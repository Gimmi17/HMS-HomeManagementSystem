import api from './api'

export interface FinanceSource {
  id: string
  name: string
  description?: string | null
  created_at: string
}

export interface FinanceEntry {
  id: string
  user_id: string
  house_id: string
  label: string
  amount: number
  type: 'income' | 'expense'
  subtype: 'recurring' | 'done'
  frequency?: 'monthly' | 'weekly' | 'every_n_months' | null
  frequency_n?: number | null
  date?: string | null
  start_date?: string | null
  end_date?: string | null
  source_id?: string | null
  investment_id?: string | null
  created_at: string
}

export interface FinanceSavings {
  amount: number
  resign_date: string | null
}

export interface RevolutMovement {
  id: string
  user_id: string
  house_id: string
  label: string
  amount: number
  category: string
  date: string
  notes?: string | null
  entity_id?: string | null
  source_id?: string | null
  created_at: string
}

export interface OCRParsed {
  label: string
  amount: number
  type: 'income' | 'expense'
  tx_date?: string | null
  subtype: 'done' | 'recurring'
  entity?: string | null
  source?: string | null
}

export interface FinanceLabel {
  id: string
  name: string
  created_at: string
}

export interface FinanceEntity {
  id: string
  name: string
  category?: string | null
  created_at: string
}

export interface HouseMember {
  user_id: string
  name: string
  monthly_income: number
  monthly_expense: number
  leftover: number
  savings: number
}

export interface HouseSummary {
  members: HouseMember[]
  total_income: number
  total_expense: number
  total_savings: number
  total_leftover: number
}

export const financeService = {
  async listEntries(): Promise<FinanceEntry[]> {
    const res = await api.get('/finance/entries')
    return res.data
  },
  async createEntry(data: {
    label: string
    amount: number
    type: string
    subtype: string
    frequency?: string | null
    frequency_n?: number | null
    date?: string | null
    start_date?: string | null
    end_date?: string | null
    label_id?: string | null
    entity_id?: string | null
    entity_name?: string | null
    source_id?: string | null
    source_name?: string | null
  }): Promise<FinanceEntry> {
    const res = await api.post('/finance/entries', data)
    return res.data
  },
  async deleteEntry(id: string): Promise<void> {
    await api.delete(`/finance/entries/${id}`)
  },
  async updateEntry(id: string, data: { label?: string; amount?: number; start_date?: string | null; end_date?: string | null }): Promise<FinanceEntry> {
    const res = await api.patch(`/finance/entries/${id}`, data)
    return res.data
  },

  async getSavings(): Promise<FinanceSavings> {
    const res = await api.get('/finance/savings')
    return res.data
  },
  async saveSavings(data: FinanceSavings): Promise<FinanceSavings> {
    const res = await api.post('/finance/savings', data)
    return res.data
  },

  async listRevolut(): Promise<RevolutMovement[]> {
    const res = await api.get('/finance/revolut')
    return res.data
  },
  async createRevolut(data: { label: string; amount: number; category: string; date: string; notes?: string; entity_name?: string; entity_id?: string; source_name?: string; source_id?: string }): Promise<RevolutMovement> {
    const res = await api.post('/finance/revolut', data)
    return res.data
  },
  async deleteRevolut(id: string): Promise<void> {
    await api.delete(`/finance/revolut/${id}`)
  },

  async importOcr(file: File): Promise<OCRParsed[]> {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post('/finance/import/ocr', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async houseSummary(): Promise<HouseSummary> {
    const res = await api.get('/finance/house/summary')
    return res.data
  },

  async listLabels(): Promise<FinanceLabel[]> {
    const res = await api.get('/finance/labels')
    return res.data
  },

  async listEntities(): Promise<FinanceEntity[]> {
    const res = await api.get('/finance/entities')
    return res.data
  },
  async createEntity(data: { name: string; category?: string }): Promise<FinanceEntity> {
    const res = await api.post('/finance/entities', data)
    return res.data
  },
  async deleteEntity(id: string): Promise<void> {
    await api.delete(`/finance/entities/${id}`)
  },

  async listSources(): Promise<FinanceSource[]> {
    const res = await api.get('/finance/sources')
    return res.data
  },
  async createSource(data: { name: string; description?: string }): Promise<FinanceSource> {
    const res = await api.post('/finance/sources', data)
    return res.data
  },
  async deleteSource(id: string): Promise<void> {
    await api.delete(`/finance/sources/${id}`)
  },
}

export default financeService
