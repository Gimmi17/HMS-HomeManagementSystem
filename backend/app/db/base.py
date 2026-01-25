"""
SQLAlchemy Declarative Base
Defines the base class for all SQLAlchemy models.

All database models should inherit from the Base class defined here.
This provides ORM functionality and table creation capabilities.
"""

from sqlalchemy.orm import declarative_base

# Declarative base class for all models
# All database models (User, House, Recipe, etc.) inherit from this base.
# SQLAlchemy uses this to track all models and create their tables.
#
# Usage:
#     from app.db.base import Base
#
#     class User(Base):
#         __tablename__ = "users"
#         id = Column(UUID, primary_key=True)
#         ...
Base = declarative_base()
