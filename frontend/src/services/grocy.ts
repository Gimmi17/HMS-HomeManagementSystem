import api from './api'
import type { GrocyProduct, GrocyStockItem, GrocyProductSimple } from '@/types'

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
}

export default grocyService
