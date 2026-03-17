import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { recipesService } from '@/services/recipes'
import { useHouse } from '@/context/HouseContext'
import { RecipeHeader } from '@/components/Recipes/RecipeHeader'
import { IngredientTable } from '@/components/Recipes/IngredientTable'
import { NutritionCard } from '@/components/Recipes/NutritionCard'
import { ProcedureSection } from '@/components/Recipes/ProcedureSection'
import { PortionCalculator } from '@/components/Recipes/PortionCalculator'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import { MealTypeSelector } from '@/components/Meals/MealTypeSelector'
import { PortionInput } from '@/components/Meals/PortionInput'
import mealsService from '@/services/meals'
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
  const [searchParams] = useSearchParams()
  const { currentHouse } = useHouse()

  // Inquiry mode detection
  const inquiry = searchParams.get('inquiry')
  const inquiryDate = searchParams.get('date') || ''
  const inquiryMealType = searchParams.get('meal_type') || ''
  const isInquiry = inquiry === 'meal'

  // Recipe data
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [portionMultiplier, setPortionMultiplier] = useState(1.0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Prepare Meal drawer state
  const [showPrepareDrawer, setShowPrepareDrawer] = useState(false)
  const [drawerMealType, setDrawerMealType] = useState<'colazione' | 'spuntino' | 'pranzo' | 'cena'>('pranzo')
  const [drawerPortion, setDrawerPortion] = useState(1.0)
  const [drawerSubmitting, setDrawerSubmitting] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

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
   * Submit meal via quick drawer
   */
  const handlePrepareMeal = async () => {
    if (!currentHouse || !recipe) return
    setDrawerSubmitting(true)
    setDrawerError(null)
    try {
      const newMeal = await mealsService.create(currentHouse.id, {
        recipe_id: recipe.id,
        meal_type: drawerMealType,
        consumed_at: new Date().toISOString(),
      })
      // Decrementa stock se la ricetta ha ingredienti collegati a prodotti dispensa
      if (recipe.ingredients?.some((ing: any) => ing.product_id)) {
        try {
          await mealsService.consumeRecipeStock(newMeal.id, currentHouse.id, drawerPortion)
        } catch (e) {
          // Non critico — logga ma non blocca il flusso
          console.error('Stock decrement non critico:', e)
        }
      }
      setShowPrepareDrawer(false)
      setShowSuccessToast(true)
      setTimeout(() => setShowSuccessToast(false), 3000)
    } catch {
      setDrawerError('Errore nel salvataggio. Riprova.')
    } finally {
      setDrawerSubmitting(false)
    }
  }

  /**
   * Navigate to meal creation with recipe pre-filled (or select in inquiry mode)
   */
  const handleSelectOrPrepare = () => {
    if (id) {
      const params = new URLSearchParams()
      params.set('recipe_id', id)
      if (inquiryDate) params.set('date', inquiryDate)
      if (inquiryMealType) params.set('meal_type', inquiryMealType)
      navigate(`/meals/new?${params.toString()}`)
    }
  }

  /**
   * Go back to recipes list (preserving inquiry params)
   */
  const handleBack = () => {
    if (isInquiry) {
      const params = new URLSearchParams()
      params.set('inquiry', 'meal')
      if (inquiryDate) params.set('date', inquiryDate)
      if (inquiryMealType) params.set('meal_type', inquiryMealType)
      navigate(`/recipes?${params.toString()}`)
    } else {
      navigate('/recipes')
    }
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
        {isInquiry ? 'Torna alla selezione' : 'Torna alle Ricette'}
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

              {isInquiry ? (
                /* Inquiry mode: only "Seleziona" button */
                <button
                  onClick={handleSelectOrPrepare}
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Seleziona questa ricetta
                </button>
              ) : (
                <>
                  {/* Prepare button (primary action) */}
                  <button
                    onClick={() => setShowPrepareDrawer(true)}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          title='Elimina ricetta'
          message={`Sei sicuro di voler eliminare "${recipe.name}"? Questa azione non può essere annullata.`}
          onConfirm={handleDeleteConfirm}
          onClose={handleDeleteCancel}
          isDeleting={isDeleting}
        />
      )}

      {/* Success toast */}
      {showSuccessToast && (
        <div className='fixed bottom-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50 animate-fade-in'>
          Pasto registrato!
        </div>
      )}

      {/* Prepare Meal drawer */}
      {showPrepareDrawer && (
        <>
          <div className='fixed inset-0 bg-black/40 z-40' onClick={() => setShowPrepareDrawer(false)} />
          <div className='fixed bottom-0 left-0 right-0 lg:bottom-auto lg:top-20 lg:right-6 lg:left-auto lg:w-80 bg-white rounded-t-2xl lg:rounded-2xl shadow-xl p-4 space-y-4 z-50 animate-slide-up'>
            <div className='flex items-center justify-between'>
              <h3 className='font-semibold text-gray-900'>Prepara Pasto</h3>
              <button onClick={() => setShowPrepareDrawer(false)} className='text-gray-400 hover:text-gray-600'>✕</button>
            </div>
            <MealTypeSelector value={drawerMealType} onChange={setDrawerMealType} />
            <PortionInput value={drawerPortion} onChange={setDrawerPortion} recipe={recipe} />
            {drawerError && <p className='text-sm text-red-600'>{drawerError}</p>}
            <button
              onClick={handlePrepareMeal}
              disabled={drawerSubmitting}
              className='btn btn-primary w-full'
            >
              {drawerSubmitting ? 'Salvo...' : 'Registra Pasto'}
            </button>
            <a href={`/meals/new?recipe_id=${recipe.id}`} className='block text-center text-xs text-gray-400 hover:text-gray-600'>Form completo →</a>
          </div>
        </>
      )}
    </div>
  )
}
