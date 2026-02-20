"""
Environment Service - Business Logic Layer
Handles all business logic for environment management.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, extract
from typing import Optional, Dict
from uuid import UUID

from app.models.environment import Environment, EnvironmentType
from app.models.dispensa import DispensaItem
from app.models.category import Category
from app.schemas.environment import EnvironmentCreate, EnvironmentUpdate


DEFAULT_ENVIRONMENTS = [
    {"name": "Dispensa", "icon": "\U0001f3e0", "env_type": EnvironmentType.FOOD_STORAGE, "position": 0},
    {"name": "Frigorifero", "icon": "\u2744\ufe0f", "env_type": EnvironmentType.FOOD_STORAGE, "position": 1},
    {"name": "Congelatore", "icon": "\U0001f9ca", "env_type": EnvironmentType.FOOD_STORAGE, "position": 2},
]


class EnvironmentService:

    @staticmethod
    def get_environments(db: Session, house_id: UUID) -> list[Environment]:
        return db.query(Environment).filter(
            Environment.house_id == house_id
        ).order_by(Environment.position.asc(), Environment.name.asc()).all()

    @staticmethod
    def get_environment_by_id(db: Session, env_id: UUID, house_id: UUID) -> Optional[Environment]:
        return db.query(Environment).filter(
            and_(
                Environment.id == env_id,
                Environment.house_id == house_id
            )
        ).first()

    @staticmethod
    def create_environment(db: Session, house_id: UUID, data: EnvironmentCreate) -> Environment:
        env = Environment(
            house_id=house_id,
            name=data.name,
            icon=data.icon,
            env_type=data.env_type or EnvironmentType.GENERAL,
            description=data.description,
            is_default=False,
            position=data.position or 0,
        )
        db.add(env)
        db.flush()
        return env

    @staticmethod
    def update_environment(db: Session, env_id: UUID, house_id: UUID, data: EnvironmentUpdate) -> Optional[Environment]:
        env = EnvironmentService.get_environment_by_id(db, env_id, house_id)
        if not env:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(env, field, value)

        db.flush()
        return env

    @staticmethod
    def delete_environment(db: Session, env_id: UUID, house_id: UUID) -> Dict:
        env = EnvironmentService.get_environment_by_id(db, env_id, house_id)
        if not env:
            return {"error": "Ambiente non trovato"}

        if env.is_default:
            return {"error": "Non puoi eliminare un ambiente predefinito"}

        item_count = db.query(DispensaItem).filter(
            and_(
                DispensaItem.environment_id == env_id,
                DispensaItem.is_consumed == False
            )
        ).count()

        if item_count > 0:
            return {"error": f"L'ambiente contiene {item_count} articoli attivi. Spostali prima di eliminare."}

        db.delete(env)
        db.flush()
        return {"success": True}

    @staticmethod
    def get_item_count(db: Session, env_id: UUID) -> int:
        return db.query(DispensaItem).filter(
            and_(
                DispensaItem.environment_id == env_id,
                DispensaItem.is_consumed == False
            )
        ).count()

    @staticmethod
    def seed_defaults(db: Session, house_id: UUID) -> int:
        existing = db.query(Environment).filter(
            Environment.house_id == house_id
        ).count()

        if existing > 0:
            return 0

        count = 0
        for env_data in DEFAULT_ENVIRONMENTS:
            env = Environment(
                house_id=house_id,
                name=env_data["name"],
                icon=env_data["icon"],
                env_type=env_data["env_type"],
                is_default=True,
                position=env_data["position"],
            )
            db.add(env)
            count += 1

        db.flush()
        return count

    @staticmethod
    def assign_orphaned_items(db: Session, house_id: UUID) -> int:
        dispensa_env = db.query(Environment).filter(
            and_(
                Environment.house_id == house_id,
                Environment.name == "Dispensa",
                Environment.is_default == True
            )
        ).first()

        if not dispensa_env:
            return 0

        orphaned = db.query(DispensaItem).filter(
            and_(
                DispensaItem.house_id == house_id,
                DispensaItem.environment_id == None
            )
        ).all()

        count = 0
        for item in orphaned:
            item.environment_id = dispensa_env.id
            count += 1

        if count > 0:
            db.flush()

        return count

    @staticmethod
    def get_expense_stats(db: Session, environment_id: UUID) -> Dict:
        base_query = db.query(DispensaItem).filter(
            and_(
                DispensaItem.environment_id == environment_id,
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
                DispensaItem.environment_id == environment_id,
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
                DispensaItem.environment_id == environment_id,
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
