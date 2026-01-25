import api from './api'
import type { Meal, MealCreate } from '@/types'

export const mealsService = {
  async getAll(houseId: string, params?: { from?: string; to?: string }): Promise<Meal[]> {
    const response = await api.get('/meals', {
      params: { house_id: houseId, ...params },
    })
    // Backend returns { meals: [...], total, limit, offset }
    return response.data.meals || []
  },

  async getById(id: string): Promise<Meal> {
    const response = await api.get(`/meals/${id}`)
    return response.data
  },

  async create(houseId: string, data: MealCreate): Promise<Meal> {
    const response = await api.post('/meals', { ...data, house_id: houseId })
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/meals/${id}`)
  },

  async getToday(houseId: string, userId?: string): Promise<Meal[]> {
    const today = new Date().toISOString().split('T')[0]
    const response = await api.get('/meals', {
      params: {
        house_id: houseId,
        user_id: userId,
        from: today,
        to: today,
      },
    })
    // Backend returns { meals: [...], total, limit, offset }
    return response.data.meals || []
  },
}

export default mealsService
