import api from './api'
import type { Recipe, RecipeCreate } from '@/types'

interface RecipeListResponse {
  recipes: Recipe[]
  total: number
  limit: number
  offset: number
}

export const recipesService = {
  /**
   * Get all recipes for a house
   */
  async getAll(houseId: string, params?: {
    search?: string
    difficulty?: string
    tags?: string[]
    limit?: number
    offset?: number
  }): Promise<RecipeListResponse> {
    const response = await api.get('/recipes', {
      params: {
        house_id: houseId,
        ...params
      }
    })
    return response.data
  },

  /**
   * Get recipe by ID
   */
  async getById(id: string, houseId: string): Promise<Recipe> {
    const response = await api.get(`/recipes/${id}`, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Create a new recipe
   */
  async create(houseId: string, data: RecipeCreate): Promise<Recipe> {
    const response = await api.post('/recipes', data, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Update an existing recipe
   */
  async update(id: string, houseId: string, data: Partial<RecipeCreate>): Promise<Recipe> {
    const response = await api.put(`/recipes/${id}`, data, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Delete a recipe
   */
  async delete(id: string, houseId: string): Promise<void> {
    await api.delete(`/recipes/${id}`, {
      params: { house_id: houseId }
    })
  },
}

export default recipesService
