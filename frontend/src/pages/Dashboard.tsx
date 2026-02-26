import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'
import mealsService from '@/services/meals'
import shoppingListsService from '@/services/shoppingLists'
import dispensaService from '@/services/dispensa'
import type { Meal, ShoppingListSummary, DispensaItem, DispensaStats } from '@/types'

export function Dashboard() {
  const { user } = useAuth()
  const { currentHouse } = useHouse()

  const [todayMeals, setTodayMeals] = useState<Meal[]>([])
  const [activeLists, setActiveLists] = useState<ShoppingListSummary[]>([])
  const [dispensaStats, setDispensaStats] = useState<DispensaStats | null>(null)
  const [expiringItems, setExpiringItems] = useState<DispensaItem[]>([])
  const [expiredItems, setExpiredItems] = useState<DispensaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentHouse) return

    const fetchAll = async () => {
      setIsLoading(true)
      try {
        const [meals, listsRes, stats, expiringRes, expiredRes] = await Promise.all([
          mealsService.getToday(currentHouse.id).catch(() => []),
          shoppingListsService.getAll(currentHouse.id, { status: 'active' }).catch(() => ({ lists: [] })),
          dispensaService.getStats(currentHouse.id).catch(() => null),
          dispensaService.getItems(currentHouse.id, { expiring: true }).catch(() => ({ items: [] })),
          dispensaService.getItems(currentHouse.id, { expired: true }).catch(() => ({ items: [] })),
        ])

        setTodayMeals(Array.isArray(meals) ? meals : [])
        setActiveLists(listsRes.lists || [])
        setDispensaStats(stats)
        setExpiringItems(expiringRes.items || [])
        setExpiredItems(expiredRes.items || [])
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [currentHouse])

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <h2 className="text-lg font-medium text-gray-600">Nessuna casa selezionata</h2>
        <p className="text-gray-500 mt-2 text-sm">Crea o unisciti a una casa per iniziare</p>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const meals = todayMeals || []
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0)
  const totalProteins = meals.reduce((sum, meal) => sum + (meal.proteins_g || 0), 0)
  const totalCarbs = meals.reduce((sum, meal) => sum + (meal.carbs_g || 0), 0)
  const totalFats = meals.reduce((sum, meal) => sum + (meal.fats_g || 0), 0)

  // Combine expiring + expired items, deduplicate by id, limit to 5
  const alertItems: (DispensaItem & { alertType: 'expiring' | 'expired' })[] = [
    ...expiredItems.map(item => ({ ...item, alertType: 'expired' as const })),
    ...expiringItems.map(item => ({ ...item, alertType: 'expiring' as const })),
  ]
  const uniqueAlertItems = alertItems.filter(
    (item, index, self) => self.findIndex(i => i.id === item.id) === index
  )
  const displayAlertItems = uniqueAlertItems.slice(0, 5)
  const hasMoreAlerts = uniqueAlertItems.length > 5

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Ciao, {user?.full_name?.split(' ')[0] || 'Utente'}!
          </h1>
          <p className="text-sm text-gray-600 capitalize">{today}</p>
        </div>
        <p className="text-gray-500 text-sm">Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Ciao, {user?.full_name?.split(' ')[0] || 'Utente'}!
        </h1>
        <p className="text-sm text-gray-600 capitalize">{today}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/meals/new"
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors shadow-sm"
        >
          <span className="text-2xl">🍽️</span>
          <span className="text-xs font-medium text-gray-700 text-center">Nuovo Pasto</span>
        </Link>
        <Link
          to="/shopping-lists/new"
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors shadow-sm"
        >
          <span className="text-2xl">🛒</span>
          <span className="text-xs font-medium text-gray-700 text-center">Nuova Lista</span>
        </Link>
        <Link
          to="/giacenze"
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors shadow-sm"
        >
          <span className="text-2xl">📦</span>
          <span className="text-xs font-medium text-gray-700 text-center">Dispensa</span>
        </Link>
      </div>

      {/* Sezione Liste Spesa Attive */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <h2 className="text-base font-semibold">Liste della Spesa</h2>
          </div>
          <Link to="/shopping-lists" className="text-sm text-primary-600 hover:text-primary-700">
            Vedi tutte
          </Link>
        </div>

        {activeLists.length === 0 ? (
          <p className="text-gray-500 text-sm mb-3">Nessuna lista attiva</p>
        ) : (
          <div className="space-y-3 mb-3">
            {activeLists.map((list) => {
              const progress = list.item_count > 0
                ? Math.round((list.checked_count / list.item_count) * 100)
                : 0
              return (
                <Link
                  key={list.id}
                  to={`/shopping-lists/${list.id}`}
                  className="block p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{list.name}</p>
                      {list.store_name && (
                        <p className="text-xs text-gray-500">{list.store_name}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {list.checked_count}/{list.item_count}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <Link
          to="/shopping-lists/new"
          className="btn btn-primary w-full py-2.5 text-center flex items-center justify-center gap-2 text-sm"
        >
          <span>+</span>
          <span>Nuova Lista</span>
        </Link>
      </div>

      {/* Sezione Dispensa - Scadenze */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧊</span>
            <h2 className="text-base font-semibold">Dispensa</h2>
          </div>
          <Link to="/giacenze" className="text-sm text-primary-600 hover:text-primary-700">
            Vai alla Dispensa
          </Link>
        </div>

        {/* Badge stats */}
        {dispensaStats && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {dispensaStats.total} articoli
            </span>
            {dispensaStats.expiring_soon > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {dispensaStats.expiring_soon} in scadenza
              </span>
            )}
            {dispensaStats.expired > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {dispensaStats.expired} scaduti
              </span>
            )}
          </div>
        )}

        {/* Lista prodotti in scadenza/scaduti */}
        {displayAlertItems.length > 0 ? (
          <div className="space-y-2">
            {displayAlertItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-1.5 border-b last:border-0 border-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {item.expiry_date ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.alertType === 'expired'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {new Date(item.expiry_date).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {hasMoreAlerts && (
              <Link
                to="/giacenze"
                className="block text-center text-xs text-primary-600 hover:text-primary-700 pt-1"
              >
                Vedi tutti →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Nessun prodotto in scadenza</p>
        )}
      </div>

      {/* Sezione Pasti di Oggi */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <h2 className="text-base font-semibold">Pasti di Oggi</h2>
          </div>
        </div>

        {meals.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Calorie</p>
              <p className="text-sm font-bold text-gray-900">{Math.round(totalCalories)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Prot</p>
              <p className="text-sm font-bold text-blue-600">{Math.round(totalProteins)}g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Carb</p>
              <p className="text-sm font-bold text-yellow-600">{Math.round(totalCarbs)}g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Grassi</p>
              <p className="text-sm font-bold text-red-600">{Math.round(totalFats)}g</p>
            </div>
          </div>
        )}

        {meals.length === 0 ? (
          <p className="text-gray-500 text-sm mb-3">Nessun pasto registrato oggi</p>
        ) : (
          <div className="space-y-2 mb-3">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center justify-between py-1.5 border-b last:border-0 border-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {meal.recipe_name || 'Pasto libero'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{meal.meal_type}</p>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className="font-medium text-sm">{Math.round(meal.calories || 0)} kcal</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          to="/meals/new"
          className="btn btn-primary w-full py-2.5 text-center flex items-center justify-center gap-2 text-sm"
        >
          <span>+</span>
          <span>Registra Pasto</span>
        </Link>
      </div>
    </div>
  )
}

export default Dashboard
