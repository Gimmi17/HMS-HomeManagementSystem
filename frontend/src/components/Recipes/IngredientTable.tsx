import type { RecipeIngredient } from '@/types'
import { useState, useEffect } from 'react'
import { foodsService } from '@/services/foods'

/**
 * IngredientTable Component
 *
 * Displays a table of recipe ingredients with their nutritional values.
 * Features:
 * - Ingredient name and quantity
 * - Nutritional values per ingredient (calories, proteins, carbs, fats)
 * - Supports portion multiplier to scale quantities and nutrition
 * - Fetches full food data to calculate accurate nutrition values
 *
 * Props:
 * - ingredients: List of recipe ingredients with food_id and quantity
 * - portionMultiplier: Multiplier for scaling quantities (default 1.0)
 */

interface IngredientTableProps {
  ingredients: RecipeIngredient[]
  portionMultiplier?: number
}

/**
 * Extended ingredient with nutrition data
 */
interface IngredientWithNutrition extends RecipeIngredient {
  calories: number
  proteins_g: number
  carbs_g: number
  fats_g: number
}

export function IngredientTable({
  ingredients,
  portionMultiplier = 1.0,
}: IngredientTableProps) {
  const [enrichedIngredients, setEnrichedIngredients] = useState<
    IngredientWithNutrition[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load full food data for each ingredient to calculate nutrition
   */
  useEffect(() => {
    const loadNutritionData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch all foods data
        const foodsPromises = ingredients
          .filter((ing) => ing.food_id !== undefined)
          .map((ing) => foodsService.getById(ing.food_id!))
        const foods = await Promise.all(foodsPromises)

        // Calculate nutrition for each ingredient based on quantity
        const enriched = ingredients.map((ing, index) => {
          const food = foods[index]
          const scaledQuantity = ing.quantity_g * portionMultiplier
          const ratio = scaledQuantity / 100 // Foods DB has values per 100g

          return {
            ...ing,
            quantity_g: scaledQuantity,
            calories: (food.calories || 0) * ratio,
            proteins_g: food.proteins_g * ratio,
            carbs_g: food.carbs_g * ratio,
            fats_g: food.fats_g * ratio,
          }
        })

        setEnrichedIngredients(enriched)
      } catch (err) {
        console.error('Errore nel caricamento dei dati nutrizionali:', err)
        setError('Impossibile caricare i dati nutrizionali')
      } finally {
        setIsLoading(false)
      }
    }

    if (ingredients.length > 0) {
      loadNutritionData()
    }
  }, [ingredients, portionMultiplier])

  if (isLoading) {
    return (
      <div className="card">
        <div className="text-center text-gray-500 py-8">
          Caricamento ingredienti...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center text-red-600 py-8">{error}</div>
      </div>
    )
  }

  if (enrichedIngredients.length === 0) {
    return (
      <div className="card">
        <div className="text-center text-gray-500 py-8">
          Nessun ingrediente presente
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Ingredienti</h2>

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-3">
        {enrichedIngredients.map((ingredient, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="font-medium text-gray-900">{ingredient.food_name}</div>
              <div className="text-sm font-medium text-gray-900">
                {ingredient.quantity_g.toFixed(0)}g
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-600">
              <span>{ingredient.calories.toFixed(0)} kcal</span>
              <span>P: {ingredient.proteins_g.toFixed(1)}g</span>
              <span>C: {ingredient.carbs_g.toFixed(1)}g</span>
              <span>G: {ingredient.fats_g.toFixed(1)}g</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">
                Ingrediente
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Quantità (g)
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Calorie
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Proteine (g)
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Carb (g)
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">
                Grassi (g)
              </th>
            </tr>
          </thead>
          <tbody>
            {enrichedIngredients.map((ingredient, index) => (
              <tr key={index} className="border-b border-gray-100 last:border-0">
                <td className="py-3 px-4 text-gray-900">{ingredient.food_name}</td>
                <td className="py-3 px-4 text-right text-gray-900 font-medium">
                  {ingredient.quantity_g.toFixed(0)}
                </td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {ingredient.calories.toFixed(0)}
                </td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {ingredient.proteins_g.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {ingredient.carbs_g.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {ingredient.fats_g.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
