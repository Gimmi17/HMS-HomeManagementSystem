import { useState } from 'react'

/**
 * IngredientList Component
 *
 * Displays list of ingredients added to recipe with editable quantities.
 * Features:
 * - Show ingredient name, category, and quantity
 * - Edit quantity inline with validation
 * - Remove ingredient from list
 * - Display nutrition info per ingredient based on quantity
 */

export interface IngredientInput {
  food_id: string
  food_name: string
  category?: string
  quantity_g: number
  // Nutrition data calculated based on quantity (per 100g in DB)
  calories?: number
  proteins_g: number
  carbs_g: number
  fats_g: number
}

interface IngredientListProps {
  ingredients: IngredientInput[]
  onUpdate: (index: number, quantity: number) => void
  onRemove: (index: number) => void
}

export function IngredientList({ ingredients, onUpdate, onRemove }: IngredientListProps) {
  // Track which ingredient is being edited (by index)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  /**
   * Start editing ingredient quantity
   */
  const startEdit = (index: number, currentQuantity: number) => {
    setEditingIndex(index)
    setEditValue(currentQuantity.toString())
  }

  /**
   * Save edited quantity
   * Validates that quantity is a positive number
   */
  const saveEdit = (index: number) => {
    const newQuantity = parseFloat(editValue)
    if (!isNaN(newQuantity) && newQuantity > 0) {
      onUpdate(index, newQuantity)
    }
    setEditingIndex(null)
  }

  /**
   * Cancel editing and restore original value
   */
  const cancelEdit = () => {
    setEditingIndex(null)
    setEditValue('')
  }

  /**
   * Handle Enter key to save, Escape to cancel
   */
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      saveEdit(index)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // Show empty state if no ingredients
  if (ingredients.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p>Nessun ingrediente aggiunto</p>
        <p className="text-sm mt-1">Usa la ricerca sopra per aggiungere ingredienti</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ingredients.map((ingredient, index) => (
        <div
          key={`${ingredient.food_id}-${index}`}
          className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {/* Mobile: stacked layout, Desktop: horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* Ingredient Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {ingredient.food_name}
              </div>
              {ingredient.category && (
                <div className="text-xs text-gray-500">{ingredient.category}</div>
              )}
            </div>

            {/* Quantity, Nutrition, and Remove - second row on mobile */}
            <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
              {/* Quantity Input (Editable) */}
              <div className="flex items-center gap-2">
                {editingIndex === index ? (
                  // Edit mode
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      onBlur={() => saveEdit(index)}
                      autoFocus
                      min="0"
                      step="1"
                      className="w-16 sm:w-20 px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600">g</span>
                  </div>
                ) : (
                  // Display mode
                  <button
                    onClick={() => startEdit(index, ingredient.quantity_g)}
                    className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-white rounded transition-colors"
                  >
                    <span>{ingredient.quantity_g}</span>
                    <span className="text-gray-500">g</span>
                    <svg
                      className="w-3 h-3 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Nutrition Info - compact on mobile */}
              <div className="text-[10px] sm:text-xs text-gray-600 text-right">
                <div className="font-medium">
                  {ingredient.calories?.toFixed(0) || '-'} kcal
                </div>
                <div className="text-gray-500 hidden sm:block">
                  P:{ingredient.proteins_g.toFixed(1)}g
                  {' '}C:{ingredient.carbs_g.toFixed(1)}g
                  {' '}F:{ingredient.fats_g.toFixed(1)}g
                </div>
                <div className="text-gray-500 sm:hidden">
                  P:{ingredient.proteins_g.toFixed(0)} C:{ingredient.carbs_g.toFixed(0)} F:{ingredient.fats_g.toFixed(0)}
                </div>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => onRemove(index)}
                className="flex-shrink-0 p-1.5 sm:p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Rimuovi ingrediente"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
    </div>
  )
}
