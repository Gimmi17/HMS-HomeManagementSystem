import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import { housesService } from '@/services/houses'
import { mealPlannerService } from '@/services/mealPlanner'
import type { HouseMember } from '@/types'
import type { SuggestionItem, MealSuggestions, GenerateResponse } from '@/services/mealPlanner'

const MEAL_TYPES = [
  { key: 'colazione', label: 'Colazione' },
  { key: 'spuntino', label: 'Spuntino' },
  { key: 'pranzo', label: 'Pranzo' },
  { key: 'cena', label: 'Cena' },
] as const

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

const STEP_LABELS = ['Giorni', 'Pasti', 'Menu', 'Conferma']

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = d.toLocaleDateString('it-IT', { weekday: 'long' })
  const dayNum = d.getDate()
  const month = d.toLocaleDateString('it-IT', { month: 'short' })
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${month}`
}

// =============================================================================
// Step Indicator
// =============================================================================

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
            i < current ? 'bg-blue-600 text-white' :
            i === current ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
            'bg-gray-200 text-gray-500'
          }`}>
            {i < current ? '\u2713' : i + 1}
          </div>
          <span className={`ml-1 text-xs hidden sm:inline ${
            i === current ? 'text-blue-600 font-semibold' : 'text-gray-400'
          }`}>{label}</span>
          {i < STEP_LABELS.length - 1 && (
            <div className={`w-6 sm:w-10 h-0.5 mx-1 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Step 1: Calendar Day Selection
// =============================================================================

function StepDays({
  selectedDays,
  onToggleDay,
}: {
  selectedDays: Set<string>
  onToggleDay: (dateStr: string) => void
}) {
  const [viewDate, setViewDate] = useState(() => new Date())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    // Monday-based week
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (string | null)[] = []

    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d)
      cells.push(dt.toISOString().split('T')[0])
    }
    return cells
  }, [year, month])

  const monthLabel = viewDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Seleziona i giorni</h2>

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-2 rounded hover:bg-gray-100 text-gray-600"
        >&lt;</button>
        <span className="font-medium capitalize">{monthLabel}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-2 rounded hover:bg-gray-100 text-gray-600"
        >&gt;</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
        {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dateStr, i) =>
          dateStr === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <button
              key={dateStr}
              onClick={() => onToggleDay(dateStr)}
              className={`py-2 rounded text-sm transition-colors ${
                selectedDays.has(dateStr)
                  ? 'bg-blue-600 text-white font-semibold'
                  : dateStr === today
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {parseInt(dateStr.split('-')[2])}
            </button>
          ),
        )}
      </div>

      {selectedDays.size > 0 && (
        <p className="mt-3 text-sm text-gray-500">
          {selectedDays.size} giorn{selectedDays.size === 1 ? 'o' : 'i'} selezionat{selectedDays.size === 1 ? 'o' : 'i'}
        </p>
      )}
    </div>
  )
}

// =============================================================================
// Step 2: Meals & People
// =============================================================================

interface DayMealConfig {
  [mealType: string]: string[] // user_ids
}

function StepMealsAndPeople({
  selectedDays,
  members,
  dayConfigs,
  onUpdateConfig,
}: {
  selectedDays: string[]
  members: HouseMember[]
  dayConfigs: Record<string, DayMealConfig>
  onUpdateConfig: (date: string, config: DayMealConfig) => void
}) {
  const toggleMeal = (dateStr: string, mealType: string) => {
    const config = { ...(dayConfigs[dateStr] || {}) }
    if (config[mealType]) {
      delete config[mealType]
    } else {
      config[mealType] = members.map(m => m.user_id)
    }
    onUpdateConfig(dateStr, config)
  }

  const togglePerson = (dateStr: string, mealType: string, userId: string) => {
    const config = { ...(dayConfigs[dateStr] || {}) }
    const current = config[mealType] || []
    if (current.includes(userId)) {
      config[mealType] = current.filter(id => id !== userId)
      if (config[mealType].length === 0) delete config[mealType]
    } else {
      config[mealType] = [...current, userId]
    }
    onUpdateConfig(dateStr, config)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Configura pasti e persone</h2>

      <div className="space-y-4">
        {selectedDays.map(dateStr => {
          const config = dayConfigs[dateStr] || {}
          return (
            <div key={dateStr} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-700 mb-3">{formatDateLabel(dateStr)}</h3>

              <div className="space-y-2">
                {MEAL_TYPES.map(({ key, label }) => {
                  const isActive = !!config[key]
                  return (
                    <div key={key}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleMeal(dateStr, key)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>

                      {isActive && (
                        <div className="ml-6 mt-1 flex flex-wrap gap-2">
                          {members.map(member => (
                            <label key={member.user_id} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(config[key] || []).includes(member.user_id)}
                                onChange={() => togglePerson(dateStr, key, member.user_id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className="text-gray-600">{member.full_name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Step 3: Suggestions (Restaurant Menu Style)
// =============================================================================

function SuggestionCard({
  item,
  selected,
  onSelect,
}: {
  item: SuggestionItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        selected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{item.recipe_name}</span>
            {item.expiry_alert && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Scadenza!</span>
            )}
            {item.avg_expiry_days !== null && item.avg_expiry_days <= 5 && !item.expiry_alert && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                ~{Math.round(item.avg_expiry_days)}gg
              </span>
            )}
          </div>

          {item.reason && <p className="text-xs text-gray-500 mt-1">{item.reason}</p>}

          <div className="flex items-center gap-3 mt-2">
            {/* Coverage bar */}
            {item.coverage_ratio > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.round(item.coverage_ratio * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{Math.round(item.coverage_ratio * 100)}%</span>
              </div>
            )}

            {/* Compact nutrition */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {item.calories != null && <span>{Math.round(item.calories)} kcal</span>}
              {item.proteins_g != null && <span>P{Math.round(item.proteins_g)}</span>}
              {item.carbs_g != null && <span>C{Math.round(item.carbs_g)}</span>}
              {item.fats_g != null && <span>F{Math.round(item.fats_g)}</span>}
            </div>
          </div>
        </div>

        {/* Radio indicator */}
        <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-blue-500' : 'border-gray-300'
        }`}>
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
        </div>
      </div>
    </button>
  )
}

function StepSuggestions({
  mealSuggestions,
  selections,
  onSelect,
}: {
  mealSuggestions: MealSuggestions[]
  selections: Record<string, string> // key: "date|meal_type" -> recipe_id
  onSelect: (key: string, recipeId: string) => void
}) {
  const mealTypeLabels: Record<string, string> = {
    colazione: 'Colazione',
    spuntino: 'Spuntino',
    pranzo: 'Pranzo',
    cena: 'Cena',
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Scegli i piatti</h2>

      <div className="space-y-6">
        {mealSuggestions.map(ms => {
          const key = `${ms.date}|${ms.meal_type}`
          return (
            <div key={key}>
              <h3 className="font-medium text-blue-700 mb-2">
                {mealTypeLabels[ms.meal_type] || ms.meal_type} - {formatDateLabel(ms.date)}
              </h3>

              {ms.suggestions.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun suggerimento disponibile</p>
              ) : (
                <div className="space-y-2">
                  {ms.suggestions.map(item => (
                    <SuggestionCard
                      key={item.recipe_id}
                      item={item}
                      selected={selections[key] === item.recipe_id}
                      onSelect={() => onSelect(key, item.recipe_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Step 4: Confirmation
// =============================================================================

function StepConfirm({
  mealSuggestions,
  selections,
  members,
}: {
  mealSuggestions: MealSuggestions[]
  selections: Record<string, string>
  members: HouseMember[]
}) {
  const mealTypeLabels: Record<string, string> = {
    colazione: 'Colazione',
    spuntino: 'Spuntino',
    pranzo: 'Pranzo',
    cena: 'Cena',
  }

  const memberMap = Object.fromEntries(members.map(m => [m.user_id, m.full_name]))

  const confirmedItems = mealSuggestions
    .filter(ms => selections[`${ms.date}|${ms.meal_type}`])
    .map(ms => {
      const recipeId = selections[`${ms.date}|${ms.meal_type}`]
      const suggestion = ms.suggestions.find(s => s.recipe_id === recipeId)
      return {
        date: ms.date,
        meal_type: ms.meal_type,
        recipe_name: suggestion?.recipe_name || '?',
        recipe_id: recipeId,
        user_ids: ms.user_ids,
        people: ms.user_ids.map(uid => memberMap[uid] || uid).join(', '),
      }
    })

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Riepilogo piano pasti</h2>

      {confirmedItems.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun piatto selezionato.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Giorno</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Pasto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Piatto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 hidden sm:table-cell">Persone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {confirmedItems.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{formatDateLabel(item.date)}</td>
                  <td className="px-3 py-2 text-gray-600">{mealTypeLabels[item.meal_type] || item.meal_type}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{item.recipe_name}</td>
                  <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{item.people}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Wizard
// =============================================================================

export function MealPlannerWizard() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()

  const [step, setStep] = useState(0)
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [members, setMembers] = useState<HouseMember[]>([])
  const [dayConfigs, setDayConfigs] = useState<Record<string, DayMealConfig>>({})
  const [generateResponse, setGenerateResponse] = useState<GenerateResponse | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch house members when entering step 2
  useEffect(() => {
    if (step === 1 && currentHouse && members.length === 0) {
      housesService.getById(currentHouse.id).then(house => {
        setMembers(house.members || [])
      }).catch(err => {
        console.error('Failed to fetch members:', err)
      })
    }
  }, [step, currentHouse, members.length])

  const sortedDays = useMemo(
    () => Array.from(selectedDays).sort(),
    [selectedDays],
  )

  const toggleDay = (dateStr: string) => {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  const updateDayConfig = (date: string, config: DayMealConfig) => {
    setDayConfigs(prev => ({ ...prev, [date]: config }))
  }

  const handleSelectSuggestion = (key: string, recipeId: string) => {
    setSelections(prev => ({ ...prev, [key]: recipeId }))
  }

  // Check if step 2 has at least one meal configured
  const hasAnyMealConfigured = useMemo(() => {
    return sortedDays.some(d => {
      const config = dayConfigs[d]
      return config && Object.keys(config).length > 0
    })
  }, [sortedDays, dayConfigs])

  const handleGenerate = async () => {
    if (!currentHouse) return
    setIsLoading(true)
    setError(null)

    const plan = sortedDays
      .filter(d => dayConfigs[d] && Object.keys(dayConfigs[d]).length > 0)
      .map(d => ({
        date: d,
        meals: Object.entries(dayConfigs[d]).map(([meal_type, user_ids]) => ({
          meal_type,
          user_ids,
        })),
      }))

    try {
      const response = await mealPlannerService.generate({
        house_id: currentHouse.id,
        plan,
      })
      setGenerateResponse(response)
      setStep(2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la generazione'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!currentHouse || !generateResponse) return
    setIsLoading(true)
    setError(null)

    const selectionsList = generateResponse.meals
      .filter(ms => selections[`${ms.date}|${ms.meal_type}`])
      .map(ms => ({
        date: ms.date,
        meal_type: ms.meal_type,
        recipe_id: selections[`${ms.date}|${ms.meal_type}`],
        user_ids: ms.user_ids,
      }))

    try {
      await mealPlannerService.confirm({
        house_id: currentHouse.id,
        selections: selectionsList,
      })
      navigate('/meals')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCount = Object.keys(selections).length
  const totalMeals = generateResponse?.meals.length || 0

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Seleziona una casa per pianificare i pasti</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <h1 className="text-xl font-bold mb-4">Pianifica Pasti</h1>

      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {step === 0 && (
          <StepDays selectedDays={selectedDays} onToggleDay={toggleDay} />
        )}

        {step === 1 && (
          <StepMealsAndPeople
            selectedDays={sortedDays}
            members={members}
            dayConfigs={dayConfigs}
            onUpdateConfig={updateDayConfig}
          />
        )}

        {step === 2 && generateResponse && (
          <StepSuggestions
            mealSuggestions={generateResponse.meals}
            selections={selections}
            onSelect={handleSelectSuggestion}
          />
        )}

        {step === 3 && generateResponse && (
          <StepConfirm
            mealSuggestions={generateResponse.meals}
            selections={selections}
            members={members}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Indietro
        </button>

        {step === 0 && (
          <button
            onClick={() => setStep(1)}
            disabled={selectedDays.size === 0}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Avanti
          </button>
        )}

        {step === 1 && (
          <button
            onClick={handleGenerate}
            disabled={!hasAnyMealConfigured || isLoading}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Genera Menu
          </button>
        )}

        {step === 2 && (
          <button
            onClick={() => setStep(3)}
            disabled={selectedCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Conferma Selezioni ({selectedCount}/{totalMeals})
          </button>
        )}

        {step === 3 && (
          <button
            onClick={handleConfirm}
            disabled={isLoading || selectedCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Salva Piano Pasti
          </button>
        )}
      </div>
    </div>
  )
}
