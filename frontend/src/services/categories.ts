import api from './api'
import type { Category, CategoryCreate, CategoryUpdate } from '@/types'

interface CategoriesResponse {
  categories: Category[]
  total: number
}

export const categoriesService = {
  /**
   * Get all categories
   */
  async getAll(params?: { search?: string; limit?: number; offset?: number }): Promise<CategoriesResponse> {
    const response = await api.get('/categories', { params })
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
  async create(data: CategoryCreate): Promise<Category> {
    const response = await api.post('/categories', data)
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
}

export default categoriesService
