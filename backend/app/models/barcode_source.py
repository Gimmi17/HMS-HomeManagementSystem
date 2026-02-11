"""
Barcode Lookup Source Model

Configurable API sources for barcode product lookup.
Supports fallback chain: tries sources in sort_order until a result is found.
"""

from sqlalchemy import Column, String, Boolean, Integer

from app.models.base import BaseModel


class BarcodeLookupSource(BaseModel):
    __tablename__ = "barcode_lookup_sources"

    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, unique=True)
    base_url = Column(String(500), nullable=False)
    api_path = Column(String(200), nullable=False)
    is_hardcoded = Column(Boolean, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    cancelled = Column(Boolean, default=False)
    description = Column(String(500), nullable=True)
