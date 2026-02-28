import api from './api'
import type { Area, AreaCreate, AreaUpdate, AreaExpenseStats } from '@/types'

interface AreasResponse {
  areas: Area[]
  total: number
}

interface SeedResponse {
  message: string
  areas_created: number
  items_assigned: number
}

export const areasService = {
  async getAll(houseId: string): Promise<AreasResponse> {
    const response = await api.get('/areas', {
      params: { house_id: houseId },
    })
    return response.data
  },

  async create(houseId: string, data: AreaCreate): Promise<Area> {
    const response = await api.post('/areas', data, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async update(areaId: string, houseId: string, data: AreaUpdate): Promise<Area> {
    const response = await api.put(`/areas/${areaId}`, data, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async delete(areaId: string, houseId: string): Promise<void> {
    await api.delete(`/areas/${areaId}`, {
      params: { house_id: houseId },
    })
  },

  async getStats(areaId: string, houseId: string): Promise<AreaExpenseStats> {
    const response = await api.get(`/areas/${areaId}/stats`, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async seed(houseId: string): Promise<SeedResponse> {
    const response = await api.post('/areas/seed', null, {
      params: { house_id: houseId },
    })
    return response.data
  },
}

export default areasService
