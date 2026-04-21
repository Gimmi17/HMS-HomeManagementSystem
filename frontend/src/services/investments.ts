import api from './api'

export interface Investment {
  id: string
  user_id: string
  house_id: string
  name: string
  type: 'pac' | 'pension' | 'etf' | 'stock' | 'crypto' | 'real_estate' | 'other'
  provider: string | null
  description: string | null
  currency: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvestmentSnapshot {
  id: string
  investment_id: string
  snapshot_date: string
  current_value: number
  invested_amount: number | null
  units: number | null
  nav: number | null
  notes: string | null
  created_at: string
}

export interface LinkedEntry {
  id: string
  label: string
  amount: number
  type: string
  subtype: string
  frequency: string | null
}

export const INVESTMENT_TYPES = [
  { value: 'pac', label: 'PAC (Piano Accumulo Capitale)' },
  { value: 'pension', label: 'Previdenza Complementare' },
  { value: 'etf', label: 'ETF / Fondi' },
  { value: 'stock', label: 'Azioni' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'real_estate', label: 'Immobiliare' },
  { value: 'other', label: 'Altro' },
]

export const investmentService = {
  async list(): Promise<Investment[]> {
    const res = await api.get('/investments/')
    return res.data
  },

  async get(id: string): Promise<Investment> {
    const res = await api.get(`/investments/${id}`)
    return res.data
  },

  async create(data: {
    name: string
    type: string
    provider?: string | null
    description?: string | null
    currency?: string
    start_date?: string | null
    end_date?: string | null
    is_active?: boolean
    notes?: string | null
  }): Promise<Investment> {
    const res = await api.post('/investments/', data)
    return res.data
  },

  async update(id: string, data: Partial<Investment>): Promise<Investment> {
    const res = await api.put(`/investments/${id}`, data)
    return res.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/investments/${id}`)
  },

  async listSnapshots(investmentId: string): Promise<InvestmentSnapshot[]> {
    const res = await api.get(`/investments/${investmentId}/snapshots`)
    return res.data
  },

  async addSnapshot(
    investmentId: string,
    data: {
      snapshot_date: string
      current_value: number
      invested_amount?: number | null
      units?: number | null
      nav?: number | null
      notes?: string | null
    }
  ): Promise<InvestmentSnapshot> {
    const res = await api.post(`/investments/${investmentId}/snapshots`, data)
    return res.data
  },

  async deleteSnapshot(investmentId: string, snapshotId: string): Promise<void> {
    await api.delete(`/investments/${investmentId}/snapshots/${snapshotId}`)
  },

  async linkEntry(entryId: string, investmentId: string | null): Promise<void> {
    await api.patch(`/investments/link-entry/${entryId}`, { investment_id: investmentId })
  },

  async getLinkedEntries(investmentId: string): Promise<LinkedEntry[]> {
    const res = await api.get(`/investments/linked-entries/${investmentId}`)
    return res.data
  },
}

export default investmentService
