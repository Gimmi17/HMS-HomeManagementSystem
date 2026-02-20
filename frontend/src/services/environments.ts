import api from './api'
import type { Environment, EnvironmentCreate, EnvironmentUpdate, EnvironmentExpenseStats } from '@/types'

interface EnvironmentsResponse {
  environments: Environment[]
  total: number
}

interface SeedResponse {
  message: string
  environments_created: number
  items_assigned: number
}

export const environmentsService = {
  async getAll(houseId: string): Promise<EnvironmentsResponse> {
    const response = await api.get('/environments', {
      params: { house_id: houseId },
    })
    return response.data
  },

  async create(houseId: string, data: EnvironmentCreate): Promise<Environment> {
    const response = await api.post('/environments', data, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async update(envId: string, houseId: string, data: EnvironmentUpdate): Promise<Environment> {
    const response = await api.put(`/environments/${envId}`, data, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async delete(envId: string, houseId: string): Promise<void> {
    await api.delete(`/environments/${envId}`, {
      params: { house_id: houseId },
    })
  },

  async getStats(envId: string, houseId: string): Promise<EnvironmentExpenseStats> {
    const response = await api.get(`/environments/${envId}/stats`, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async seed(houseId: string): Promise<SeedResponse> {
    const response = await api.post('/environments/seed', null, {
      params: { house_id: houseId },
    })
    return response.data
  },
}

export default environmentsService
