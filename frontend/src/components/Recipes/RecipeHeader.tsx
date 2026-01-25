import type { Recipe } from '@/types'

/**
 * RecipeHeader Component
 *
 * Displays the main header information for a recipe including:
 * - Recipe name (title)
 * - Preparation time (if available)
 * - Difficulty level with color-coded badge
 * - Tags as colored chips
 *
 * Props:
 * - recipe: Complete recipe object containing all metadata
 */

interface RecipeHeaderProps {
  recipe: Recipe
}

/**
 * Get appropriate badge color based on difficulty level
 */
const getDifficultyColor = (difficulty?: string) => {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-100 text-green-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'hard':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get human-readable difficulty label
 */
const getDifficultyLabel = (difficulty?: string) => {
  switch (difficulty) {
    case 'easy':
      return 'Facile'
    case 'medium':
      return 'Media'
    case 'hard':
      return 'Difficile'
    default:
      return 'Non specificata'
  }
}

export function RecipeHeader({ recipe }: RecipeHeaderProps) {
  return (
    <div className="card">
      {/* Recipe Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{recipe.name}</h1>

      {/* Description */}
      {recipe.description && (
        <p className="text-gray-600 mb-4">{recipe.description}</p>
      )}

      {/* Metadata Row */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Preparation Time */}
        {recipe.preparation_time_min && recipe.preparation_time_min > 0 && (
          <div className="flex items-center gap-2 text-gray-700">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{recipe.preparation_time_min} min</span>
          </div>
        )}

        {/* Difficulty Badge */}
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
            recipe.difficulty
          )}`}
        >
          {getDifficultyLabel(recipe.difficulty)}
        </div>
      </div>

      {/* Tags */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
