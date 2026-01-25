/**
 * NutritionCard Component
 *
 * Displays total nutritional information for a recipe with visual progress bars.
 * Features:
 * - Total calories (prominent display)
 * - Macronutrients (proteins, carbs, fats) with progress bars
 * - Color-coded progress bars for each macro
 * - Scales with portion multiplier
 *
 * Props:
 * - calories: Total calories for the recipe
 * - proteins_g: Total proteins in grams
 * - carbs_g: Total carbohydrates in grams
 * - fats_g: Total fats in grams
 * - portionMultiplier: Optional multiplier for portion size (default 1.0)
 */

interface NutritionCardProps {
  calories?: number
  proteins_g?: number
  carbs_g?: number
  fats_g?: number
  portionMultiplier?: number
}

/**
 * Calculate percentage of total macros for progress bar
 * Each macro contributes different calories per gram:
 * - Proteins: 4 kcal/g
 * - Carbs: 4 kcal/g
 * - Fats: 9 kcal/g
 */
const calculateMacroPercentage = (
  proteins: number,
  carbs: number,
  fats: number
) => {
  const totalMacros = proteins + carbs + fats
  if (totalMacros === 0) return { proteins: 0, carbs: 0, fats: 0 }

  return {
    proteins: (proteins / totalMacros) * 100,
    carbs: (carbs / totalMacros) * 100,
    fats: (fats / totalMacros) * 100,
  }
}

export function NutritionCard({
  calories = 0,
  proteins_g = 0,
  carbs_g = 0,
  fats_g = 0,
  portionMultiplier = 1.0,
}: NutritionCardProps) {
  // Scale values by portion multiplier
  const scaledCalories = calories * portionMultiplier
  const scaledProteins = proteins_g * portionMultiplier
  const scaledCarbs = carbs_g * portionMultiplier
  const scaledFats = fats_g * portionMultiplier

  // Calculate percentages for progress bars
  const percentages = calculateMacroPercentage(
    scaledProteins,
    scaledCarbs,
    scaledFats
  )

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Valori Nutrizionali
      </h2>

      {/* Total Calories - Prominent Display */}
      <div className="mb-6 p-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg">
        <div className="text-sm text-primary-700 font-medium mb-1">
          Calorie Totali
        </div>
        <div className="text-3xl font-bold text-primary-900">
          {scaledCalories.toFixed(0)}
          <span className="text-lg font-normal text-primary-700 ml-1">kcal</span>
        </div>
      </div>

      {/* Macronutrients with Progress Bars */}
      <div className="space-y-4">
        {/* Proteins */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">Proteine</span>
            <span className="text-sm font-bold text-gray-900">
              {scaledProteins.toFixed(1)}g
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${percentages.proteins}%` }}
            />
          </div>
        </div>

        {/* Carbohydrates */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">Carboidrati</span>
            <span className="text-sm font-bold text-gray-900">
              {scaledCarbs.toFixed(1)}g
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${percentages.carbs}%` }}
            />
          </div>
        </div>

        {/* Fats */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">Grassi</span>
            <span className="text-sm font-bold text-gray-900">
              {scaledFats.toFixed(1)}g
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${percentages.fats}%` }}
            />
          </div>
        </div>
      </div>

      {/* Macro Distribution Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Distribuzione: {percentages.proteins.toFixed(0)}% proteine,{' '}
          {percentages.carbs.toFixed(0)}% carb, {percentages.fats.toFixed(0)}% grassi
        </div>
      </div>
    </div>
  )
}
