import api from './api'
import type { Store, StoreCreate, StoreUpdate } from '@/types'

interface StoresResponse {
  stores: Store[]
  total: number
}

interface ImportResult {
  message: string
  imported: number
}

export const storesService = {
  /**
   * Get all stores for a house
   */
  async getAll(houseId: string, params?: { search?: string; limit?: number; offset?: number }): Promise<StoresResponse> {
    const response = await api.get('/stores', { params: { house_id: houseId, ...params } })
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
  async create(houseId: string, data: StoreCreate): Promise<Store> {
    const response = await api.post('/stores', data, { params: { house_id: houseId } })
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

  /**
   * Get global template stores
   */
  async getTemplates(): Promise<StoresResponse> {
    const response = await api.get('/stores/templates')
    return response.data
  },

  /**
   * Import templates into a house
   */
  async importTemplates(houseId: string): Promise<ImportResult> {
    const response = await api.post('/stores/import-templates', null, { params: { house_id: houseId } })
    return response.data
  },
}

export default storesService
