import api from './api'
import type { DispensaItem, DispensaStats } from '@/types'

interface DispensaItemListResponse {
  items: DispensaItem[]
  total: number
  stats: DispensaStats
}

interface SendToDispensaResponse {
  message: string
  count: number
}

interface GetItemsParams {
  search?: string
  category_id?: string
  expiring?: boolean
  expired?: boolean
  consumed?: boolean
  show_all?: boolean
}

export const dispensaService = {
  /**
   * Get all dispensa items with optional filters
   */
  async getItems(houseId: string, params?: GetItemsParams): Promise<DispensaItemListResponse> {
    const response = await api.get('/dispensa', {
      params: { house_id: houseId, ...params },
    })
    return response.data
  },

  /**
   * Get dispensa statistics
   */
  async getStats(houseId: string): Promise<DispensaStats> {
    const response = await api.get('/dispensa/stats', {
      params: { house_id: houseId },
    })
    return response.data
  },

  /**
   * Create a new dispensa item
   */
  async createItem(houseId: string, data: {
    name: string
    quantity?: number
    unit?: string
    category_id?: string
    expiry_date?: string
    barcode?: string
    grocy_product_id?: number
    grocy_product_name?: string
    notes?: string
  }): Promise<DispensaItem> {
    const response = await api.post('/dispensa', data, {
      params: { house_id: houseId },
    })
    return response.data
  },

  /**
   * Update a dispensa item
   */
  async updateItem(houseId: string, itemId: string, data: {
    name?: string
    quantity?: number
    unit?: string
    category_id?: string
    expiry_date?: string
    barcode?: string
    notes?: string
  }): Promise<DispensaItem> {
    const response = await api.put(`/dispensa/${itemId}`, data, {
      params: { house_id: houseId },
    })
    return response.data
  },

  /**
   * Delete a dispensa item
   */
  async deleteItem(houseId: string, itemId: string): Promise<void> {
    await api.delete(`/dispensa/${itemId}`, {
      params: { house_id: houseId },
    })
  },

  /**
   * Consume an item (total or partial)
   */
  async consumeItem(houseId: string, itemId: string, quantity?: number): Promise<DispensaItem> {
    const response = await api.post(`/dispensa/${itemId}/consume`,
      { quantity: quantity ?? null },
      { params: { house_id: houseId } },
    )
    return response.data
  },

  /**
   * Restore a consumed item
   */
  async unconsumeItem(houseId: string, itemId: string): Promise<DispensaItem> {
    const response = await api.post(`/dispensa/${itemId}/unconsume`, null, {
      params: { house_id: houseId },
    })
    return response.data
  },

  /**
   * Send verified items from a shopping list to the dispensa
   */
  async sendFromShoppingList(houseId: string, listId: string): Promise<SendToDispensaResponse> {
    const response = await api.post('/dispensa/from-shopping-list',
      { shopping_list_id: listId },
      { params: { house_id: houseId } },
    )
    return response.data
  },
}

export default dispensaService
