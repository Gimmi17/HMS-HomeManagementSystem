import api from './api'

interface MealConfigPayload {
  meal_type: string
  user_ids: string[]
}

interface DayPlanPayload {
  date: string
  meals: MealConfigPayload[]
}

interface GenerateRequest {
  house_id: string
  plan: DayPlanPayload[]
}

export interface SuggestionItem {
  recipe_id: string
  recipe_name: string
  reason: string
  avg_expiry_days: number | null
  expiry_alert: boolean
  coverage_ratio: number
  calories: number | null
  proteins_g: number | null
  fats_g: number | null
  carbs_g: number | null
}

export interface MealSuggestions {
  date: string
  meal_type: string
  user_ids: string[]
  suggestions: SuggestionItem[]
}

export interface GenerateResponse {
  meals: MealSuggestions[]
  pantry_summary: Record<string, unknown>
}

interface MealSelection {
  date: string
  meal_type: string
  recipe_id: string
  user_ids: string[]
}

interface ConfirmRequest {
  house_id: string
  selections: MealSelection[]
}

interface ConfirmResponse {
  created: number
  meals: {
    id: string
    user_id: string
    recipe_id: string | null
    meal_type: string
    consumed_at: string | null
  }[]
}

export const mealPlannerService = {
  async generate(data: GenerateRequest): Promise<GenerateResponse> {
    const response = await api.post('/meal-planner/generate', data)
    return response.data
  },

  async confirm(data: ConfirmRequest): Promise<ConfirmResponse> {
    const response = await api.post('/meal-planner/confirm', data)
    return response.data
  },
}

export default mealPlannerService
