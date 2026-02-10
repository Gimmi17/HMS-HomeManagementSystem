import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import recipesService from '@/services/recipes'
import type { Recipe } from '@/types'

export function Recipes() {
  const { currentHouse } = useHouse()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchRecipes = async () => {
      if (!currentHouse) return

      try {
        const response = await recipesService.getAll(currentHouse.id)
        setRecipes(Array.isArray(response?.recipes) ? response.recipes : [])
      } catch (error) {
        console.error('Failed to fetch recipes:', error)
        setRecipes([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecipes()
  }, [currentHouse])

  const safeRecipes = Array.isArray(recipes) ? recipes : []
  const filteredRecipes = safeRecipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Seleziona una casa per vedere le ricette</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ricette</h1>
        <Link to="/recipes/new" className="btn btn-primary text-sm px-3 py-2">
          + Nuova
        </Link>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Cerca ricette..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full"
        />
      </div>

      {/* Recipes list */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : filteredRecipes.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">
            {searchQuery ? 'Nessuna ricetta trovata' : 'Nessuna ricetta creata'}
          </p>
          {!searchQuery && (
            <Link to="/recipes/new" className="btn btn-primary mt-4 inline-block text-sm">
              Crea la prima ricetta
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="card p-3 block hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base truncate">{recipe.name}</h3>

                  {recipe.description && (
                    <p className="text-gray-600 text-xs mt-1 line-clamp-1">
                      {recipe.description}
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    {recipe.preparation_time_min && (
                      <span>{recipe.preparation_time_min} min</span>
                    )}
                    {recipe.difficulty && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{recipe.difficulty}</span>
                      </>
                    )}
                  </div>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {recipe.tags.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{recipe.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Nutrition summary */}
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-bold text-gray-900">
                    {Math.round(recipe.total_calories || 0)}
                  </div>
                  <div className="text-[10px] text-gray-500">kcal</div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    P:{Math.round(recipe.total_proteins_g || 0)}
                    C:{Math.round(recipe.total_carbs_g || 0)}
                    G:{Math.round(recipe.total_fats_g || 0)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default Recipes
