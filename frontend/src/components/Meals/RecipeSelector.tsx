/**
 * RecipeSelector Component
 *
 * Searchable dropdown selector for existing recipes.
 * Fetches recipes from the API based on current house context.
 * Displays recipe name and shows nutritional info when selected.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import recipesService from '@/services/recipes'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { Recipe } from '@/types'

interface RecipeSelectorProps {
  value: string | null
  onChange: (recipeId: string | null, recipe: Recipe | null) => void
  disabled?: boolean
}

export function RecipeSelector({ value, onChange, disabled = false }: RecipeSelectorProps) {
  const { currentHouse } = useHouse()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch recipes when house changes
  useEffect(() => {
    const fetchRecipes = async () => {
      if (!currentHouse?.id) {
        setRecipes([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const data = await recipesService.getAll(currentHouse.id)
        // API returns { recipes: [...], total, limit, offset }
        setRecipes(Array.isArray(data.recipes) ? data.recipes : [])
      } catch (err) {
        console.error('Failed to fetch recipes:', err)
        setError('Impossibile caricare le ricette')
        setRecipes([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecipes()
  }, [currentHouse?.id])

  const safeRecipes = Array.isArray(recipes) ? recipes : []

  const options = safeRecipes.map((r) => ({
    value: r.id,
    label: r.name,
    sublabel: r.total_calories ? `${Math.round(r.total_calories)} kcal` : '',
  }))

  const selectedRecipe = safeRecipes.find((r) => r.id === value) ?? null

  const handleChange = (val: string | null) => {
    const recipe = val ? safeRecipes.find((r) => r.id === val) ?? null : null
    onChange(val, recipe)
  }

  const newRecipeLink = (
    <Link
      to="/recipes/new"
      className="flex items-center justify-center w-10 h-10 bg-green-500 text-white rounded-lg hover:bg-green-600 flex-shrink-0"
      title="Nuova ricetta"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    </Link>
  )

  return (
    <div className="space-y-2">
      <label className="label">Seleziona ricetta</label>

      <SearchableSelect
        options={options}
        value={value}
        onChange={handleChange}
        placeholder="-- Seleziona una ricetta --"
        emptyLabel="Nessuna ricetta trovata"
        disabled={disabled || isLoading}
        renderSuffix={newRecipeLink}
      />

      {/* Loading state */}
      {isLoading && (
        <p className="text-sm text-gray-500">Caricamento ricette...</p>
      )}

      {/* Error state */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Empty state */}
      {!isLoading && !error && safeRecipes.length === 0 && (
        <p className="text-sm text-gray-500">
          Nessuna ricetta disponibile. Creane una prima!
        </p>
      )}

      {/* Selected recipe nutrition info */}
      {selectedRecipe && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Valori nutrizionali (porzione intera)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Calorie:</span>
              <span className="ml-1 font-medium">
                {selectedRecipe.total_calories?.toFixed(0) || '0'} kcal
              </span>
            </div>
            <div>
              <span className="text-gray-500">Proteine:</span>
              <span className="ml-1 font-medium">
                {selectedRecipe.total_proteins_g?.toFixed(1) || '0'} g
              </span>
            </div>
            <div>
              <span className="text-gray-500">Carboidrati:</span>
              <span className="ml-1 font-medium">
                {selectedRecipe.total_carbs_g?.toFixed(1) || '0'} g
              </span>
            </div>
            <div>
              <span className="text-gray-500">Grassi:</span>
              <span className="ml-1 font-medium">
                {selectedRecipe.total_fats_g?.toFixed(1) || '0'} g
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecipeSelector
