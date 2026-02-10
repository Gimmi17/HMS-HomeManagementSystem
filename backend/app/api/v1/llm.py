"""
LLM Configuration API

Endpoints for managing LLM connections and testing them.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.house import House
from app.models.user_house import UserHouse
from app.integrations.llm import (
    LLMConnection,
    LLMPurpose,
    LLMType,
    get_llm_manager,
    test_connection,
    check_connection_health,
)

router = APIRouter(prefix="/llm", tags=["LLM"])


# =============================================================================
# Helper Functions
# =============================================================================

def verify_house_membership(db: Session, user_id, house_id) -> House:
    """Verify user belongs to house and return the house"""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non sei membro di questa casa"
        )

    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Casa non trovata"
        )
    return house


def get_llm_settings(house: House) -> list[dict]:
    """Get LLM connections from house settings"""
    settings = house.settings or {}
    return settings.get("llm_connections", [])


def save_llm_settings(db: Session, house: House, connections: list[dict]):
    """Save LLM connections to house settings"""
    settings = dict(house.settings or {})
    settings["llm_connections"] = connections
    house.settings = settings
    db.commit()

    # Update manager
    manager = get_llm_manager()
    manager.load_from_settings(settings)


# =============================================================================
# Pydantic Schemas
# =============================================================================

class LLMConnectionCreate(BaseModel):
    """Schema for creating a new LLM connection"""
    name: str = Field(..., min_length=1, max_length=100, description="Display name")
    url: str = Field(..., description="Base URL (e.g., http://localhost:8080)")
    model: str = Field(default="default", description="Model name/id")
    purpose: str = Field(default="general", description="Purpose: ocr, chat, suggestions, general")
    connection_type: str = Field(default="openai", description="API type: openai, docext")
    enabled: bool = Field(default=True)
    timeout: float = Field(default=30.0, ge=5.0, le=300.0)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=500, ge=10, le=4096)
    api_key: Optional[str] = Field(default=None, description="API key if required")
    # DocExt specific
    docext_auth_user: str = Field(default="admin", description="DocExt Gradio username")
    docext_auth_pass: str = Field(default="admin", description="DocExt Gradio password")


class LLMConnectionUpdate(BaseModel):
    """Schema for updating an LLM connection"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    url: Optional[str] = None
    model: Optional[str] = None
    purpose: Optional[str] = None
    connection_type: Optional[str] = None
    enabled: Optional[bool] = None
    timeout: Optional[float] = Field(None, ge=5.0, le=300.0)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=10, le=4096)
    api_key: Optional[str] = None
    docext_auth_user: Optional[str] = None
    docext_auth_pass: Optional[str] = None


class LLMConnectionResponse(BaseModel):
    """Response schema for LLM connection"""
    id: str
    name: str
    url: str
    model: str
    purpose: str
    connection_type: str
    enabled: bool
    timeout: float
    temperature: float
    max_tokens: int
    has_api_key: bool  # Don't expose actual key
    docext_auth_user: Optional[str] = None


class LLMTestRequest(BaseModel):
    """Request to test a connection"""
    url: str
    model: str = "default"
    connection_type: str = "openai"
    docext_auth_user: str = "admin"
    docext_auth_pass: str = "admin"


class LLMTestResponse(BaseModel):
    """Response from connection test"""
    status: str
    message: Optional[str] = None
    models: Optional[list[str]] = None
    test_response: Optional[str] = None


class LLMHealthResponse(BaseModel):
    """Health check response"""
    connection_id: str
    status: str
    message: Optional[str] = None


def connection_to_response(conn: dict) -> LLMConnectionResponse:
    """Convert stored connection to response"""
    return LLMConnectionResponse(
        id=conn["id"],
        name=conn["name"],
        url=conn["url"],
        model=conn.get("model", "default"),
        purpose=conn.get("purpose", "general"),
        connection_type=conn.get("connection_type", "openai"),
        enabled=conn.get("enabled", True),
        timeout=conn.get("timeout", 30.0),
        temperature=conn.get("temperature", 0.3),
        max_tokens=conn.get("max_tokens", 500),
        has_api_key=bool(conn.get("api_key")),
        docext_auth_user=conn.get("docext_auth_user", "admin") if conn.get("connection_type") == "docext" else None
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/connections", response_model=list[LLMConnectionResponse])
def list_connections(
    house_id: str = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List all LLM connections for the specified house"""
    house = verify_house_membership(db, user.id, house_id)
    connections = get_llm_settings(house)
    return [connection_to_response(c) for c in connections]


@router.post("/connections", response_model=LLMConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    data: LLMConnectionCreate,
    house_id: str = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new LLM connection"""
    house = verify_house_membership(db, user.id, house_id)

    # Validate purpose
    try:
        purpose = LLMPurpose(data.purpose)
    except ValueError:
        raise HTTPException(400, f"Invalid purpose. Must be one of: {[p.value for p in LLMPurpose]}")

    # Validate connection_type
    try:
        conn_type = LLMType(data.connection_type)
    except ValueError:
        raise HTTPException(400, f"Invalid connection_type. Must be one of: {[t.value for t in LLMType]}")

    connections = get_llm_settings(house)

    # Create new connection
    new_conn = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "url": data.url.rstrip('/'),
        "model": data.model,
        "purpose": purpose.value,
        "connection_type": conn_type.value,
        "enabled": data.enabled,
        "timeout": data.timeout,
        "temperature": data.temperature,
        "max_tokens": data.max_tokens,
        "api_key": data.api_key,
        "extra_headers": {},
        "docext_auth_user": data.docext_auth_user,
        "docext_auth_pass": data.docext_auth_pass
    }

    connections.append(new_conn)
    save_llm_settings(db, house, connections)

    return connection_to_response(new_conn)


@router.get("/connections/{connection_id}", response_model=LLMConnectionResponse)
def get_connection(
    connection_id: str,
    house_id: str = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get a specific LLM connection"""
    house = verify_house_membership(db, user.id, house_id)
    connections = get_llm_settings(house)
    conn = next((c for c in connections if c["id"] == connection_id), None)
    if not conn:
        raise HTTPException(404, "Connection not found")
    return connection_to_response(conn)


@router.put("/connections/{connection_id}", response_model=LLMConnectionResponse)
def update_connection(
    connection_id: str,
    data: LLMConnectionUpdate,
    house_id: str = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update an LLM connection"""
    house = verify_house_membership(db, user.id, house_id)
    connections = get_llm_settings(house)
    conn_idx = next((i for i, c in enumerate(connections) if c["id"] == connection_id), None)

    if conn_idx is None:
        raise HTTPException(404, "Connection not found")

    conn = connections[conn_idx]

    # Update fields
    if data.name is not None:
        conn["name"] = data.name
    if data.url is not None:
        conn["url"] = data.url.rstrip('/')
    if data.model is not None:
        conn["model"] = data.model
    if data.purpose is not None:
        try:
            purpose = LLMPurpose(data.purpose)
            conn["purpose"] = purpose.value
        except ValueError:
            raise HTTPException(400, f"Invalid purpose. Must be one of: {[p.value for p in LLMPurpose]}")
    if data.connection_type is not None:
        try:
            conn_type = LLMType(data.connection_type)
            conn["connection_type"] = conn_type.value
        except ValueError:
            raise HTTPException(400, f"Invalid connection_type. Must be one of: {[t.value for t in LLMType]}")
    if data.enabled is not None:
        conn["enabled"] = data.enabled
    if data.timeout is not None:
        conn["timeout"] = data.timeout
    if data.temperature is not None:
        conn["temperature"] = data.temperature
    if data.max_tokens is not None:
        conn["max_tokens"] = data.max_tokens
    if data.api_key is not None:
        conn["api_key"] = data.api_key if data.api_key else None
    if data.docext_auth_user is not None:
        conn["docext_auth_user"] = data.docext_auth_user
    if data.docext_auth_pass is not None:
        conn["docext_auth_pass"] = data.docext_auth_pass if data.docext_auth_pass else None

    connections[conn_idx] = conn
    save_llm_settings(db, house, connections)

    return connection_to_response(conn)


@router.delete("/connections/{connection_id}")
def delete_connection(
    connection_id: str,
    house_id: str = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete an LLM connection"""
    house = verify_house_membership(db, user.id, house_id)
    connections = get_llm_settings(house)
    new_connections = [c for c in connections if c["id"] != connection_id]

    if len(new_connections) == len(connections):
        raise HTTPException(404, "Connection not found")

    save_llm_settings(db, house, new_connections)
    return {"message": "Connection deleted"}


@router.post("/test", response_model=LLMTestResponse)
async def test_llm_connection(
    data: LLMTestRequest,
    user: User = Depends(get_current_user)
):
    """Test an LLM connection before saving"""
    result = await test_connection(
        url=data.url,
        model=data.model,
        connection_type=data.connection_type,
        docext_auth_user=data.docext_auth_user,
        docext_auth_pass=data.docext_auth_pass
    )
    return LLMTestResponse(
        status=result.get("status", "error"),
        message=result.get("message"),
        models=result.get("models"),
        test_response=result.get("test_response")
    )


@router.get("/connections/{connection_id}/health", response_model=LLMHealthResponse)
async def check_llm_health(
    connection_id: str,
    house_id: str = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Check health of a specific LLM connection"""
    house = verify_house_membership(db, user.id, house_id)
    connections = get_llm_settings(house)
    conn = next((c for c in connections if c["id"] == connection_id), None)

    if not conn:
        raise HTTPException(404, "Connection not found")

    # Load into manager and check health
    manager = get_llm_manager()
    try:
        llm_conn = LLMConnection.from_dict(conn)
        manager.add_connection(llm_conn)
        result = await check_connection_health(connection_id)
        return LLMHealthResponse(
            connection_id=connection_id,
            status=result.get("status", "error"),
            message=result.get("message")
        )
    except Exception as e:
        return LLMHealthResponse(
            connection_id=connection_id,
            status="error",
            message=str(e)
        )


@router.get("/purposes")
def list_purposes():
    """List available LLM purposes"""
    return {
        "purposes": [
            {"value": p.value, "label": _get_purpose_label(p), "description": _get_purpose_description(p)}
            for p in LLMPurpose
        ]
    }


@router.get("/types")
def list_connection_types():
    """List available LLM connection types"""
    return {
        "types": [
            {"value": t.value, "label": _get_type_label(t), "description": _get_type_description(t)}
            for t in LLMType
        ]
    }


def _get_type_label(conn_type: LLMType) -> str:
    labels = {
        LLMType.OPENAI: "OpenAI Compatible",
        LLMType.DOCEXT: "DocExt",
    }
    return labels.get(conn_type, conn_type.value)


def _get_type_description(conn_type: LLMType) -> str:
    descriptions = {
        LLMType.OPENAI: "MLX, Ollama, LM Studio, vLLM, OpenAI API",
        LLMType.DOCEXT: "DocExt Document Intelligence (richiede GPU NVIDIA)",
    }
    return descriptions.get(conn_type, "")


def _get_purpose_label(purpose: LLMPurpose) -> str:
    labels = {
        LLMPurpose.OCR: "OCR Scontrini",
        LLMPurpose.CHAT: "Chat",
        LLMPurpose.SUGGESTIONS: "Suggerimenti",
        LLMPurpose.GENERAL: "Generale",
    }
    return labels.get(purpose, purpose.value)


def _get_purpose_description(purpose: LLMPurpose) -> str:
    descriptions = {
        LLMPurpose.OCR: "Interpretazione scontrini e matching prodotti",
        LLMPurpose.CHAT: "Conversazione generale (futuro)",
        LLMPurpose.SUGGESTIONS: "Suggerimenti ricette e pasti (futuro)",
        LLMPurpose.GENERAL: "Uso generale / fallback",
    }
    return descriptions.get(purpose, "")
