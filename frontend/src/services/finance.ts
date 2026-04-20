import api from './api'

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
  created_at: string
}

export interface OCRParsed {
  label: string
  amount: number
  type: 'income' | 'expense'
  date?: string | null
  subtype: 'done' | 'recurring'
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
  async createRevolut(data: { label: string; amount: number; category: string; date: string; notes?: string }): Promise<RevolutMovement> {
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
}

export default financeService
