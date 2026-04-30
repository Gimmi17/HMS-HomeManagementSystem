import api from './api'

/* ── Types ──────────────────────────────────────────────────────────── */

export interface TraderInfo {
  name: string
  balance_total: number
  pnl_account: number
  balance_deposited: number
  credit: number
  open_positions: number
  last_update: string | null
  positions: TradePosition[]
}

export interface TradePosition {
  id?: number
  trade_id: string
  symbol: string
  trade_type: string
  lot_size: number
  entry_price: number
  current_price: number
  pnl: number
}

export interface TradingSummary {
  total_balance: number
  total_pnl: number
  total_deposited: number
  open_positions: number
  traders: TraderInfo[]
  balance_trend: BalancePoint[]
}

export interface BalancePoint {
  captured_at: string
  balance_total: number | null
  trader_name: string
  pnl_account?: number | null
  balance_deposited?: number | null
  credit?: number | null
}

export interface TradeRecord {
  trader_name: string
  captured_at: string
  trade_id: string
  symbol: string | null
  direction: string | null
  lot: number | null
  entry_price: number | null
  current_price: number | null
  pnl_trade: number | null
}

export interface TradingHealth {
  status: string
  upstream?: string
  detail?: string
}

/* ── Service ────────────────────────────────────────────────────────── */

export const tradingService = {
  async getSummary(traderName?: string): Promise<TradingSummary> {
    const params = traderName ? { trader_name: traderName } : {}
    const res = await api.get('/trading/analytics/summary', { params })
    return res.data
  },

  async getBalanceHistory(traderName?: string, limit = 500): Promise<BalancePoint[]> {
    const params: Record<string, any> = { limit }
    if (traderName) params.trader_name = traderName
    const res = await api.get('/trading/analytics/balance-history', { params })
    return res.data
  },

  async getPnlTrades(traderName?: string, limit = 500): Promise<TradeRecord[]> {
    const params: Record<string, any> = { limit }
    if (traderName) params.trader_name = traderName
    const res = await api.get('/trading/analytics/pnl-trades', { params })
    return res.data
  },

  async checkHealth(): Promise<TradingHealth> {
    const res = await api.get('/trading/health')
    return res.data
  },
}

export default tradingService
