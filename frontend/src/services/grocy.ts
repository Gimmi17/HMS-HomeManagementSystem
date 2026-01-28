import api from './api'
import type {
  GrocyProduct,
  GrocyStockItem,
  GrocyProductSimple,
  GrocyAddStockParams,
  GrocyConsumeStockParams,
  GrocyOpenProductParams,
  GrocyTransferStockParams,
  GrocyInventoryCorrectionParams,
  GrocyBulkAddItem,
  GrocyWriteOperationResponse,
  GrocyBulkAddStockResponse,
  GrocyLocation,
} from '@/types'

export const grocyService = {
  async getStock(): Promise<GrocyStockItem[]> {
    const response = await api.get('/grocy/stock')
    return response.data
  },

  async getProducts(): Promise<GrocyProduct[]> {
    const response = await api.get('/grocy/products')
    return response.data
  },

  async getProduct(id: string): Promise<GrocyProduct> {
    const response = await api.get(`/grocy/products/${id}`)
    return response.data
  },

  async matchFood(grocyProductId: string, foodId: string): Promise<void> {
    await api.post('/grocy/match-food', {
      grocy_product_id: grocyProductId,
      food_id: foodId,
    })
  },

  async getLocations(): Promise<GrocyLocation[]> {
    const response = await api.get('/grocy/locations')
    return response.data
  },

  async addStock(productId: number, params: GrocyAddStockParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/stock/${productId}/add`, params)
    return response.data
  },

  async consumeStock(productId: number, params: GrocyConsumeStockParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/stock/${productId}/consume`, params)
    return response.data
  },

  async openProduct(productId: number, params?: GrocyOpenProductParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/stock/${productId}/open`, params || { amount: 1 })
    return response.data
  },

  async transferStock(productId: number, params: GrocyTransferStockParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/stock/${productId}/transfer`, params)
    return response.data
  },

  async inventoryCorrection(productId: number, params: GrocyInventoryCorrectionParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/stock/${productId}/inventory`, params)
    return response.data
  },

  async bulkAddStock(items: GrocyBulkAddItem[]): Promise<GrocyBulkAddStockResponse> {
    const response = await api.post('/grocy/stock/bulk-add', { items })
    return response.data
  },
}

/**
 * Grocy service with house-based settings
 */
export const grocyHouseService = {
  /**
   * Get products from house-configured Grocy instance
   */
  async getProducts(houseId: string, search?: string): Promise<GrocyProductSimple[]> {
    const response = await api.get('/grocy/house-products', {
      params: {
        house_id: houseId,
        search,
      },
    })
    return response.data
  },

  async getLocations(houseId: string): Promise<GrocyLocation[]> {
    const response = await api.get('/grocy/house-locations', {
      params: { house_id: houseId },
    })
    return response.data
  },

  async addStock(houseId: string, productId: number, params: GrocyAddStockParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/house-stock/${productId}/add`, params, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async consumeStock(houseId: string, productId: number, params: GrocyConsumeStockParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/house-stock/${productId}/consume`, params, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async openProduct(houseId: string, productId: number, params?: GrocyOpenProductParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/house-stock/${productId}/open`, params || { amount: 1 }, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async inventoryCorrection(houseId: string, productId: number, params: GrocyInventoryCorrectionParams): Promise<GrocyWriteOperationResponse> {
    const response = await api.post(`/grocy/house-stock/${productId}/inventory`, params, {
      params: { house_id: houseId },
    })
    return response.data
  },

  async bulkAddStock(houseId: string, items: GrocyBulkAddItem[]): Promise<GrocyBulkAddStockResponse> {
    const response = await api.post('/grocy/house-stock/bulk-add', { items }, {
      params: { house_id: houseId },
    })
    return response.data
  },
}

export default grocyService
