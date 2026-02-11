import api from './api'
import type {
  Receipt,
  ReceiptSummary,
  ReceiptItem,
  ReconciliationResponse,
} from '@/types'

interface ReceiptsResponse {
  receipts: ReceiptSummary[]
  total: number
}

export const receiptsService = {
  /**
   * Upload receipt images for a shopping list
   * Supports multiple files for long receipts
   */
  async upload(listId: string, files: File[]): Promise<Receipt> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const response = await api.post(`/receipts/shopping-lists/${listId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Add more images to an existing receipt
   */
  async addImages(receiptId: string, files: File[]): Promise<Receipt> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const response = await api.post(`/receipts/${receiptId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Process a receipt with OCR
   */
  async process(receiptId: string): Promise<Receipt> {
    const response = await api.post(`/receipts/${receiptId}/process`)
    return response.data
  },

  /**
   * Reconcile receipt items with shopping list
   */
  async reconcile(receiptId: string): Promise<ReconciliationResponse> {
    const response = await api.post(`/receipts/${receiptId}/reconcile`)
    return response.data
  },

  /**
   * Get a receipt with all items
   */
  async getById(receiptId: string): Promise<Receipt> {
    const response = await api.get(`/receipts/${receiptId}`)
    return response.data
  },

  /**
   * Get all receipts for a shopping list
   */
  async getByListId(listId: string): Promise<ReceiptsResponse> {
    const response = await api.get(`/receipts/shopping-lists/${listId}`)
    return response.data
  },

  /**
   * Update a receipt item (user correction)
   */
  async updateItem(
    itemId: string,
    data: {
      parsed_name?: string
      user_corrected_name?: string
      user_confirmed?: boolean
      match_status?: string
      shopping_list_item_id?: string
    }
  ): Promise<ReceiptItem> {
    const response = await api.put(`/receipts/items/${itemId}`, data)
    return response.data
  },

  /**
   * Add extra items from receipt to shopping list
   */
  async addExtraToList(
    receiptId: string,
    itemIds: string[]
  ): Promise<{ success: boolean; added_count: number; added_items: string[] }> {
    const response = await api.post(`/receipts/${receiptId}/add-extra-to-list`, {
      receipt_item_ids: itemIds,
    })
    return response.data
  },

  /**
   * Delete a single receipt image
   */
  async deleteImage(imageId: string): Promise<void> {
    await api.delete(`/receipts/images/${imageId}`)
  },

  /**
   * Delete a receipt
   */
  async delete(receiptId: string): Promise<void> {
    await api.delete(`/receipts/${receiptId}`)
  },

  /**
   * Get image URL for a receipt
   */
  getImageUrl(imagePath: string): string {
    return `/api/v1/receipts/images/file/${imagePath}`
  },
}

export default receiptsService
