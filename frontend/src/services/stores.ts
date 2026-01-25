import api from './api'
import type { Store, StoreCreate, StoreUpdate } from '@/types'

interface StoresResponse {
  stores: Store[]
  total: number
}

export const storesService = {
  /**
   * Get all stores
   */
  async getAll(params?: { search?: string; limit?: number; offset?: number }): Promise<StoresResponse> {
    const response = await api.get('/stores', { params })
    return response.data
  },

  /**
   * Get a single store by ID
   */
  async getById(storeId: string): Promise<Store> {
    const response = await api.get(`/stores/${storeId}`)
    return response.data
  },

  /**
   * Create a new store
   */
  async create(data: StoreCreate): Promise<Store> {
    const response = await api.post('/stores', data)
    return response.data
  },

  /**
   * Update a store
   */
  async update(storeId: string, data: StoreUpdate): Promise<Store> {
    const response = await api.put(`/stores/${storeId}`, data)
    return response.data
  },

  /**
   * Delete a store
   */
  async delete(storeId: string): Promise<void> {
    await api.delete(`/stores/${storeId}`)
  },
}

export default storesService
