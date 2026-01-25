import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import mealsService from '@/services/meals'
import type { Meal } from '@/types'

const MEAL_TYPE_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  spuntino: 'Spuntino',
  pranzo: 'Pranzo',
  cena: 'Cena',
}

export function Meals() {
  const { currentHouse } = useHouse()
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    const fetchMeals = async () => {
      if (!currentHouse) return

      try {
        const data = await mealsService.getAll(currentHouse.id, dateRange)
        setMeals(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Failed to fetch meals:', error)
        setMeals([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeals()
  }, [currentHouse, dateRange])

  // Group meals by date (ensure meals is an array)
  const safeMeals = Array.isArray(meals) ? meals : []
  const mealsByDate = safeMeals.reduce((acc, meal) => {
    const date = meal.consumed_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(meal)
    return acc
  }, {} as Record<string, Meal[]>)

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Seleziona una casa per vedere i pasti</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pasti</h1>
        <Link to="/meals/new" className="btn btn-primary text-sm px-3 py-2">
          + Nuovo
        </Link>
      </div>

      {/* Date filters - stacked on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="flex-1">
          <label className="label text-xs">Da</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="input w-full text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="label text-xs">A</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="input w-full text-sm"
          />
        </div>
      </div>

      {/* Meals list */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : safeMeals.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Nessun pasto registrato per questo periodo</p>
          <Link to="/meals/new" className="btn btn-primary mt-4 inline-block text-sm">
            Registra il primo pasto
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(mealsByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayMeals]) => {
              const dayTotal = {
                calories: dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
                proteins: dayMeals.reduce((sum, m) => sum + (m.proteins_g || 0), 0),
                carbs: dayMeals.reduce((sum, m) => sum + (m.carbs_g || 0), 0),
                fats: dayMeals.reduce((sum, m) => sum + (m.fats_g || 0), 0),
              }

              return (
                <div key={date} className="card p-3 sm:p-4">
                  {/* Day header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 pb-2 border-b">
                    <h3 className="font-semibold text-sm sm:text-base">
                      {new Date(date).toLocaleDateString('it-IT', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </h3>
                    <div className="text-xs text-gray-500 mt-1 sm:mt-0">
                      {Math.round(dayTotal.calories)} kcal •
                      P:{Math.round(dayTotal.proteins)}g
                      C:{Math.round(dayTotal.carbs)}g
                      G:{Math.round(dayTotal.fats)}g
                    </div>
                  </div>

                  {/* Day meals */}
                  <div className="space-y-2">
                    {dayMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                              {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                            </span>
                          </div>
                          <span className="font-medium text-sm block truncate mt-1">
                            {meal.recipe_name || 'Pasto libero'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600 ml-2 flex-shrink-0">
                          {Math.round(meal.calories || 0)} kcal
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

export default Meals
