"""
Dispensa Service - Business Logic Layer
Handles all business logic for dispensa (pantry) management.

Key responsibilities:
- CRUD operations for dispensa items (individual stock entries, no merge)
- Consumption tracking (total/partial)
- Import from verified shopping lists with source_item_id tracking
- Sync from shopping list item changes
- Expiry statistics
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict
from datetime import datetime, date, timedelta, timezone
from uuid import UUID

from app.models.dispensa import DispensaItem
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.product_catalog import ProductCatalog
from app.models.product_barcode import ProductBarcode
from app.models.category import Category
from app.models.area import Area
from app.schemas.dispensa import DispensaItemCreate, DispensaItemUpdate


class DispensaService:

    @staticmethod
    def get_items(
        db: Session,
        house_id: UUID,
        search: Optional[str] = None,
        category_id: Optional[UUID] = None,
        expiring: bool = False,
        expired: bool = False,
        consumed: bool = False,
        show_all: bool = False,
        area_id: Optional[UUID] = None,
    ) -> list[DispensaItem]:
        """Get dispensa items with optional filters."""
        query = db.query(DispensaItem).filter(DispensaItem.house_id == house_id)

        if area_id:
            query = query.filter(DispensaItem.area_id == area_id)

        if not show_all:
            if consumed:
                query = query.filter(DispensaItem.is_consumed == True)
            else:
                query = query.filter(DispensaItem.is_consumed == False)

        if search:
            query = query.filter(DispensaItem.name.ilike(f"%{search}%"))

        if category_id:
            query = query.filter(DispensaItem.category_id == category_id)

        today = date.today()

        if expiring:
            three_days = today + timedelta(days=3)
            query = query.outerjoin(Area, DispensaItem.area_id == Area.id).filter(
                and_(
                    DispensaItem.expiry_date != None,
                    DispensaItem.expiry_date > today,
                    DispensaItem.expiry_date <= three_days,
                    (Area.disable_expiry_tracking == False) | (Area.id == None)
                )
            )

        if expired:
            query = query.outerjoin(Area, DispensaItem.area_id == Area.id).filter(
                and_(
                    DispensaItem.expiry_date != None,
                    DispensaItem.expiry_date <= today,
                    (Area.disable_expiry_tracking == False) | (Area.id == None)
                )
            )

        # Sort: expired first, then expiring soon, then by name
        query = query.order_by(
            DispensaItem.is_consumed.asc(),
            DispensaItem.expiry_date.asc().nullslast(),
            DispensaItem.name.asc()
        )

        return query.all()

    @staticmethod
    def get_item_by_id(
        db: Session,
        item_id: UUID,
        house_id: UUID
    ) -> Optional[DispensaItem]:
        """Get a single item by ID."""
        return db.query(DispensaItem).filter(
            and_(
                DispensaItem.id == item_id,
                DispensaItem.house_id == house_id
            )
        ).first()

    @staticmethod
    def create_item(
        db: Session,
        house_id: UUID,
        user_id: UUID,
        data: DispensaItemCreate
    ) -> DispensaItem:
        """
        Create a dispensa item.
        Always creates a new row (no merge). Each entry is an individual stock entry.
        """
        item = DispensaItem(
            house_id=house_id,
            name=data.name,
            quantity=data.quantity,
            unit=data.unit,
            category_id=data.category_id,
            expiry_date=data.expiry_date,
            original_expiry_date=data.original_expiry_date,
            barcode=data.barcode,
            grocy_product_id=data.grocy_product_id,
            grocy_product_name=data.grocy_product_name,
            source_item_id=data.source_item_id,
            area_id=data.area_id,
            purchase_price=data.purchase_price,
            added_by=user_id,
            notes=data.notes,
            warranty_expiry_date=data.warranty_expiry_date,
            trial_expiry_date=data.trial_expiry_date,
        )
        db.add(item)
        db.flush()
        return item

    @staticmethod
    def update_item(
        db: Session,
        item_id: UUID,
        house_id: UUID,
        data: DispensaItemUpdate
    ) -> Optional[DispensaItem]:
        """Update a dispensa item."""
        item = DispensaService.get_item_by_id(db, item_id, house_id)
        if not item:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        db.flush()
        return item

    @staticmethod
    def delete_item(
        db: Session,
        item_id: UUID,
        house_id: UUID
    ) -> bool:
        """Delete a dispensa item."""
        item = DispensaService.get_item_by_id(db, item_id, house_id)
        if not item:
            return False

        db.delete(item)
        db.flush()
        return True

    @staticmethod
    def consume_item(
        db: Session,
        item_id: UUID,
        house_id: UUID,
        quantity: Optional[float] = None
    ) -> Optional[DispensaItem]:
        """
        Consume an item (total or partial).
        - If quantity is None or >= item.quantity: mark as fully consumed
        - If quantity < item.quantity: reduce quantity
        """
        item = DispensaService.get_item_by_id(db, item_id, house_id)
        if not item:
            return None

        if quantity is None or quantity >= item.quantity:
            item.is_consumed = True
            item.consumed_at = datetime.now(timezone.utc)
        else:
            item.quantity -= quantity

        db.flush()
        return item

    @staticmethod
    def unconsume_item(
        db: Session,
        item_id: UUID,
        house_id: UUID
    ) -> Optional[DispensaItem]:
        """Restore a consumed item."""
        item = DispensaService.get_item_by_id(db, item_id, house_id)
        if not item:
            return None

        item.is_consumed = False
        item.consumed_at = None
        db.flush()
        return item

    @staticmethod
    def _resolve_area_for_item(
        db: Session,
        sl_item: ShoppingListItem,
    ) -> Optional[UUID]:
        """
        Resolve the area for a shopping list item using the fallback chain:
        1. Barcode → ProductCatalog → ProductCategoryTag.default_area_id
        2. item.category_id → Category.default_area_id
        3. None (user must choose)
        """
        # 1. Try barcode → product → category tag default area
        if sl_item.scanned_barcode:
            product = db.query(ProductCatalog).join(
                ProductBarcode, ProductCatalog.id == ProductBarcode.product_id
            ).filter(
                ProductBarcode.barcode == sl_item.scanned_barcode,
                ProductCatalog.cancelled == False
            ).first()
            if product and product.category_tags:
                for tag in product.category_tags:
                    if tag.default_area_id:
                        return tag.default_area_id

        # 2. Try category → default_area_id
        if sl_item.category_id:
            category = db.query(Category).filter(Category.id == sl_item.category_id).first()
            if category and category.default_area_id:
                return category.default_area_id

        return None

    @staticmethod
    def _auto_create_product_catalog(
        db: Session,
        house_id: UUID,
        sl_item: ShoppingListItem,
    ) -> None:
        """
        Auto-create a ProductCatalog entry for items with a scanned barcode
        that don't yet have a product in the catalog.
        """
        if not sl_item.scanned_barcode:
            return

        # Check if product already exists for this barcode
        existing = db.query(ProductBarcode).filter(
            ProductBarcode.barcode == sl_item.scanned_barcode
        ).first()
        if existing:
            return

        # Create a minimal product catalog entry
        product = ProductCatalog(
            house_id=house_id,
            barcode=sl_item.scanned_barcode,
            name=sl_item.grocy_product_name or sl_item.name,
            category_id=sl_item.category_id,
            source="auto",
        )
        db.add(product)
        db.flush()

        # Create the barcode association
        barcode_entry = ProductBarcode(
            product_id=product.id,
            barcode=sl_item.scanned_barcode,
            is_primary=True,
            source="auto",
        )
        db.add(barcode_entry)
        db.flush()

    @staticmethod
    def preview_from_shopping_list(
        db: Session,
        house_id: UUID,
        shopping_list_id: UUID,
    ) -> Optional[Dict]:
        """
        Preview items from a shopping list before sending to dispensa.
        Returns items with resolved areas and the list of available areas.
        """
        shopping_list = db.query(ShoppingList).filter(
            and_(
                ShoppingList.id == shopping_list_id,
                ShoppingList.house_id == house_id
            )
        ).first()

        if not shopping_list:
            return None

        # Get eligible items (verified or checked, not not_purchased)
        eligible_items = db.query(ShoppingListItem).filter(
            and_(
                ShoppingListItem.shopping_list_id == shopping_list_id,
                ShoppingListItem.not_purchased == False,
                (ShoppingListItem.verified_at != None) | (ShoppingListItem.checked == True)
            )
        ).all()

        # Get all food_storage areas for this house
        areas = db.query(Area).filter(
            and_(
                Area.house_id == house_id,
                Area.area_type == "food_storage",
            )
        ).order_by(Area.position).all()

        area_map = {a.id: a for a in areas}

        # Build category name map for items that have category_id
        category_ids = {sl_item.category_id for sl_item in eligible_items if sl_item.category_id}
        category_map = {}
        if category_ids:
            cats = db.query(Category).filter(Category.id.in_(category_ids)).all()
            category_map = {c.id: c.name for c in cats}

        items = []
        for sl_item in eligible_items:
            qty = sl_item.verified_quantity if sl_item.verified_quantity is not None else float(sl_item.quantity)
            unit = sl_item.verified_unit if sl_item.verified_unit else sl_item.unit

            resolved_area_id = DispensaService._resolve_area_for_item(db, sl_item)
            area_name = area_map[resolved_area_id].name if resolved_area_id and resolved_area_id in area_map else None

            items.append({
                "item_id": sl_item.id,
                "name": sl_item.grocy_product_name or sl_item.name,
                "quantity": qty,
                "unit": unit,
                "category_name": category_map.get(sl_item.category_id) if sl_item.category_id else None,
                "area_id": resolved_area_id,
                "area_name": area_name,
            })

        area_list = [
            {
                "id": a.id,
                "name": a.name,
                "icon": a.icon,
                "expiry_extension_enabled": a.expiry_extension_enabled,
                "disable_expiry_tracking": a.disable_expiry_tracking,
                "warranty_tracking_enabled": a.warranty_tracking_enabled,
                "default_warranty_months": a.default_warranty_months,
                "trial_period_enabled": a.trial_period_enabled,
                "default_trial_days": a.default_trial_days,
            }
            for a in areas
        ]

        return {"items": items, "areas": area_list}

    @staticmethod
    def send_from_shopping_list(
        db: Session,
        house_id: UUID,
        user_id: UUID,
        shopping_list_id: UUID,
        item_areas: Optional[Dict[str, str]] = None,
        item_expiry_extensions: Optional[Dict[str, int]] = None,
    ) -> Dict:
        """
        Send verified items from a shopping list to the dispensa.

        Only takes items with verified_at IS NOT NULL and not_purchased = False.
        Uses verified_quantity/verified_unit if available, otherwise quantity/unit.
        Each item creates a separate row (no merge). Uses source_item_id to prevent
        duplicates when pressing "Send to Dispensa" multiple times.

        Auto-creates ProductCatalog entries for items with barcodes not yet in catalog.

        Returns dict with count of items sent.
        """
        # Verify the shopping list belongs to the house
        shopping_list = db.query(ShoppingList).filter(
            and_(
                ShoppingList.id == shopping_list_id,
                ShoppingList.house_id == house_id
            )
        ).first()

        if not shopping_list:
            return {"count": 0, "error": "Lista non trovata"}

        # Get items eligible for dispensa
        eligible_items = db.query(ShoppingListItem).filter(
            and_(
                ShoppingListItem.shopping_list_id == shopping_list_id,
                ShoppingListItem.not_purchased == False,
                (ShoppingListItem.verified_at != None) | (ShoppingListItem.checked == True)
            )
        ).all()

        count = 0
        skipped = 0
        for sl_item in eligible_items:
            # Check if a dispensa item already exists for this source item (dedup)
            existing = db.query(DispensaItem).filter(
                DispensaItem.source_item_id == sl_item.id
            ).first()
            if existing:
                skipped += 1
                continue

            # Auto-create product catalog entry if needed
            DispensaService._auto_create_product_catalog(db, house_id, sl_item)

            # Use verified values if available, otherwise original
            qty = sl_item.verified_quantity if sl_item.verified_quantity is not None else float(sl_item.quantity)
            unit = sl_item.verified_unit if sl_item.verified_unit else sl_item.unit

            # Resolve area: explicit override → auto-resolve
            resolved_area_id = None
            item_id_str = str(sl_item.id)
            if item_areas and item_id_str in item_areas:
                resolved_area_id = UUID(item_areas[item_id_str])
            else:
                resolved_area_id = DispensaService._resolve_area_for_item(db, sl_item)

            item_data = DispensaItemCreate(
                name=sl_item.grocy_product_name or sl_item.name,
                quantity=qty,
                unit=unit,
                category_id=sl_item.category_id,
                expiry_date=sl_item.expiry_date,
                barcode=sl_item.scanned_barcode,
                grocy_product_id=sl_item.grocy_product_id,
                grocy_product_name=sl_item.grocy_product_name,
                source_item_id=sl_item.id,
                area_id=resolved_area_id,
            )

            item = DispensaService.create_item(db, house_id, user_id, item_data)
            item.source_list_id = shopping_list_id

            # Apply expiry extension if requested
            if item_expiry_extensions and item.expiry_date:
                item_id_str = str(sl_item.id)
                if item_id_str in item_expiry_extensions:
                    extension_days = item_expiry_extensions[item_id_str]
                    if extension_days > 0:
                        item.original_expiry_date = item.expiry_date
                        item.expiry_date = item.expiry_date + timedelta(days=extension_days)

            count += 1

        return {"count": count, "skipped": skipped}

    @staticmethod
    def sync_from_source_item(
        db: Session,
        source_item_id: UUID
    ) -> Optional[DispensaItem]:
        """
        Sync a dispensa item from its source shopping list item.

        Updates name, quantity, unit, expiry_date, category_id, barcode,
        grocy fields from the source item. If the source item is marked
        not_purchased, deletes the dispensa item.
        """
        dispensa_item = db.query(DispensaItem).filter(
            DispensaItem.source_item_id == source_item_id
        ).first()

        if not dispensa_item:
            return None

        # Load the source shopping list item
        sl_item = db.query(ShoppingListItem).filter(
            ShoppingListItem.id == source_item_id
        ).first()

        if not sl_item:
            return None

        # If source item marked not_purchased, remove from dispensa
        if sl_item.not_purchased:
            db.delete(dispensa_item)
            db.flush()
            return None

        # Sync fields from source
        dispensa_item.name = sl_item.grocy_product_name or sl_item.name
        dispensa_item.quantity = sl_item.verified_quantity if sl_item.verified_quantity is not None else float(sl_item.quantity)
        dispensa_item.unit = sl_item.verified_unit if sl_item.verified_unit else sl_item.unit
        dispensa_item.expiry_date = sl_item.expiry_date
        dispensa_item.category_id = sl_item.category_id
        dispensa_item.barcode = sl_item.scanned_barcode
        dispensa_item.grocy_product_id = sl_item.grocy_product_id
        dispensa_item.grocy_product_name = sl_item.grocy_product_name

        db.flush()
        return dispensa_item

    @staticmethod
    def delete_by_source_item(
        db: Session,
        source_item_id: UUID
    ) -> bool:
        """
        Delete the dispensa item linked to a source shopping list item.
        Called when the source item is deleted from the shopping list.
        """
        dispensa_item = db.query(DispensaItem).filter(
            DispensaItem.source_item_id == source_item_id
        ).first()

        if not dispensa_item:
            return False

        db.delete(dispensa_item)
        db.flush()
        return True

    @staticmethod
    def get_stats(
        db: Session,
        house_id: UUID,
        area_id: Optional[UUID] = None
    ) -> Dict:
        """Get dispensa statistics."""
        today = date.today()
        three_days = today + timedelta(days=3)

        base_query = db.query(DispensaItem).filter(
            and_(
                DispensaItem.house_id == house_id,
                DispensaItem.is_consumed == False
            )
        )

        if area_id:
            base_query = base_query.filter(DispensaItem.area_id == area_id)

        total = base_query.count()

        # For expiry stats, exclude items in areas with disable_expiry_tracking
        expiry_query = base_query.outerjoin(Area, DispensaItem.area_id == Area.id).filter(
            (Area.disable_expiry_tracking == False) | (Area.id == None)
        )

        expiring_soon = expiry_query.filter(
            and_(
                DispensaItem.expiry_date != None,
                DispensaItem.expiry_date > today,
                DispensaItem.expiry_date <= three_days
            )
        ).count()

        expired = expiry_query.filter(
            and_(
                DispensaItem.expiry_date != None,
                DispensaItem.expiry_date <= today
            )
        ).count()

        return {
            "total": total,
            "expiring_soon": expiring_soon,
            "expired": expired,
        }
