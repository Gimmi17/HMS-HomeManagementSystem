"""
Gold Alert Finance API — proxy to Gold Alert backend
Proxies finance entries, revolut movements, labels, entities, sources and savings
from the Gold Alert service. No local DB interaction; all data lives in Gold Alert.
"""

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings

router = APIRouter()

GOLD_ALERT_URL = settings.GOLD_ALERT_URL

_TIMEOUT = 10.0  # seconds


async def _get(path: str, params: dict | None = None) -> Any:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{GOLD_ALERT_URL}{path}", params=params)
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Gold Alert service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


async def _post(path: str, body: Any) -> Any:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(f"{GOLD_ALERT_URL}{path}", json=body)
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Gold Alert service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


async def _post_raw(path: str, request: Request) -> Any:
    """POST that forwards raw body (e.g. multipart/form-data)."""
    try:
        body = await request.body()
        headers = {
            k: v for k, v in request.headers.items()
            if k.lower() not in ("host", "content-length")
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{GOLD_ALERT_URL}{path}", content=body, headers=headers
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Gold Alert service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


async def _patch(path: str, body: Any) -> Any:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.patch(f"{GOLD_ALERT_URL}{path}", json=body)
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Gold Alert service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


async def _put(path: str, body: Any) -> Any:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.put(f"{GOLD_ALERT_URL}{path}", json=body)
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Gold Alert service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


async def _delete(path: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.delete(f"{GOLD_ALERT_URL}{path}")
            resp.raise_for_status()
    except httpx.ConnectError:
        raise HTTPException(502, "Gold Alert service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


# ── Entries ───────────────────────────────────────────────────────────────────

@router.get("/entries")
async def list_entries() -> Any:
    return await _get("/api/finances")


@router.post("/entries")
async def create_entry(body: dict[str, Any]) -> Any:
    if "subtype" in body:
        body["kind"] = body.pop("subtype")
    return await _post("/api/finances", body)


@router.patch("/entries/{entry_id}")
async def update_entry(entry_id: str, body: dict[str, Any]) -> Any:
    if "subtype" in body:
        body["kind"] = body.pop("subtype")
    return await _patch(f"/api/finances/{entry_id}", body)


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(entry_id: str) -> None:
    await _delete(f"/api/finances/{entry_id}")


# ── Revolut ───────────────────────────────────────────────────────────────────

@router.get("/revolut")
async def list_revolut(request: Request) -> Any:
    params = dict(request.query_params) or None
    return await _get("/api/revolut", params=params)


@router.post("/revolut")
async def create_revolut(body: dict[str, Any]) -> Any:
    if "notes" in body:
        body["note"] = body.pop("notes")
    return await _post("/api/revolut", body)


@router.patch("/revolut/{mov_id}")
async def update_revolut(mov_id: str, body: dict[str, Any]) -> Any:
    return await _patch(f"/api/revolut/{mov_id}", body)


@router.delete("/revolut/{mov_id}", status_code=204)
async def delete_revolut(mov_id: str) -> None:
    await _delete(f"/api/revolut/{mov_id}")


# ── Labels ────────────────────────────────────────────────────────────────────

@router.get("/labels")
async def list_labels() -> Any:
    return await _get("/api/finance/labels")


@router.post("/labels")
async def create_label(body: dict[str, Any]) -> Any:
    return await _post("/api/finance/labels", body)


@router.delete("/labels/{label_id}", status_code=204)
async def delete_label(label_id: str) -> None:
    await _delete(f"/api/finance/labels/{label_id}")


# ── Entities ──────────────────────────────────────────────────────────────────

@router.get("/entities")
async def list_entities() -> Any:
    return await _get("/api/finance/entities")


@router.post("/entities")
async def create_entity(body: dict[str, Any]) -> Any:
    return await _post("/api/finance/entities", body)


@router.delete("/entities/{entity_id}", status_code=204)
async def delete_entity(entity_id: str) -> None:
    await _delete(f"/api/finance/entities/{entity_id}")


# ── Sources ───────────────────────────────────────────────────────────────────

@router.get("/sources")
async def list_sources() -> Any:
    return await _get("/api/finance/sources")


@router.post("/sources")
async def create_source(body: dict[str, Any]) -> Any:
    return await _post("/api/finance/sources", body)


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(source_id: str) -> None:
    await _delete(f"/api/finance/sources/{source_id}")


# ── Savings ───────────────────────────────────────────────────────────────────

@router.get("/savings")
async def get_savings() -> Any:
    return await _get("/api/finance/savings")


@router.put("/savings")
async def upsert_savings(body: dict[str, Any]) -> Any:
    return await _put("/api/finance/savings", body)


@router.post("/savings")
async def post_savings(body: dict[str, Any]) -> Any:
    return await _put("/api/finance/savings", body)


# ── Batch ─────────────────────────────────────────────────────────────────────

@router.post("/batch")
async def batch_create(body: dict[str, Any]) -> Any:
    return await _post("/api/finances/batch", body)


# ── OCR Parse ─────────────────────────────────────────────────────────────────

@router.post("/ocr-parse")
async def ocr_parse(request: Request) -> Any:
    return await _post_raw("/api/finances/ocr-parse", request)


@router.post("/import/ocr")
async def import_ocr(request: Request) -> Any:
    return await _post_raw("/api/finances/ocr-parse", request)


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary")
async def summary() -> Any:
    """Proxy to Gold Alert's /api/finance/summary (monthly recurring breakdown)."""
    return await _get("/api/finance/summary")
