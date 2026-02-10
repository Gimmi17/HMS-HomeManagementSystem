import api from './api'
import type { Category, CategoryCreate, CategoryUpdate } from '@/types'

interface CategoriesResponse {
  categories: Category[]
  total: number
}

interface ImportResult {
  message: string
  imported: number
}

export const categoriesService = {
  /**
   * Get all categories for a house
   */
  async getAll(houseId: string, params?: { search?: string; limit?: number; offset?: number }): Promise<CategoriesResponse> {
    const response = await api.get('/categories', { params: { house_id: houseId, ...params } })
    return response.data
  },

  /**
   * Get a single category by ID
   */
  async getById(categoryId: string): Promise<Category> {
    const response = await api.get(`/categories/${categoryId}`)
    return response.data
  },

  /**
   * Create a new category
   */
  async create(houseId: string, data: CategoryCreate): Promise<Category> {
    const response = await api.post('/categories', data, { params: { house_id: houseId } })
    return response.data
  },

  /**
   * Update a category
   */
  async update(categoryId: string, data: CategoryUpdate): Promise<Category> {
    const response = await api.put(`/categories/${categoryId}`, data)
    return response.data
  },

  /**
   * Delete a category
   */
  async delete(categoryId: string): Promise<void> {
    await api.delete(`/categories/${categoryId}`)
  },

  /**
   * Get global template categories
   */
  async getTemplates(): Promise<CategoriesResponse> {
    const response = await api.get('/categories/templates')
    return response.data
  },

  /**
   * Import templates into a house
   */
  async importTemplates(houseId: string): Promise<ImportResult> {
    const response = await api.post('/categories/import-templates', null, { params: { house_id: houseId } })
    return response.data
  },
}

export default categoriesService
