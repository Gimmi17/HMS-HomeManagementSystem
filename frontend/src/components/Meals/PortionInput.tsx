/**
 * PortionInput Component
 *
 * Input/slider for portion multiplier (0.5x, 1x, 1.5x, 2x)
 * Shows calculated nutritional values based on multiplier
 * Used when creating a meal from an existing recipe
 */

import type { Recipe } from '@/types'

interface PortionInputProps {
  value: number
  onChange: (value: number) => void
  recipe: Recipe | null
  disabled?: boolean
}

// Predefined portion options for quick selection
const PORTION_OPTIONS = [
  { value: 0.5, label: '1/2 porzione' },
  { value: 1, label: '1 porzione' },
  { value: 1.5, label: '1.5 porzioni' },
  { value: 2, label: '2 porzioni' },
]

export function PortionInput({ value, onChange, recipe, disabled = false }: PortionInputProps) {
  // Calculate nutrition values based on portion multiplier
  const calculatedNutrition = recipe ? {
    calories: (recipe.total_calories || 0) * value,
    proteins_g: (recipe.total_proteins_g || 0) * value,
    carbs_g: (recipe.total_carbs_g || 0) * value,
    fats_g: (recipe.total_fats_g || 0) * value,
  } : null

  return (
    <div className="space-y-3">
      <label className="label">Porzione</label>

      {/* Quick selection buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PORTION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`
              px-3 py-2 rounded-lg border text-sm font-medium transition-colors
              ${
                value === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Custom value input */}
      <div className="flex items-center gap-3">
        <label htmlFor="portion-custom" className="text-sm text-gray-700 whitespace-nowrap">
          Valore personalizzato:
        </label>
        <input
          id="portion-custom"
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 1)}
          disabled={disabled}
          className="input w-24"
        />
        <span className="text-sm text-gray-500">x</span>
      </div>

      {/* Slider for visual adjustment */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">0.5x</span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-sm text-gray-500">2x</span>
      </div>

      {/* Calculated nutrition display */}
      {calculatedNutrition && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Valori nutrizionali per questa porzione ({value}x)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-blue-600">Calorie:</span>
              <span className="ml-1 font-medium text-blue-900">
                {calculatedNutrition.calories.toFixed(0)} kcal
              </span>
            </div>
            <div>
              <span className="text-blue-600">Proteine:</span>
              <span className="ml-1 font-medium text-blue-900">
                {calculatedNutrition.proteins_g.toFixed(1)} g
              </span>
            </div>
            <div>
              <span className="text-blue-600">Carboidrati:</span>
              <span className="ml-1 font-medium text-blue-900">
                {calculatedNutrition.carbs_g.toFixed(1)} g
              </span>
            </div>
            <div>
              <span className="text-blue-600">Grassi:</span>
              <span className="ml-1 font-medium text-blue-900">
                {calculatedNutrition.fats_g.toFixed(1)} g
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PortionInput
