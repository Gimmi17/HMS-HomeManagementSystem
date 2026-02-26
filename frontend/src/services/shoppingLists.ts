import api from './api'
import type {
  ShoppingList,
  ShoppingListSummary,
  ShoppingListCreate,
  ShoppingListItem,
  ShoppingListItemCreate,
  ShoppingListStatus,
  VerificationStatus,
} from '@/types'

interface ShoppingListsResponse {
  lists: ShoppingListSummary[]
  total: number
  limit: number
  offset: number
}

export const shoppingListsService = {
  /**
   * Get all shopping lists for a house
   */
  async getAll(
    houseId: string,
    params?: { status?: ShoppingListStatus; limit?: number; offset?: number }
  ): Promise<ShoppingListsResponse> {
    const response = await api.get('/shopping-lists', {
      params: {
        house_id: houseId,
        ...params,
      },
    })
    return response.data
  },

  /**
   * Get a single shopping list with items
   */
  async getById(listId: string): Promise<ShoppingList> {
    const response = await api.get(`/shopping-lists/${listId}`)
    return response.data
  },

  /**
   * Create a new shopping list
   */
  async create(data: ShoppingListCreate): Promise<ShoppingList> {
    const response = await api.post('/shopping-lists', data)
    return response.data
  },

  /**
   * Update a shopping list (name, status, store, or verification status)
   */
  async update(
    listId: string,
    data: { name?: string; status?: ShoppingListStatus; store_id?: string; verification_status?: VerificationStatus }
  ): Promise<ShoppingList> {
    const response = await api.put(`/shopping-lists/${listId}`, data)
    return response.data
  },

  /**
   * Delete a shopping list
   */
  async delete(listId: string): Promise<void> {
    await api.delete(`/shopping-lists/${listId}`)
  },

  /**
   * Add an item to a shopping list
   */
  async addItem(listId: string, item: ShoppingListItemCreate): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items`, item)
    return response.data
  },

  /**
   * Update an item in a shopping list
   */
  async updateItem(
    listId: string,
    itemId: string,
    data: Partial<ShoppingListItem>
  ): Promise<ShoppingListItem> {
    const response = await api.put(`/shopping-lists/${listId}/items/${itemId}`, data)
    return response.data
  },

  /**
   * Delete an item from a shopping list
   */
  async deleteItem(listId: string, itemId: string): Promise<void> {
    await api.delete(`/shopping-lists/${listId}/items/${itemId}`)
  },

  /**
   * Toggle checked status of an item
   */
  async toggleItemCheck(listId: string, itemId: string): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items/${itemId}/toggle-check`)
    return response.data
  },

  /**
   * Verify an item by scanning its barcode
   */
  async verifyItem(listId: string, itemId: string, barcode: string): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items/${itemId}/verify`, null, {
      params: { barcode },
    })
    return response.data
  },

  /**
   * Verify an item with quantity (for load verification)
   */
  async verifyItemWithQuantity(
    listId: string,
    itemId: string,
    barcode: string,
    quantity: number,
    unit: string,
    productName?: string
  ): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items/${itemId}/verify-with-quantity`, {
      barcode,
      quantity,
      unit,
      product_name: productName,
    })
    return response.data
  },

  /**
   * Mark an item as not purchased (not available at store)
   */
  async markNotPurchased(listId: string, itemId: string): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items/${itemId}/not-purchased`)
    return response.data
  },

  /**
   * Undo not-purchased, returning item to pending state
   */
  async undoNotPurchased(listId: string, itemId: string): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items/${itemId}/undo-not-purchased`)
    return response.data
  },

  /**
   * Add an extra item during load verification (products not originally on the list)
   */
  async addExtraItem(
    listId: string,
    barcode: string,
    quantity: number,
    unit: string,
    productName?: string
  ): Promise<ShoppingListItem> {
    const response = await api.post(`/shopping-lists/${listId}/items/extra`, {
      barcode,
      quantity,
      unit,
      product_name: productName,
    })
    return response.data
  },

  /**
   * Acquire edit lock for a shopping list
   */
  async acquireLock(listId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/shopping-lists/${listId}/lock`)
    return response.data
  },

  /**
   * Release edit lock for a shopping list
   */
  async releaseLock(listId: string): Promise<void> {
    await api.post(`/shopping-lists/${listId}/unlock`)
  },

  /**
   * Get not purchased items from the last completed list (for recovery)
   */
  async getNotPurchasedItems(houseId: string): Promise<{
    items: Array<{
      id: string
      name: string
      grocy_product_id?: number
      grocy_product_name?: string
      quantity: number
      unit?: string
    }>
    source_list_name?: string
    source_list_id?: string
  }> {
    const response = await api.get(`/shopping-lists/house/${houseId}/not-purchased`)
    return response.data
  },
}

export default shoppingListsService
