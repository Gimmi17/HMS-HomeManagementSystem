"""
Trading API — proxy to android-trader-monitor
Reads positions, account snapshots and trade history from the external
android-trader-monitor service via its REST API.

No local DB models needed: data lives in the trader-monitor Postgres,
HMS just reads and transforms for the Finance UI.
"""

from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings

router = APIRouter()

TRADER_MONITOR_URL = settings.TRADER_MONITOR_URL
TRADER_MONITOR_TOKEN = settings.TRADER_MONITOR_TOKEN

_TIMEOUT = 10.0  # seconds


def _headers() -> dict[str, str]:
    h: dict[str, str] = {"Accept": "application/json"}
    if TRADER_MONITOR_TOKEN:
        h["Authorization"] = f"Bearer {TRADER_MONITOR_TOKEN}"
    return h


async def _get(path: str, params: dict | None = None) -> Any:
    """GET helper — raises 502 on connection errors."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{TRADER_MONITOR_URL}{path}",
                headers=_headers(),
                params=params,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Trader monitor service unreachable")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, exc.response.text)


# ── Traders ──────────────────────────────────────────────────────────────────

@router.get("/traders")
async def list_traders() -> list[dict[str, Any]]:
    """List configured traders from android-trader-monitor."""
    return await _get("/api/traders")


# ── Positions (raw) ─────────────────────────────────────────────────────────

@router.get("/positions")
async def list_positions(
    trader_name: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=2000),
) -> list[dict[str, Any]]:
    """All positions (history), optionally filtered by trader."""
    params: dict[str, Any] = {"limit": limit}
    if trader_name:
        params["trader_name"] = trader_name
    return await _get("/api/positions", params)


@router.get("/positions/latest")
async def latest_positions() -> list[dict[str, Any]]:
    """Latest snapshot per trader (dashboard card)."""
    return await _get("/api/positions/latest")


# ── Aggregated analytics ────────────────────────────────────────────────────

@router.get("/analytics/balance-history")
async def balance_history(
    trader_name: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
) -> list[dict[str, Any]]:
    """
    Time-series of account balance snapshots — one point per screenshot.
    Returns deduplicated (by captured_at) balance_total + pnl_account over time.
    Used for equity-curve charts in the Finance UI.
    """
    params: dict[str, Any] = {"limit": limit}
    if trader_name:
        params["trader_name"] = trader_name
    raw: list[dict[str, Any]] = await _get("/api/positions", params)

    # Deduplicate: keep one row per (trader_name, captured_at) — prefer the first
    seen: set[str] = set()
    series: list[dict[str, Any]] = []
    for row in reversed(raw):  # oldest first
        key = f"{row['trader_name']}|{row['captured_at']}"
        if key in seen:
            continue
        seen.add(key)
        series.append({
            "trader_name": row["trader_name"],
            "captured_at": row["captured_at"],
            "balance_total": row.get("balance_total"),
            "pnl_account": row.get("pnl_account"),
            "balance_deposited": row.get("balance_deposited"),
            "credit": row.get("credit"),
        })
    return series


@router.get("/analytics/pnl-trades")
async def pnl_trades(
    trader_name: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
) -> list[dict[str, Any]]:
    """
    Per-trade PnL history — every individual trade snapshot with non-null trade_id.
    Used for trade-level analysis (symbol breakdown, win/loss ratio, etc.).
    """
    params: dict[str, Any] = {"limit": limit}
    if trader_name:
        params["trader_name"] = trader_name
    raw: list[dict[str, Any]] = await _get("/api/positions", params)

    trades: list[dict[str, Any]] = []
    for row in reversed(raw):
        if not row.get("trade_id"):
            continue
        trades.append({
            "trader_name": row["trader_name"],
            "captured_at": row["captured_at"],
            "trade_id": row["trade_id"],
            "symbol": row.get("symbol"),
            "direction": row.get("direction"),
            "lot": row.get("lot"),
            "entry_price": row.get("entry_price"),
            "current_price": row.get("current_price"),
            "pnl_trade": row.get("pnl_trade"),
        })
    return trades


@router.get("/analytics/summary")
async def trading_summary(
    trader_name: Optional[str] = Query(None),
) -> dict[str, Any]:
    """
    Aggregated summary: latest balance, total PnL, open positions count,
    balance trend (last 10 snapshots).
    """
    latest_data: list[dict[str, Any]] = await _get("/api/positions/latest")
    positions_raw: list[dict[str, Any]] = await _get(
        "/api/positions", {"limit": 500, **({"trader_name": trader_name} if trader_name else {})}
    )

    # Filter latest_data by trader_name if specified
    if trader_name:
        latest_data = [d for d in latest_data if d.get("trader", {}).get("name") == trader_name]

    # Aggregate across all traders
    total_balance = 0.0
    total_pnl = 0.0
    total_deposited = 0.0
    open_positions = 0
    traders_summary: list[dict[str, Any]] = []

    for entry in latest_data:
        account = entry.get("account", {})
        balance = account.get("balance_total") or 0
        pnl = account.get("pnl_account") or 0
        deposited = account.get("balance_deposited") or 0
        total_balance += balance
        total_pnl += pnl
        total_deposited += deposited
        open_positions += len(entry.get("positions", []))

        traders_summary.append({
            "name": entry.get("trader", {}).get("name", "?"),
            "balance_total": balance,
            "pnl_account": pnl,
            "balance_deposited": deposited,
            "credit": account.get("credit") or 0,
            "open_positions": len(entry.get("positions", [])),
            "last_update": entry.get("captured_at"),
            "positions": entry.get("positions", []),
        })

    # Balance trend: deduplicate snapshots, take last 20
    seen: set[str] = set()
    trend: list[dict[str, Any]] = []
    for row in reversed(positions_raw):
        key = f"{row['trader_name']}|{row['captured_at']}"
        if key in seen:
            continue
        seen.add(key)
        trend.append({
            "captured_at": row["captured_at"],
            "balance_total": row.get("balance_total"),
            "trader_name": row["trader_name"],
        })
    trend = trend[-20:]

    return {
        "total_balance": round(total_balance, 2),
        "total_pnl": round(total_pnl, 2),
        "total_deposited": round(total_deposited, 2),
        "open_positions": open_positions,
        "traders": traders_summary,
        "balance_trend": trend,
    }


@router.get("/health")
async def trading_health() -> dict[str, str]:
    """Check connectivity to android-trader-monitor."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{TRADER_MONITOR_URL}/health")
            resp.raise_for_status()
            return {"status": "ok", "upstream": resp.json().get("status", "ok")}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
