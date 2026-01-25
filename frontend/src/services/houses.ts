import api from './api'
import type { House, HouseInvite } from '@/types'

export const housesService = {
  async getAll(): Promise<House[]> {
    const response = await api.get('/houses')
    return response.data
  },

  async getById(id: string): Promise<House> {
    const response = await api.get(`/houses/${id}`)
    return response.data
  },

  async create(data: { name: string; description?: string; location?: string }): Promise<House> {
    const response = await api.post('/houses', data)
    return response.data
  },

  async update(id: string, data: Partial<House>): Promise<House> {
    const response = await api.put(`/houses/${id}`, data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/houses/${id}`)
  },

  async createInvite(houseId: string): Promise<HouseInvite> {
    const response = await api.post(`/houses/${houseId}/invites`)
    return response.data
  },

  async joinWithCode(code: string): Promise<House> {
    const response = await api.post('/houses/join', { invite_code: code })
    return response.data
  },

  async removeMember(houseId: string, userId: string): Promise<void> {
    await api.delete(`/houses/${houseId}/members/${userId}`)
  },
}

export default housesService
