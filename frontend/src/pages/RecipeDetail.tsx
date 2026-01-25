import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { recipesService } from '@/services/recipes'
import { useHouse } from '@/context/HouseContext'
import { RecipeHeader } from '@/components/Recipes/RecipeHeader'
import { IngredientTable } from '@/components/Recipes/IngredientTable'
import { NutritionCard } from '@/components/Recipes/NutritionCard'
import { ProcedureSection } from '@/components/Recipes/ProcedureSection'
import { PortionCalculator } from '@/components/Recipes/PortionCalculator'
import type { Recipe } from '@/types'

/**
 * RecipeDetail Page Component
 *
 * Displays complete recipe details with:
 * - Recipe header (name, time, difficulty, tags)
 * - Ingredients table with nutritional values
 * - Total nutrition summary
 * - Cooking procedure/instructions
 * - Portion calculator (1-10 portions)
 * - Action buttons (Edit, Delete, Prepare as meal)
 *
 * Features:
 * - Real-time portion calculation (scales quantities and nutrition)
 * - Delete confirmation modal
 * - Navigate to meal creation with recipe pre-filled
 * - Responsive layout with sidebar
 *
 * Routes:
 * - /recipes/:id - View recipe detail
 * - Edit → /recipes/:id/edit
 * - Prepare → /meals/new?recipe_id=:id
 */

export default function RecipeDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { currentHouse } = useHouse()

  // Recipe data
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [portionMultiplier, setPortionMultiplier] = useState(1.0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /**
   * Load recipe data on mount
   */
  useEffect(() => {
    if (id && currentHouse) {
      loadRecipe(id)
    }
  }, [id, currentHouse])

  /**
   * Fetch recipe from API
   */
  const loadRecipe = async (recipeId: string) => {
    if (!currentHouse) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await recipesService.getById(recipeId, currentHouse.id)
      setRecipe(data)
    } catch (err) {
      console.error('Errore nel caricamento ricetta:', err)
      setError('Impossibile caricare la ricetta')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Navigate to edit page
   */
  const handleEdit = () => {
    if (id) {
      navigate(`/recipes/${id}/edit`)
    }
  }

  /**
   * Show delete confirmation modal
   */
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  /**
   * Confirm and delete recipe
   */
  const handleDeleteConfirm = async () => {
    if (!id || !currentHouse) return

    setIsDeleting(true)
    setError(null)

    try {
      await recipesService.delete(id, currentHouse.id)
      // Navigate back to recipes list after successful deletion
      navigate('/recipes')
    } catch (err) {
      console.error('Errore durante eliminazione:', err)
      setError('Impossibile eliminare la ricetta. Riprova.')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Cancel delete operation
   */
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  /**
   * Navigate to meal creation with recipe pre-filled
   */
  const handlePrepare = () => {
    if (id) {
      navigate(`/meals/new?recipe_id=${id}`)
    }
  }

  /**
   * Go back to recipes list
   */
  const handleBack = () => {
    navigate('/recipes')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Caricamento ricetta...</div>
      </div>
    )
  }

  // Error state
  if (error && !recipe) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <div className="text-center text-red-600 py-8">
            <p className="text-lg font-semibold mb-2">Errore</p>
            <p>{error}</p>
            <button onClick={handleBack} className="btn btn-primary mt-4">
              Torna alle Ricette
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No recipe found
  if (!recipe) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-semibold mb-2">Ricetta non trovata</p>
            <button onClick={handleBack} className="btn btn-primary mt-4">
              Torna alle Ricette
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Torna alle Ricette
      </button>

      {/* Error message (for delete errors) */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipe Header */}
          <RecipeHeader recipe={recipe} />

          {/* Ingredients Table */}
          <IngredientTable
            ingredients={recipe.ingredients}
            portionMultiplier={portionMultiplier}
          />

          {/* Procedure Section */}
          <ProcedureSection procedure={recipe.procedure} />
        </div>

        {/* Sidebar column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Portion Calculator */}
            <PortionCalculator
              portionMultiplier={portionMultiplier}
              onChange={setPortionMultiplier}
            />

            {/* Nutrition Card */}
            <NutritionCard
              calories={recipe.total_calories}
              proteins_g={recipe.total_proteins_g}
              carbs_g={recipe.total_carbs_g}
              fats_g={recipe.total_fats_g}
              portionMultiplier={portionMultiplier}
            />

            {/* Action Buttons */}
            <div className="card space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Azioni</h3>

              {/* Prepare button (primary action) */}
              <button
                onClick={handlePrepare}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Prepara Pasto
              </button>

              {/* Edit button */}
              <button
                onClick={handleEdit}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Modifica
              </button>

              {/* Delete button */}
              <button
                onClick={handleDeleteClick}
                className="btn btn-danger w-full flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Elimina
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Conferma Eliminazione
            </h3>
            <p className="text-gray-700 mb-6">
              Sei sicuro di voler eliminare la ricetta "{recipe.name}"? Questa
              azione non può essere annullata.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn btn-danger flex-1"
              >
                {isDeleting ? 'Eliminazione...' : 'Elimina'}
              </button>
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="btn btn-secondary flex-1"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
