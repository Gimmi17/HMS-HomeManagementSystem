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
    ) -> list[DispensaItem]:
        """Get dispensa items with optional filters."""
        query = db.query(DispensaItem).filter(DispensaItem.house_id == house_id)

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
            query = query.filter(
                and_(
                    DispensaItem.expiry_date != None,
                    DispensaItem.expiry_date > today,
                    DispensaItem.expiry_date <= three_days
                )
            )

        if expired:
            query = query.filter(
                and_(
                    DispensaItem.expiry_date != None,
                    DispensaItem.expiry_date <= today
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
            barcode=data.barcode,
            grocy_product_id=data.grocy_product_id,
            grocy_product_name=data.grocy_product_name,
            source_item_id=data.source_item_id,
            added_by=user_id,
            notes=data.notes,
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
    def send_from_shopping_list(
        db: Session,
        house_id: UUID,
        user_id: UUID,
        shopping_list_id: UUID
    ) -> Dict:
        """
        Send verified items from a shopping list to the dispensa.

        Only takes items with verified_at IS NOT NULL and not_purchased = False.
        Uses verified_quantity/verified_unit if available, otherwise quantity/unit.
        Each item creates a separate row (no merge). Uses source_item_id to prevent
        duplicates when pressing "Send to Dispensa" multiple times.

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

        # Get items eligible for dispensa:
        # - Verified items (verified_at IS NOT NULL, not_purchased = False)
        # - OR checked items (checked = True) that weren't marked as not purchased
        eligible_items = db.query(ShoppingListItem).filter(
            and_(
                ShoppingListItem.shopping_list_id == shopping_list_id,
                ShoppingListItem.not_purchased == False,
                # Either verified or checked
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

            # Use verified values if available, otherwise original
            qty = sl_item.verified_quantity if sl_item.verified_quantity is not None else float(sl_item.quantity)
            unit = sl_item.verified_unit if sl_item.verified_unit else sl_item.unit

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
            )

            item = DispensaService.create_item(db, house_id, user_id, item_data)
            item.source_list_id = shopping_list_id
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
        house_id: UUID
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

        total = base_query.count()

        expiring_soon = base_query.filter(
            and_(
                DispensaItem.expiry_date != None,
                DispensaItem.expiry_date > today,
                DispensaItem.expiry_date <= three_days
            )
        ).count()

        expired = base_query.filter(
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
