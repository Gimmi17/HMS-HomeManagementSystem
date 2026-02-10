import api from './api'
import type { Food } from '@/types'

interface FoodListResponse {
  foods: Food[]
  total: number
  limit: number
  offset: number
}

interface ImportResult {
  message: string
  imported: number
}

export const foodsService = {
  /**
   * Search foods in a house
   */
  async search(houseId: string, query?: string, category?: string, limit = 50, offset = 0): Promise<FoodListResponse> {
    const response = await api.get('/foods', {
      params: { house_id: houseId, search: query, category, limit, offset },
    })
    return response.data
  },

  /**
   * Get a food by ID
   */
  async getById(id: string): Promise<Food> {
    const response = await api.get(`/foods/${id}`)
    return response.data
  },

  /**
   * Get food categories for a house
   */
  async getCategories(houseId: string): Promise<string[]> {
    const response = await api.get('/foods/categories', { params: { house_id: houseId } })
    return response.data.categories
  },

  /**
   * Get template foods
   */
  async getTemplates(params?: { search?: string; category?: string; limit?: number; offset?: number }): Promise<FoodListResponse> {
    const response = await api.get('/foods/templates', { params })
    return response.data
  },

  /**
   * Get template food categories
   */
  async getTemplateCategories(): Promise<string[]> {
    const response = await api.get('/foods/templates/categories')
    return response.data.categories
  },

  /**
   * Import templates into a house
   */
  async importTemplates(houseId: string, category?: string): Promise<ImportResult> {
    const response = await api.post('/foods/import-templates', null, { params: { house_id: houseId, category } })
    return response.data
  },

  /**
   * Create a new food
   */
  async create(houseId: string, data: Partial<Food>): Promise<Food> {
    const response = await api.post('/foods', data, { params: { house_id: houseId } })
    return response.data
  },

  /**
   * Update a food
   */
  async update(foodId: string, data: Partial<Food>): Promise<Food> {
    const response = await api.put(`/foods/${foodId}`, data)
    return response.data
  },

  /**
   * Delete a food
   */
  async delete(foodId: string): Promise<void> {
    await api.delete(`/foods/${foodId}`)
  },
}

export default foodsService
