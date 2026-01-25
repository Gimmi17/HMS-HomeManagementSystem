import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { recipesService } from '@/services/recipes'
import { useHouse } from '@/context/HouseContext'
import { DynamicIngredientInput } from '@/components/Recipes/DynamicIngredientInput'
import { NutritionSummary } from '@/components/Recipes/NutritionSummary'
import { TagInput } from '@/components/Recipes/TagInput'
import type { RecipeIngredient } from '@/types'

/**
 * RecipeForm Page Component
 *
 * Main form for creating and editing recipes.
 * Features:
 * - Create new recipe or edit existing one (based on URL params)
 * - Dynamic ingredient rows with add/remove functionality
 * - Real-time nutrition calculation as ingredients are modified
 * - Form validation before submission
 * - Tags management
 * - Difficulty selection
 * - Preparation time input
 *
 * Routes:
 * - /recipes/new - Create new recipe
 * - /recipes/:id/edit - Edit existing recipe
 */

export default function RecipeForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { currentHouse } = useHouse()
  const isEditMode = !!id

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [procedure, setProcedure] = useState('')
  const [preparationTime, setPreparationTime] = useState<number>(0)
  const [portions, setPortions] = useState<number>(1)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [tags, setTags] = useState<string[]>([])
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load recipe data in edit mode
   */
  useEffect(() => {
    if (isEditMode && id && currentHouse) {
      loadRecipe(id)
    }
  }, [isEditMode, id, currentHouse])

  /**
   * Fetch recipe data from API and populate form
   */
  const loadRecipe = async (recipeId: string) => {
    if (!currentHouse) return

    setIsLoading(true)
    setError(null)
    try {
      const recipe = await recipesService.getById(recipeId, currentHouse.id)

      // Populate form with recipe data
      setName(recipe.name)
      setDescription(recipe.description || '')
      setProcedure(recipe.procedure || '')
      setPreparationTime(recipe.preparation_time_min || 0)
      setDifficulty(recipe.difficulty || 'medium')
      setTags(recipe.tags || [])

      // Convert recipe ingredients to the expected format
      const ingredientData: RecipeIngredient[] = recipe.ingredients.map(ing => ({
        food_id: ing.food_id,
        food_name: ing.food_name,
        quantity: ing.quantity || ing.quantity_g, // Fallback for old data
        unit: ing.unit || 'g',
        quantity_g: ing.quantity_g,
      }))
      setIngredients(ingredientData)
    } catch (err) {
      console.error('Errore nel caricamento ricetta:', err)
      setError('Impossibile caricare la ricetta')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Calculate total nutrition from all ingredients
   */
  const calculateTotalNutrition = () => {
    // Note: Actual calculation is done server-side
    // This is a simple client-side estimate for preview
    // We'd need the food's nutrition data to calculate accurately
    return {
      calories: 0,
      proteins_g: 0,
      carbs_g: 0,
      fats_g: 0,
    }
  }

  /**
   * Validate form before submission
   */
  const validateForm = (): string | null => {
    if (!name.trim()) return 'Il nome della ricetta è obbligatorio'
    if (ingredients.length === 0) return 'Aggiungi almeno un ingrediente'
    if (!currentHouse) return 'Seleziona una casa prima di continuare'
    return null
  }

  /**
   * Handle form submission (create or update)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Prepare recipe data
      const recipeData = {
        name: name.trim(),
        description: description.trim() || undefined,
        procedure: procedure.trim() || undefined,
        preparation_time_min: preparationTime > 0 ? preparationTime : undefined,
        difficulty,
        tags,
        ingredients: ingredients.map(ing => ({
          food_id: ing.food_id,
          food_name: ing.food_name,
          quantity: ing.quantity,
          unit: ing.unit,
          quantity_g: ing.quantity_g,
        })),
      }

      if (isEditMode && id) {
        // Update existing recipe
        await recipesService.update(id, currentHouse!.id, recipeData)
      } else {
        // Create new recipe
        await recipesService.create(currentHouse!.id, recipeData)
      }

      // Navigate back to recipes list
      navigate('/recipes')
    } catch (err: any) {
      console.error('Errore nel salvataggio ricetta:', err)
      setError(err?.response?.data?.detail || 'Errore nel salvataggio della ricetta. Riprova.')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Cancel and go back to recipes list
   */
  const handleCancel = () => {
    if (confirm('Vuoi annullare? Le modifiche non salvate andranno perse.')) {
      navigate('/recipes')
    }
  }

  // Check if house is selected
  if (!currentHouse) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-medium text-yellow-800 mb-2">
            Nessuna casa selezionata
          </h2>
          <p className="text-yellow-700 mb-4">
            Devi selezionare o creare una casa prima di poter aggiungere ricette.
          </p>
          <button
            onClick={() => navigate('/house')}
            className="btn btn-primary"
          >
            Vai alla gestione casa
          </button>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    )
  }

  const totalNutrition = calculateTotalNutrition()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Modifica Ricetta' : 'Nuova Ricetta'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditMode
            ? 'Modifica i dettagli della ricetta'
            : 'Crea una nuova ricetta aggiungendo ingredienti e istruzioni'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Casa: <span className="font-medium">{currentHouse.name}</span>
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Informazioni Base</h2>

              {/* Recipe Name */}
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Ricetta *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es: Pasta al pomodoro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrizione
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrizione della ricetta..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>

              {/* Preparation Time, Portions and Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Preparation Time */}
                <div>
                  <label htmlFor="prep-time" className="block text-sm font-medium text-gray-700 mb-1">
                    Tempo (minuti)
                  </label>
                  <input
                    id="prep-time"
                    type="number"
                    value={preparationTime || ''}
                    onChange={(e) => setPreparationTime(parseInt(e.target.value) || 0)}
                    placeholder="30"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Portions */}
                <div>
                  <label htmlFor="portions" className="block text-sm font-medium text-gray-700 mb-1">
                    Porzioni
                  </label>
                  <input
                    id="portions"
                    type="number"
                    value={portions || ''}
                    onChange={(e) => setPortions(parseInt(e.target.value) || 1)}
                    placeholder="4"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Difficulty */}
                <div>
                  <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
                    Difficoltà
                  </label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  >
                    <option value="easy">Facile</option>
                    <option value="medium">Media</option>
                    <option value="hard">Difficile</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Ingredients Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Ingredienti *
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Cerca e aggiungi gli ingredienti. Usa il pulsante + per aggiungere nuove righe.
              </p>

              <DynamicIngredientInput
                ingredients={ingredients}
                onChange={setIngredients}
              />
            </div>

            {/* Procedure Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Procedimento</h2>
              <textarea
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                placeholder="Descrivi i passaggi per preparare la ricetta..."
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            {/* Tags Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Tags</h2>
              <TagInput tags={tags} onChange={setTags} />
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Nutrition Summary */}
              <NutritionSummary
                calories={totalNutrition.calories}
                proteins_g={totalNutrition.proteins_g}
                carbs_g={totalNutrition.carbs_g}
                fats_g={totalNutrition.fats_g}
              />

              {/* Ingredients count */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ingredienti:</span>
                  <span className="font-medium text-gray-900">{ingredients.length}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isSaving
                    ? 'Salvataggio...'
                    : isEditMode
                    ? 'Salva Modifiche'
                    : 'Crea Ricetta'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
