/**
 * NutritionSummary Component
 *
 * Displays calculated nutrition totals for all ingredients in recipe.
 * Features:
 * - Show total calories, proteins, carbs, fats
 * - Visual progress bars for macronutrients
 * - Color-coded by nutrient type (protein=blue, carbs=green, fats=orange)
 * - Updates in real-time as ingredients are added/removed/modified
 */

interface NutritionSummaryProps {
  calories: number
  proteins_g: number
  carbs_g: number
  fats_g: number
}

export function NutritionSummary({
  calories,
  proteins_g,
  carbs_g,
  fats_g,
}: NutritionSummaryProps) {
  // Calculate total grams of macros for percentage calculation
  const totalMacros = proteins_g + carbs_g + fats_g

  // Calculate percentage of each macro (for visual bars)
  const proteinPercent = totalMacros > 0 ? (proteins_g / totalMacros) * 100 : 0
  const carbsPercent = totalMacros > 0 ? (carbs_g / totalMacros) * 100 : 0
  const fatsPercent = totalMacros > 0 ? (fats_g / totalMacros) * 100 : 0

  // Calculate calories from each macro
  // Proteins and Carbs: 4 kcal/g, Fats: 9 kcal/g
  const caloriesFromProtein = proteins_g * 4
  const caloriesFromCarbs = carbs_g * 4
  const caloriesFromFats = fats_g * 9

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-5 h-5 text-primary-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">Valori Nutrizionali</h3>
      </div>

      {/* Total Calories */}
      <div className="mb-6 text-center py-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg">
        <div className="text-sm text-gray-600 mb-1">Calorie Totali</div>
        <div className="text-4xl font-bold text-primary-600">
          {calories.toFixed(0)}
        </div>
        <div className="text-sm text-gray-500 mt-1">kcal</div>
      </div>

      {/* Macronutrients Breakdown */}
      <div className="space-y-4">
        {/* Proteins */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">Proteine</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-gray-900">
                {proteins_g.toFixed(1)}g
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({caloriesFromProtein.toFixed(0)} kcal)
              </span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${proteinPercent}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {proteinPercent.toFixed(0)}% del totale macro
          </div>
        </div>

        {/* Carbs */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">Carboidrati</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-gray-900">
                {carbs_g.toFixed(1)}g
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({caloriesFromCarbs.toFixed(0)} kcal)
              </span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${carbsPercent}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {carbsPercent.toFixed(0)}% del totale macro
          </div>
        </div>

        {/* Fats */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">Grassi</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-gray-900">
                {fats_g.toFixed(1)}g
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({caloriesFromFats.toFixed(0)} kcal)
              </span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${fatsPercent}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {fatsPercent.toFixed(0)}% del totale macro
          </div>
        </div>
      </div>

      {/* Info Note */}
      {totalMacros === 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 text-center">
          Aggiungi ingredienti per vedere i valori nutrizionali
        </div>
      )}
    </div>
  )
}
