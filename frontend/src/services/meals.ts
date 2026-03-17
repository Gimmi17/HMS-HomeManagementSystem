import api from './api'
import type { Meal, MealCreate } from '@/types'

export interface StockConsumeItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  available_in_pantry: number
  will_be_available: number
  warning?: string
}

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

  async create(_houseId: string, data: MealCreate): Promise<Meal> {
    const response = await api.post('/meals', data)
    return response.data
  },

  async consumeRecipeStock(
    mealId: string,
    houseId: string,
    portionMultiplier: number = 1.0
  ): Promise<{ consumed: StockConsumeItem[]; warnings: string[] }> {
    const res = await api.post(`/meals/${mealId}/consume-recipe-stock`, {
      house_id: houseId,
      portion_multiplier: portionMultiplier,
    })
    return res.data
  },

  async previewRecipeStock(
    mealId: string,
    houseId: string,
    portionMultiplier: number = 1.0
  ): Promise<{ consumed: StockConsumeItem[]; warnings: string[] }> {
    const res = await api.get(
      `/meals/${mealId}/recipe-stock-preview?house_id=${houseId}&portion_multiplier=${portionMultiplier}`
    )
    return res.data
  },

  async delete(id: string, houseId: string): Promise<void> {
    await api.delete(`/meals/${id}`, {
      params: { house_id: houseId },
    })
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
