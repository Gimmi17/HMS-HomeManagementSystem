import api from './api'
import type { Food } from '@/types'

export const foodsService = {
  async search(query: string, category?: string, limit = 50): Promise<Food[]> {
    const response = await api.get('/foods', {
      params: { search: query, category, limit },
    })
    return response.data
  },

  async getById(id: string): Promise<Food> {
    const response = await api.get(`/foods/${id}`)
    return response.data
  },

  async getCategories(): Promise<string[]> {
    const response = await api.get('/foods/categories')
    return response.data
  },
}

export default foodsService
