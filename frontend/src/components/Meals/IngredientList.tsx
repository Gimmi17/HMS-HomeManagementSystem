/**
 * IngredientList Component
 *
 * Displays and manages a list of selected ingredients with quantities
 * Features:
 * - Add/remove ingredients
 * - Edit quantities (in grams)
 * - Real-time nutritional calculation
 * - Visual feedback and validation
 */

import type { RecipeIngredient } from '@/types'

interface IngredientListProps {
  ingredients: RecipeIngredient[]
  onUpdate: (ingredients: RecipeIngredient[]) => void
  disabled?: boolean
}

export function IngredientList({ ingredients, onUpdate, disabled = false }: IngredientListProps) {
  // Update ingredient quantity
  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], quantity_g: quantity }
    onUpdate(updated)
  }

  // Remove ingredient
  const handleRemove = (index: number) => {
    const updated = ingredients.filter((_, i) => i !== index)
    onUpdate(updated)
  }

  if (ingredients.length === 0) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-lg">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-2"
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
        <p className="text-gray-500">Nessun ingrediente aggiunto</p>
        <p className="text-sm text-gray-400 mt-1">Cerca e aggiungi ingredienti dall'elenco sopra</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ingredients.map((ingredient, index) => (
        <div
          key={`${ingredient.food_id}-${index}`}
          className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* Ingredient name */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {ingredient.food_name}
              </div>
            </div>

            {/* Quantity input and remove button */}
            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={ingredient.quantity_g}
                  onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  className="input w-20 sm:w-24 text-right"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">g</span>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Rimuovi ingrediente"
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
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="pt-2 border-t border-gray-200">
        <div className="text-sm text-gray-600 flex justify-between">
          <span>Totale ingredienti:</span>
          <span className="font-medium text-gray-900">{ingredients.length}</span>
        </div>
        <div className="text-sm text-gray-600 flex justify-between mt-1">
          <span>Peso totale:</span>
          <span className="font-medium text-gray-900">
            {ingredients.reduce((sum, ing) => sum + ing.quantity_g, 0).toFixed(0)} g
          </span>
        </div>
      </div>
    </div>
  )
}

export default IngredientList
