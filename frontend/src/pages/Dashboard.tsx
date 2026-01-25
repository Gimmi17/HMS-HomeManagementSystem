import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'
import mealsService from '@/services/meals'
import type { Meal } from '@/types'

export function Dashboard() {
  const { user } = useAuth()
  const { currentHouse } = useHouse()
  const [todayMeals, setTodayMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTodayMeals = async () => {
      if (!currentHouse) return

      try {
        const meals = await mealsService.getToday(currentHouse.id)
        setTodayMeals(Array.isArray(meals) ? meals : [])
      } catch (error) {
        console.error('Failed to fetch meals:', error)
        setTodayMeals([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTodayMeals()
  }, [currentHouse])

  const meals = todayMeals || []
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0)
  const totalProteins = meals.reduce((sum, meal) => sum + (meal.proteins_g || 0), 0)
  const totalCarbs = meals.reduce((sum, meal) => sum + (meal.carbs_g || 0), 0)
  const totalFats = meals.reduce((sum, meal) => sum + (meal.fats_g || 0), 0)

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <h2 className="text-lg font-medium text-gray-600">Nessuna casa selezionata</h2>
        <p className="text-gray-500 mt-2 text-sm">Crea o unisciti a una casa per iniziare</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header - compact on mobile */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Ciao, {user?.full_name?.split(' ')[0] || 'Utente'}!
        </h1>
        <p className="text-sm text-gray-600">Riepilogo di oggi</p>
      </div>

      {/* Macro summary - 2x2 grid on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-gray-500">Calorie</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {Math.round(totalCalories)}
          </p>
          <p className="text-[10px] text-gray-400">kcal</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-gray-500">Proteine</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {Math.round(totalProteins)}g
          </p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-gray-500">Carboidrati</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">
            {Math.round(totalCarbs)}g
          </p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-gray-500">Grassi</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">
            {Math.round(totalFats)}g
          </p>
        </div>
      </div>

      {/* Quick action button - prominent on mobile */}
      <Link
        to="/meals/new"
        className="btn btn-primary w-full py-3 text-center flex items-center justify-center gap-2"
      >
        <span className="text-lg">+</span>
        <span>Registra Pasto</span>
      </Link>

      {/* Today's meals */}
      <div className="card p-4">
        <h2 className="text-base font-semibold mb-3">Pasti di oggi</h2>

        {isLoading ? (
          <p className="text-gray-500 text-sm">Caricamento...</p>
        ) : meals.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun pasto registrato oggi</p>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {meal.recipe_name || 'Pasto libero'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{meal.meal_type}</p>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className="font-medium text-sm">{Math.round(meal.calories || 0)} kcal</p>
                  <p className="text-[10px] text-gray-500">
                    P:{Math.round(meal.proteins_g || 0)} C:{Math.round(meal.carbs_g || 0)} G:{Math.round(meal.fats_g || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
