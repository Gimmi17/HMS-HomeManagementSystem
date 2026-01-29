"""
Receipts API Endpoints

Upload, process, and reconcile receipt images with shopping lists.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
import os
import logging
import shutil

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.receipt import Receipt, ReceiptImage, ReceiptItem, ReceiptStatus, ReceiptItemMatchStatus
from app.schemas.receipt import (
    ReceiptResponse,
    ReceiptImageResponse,
    ReceiptSummary,
    ReceiptsResponse,
    ReceiptItemResponse,
    ReceiptItemUpdate,
    ReconciliationResponse,
    ReconciliationResult,
    ReconciliationSummary,
    AddExtraToListRequest,
)
from app.services.receipt_ocr import process_receipt, get_product_lines
from app.services.receipt_reconciliation import (
    reconcile_receipt_items,
    get_unmatched_shopping_items,
    get_reconciliation_summary,
)
from app.services.llm_ocr import smart_match_items, parse_receipt_with_llm
from app.services.error_logging import error_logger
from app.integrations.llm import get_llm_manager, LLMPurpose
from app.models.house import House

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/receipts")

# Base path for storing receipt images
RECEIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "receipts")


def ensure_receipts_dir():
    """Ensure the receipts directory exists"""
    os.makedirs(RECEIPTS_DIR, exist_ok=True)


def build_receipt_response(receipt: Receipt) -> ReceiptResponse:
    """Helper to build ReceiptResponse with images and items."""
    return ReceiptResponse(
        id=receipt.id,
        shopping_list_id=receipt.shopping_list_id,
        uploaded_by=receipt.uploaded_by,
        status=receipt.status,
        raw_ocr_text=receipt.raw_ocr_text,
        ocr_confidence=receipt.ocr_confidence,
        store_name_detected=receipt.store_name_detected,
        total_amount_detected=receipt.total_amount_detected,
        processed_at=receipt.processed_at,
        error_message=receipt.error_message,
        images=[
            ReceiptImageResponse(
                id=img.id,
                receipt_id=img.receipt_id,
                position=img.position,
                image_path=img.image_path,
                raw_ocr_text=img.raw_ocr_text,
                ocr_confidence=img.ocr_confidence,
                created_at=img.created_at
            )
            for img in receipt.images
        ],
        items=receipt.items,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at
    )


@router.post("/shopping-lists/{list_id}/upload", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    list_id: UUID,
    files: list[UploadFile] = File(..., description="Receipt images (JPG, PNG, WEBP) - multiple files supported for long receipts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload receipt images for a shopping list.

    Accepts multiple JPG, PNG, or WEBP images.
    For long receipts, upload images in order (top to bottom).
    Creates a receipt record with status 'uploaded'.
    """
    # Verify shopping list exists
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nessuna immagine fornita"
        )

    # Validate file types
    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo file non supportato: {file.filename}. Usa: JPG, PNG, WEBP"
            )

    # Ensure directory exists
    ensure_receipts_dir()

    # Create receipt record first
    receipt = Receipt(
        shopping_list_id=list_id,
        uploaded_by=current_user.id,
        status=ReceiptStatus.UPLOADED
    )
    db.add(receipt)
    db.flush()  # Get the receipt ID

    # Save files and create ReceiptImage records
    saved_files = []
    try:
        for idx, file in enumerate(files):
            # Generate unique filename
            ext = file.filename.split('.')[-1] if file.filename else 'jpg'
            filename = f"{receipt.id}_{idx}.{ext}"

            # Save file
            file_path = os.path.join(RECEIPTS_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append(file_path)

            # Create ReceiptImage record
            receipt_image = ReceiptImage(
                receipt_id=receipt.id,
                position=idx,
                image_path=filename
            )
            db.add(receipt_image)

        db.commit()
        db.refresh(receipt)

        logger.info(f"Receipt uploaded: {receipt.id} for list {list_id}, {len(files)} images")

    except Exception as e:
        # Cleanup saved files on error
        for fp in saved_files:
            if os.path.exists(fp):
                os.remove(fp)
        db.rollback()
        logger.error(f"Failed to save receipt images: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Errore nel salvataggio delle immagini"
        )

    return build_receipt_response(receipt)


@router.post("/{receipt_id}/process", response_model=ReceiptResponse)
async def process_receipt_ocr(
    receipt_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process receipt images with OCR.

    Uses EasyOCR for text extraction, then LLM to interpret and structure products.
    Processes all images in order and concatenates the text.
    Updates receipt status to 'processed' or 'error'.
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scontrino non trovato"
        )

    # Check if already processed
    if receipt.status in [ReceiptStatus.PROCESSED, ReceiptStatus.RECONCILED]:
        return build_receipt_response(receipt)

    # Check if has images
    if not receipt.images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nessuna immagine caricata per questo scontrino"
        )

    # Update status to processing
    receipt.status = ReceiptStatus.PROCESSING
    db.commit()

    # Try to get LLM client for product parsing
    llm_client = None
    shopping_list = db.query(ShoppingList).filter(
        ShoppingList.id == receipt.shopping_list_id
    ).first()

    if shopping_list and shopping_list.house_id:
        house = db.query(House).filter(House.id == shopping_list.house_id).first()
        if house and house.settings:
            manager = get_llm_manager()
            manager.load_from_settings(house.settings)
            llm_client = manager.get_client_for_purpose(LLMPurpose.OCR)
            if llm_client:
                logger.info(f"Using LLM for product parsing: {llm_client.connection.name}")

    try:
        # Step 1: Use EasyOCR for raw text extraction
        all_raw_text = []
        all_confidences = []
        store_name = None
        total_amount = None

        for receipt_image in sorted(receipt.images, key=lambda x: x.position):
            image_path = os.path.join(RECEIPTS_DIR, receipt_image.image_path)

            # Use EasyOCR service for text extraction
            ocr_result = process_receipt(image_path)

            receipt_image.raw_ocr_text = ocr_result.raw_text
            receipt_image.ocr_confidence = ocr_result.average_confidence

            all_raw_text.append(ocr_result.raw_text)
            all_confidences.append(ocr_result.average_confidence)

            if not store_name and ocr_result.store_name:
                store_name = ocr_result.store_name
            if ocr_result.total_amount:
                total_amount = ocr_result.total_amount

        # Combine all OCR text
        combined_raw_text = "\n".join(all_raw_text)

        # Save OCR results
        receipt.raw_ocr_text = combined_raw_text
        receipt.ocr_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        receipt.store_name_detected = store_name
        receipt.total_amount_detected = total_amount
        receipt.processed_at = datetime.now(timezone.utc)

        # Step 2: Use LLM to parse products from raw text
        all_product_lines = []

        if llm_client and combined_raw_text.strip():
            try:
                logger.info("Sending OCR text to LLM for product parsing...")
                llm_products = await parse_receipt_with_llm(combined_raw_text, llm_client)

                if llm_products:
                    logger.info(f"LLM parsed {len(llm_products)} products")
                    all_product_lines = llm_products
                else:
                    logger.warning("LLM returned no products, using EasyOCR fallback")

            except Exception as e:
                logger.warning(f"LLM parsing failed: {e}, using EasyOCR fallback")

        # Fallback: use EasyOCR's product parsing if LLM didn't work
        if not all_product_lines:
            logger.info("Using EasyOCR product parsing as fallback")
            for receipt_image in sorted(receipt.images, key=lambda x: x.position):
                image_path = os.path.join(RECEIPTS_DIR, receipt_image.image_path)
                ocr_result = process_receipt(image_path)
                product_lines = get_product_lines(ocr_result)
                all_product_lines.extend(product_lines)

        receipt.status = ReceiptStatus.PROCESSED

        # Create receipt items from product lines
        for idx, line in enumerate(all_product_lines):
            item = ReceiptItem(
                receipt_id=receipt.id,
                position=idx,
                raw_text=getattr(line, 'raw_text', ''),
                parsed_name=getattr(line, 'parsed_name', None),
                parsed_quantity=getattr(line, 'parsed_quantity', None),
                parsed_unit_price=getattr(line, 'parsed_unit_price', None),
                parsed_total_price=getattr(line, 'parsed_total_price', None),
                match_status=ReceiptItemMatchStatus.UNMATCHED
            )
            db.add(item)

        db.commit()
        db.refresh(receipt)

        logger.info(f"Receipt processed: {receipt.id}, {len(all_product_lines)} items from {len(receipt.images)} images")

    except Exception as e:
        logger.error(f"OCR processing failed for receipt {receipt_id}: {e}")
        receipt.status = ReceiptStatus.ERROR
        receipt.error_message = str(e)
        db.commit()

        error_logger.log_error(
            e,
            request=request,
            user=current_user,
            severity="error",
            context={
                "operation": "process_receipt_ocr",
                "receipt_id": str(receipt_id)
            }
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nell'elaborazione OCR: {str(e)}"
        )

    return build_receipt_response(receipt)


@router.post("/{receipt_id}/reconcile", response_model=ReconciliationResponse)
async def reconcile_receipt(
    receipt_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reconcile receipt items with shopping list items.

    Matches extracted items against the shopping list using fuzzy matching.
    When LLM is configured, uses AI to interpret abbreviated item names.
    Returns match results and summary.
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scontrino non trovato"
        )

    if receipt.status not in [ReceiptStatus.PROCESSED, ReceiptStatus.RECONCILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lo scontrino deve essere prima elaborato"
        )

    # Get shopping list with house
    shopping_list = db.query(ShoppingList).filter(
        ShoppingList.id == receipt.shopping_list_id
    ).first()

    # Get shopping list items
    shopping_list_items = db.query(ShoppingListItem).filter(
        ShoppingListItem.shopping_list_id == receipt.shopping_list_id
    ).all()

    # Get receipt items
    receipt_items = db.query(ReceiptItem).filter(
        ReceiptItem.receipt_id == receipt_id
    ).order_by(ReceiptItem.position).all()

    if not receipt_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nessun articolo estratto dallo scontrino"
        )

    try:
        # Try to get LLM hints for better matching
        llm_hints = {}
        if shopping_list and shopping_list.house_id:
            house = db.query(House).filter(House.id == shopping_list.house_id).first()
            if house and house.settings:
                # Load LLM connections from house settings
                manager = get_llm_manager()
                manager.load_from_settings(house.settings)

                # Get OCR client
                ocr_client = manager.get_client_for_purpose(LLMPurpose.OCR)
                if ocr_client:
                    # Prepare item names for LLM
                    receipt_names = [
                        item.parsed_name or item.raw_text
                        for item in receipt_items
                    ]
                    shopping_names = [item.name for item in shopping_list_items]

                    # Get LLM suggestions
                    try:
                        llm_results = await smart_match_items(
                            receipt_names,
                            shopping_names,
                            ocr_client
                        )
                        # Build hints dict: receipt_name -> (suggested_match, confidence, interpreted_name)
                        for r in llm_results:
                            if r.receipt_item and r.suggested_match:
                                llm_hints[r.receipt_item] = {
                                    "match": r.suggested_match,
                                    "confidence": r.confidence,
                                    "interpreted": r.interpreted_name
                                }
                        logger.info(f"LLM provided {len(llm_hints)} match hints")
                    except Exception as e:
                        logger.warning(f"LLM matching failed, falling back to fuzzy: {e}")

        # Run reconciliation with optional LLM hints
        match_results = reconcile_receipt_items(receipt_items, shopping_list_items, llm_hints)

        # Update receipt items with match results
        for result in match_results:
            item = db.query(ReceiptItem).filter(ReceiptItem.id == result.receipt_item_id).first()
            if item:
                item.match_status = result.match_status
                item.shopping_list_item_id = result.shopping_list_item_id if result.shopping_list_item_id else None
                item.match_confidence = result.confidence

        # Update receipt status
        receipt.status = ReceiptStatus.RECONCILED
        db.commit()

        # Get summary
        summary_data = get_reconciliation_summary(receipt_items, shopping_list_items, match_results)

        # Get missing items
        missing_items = get_unmatched_shopping_items(shopping_list_items, match_results)
        missing_items_data = [
            {
                "id": str(item.id),
                "name": item.name,
                "quantity": item.quantity,
                "unit": item.unit
            }
            for item in missing_items
        ]

        # Build response
        results = [
            ReconciliationResult(
                receipt_item_id=result.receipt_item_id,
                shopping_list_item_id=result.shopping_list_item_id if result.shopping_list_item_id else None,
                match_status=result.match_status,
                confidence=result.confidence,
                matched_name=result.matched_name
            )
            for result in match_results
        ]

        summary = ReconciliationSummary(
            total_receipt_items=summary_data["total_receipt_items"],
            total_shopping_items=summary_data["total_shopping_items"],
            matched_count=summary_data["matched_count"],
            suggested_count=summary_data["suggested_count"],
            extra_count=summary_data["extra_count"],
            missing_count=summary_data["missing_count"],
            match_rate=summary_data["match_rate"]
        )

        logger.info(f"Receipt reconciled: {receipt_id}, {summary.matched_count}/{summary.total_shopping_items} matched")

        return ReconciliationResponse(
            receipt_id=receipt_id,
            results=results,
            summary=summary,
            missing_items=missing_items_data
        )

    except Exception as e:
        logger.error(f"Reconciliation failed for receipt {receipt_id}: {e}")
        db.rollback()

        error_logger.log_error(
            e,
            request=request,
            user=current_user,
            severity="error",
            context={
                "operation": "reconcile_receipt",
                "receipt_id": str(receipt_id)
            }
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nella riconciliazione: {str(e)}"
        )


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a receipt with all its items.
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scontrino non trovato"
        )

    return build_receipt_response(receipt)


@router.get("/shopping-lists/{list_id}", response_model=ReceiptsResponse)
async def get_receipts_for_list(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all receipts for a shopping list.
    """
    # Verify shopping list exists
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    receipts = db.query(Receipt).filter(
        Receipt.shopping_list_id == list_id
    ).order_by(Receipt.created_at.desc()).all()

    summaries = []
    for receipt in receipts:
        image_count = len(receipt.images)
        item_count = len(receipt.items)
        matched_count = sum(1 for item in receipt.items if item.match_status == ReceiptItemMatchStatus.MATCHED)

        summaries.append(ReceiptSummary(
            id=receipt.id,
            shopping_list_id=receipt.shopping_list_id,
            status=receipt.status,
            store_name_detected=receipt.store_name_detected,
            total_amount_detected=receipt.total_amount_detected,
            image_count=image_count,
            item_count=item_count,
            matched_count=matched_count,
            created_at=receipt.created_at
        ))

    return ReceiptsResponse(
        receipts=summaries,
        total=len(summaries)
    )


@router.put("/items/{item_id}", response_model=ReceiptItemResponse)
async def update_receipt_item(
    item_id: UUID,
    data: ReceiptItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a receipt item (user correction).
    """
    item = db.query(ReceiptItem).filter(ReceiptItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.post("/{receipt_id}/add-extra-to-list", response_model=dict)
async def add_extra_items_to_list(
    receipt_id: UUID,
    data: AddExtraToListRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add extra receipt items to the shopping list.

    Takes items marked as 'extra' (not originally in list) and adds them
    to the shopping list for future reference.
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scontrino non trovato"
        )

    shopping_list = db.query(ShoppingList).filter(
        ShoppingList.id == receipt.shopping_list_id
    ).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    # Get max position in shopping list
    from sqlalchemy import func
    max_position = db.query(func.max(ShoppingListItem.position)).filter(
        ShoppingListItem.shopping_list_id == shopping_list.id
    ).scalar() or -1

    added_items = []
    for item_id in data.receipt_item_ids:
        receipt_item = db.query(ReceiptItem).filter(ReceiptItem.id == item_id).first()
        if receipt_item and receipt_item.receipt_id == receipt.id:
            # Create shopping list item
            max_position += 1
            item_name = receipt_item.user_corrected_name or receipt_item.parsed_name or receipt_item.raw_text

            shopping_item = ShoppingListItem(
                shopping_list_id=shopping_list.id,
                position=max_position,
                name=item_name,
                quantity=int(receipt_item.parsed_quantity or 1),
                unit=None,
                checked=True,  # Mark as already purchased
            )
            db.add(shopping_item)
            added_items.append(item_name)

            # Link receipt item to new shopping item
            db.flush()
            receipt_item.shopping_list_item_id = shopping_item.id
            receipt_item.match_status = ReceiptItemMatchStatus.MATCHED

    db.commit()

    logger.info(f"Added {len(added_items)} extra items to list {shopping_list.id}")

    return {
        "success": True,
        "added_count": len(added_items),
        "added_items": added_items
    }


@router.post("/{receipt_id}/images", response_model=ReceiptResponse)
async def add_receipt_images(
    receipt_id: UUID,
    files: list[UploadFile] = File(..., description="Additional receipt images"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add more images to an existing receipt.

    Images are added to the end of the existing images.
    Receipt must be in 'uploaded' status (not yet processed).
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scontrino non trovato"
        )

    # Can only add images if not yet processed
    if receipt.status not in [ReceiptStatus.UPLOADED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non puoi aggiungere immagini a uno scontrino già elaborato"
        )

    # Validate file types
    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo file non supportato: {file.filename}. Usa: JPG, PNG, WEBP"
            )

    # Get current max position
    current_max_position = max([img.position for img in receipt.images], default=-1)

    # Save new files
    ensure_receipts_dir()
    saved_files = []

    try:
        for idx, file in enumerate(files):
            position = current_max_position + 1 + idx
            ext = file.filename.split('.')[-1] if file.filename else 'jpg'
            filename = f"{receipt.id}_{position}.{ext}"

            file_path = os.path.join(RECEIPTS_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append(file_path)

            receipt_image = ReceiptImage(
                receipt_id=receipt.id,
                position=position,
                image_path=filename
            )
            db.add(receipt_image)

        db.commit()
        db.refresh(receipt)

        logger.info(f"Added {len(files)} images to receipt {receipt_id}")

    except Exception as e:
        for fp in saved_files:
            if os.path.exists(fp):
                os.remove(fp)
        db.rollback()
        logger.error(f"Failed to add receipt images: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Errore nel salvataggio delle immagini"
        )

    return build_receipt_response(receipt)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a receipt and all its images.
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scontrino non trovato"
        )

    # Delete all image files
    for receipt_image in receipt.images:
        image_path = os.path.join(RECEIPTS_DIR, receipt_image.image_path)
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                logger.warning(f"Failed to delete receipt image: {e}")

    db.delete(receipt)
    db.commit()

    logger.info(f"Receipt deleted: {receipt_id}")
