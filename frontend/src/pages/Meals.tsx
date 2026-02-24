import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useHouse } from '@/context/HouseContext'
import mealsService from '@/services/meals'
import type { Meal } from '@/types'

const MEAL_TYPE_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  spuntino: 'Spuntino',
  pranzo: 'Pranzo',
  cena: 'Cena',
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const totalDays = lastDay.getDate()
  return { startDow, totalDays }
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

export function Meals() {
  const { currentHouse } = useHouse()
  const navigate = useNavigate()
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Date range covers the viewed month
  const dateRange = useMemo(() => {
    const from = `${viewYear}-${pad2(viewMonth + 1)}-01`
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate()
    const to = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(lastDay)}`
    return { from, to }
  }, [viewYear, viewMonth])

  useEffect(() => {
    const fetchMeals = async () => {
      if (!currentHouse) return
      setIsLoading(true)
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

  const safeMeals = Array.isArray(meals) ? meals : []

  // Count meals per date
  const mealsCountByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const meal of safeMeals) {
      const date = meal.consumed_at.split('T')[0]
      map[date] = (map[date] || 0) + 1
    }
    return map
  }, [safeMeals])

  // Meals for selected date
  const selectedDayMeals = useMemo(() => {
    if (!selectedDate) return []
    return safeMeals.filter((m) => m.consumed_at.split('T')[0] === selectedDate)
  }, [safeMeals, selectedDate])

  const selectedDayTotal = useMemo(() => {
    return {
      calories: selectedDayMeals.reduce((s, m) => s + (m.calories || 0), 0),
      proteins: selectedDayMeals.reduce((s, m) => s + (m.proteins_g || 0), 0),
      carbs: selectedDayMeals.reduce((s, m) => s + (m.carbs_g || 0), 0),
      fats: selectedDayMeals.reduce((s, m) => s + (m.fats_g || 0), 0),
    }
  }, [selectedDayMeals])

  // Calendar data
  const { startDow, totalDays } = getMonthDays(viewYear, viewMonth)
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleDayClick = (day: number) => {
    const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
    setSelectedDate(dateStr)
  }

  const formatSelectedDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Seleziona una casa per vedere i pasti</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pasti</h1>
        <Link to="/meals/new" className="btn btn-primary text-sm px-3 py-2">
          + Nuovo
        </Link>
      </div>

      {/* Calendar */}
      <div className="card p-3">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-800 capitalize">{monthLabel}</span>
          <button onClick={goToNextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1
            const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
            const count = mealsCountByDate[dateStr] || 0
            const isToday = dateStr === todayStr

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-colors hover:bg-gray-100 ${
                  isToday ? 'bg-primary-50 ring-1 ring-primary-300' : ''
                }`}
              >
                <span className={`font-medium ${isToday ? 'text-primary-700' : 'text-gray-700'}`}>
                  {day}
                </span>
                {count > 0 && (
                  <span className="text-[9px] font-bold text-primary-600 leading-none mt-0.5">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {isLoading && (
          <p className="text-center text-gray-400 text-xs mt-2">Caricamento...</p>
        )}
      </div>

      {/* Day Detail Modal */}
      {selectedDate && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base capitalize">
                  {formatSelectedDate(selectedDate)}
                </h3>
                {selectedDayMeals.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Math.round(selectedDayTotal.calories)} kcal
                    {' \u2022 '}P:{Math.round(selectedDayTotal.proteins)}g
                    {' '}C:{Math.round(selectedDayTotal.carbs)}g
                    {' '}G:{Math.round(selectedDayTotal.fats)}g
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {selectedDayMeals.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Nessun pasto registrato</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between py-2.5 border-b last:border-0 border-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                            {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(meal.consumed_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
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
              )}
            </div>

            {/* Modal footer - add meal button */}
            <div className="px-4 py-3 border-t">
              <button
                onClick={() => {
                  setSelectedDate(null)
                  navigate(`/meals/new?date=${selectedDate}`)
                }}
                className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 text-sm flex items-center justify-center gap-2"
              >
                <span>+</span>
                <span>Registra pasto</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Meals
