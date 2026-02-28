"""
Area Service - Business Logic Layer
Handles all business logic for area management.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, extract
from typing import Optional, Dict
from uuid import UUID

from app.models.area import Area, AreaType
from app.models.dispensa import DispensaItem
from app.models.category import Category
from app.schemas.area import AreaCreate, AreaUpdate


DEFAULT_AREAS = [
    {"name": "Dispensa", "icon": "\U0001f3e0", "area_type": AreaType.FOOD_STORAGE, "position": 0},
    {"name": "Frigorifero", "icon": "\u2744\ufe0f", "area_type": AreaType.FOOD_STORAGE, "position": 1},
    {"name": "Congelatore", "icon": "\U0001f9ca", "area_type": AreaType.FOOD_STORAGE, "position": 2, "expiry_extension_enabled": True},
]


class AreaService:

    @staticmethod
    def get_areas(db: Session, house_id: UUID) -> list[Area]:
        return db.query(Area).filter(
            Area.house_id == house_id
        ).order_by(Area.position.asc(), Area.name.asc()).all()

    @staticmethod
    def get_area_by_id(db: Session, area_id: UUID, house_id: UUID) -> Optional[Area]:
        return db.query(Area).filter(
            and_(
                Area.id == area_id,
                Area.house_id == house_id
            )
        ).first()

    @staticmethod
    def create_area(db: Session, house_id: UUID, data: AreaCreate) -> Area:
        area = Area(
            house_id=house_id,
            name=data.name,
            icon=data.icon,
            area_type=data.area_type or AreaType.GENERAL,
            description=data.description,
            is_default=False,
            position=data.position or 0,
            expiry_extension_enabled=data.expiry_extension_enabled or False,
            disable_expiry_tracking=data.disable_expiry_tracking or False,
            warranty_tracking_enabled=data.warranty_tracking_enabled or False,
            default_warranty_months=data.default_warranty_months,
            trial_period_enabled=data.trial_period_enabled or False,
            default_trial_days=data.default_trial_days,
        )
        db.add(area)
        db.flush()
        return area

    @staticmethod
    def update_area(db: Session, area_id: UUID, house_id: UUID, data: AreaUpdate) -> Optional[Area]:
        area = AreaService.get_area_by_id(db, area_id, house_id)
        if not area:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(area, field, value)

        db.flush()
        return area

    @staticmethod
    def delete_area(db: Session, area_id: UUID, house_id: UUID) -> Dict:
        area = AreaService.get_area_by_id(db, area_id, house_id)
        if not area:
            return {"error": "Area non trovata"}

        if area.is_default:
            return {"error": "Non puoi eliminare un'area predefinita"}

        item_count = db.query(DispensaItem).filter(
            and_(
                DispensaItem.area_id == area_id,
                DispensaItem.is_consumed == False
            )
        ).count()

        if item_count > 0:
            return {"error": f"L'area contiene {item_count} articoli attivi. Spostali prima di eliminare."}

        db.delete(area)
        db.flush()
        return {"success": True}

    @staticmethod
    def get_item_count(db: Session, area_id: UUID) -> int:
        return db.query(DispensaItem).filter(
            and_(
                DispensaItem.area_id == area_id,
                DispensaItem.is_consumed == False
            )
        ).count()

    @staticmethod
    def seed_defaults(db: Session, house_id: UUID) -> int:
        existing = db.query(Area).filter(
            Area.house_id == house_id
        ).count()

        if existing > 0:
            return 0

        count = 0
        for area_data in DEFAULT_AREAS:
            area = Area(
                house_id=house_id,
                name=area_data["name"],
                icon=area_data["icon"],
                area_type=area_data["area_type"],
                is_default=True,
                position=area_data["position"],
                expiry_extension_enabled=area_data.get("expiry_extension_enabled", False),
            )
            db.add(area)
            count += 1

        db.flush()
        return count

    @staticmethod
    def assign_orphaned_items(db: Session, house_id: UUID) -> int:
        dispensa_area = db.query(Area).filter(
            and_(
                Area.house_id == house_id,
                Area.name == "Dispensa",
                Area.is_default == True
            )
        ).first()

        if not dispensa_area:
            return 0

        orphaned = db.query(DispensaItem).filter(
            and_(
                DispensaItem.house_id == house_id,
                DispensaItem.area_id == None
            )
        ).all()

        count = 0
        for item in orphaned:
            item.area_id = dispensa_area.id
            count += 1

        if count > 0:
            db.flush()

        return count

    @staticmethod
    def get_expense_stats(db: Session, area_id: UUID) -> Dict:
        base_query = db.query(DispensaItem).filter(
            and_(
                DispensaItem.area_id == area_id,
                DispensaItem.purchase_price != None
            )
        )

        # Total spent
        total_result = base_query.with_entities(
            func.coalesce(func.sum(DispensaItem.purchase_price), 0)
        ).scalar()
        total_spent = float(total_result)

        # By category
        by_category_query = db.query(
            DispensaItem.category_id,
            func.coalesce(Category.name, "Senza categoria").label("category_name"),
            func.sum(DispensaItem.purchase_price).label("total")
        ).outerjoin(
            Category, DispensaItem.category_id == Category.id
        ).filter(
            and_(
                DispensaItem.area_id == area_id,
                DispensaItem.purchase_price != None
            )
        ).group_by(
            DispensaItem.category_id, Category.name
        ).order_by(func.sum(DispensaItem.purchase_price).desc()).all()

        by_category = [
            {
                "category_id": str(row.category_id) if row.category_id else None,
                "category_name": row.category_name,
                "total": float(row.total),
            }
            for row in by_category_query
        ]

        # By month
        by_month_query = db.query(
            func.to_char(DispensaItem.created_at, 'YYYY-MM').label("month"),
            func.sum(DispensaItem.purchase_price).label("total")
        ).filter(
            and_(
                DispensaItem.area_id == area_id,
                DispensaItem.purchase_price != None
            )
        ).group_by(
            func.to_char(DispensaItem.created_at, 'YYYY-MM')
        ).order_by(func.to_char(DispensaItem.created_at, 'YYYY-MM').asc()).all()

        by_month = [
            {
                "month": row.month,
                "total": float(row.total),
            }
            for row in by_month_query
        ]

        return {
            "total_spent": total_spent,
            "by_category": by_category,
            "by_month": by_month,
        }
