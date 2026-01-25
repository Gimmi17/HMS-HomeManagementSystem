/**
 * NutritionSummary Component
 *
 * Displays calculated nutritional information for a meal
 * Shows macronutrients (calories, proteins, carbs, fats) in a visual grid
 * Calculates values based on ingredients and their quantities
 */

import { useMemo } from 'react'
import type { RecipeIngredient, Food } from '@/types'

interface NutritionSummaryProps {
  ingredients: RecipeIngredient[]
  foods: Map<string, Food> // Map of food_id to Food data for calculation
  className?: string
}

export function NutritionSummary({ ingredients, foods, className = '' }: NutritionSummaryProps) {
  // Calculate total nutrition from ingredients
  const nutrition = useMemo(() => {
    let calories = 0
    let proteins_g = 0
    let carbs_g = 0
    let fats_g = 0

    for (const ingredient of ingredients) {
      if (!ingredient.food_id) continue
      const food = foods.get(ingredient.food_id)
      if (!food) continue

      // Calculate based on quantity (food values are per 100g)
      const ratio = ingredient.quantity_g / 100
      calories += (food.calories || 0) * ratio
      proteins_g += food.proteins_g * ratio
      carbs_g += food.carbs_g * ratio
      fats_g += food.fats_g * ratio
    }

    return {
      calories: Math.round(calories),
      proteins_g: proteins_g.toFixed(1),
      carbs_g: carbs_g.toFixed(1),
      fats_g: fats_g.toFixed(1),
    }
  }, [ingredients, foods])

  if (ingredients.length === 0) {
    return null
  }

  return (
    <div className={`p-4 bg-green-50 border border-green-200 rounded-lg ${className}`}>
      <h3 className="text-sm font-semibold text-green-900 mb-3">
        Riepilogo nutrizionale
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Calories */}
        <div className="text-center">
          <div className="text-2xl font-bold text-green-900">
            {nutrition.calories}
          </div>
          <div className="text-xs text-green-700 mt-1">kcal</div>
        </div>

        {/* Proteins */}
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900">
            {nutrition.proteins_g}
          </div>
          <div className="text-xs text-blue-700 mt-1">Proteine (g)</div>
        </div>

        {/* Carbs */}
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-900">
            {nutrition.carbs_g}
          </div>
          <div className="text-xs text-amber-700 mt-1">Carboidrati (g)</div>
        </div>

        {/* Fats */}
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-900">
            {nutrition.fats_g}
          </div>
          <div className="text-xs text-orange-700 mt-1">Grassi (g)</div>
        </div>
      </div>
    </div>
  )
}

export default NutritionSummary
