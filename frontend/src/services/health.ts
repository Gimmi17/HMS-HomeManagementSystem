import api from './api'
import type { Weight, HealthRecord } from '@/types'

export const healthService = {
  // Weights
  async getWeights(houseId: string, userId?: string): Promise<Weight[]> {
    const response = await api.get('/weights', {
      params: { house_id: houseId, user_id: userId },
    })
    return response.data.weights || []
  },

  async addWeight(houseId: string, data: { weight_kg: number; measured_at: string; notes?: string }): Promise<Weight> {
    const response = await api.post('/weights', { ...data, house_id: houseId })
    return response.data
  },

  async deleteWeight(id: string): Promise<void> {
    await api.delete(`/weights/${id}`)
  },

  // Health records
  async getHealthRecords(houseId: string): Promise<HealthRecord[]> {
    const response = await api.get('/health', { params: { house_id: houseId } })
    return response.data
  },

  async addHealthRecord(
    houseId: string,
    data: { type: string; description: string; severity?: string; recorded_at: string }
  ): Promise<HealthRecord> {
    const response = await api.post('/health', { ...data, house_id: houseId })
    return response.data
  },

  async deleteHealthRecord(id: string): Promise<void> {
    await api.delete(`/health/${id}`)
  },
}

export default healthService
