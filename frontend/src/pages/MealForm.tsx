/**
 * MealForm Page - Mobile-first design
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import mealsService from '@/services/meals'
import recipesService from '@/services/recipes'
import foodsService from '@/services/foods'
import type { Recipe, RecipeIngredient, Food, MealCreate, RecipeCreate } from '@/types'
import {
  MealTypeSelector,
  RecipeSelector,
  PortionInput,
  SaveAsRecipeToggle,
  IngredientSearch,
  IngredientList,
  NutritionSummary,
} from '@/components/Meals'

type MealMode = 'from_recipe' | 'free_meal'
type MealType = 'colazione' | 'spuntino' | 'pranzo' | 'cena'

/**
 * Determines the meal type based on current time
 */
function getMealTypeByTime(): MealType {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours * 60 + minutes

  if (time >= 6 * 60 && time < 10 * 60 + 30) {
    return 'colazione'
  } else if (time >= 10 * 60 + 30 && time < 12 * 60) {
    return 'spuntino'
  } else if (time >= 12 * 60 && time < 15 * 60) {
    return 'pranzo'
  } else if (time >= 15 * 60 && time < 18 * 60 + 30) {
    return 'spuntino'
  } else if (time >= 18 * 60 + 30 && time < 22 * 60) {
    return 'cena'
  } else {
    return 'spuntino'
  }
}

export function MealForm() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()

  // Form state
  const [mode, setMode] = useState<MealMode>('from_recipe')
  const [mealType, setMealType] = useState<MealType>(getMealTypeByTime)
  const [consumedAt, setConsumedAt] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  })
  const [notes, setNotes] = useState('')

  // Recipe mode state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [portionMultiplier, setPortionMultiplier] = useState(1)

  // Free meal mode state
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [saveAsRecipe, setSaveAsRecipe] = useState(false)
  const [newRecipeName, setNewRecipeName] = useState('')

  // Foods cache
  const [foodsMap, setFoodsMap] = useState<Map<string, Food>>(new Map())

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFoodData = async () => {
      const foodIds = ingredients
        .map((ing) => ing.food_id)
        .filter((id): id is string => id !== undefined && !foodsMap.has(id))

      if (foodIds.length === 0) return

      try {
        const promises = foodIds.map((id) => foodsService.getById(id))
        const foods = await Promise.all(promises)

        setFoodsMap((prev) => {
          const newMap = new Map(prev)
          foods.forEach((food) => newMap.set(food.id, food))
          return newMap
        })
      } catch (err) {
        console.error('Failed to load food data:', err)
      }
    }

    loadFoodData()
  }, [ingredients, foodsMap])

  const handleModeChange = (newMode: MealMode) => {
    setMode(newMode)
    setError(null)

    if (newMode === 'from_recipe') {
      setIngredients([])
      setSaveAsRecipe(false)
      setNewRecipeName('')
    } else {
      setSelectedRecipeId(null)
      setSelectedRecipe(null)
      setPortionMultiplier(1)
    }
  }

  const handleIngredientSelect = (food: Food) => {
    const exists = ingredients.some((ing) => ing.food_id === food.id)
    if (exists) {
      setError('Ingrediente già aggiunto')
      setTimeout(() => setError(null), 3000)
      return
    }

    const newIngredient: RecipeIngredient = {
      food_id: food.id,
      food_name: food.name,
      quantity: 100,
      unit: 'g',
      quantity_g: 100,
    }

    setIngredients((prev) => [...prev, newIngredient])
  }

  const calculateNutrition = () => {
    if (mode === 'from_recipe' && selectedRecipe) {
      return {
        calories: (selectedRecipe.total_calories || 0) * portionMultiplier,
        proteins_g: (selectedRecipe.total_proteins_g || 0) * portionMultiplier,
        carbs_g: (selectedRecipe.total_carbs_g || 0) * portionMultiplier,
        fats_g: (selectedRecipe.total_fats_g || 0) * portionMultiplier,
      }
    }

    let calories = 0, proteins_g = 0, carbs_g = 0, fats_g = 0

    for (const ingredient of ingredients) {
      if (!ingredient.food_id) continue
      const food = foodsMap.get(ingredient.food_id)
      if (!food) continue

      const ratio = ingredient.quantity_g / 100
      calories += (food.calories || 0) * ratio
      proteins_g += food.proteins_g * ratio
      carbs_g += food.carbs_g * ratio
      fats_g += food.fats_g * ratio
    }

    return { calories, proteins_g, carbs_g, fats_g }
  }

  const validateForm = (): string | null => {
    if (!currentHouse) return 'Nessuna casa selezionata'

    if (mode === 'from_recipe') {
      if (!selectedRecipeId) return 'Seleziona una ricetta'
      if (portionMultiplier <= 0) return 'La porzione deve essere maggiore di 0'
    } else {
      if (ingredients.length === 0) return 'Aggiungi almeno un ingrediente'
      if (saveAsRecipe && !newRecipeName.trim()) return 'Inserisci un nome per la ricetta'
    }

    if (!consumedAt) return 'Seleziona data e ora del pasto'

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let recipeId = selectedRecipeId

      if (mode === 'free_meal' && saveAsRecipe) {
        const recipeData: RecipeCreate = {
          name: newRecipeName.trim(),
          ingredients,
        }
        const newRecipe = await recipesService.create(currentHouse!.id, recipeData)
        recipeId = newRecipe.id
      }

      const mealData: MealCreate = {
        recipe_id: recipeId || undefined,
        ingredients: mode === 'free_meal' ? ingredients : undefined,
        meal_type: mealType,
        quantity_grams: mode === 'free_meal'
          ? ingredients.reduce((sum, ing) => sum + ing.quantity_g, 0)
          : undefined,
        consumed_at: new Date(consumedAt).toISOString(),
        notes: notes.trim() || undefined,
      }

      await mealsService.create(currentHouse!.id, mealData)
      navigate('/meals')
    } catch (err: any) {
      console.error('Failed to create meal:', err)
      setError(err.response?.data?.detail || 'Errore durante la creazione del pasto')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!currentHouse) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            Seleziona o crea una casa prima di registrare un pasto
          </p>
        </div>
      </div>
    )
  }

  const nutrition = calculateNutrition()

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Registra Pasto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode selector - horizontal toggle on mobile */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('from_recipe')}
            className={`
              p-3 rounded-lg border-2 transition-all text-center
              ${mode === 'from_recipe'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600'}
            `}
          >
            <div className="text-xl mb-1">📖</div>
            <div className="text-xs font-medium">Da Ricetta</div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('free_meal')}
            className={`
              p-3 rounded-lg border-2 transition-all text-center
              ${mode === 'free_meal'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600'}
            `}
          >
            <div className="text-xl mb-1">🍽️</div>
            <div className="text-xs font-medium">Pasto Libero</div>
          </button>
        </div>

        {/* Meal type selector */}
        <div className="card p-3">
          <MealTypeSelector value={mealType} onChange={setMealType} />
        </div>

        {/* Mode-specific content */}
        {mode === 'from_recipe' ? (
          <div className="card p-3 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Ricetta</h2>
            <RecipeSelector
              value={selectedRecipeId}
              onChange={(id, recipe) => {
                setSelectedRecipeId(id)
                setSelectedRecipe(recipe)
              }}
            />

            {selectedRecipe && (
              <PortionInput
                value={portionMultiplier}
                onChange={setPortionMultiplier}
                recipe={selectedRecipe}
              />
            )}
          </div>
        ) : (
          <>
            <div className="card p-3 space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Ingredienti</h2>
              <IngredientSearch onSelect={handleIngredientSelect} />
              <IngredientList ingredients={ingredients} onUpdate={setIngredients} />
              <NutritionSummary ingredients={ingredients} foods={foodsMap} />
            </div>

            <div className="card p-3">
              <SaveAsRecipeToggle
                checked={saveAsRecipe}
                recipeName={newRecipeName}
                onCheckedChange={setSaveAsRecipe}
                onRecipeNameChange={setNewRecipeName}
              />
            </div>
          </>
        )}

        {/* Date/time */}
        <div className="card p-3 space-y-3">
          <div>
            <label htmlFor="consumed-at" className="label text-xs">
              Data e ora
            </label>
            <input
              id="consumed-at"
              type="datetime-local"
              value={consumedAt}
              onChange={(e) => setConsumedAt(e.target.value)}
              required
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="notes" className="label text-xs">
              Note (opzionale)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Aggiungi note..."
              className="input w-full resize-none"
            />
          </div>
        </div>

        {/* Nutrition summary */}
        {(selectedRecipe || ingredients.length > 0) && (
          <div className="card p-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Totale</h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-lg font-bold text-gray-900">{Math.round(nutrition.calories)}</div>
                <div className="text-[10px] text-gray-500">kcal</div>
              </div>
              <div className="bg-blue-50 rounded p-2">
                <div className="text-lg font-bold text-blue-600">{nutrition.proteins_g.toFixed(0)}</div>
                <div className="text-[10px] text-blue-500">Proteine</div>
              </div>
              <div className="bg-yellow-50 rounded p-2">
                <div className="text-lg font-bold text-yellow-600">{nutrition.carbs_g.toFixed(0)}</div>
                <div className="text-[10px] text-yellow-500">Carbo</div>
              </div>
              <div className="bg-red-50 rounded p-2">
                <div className="text-lg font-bold text-red-600">{nutrition.fats_g.toFixed(0)}</div>
                <div className="text-[10px] text-red-500">Grassi</div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Actions - sticky on mobile */}
        <div className="flex gap-2 sticky bottom-16 sm:bottom-0 bg-gray-50 -mx-4 px-4 py-3 border-t sm:border-0 sm:bg-transparent sm:static sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/meals')}
            disabled={isSubmitting}
            className="btn btn-secondary flex-1 sm:flex-none text-sm"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary flex-1 sm:flex-none text-sm"
          >
            {isSubmitting ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MealForm
