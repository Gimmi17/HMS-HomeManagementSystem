import { useState, useEffect, useRef } from 'react'
import { foodsService } from '@/services/foods'
import type { Food, RecipeIngredient } from '@/types'

/**
 * Unit conversion constants (to grams)
 */
const UNIT_CONVERSIONS: Record<string, number> = {
  'g': 1,
  'kg': 1000,
  'mg': 0.001,
  'ml': 1,
  'l': 1000,
  'cl': 10,
  'cucchiaio': 15,
  'cucchiaino': 5,
  'tazza': 240,
  'pezzi': 100,
}

const AVAILABLE_UNITS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'cucchiaio', label: 'cucchiaio' },
  { value: 'cucchiaino', label: 'cucchiaino' },
  { value: 'tazza', label: 'tazza' },
  { value: 'pezzi', label: 'pezzi' },
]

interface IngredientRow {
  id: string
  food: Food | null
  searchQuery: string
  searchResults: Food[]
  isSearching: boolean
  showDropdown: boolean
  quantity: number
  unit: string
}

interface DynamicIngredientInputProps {
  ingredients: RecipeIngredient[]
  onChange: (ingredients: RecipeIngredient[]) => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

const toGrams = (quantity: number, unit: string): number => {
  const factor = UNIT_CONVERSIONS[unit] || 1
  return quantity * factor
}

export function DynamicIngredientInput({ ingredients, onChange }: DynamicIngredientInputProps) {
  const [rows, setRows] = useState<IngredientRow[]>(() => {
    if (ingredients.length > 0) {
      return ingredients.map(ing => ({
        id: generateId(),
        food: ing.food_id ? {
          id: ing.food_id,
          name: ing.food_name,
          category: '',
          proteins_g: 0,
          fats_g: 0,
          carbs_g: 0,
          fibers_g: 0,
        } as Food : null,
        searchQuery: ing.food_name,
        searchResults: [],
        isSearching: false,
        showDropdown: false,
        quantity: ing.quantity,
        unit: ing.unit,
      }))
    }
    return [{
      id: generateId(),
      food: null,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      showDropdown: false,
      quantity: 100,
      unit: 'g',
    }]
  })

  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const validIngredients: RecipeIngredient[] = rows
      .filter(row => row.food !== null || row.searchQuery.trim().length > 0)
      .map(row => ({
        food_id: row.food?.id,
        food_name: row.food?.name || row.searchQuery.trim(),
        quantity: row.quantity,
        unit: row.unit,
        quantity_g: toGrams(row.quantity, row.unit),
        needs_configuration: row.food === null,
      }))

    onChange(validIngredients)
  }, [rows])

  const handleSearchChange = (rowId: string, query: string) => {
    setRows(prev => prev.map(row =>
      row.id === rowId
        ? { ...row, searchQuery: query, showDropdown: query.length >= 2 }
        : row
    ))

    if (searchTimers.current[rowId]) {
      clearTimeout(searchTimers.current[rowId])
    }

    if (query.length < 2) {
      setRows(prev => prev.map(row =>
        row.id === rowId
          ? { ...row, searchResults: [], isSearching: false, showDropdown: false }
          : row
      ))
      return
    }

    setRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, isSearching: true } : row
    ))

    searchTimers.current[rowId] = setTimeout(async () => {
      try {
        const houseId = localStorage.getItem('current_house_id') || ''
        if (!houseId) {
          setRows(prev => prev.map(row =>
            row.id === rowId ? { ...row, isSearching: false } : row
          ))
          return
        }
        const response = await foodsService.search(houseId, query)
        setRows(prev => prev.map(row =>
          row.id === rowId
            ? { ...row, searchResults: response.foods, isSearching: false, showDropdown: true }
            : row
        ))
      } catch (error) {
        console.error('Errore nella ricerca:', error)
        setRows(prev => prev.map(row =>
          row.id === rowId ? { ...row, isSearching: false } : row
        ))
      }
    }, 300)
  }

  const handleFoodSelect = (rowId: string, food: Food) => {
    setRows(prev => prev.map(row =>
      row.id === rowId
        ? {
            ...row,
            food,
            searchQuery: food.name,
            searchResults: [],
            showDropdown: false,
          }
        : row
    ))
  }

  const handleQuantityChange = (rowId: string, value: string) => {
    const quantity = parseFloat(value) || 0
    setRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, quantity } : row
    ))
  }

  const handleUnitChange = (rowId: string, unit: string) => {
    setRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, unit } : row
    ))
  }

  const addRow = (afterRowId?: string) => {
    const newRow: IngredientRow = {
      id: generateId(),
      food: null,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      showDropdown: false,
      quantity: 100,
      unit: 'g',
    }

    if (afterRowId) {
      setRows(prev => {
        const index = prev.findIndex(r => r.id === afterRowId)
        const newRows = [...prev]
        newRows.splice(index + 1, 0, newRow)
        return newRows
      })
    } else {
      setRows(prev => [...prev, newRow])
    }
  }

  const removeRow = (rowId: string) => {
    setRows(prev => {
      if (prev.length === 1) {
        return [{
          id: generateId(),
          food: null,
          searchQuery: '',
          searchResults: [],
          isSearching: false,
          showDropdown: false,
          quantity: 100,
          unit: 'g',
        }]
      }
      return prev.filter(row => row.id !== rowId)
    })
  }

  const handleBlur = (rowId: string) => {
    setTimeout(() => {
      setRows(prev => prev.map(row =>
        row.id === rowId ? { ...row, showDropdown: false } : row
      ))
    }, 200)
  }

  const getNutritionPreview = (row: IngredientRow) => {
    if (!row.food) return null
    const grams = toGrams(row.quantity, row.unit)
    const ratio = grams / 100
    return {
      calories: ((row.food.calories || 0) * ratio).toFixed(0),
      proteins: (row.food.proteins_g * ratio).toFixed(1),
      carbs: (row.food.carbs_g * ratio).toFixed(1),
      fats: (row.food.fats_g * ratio).toFixed(1),
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const nutrition = getNutritionPreview(row)

        return (
          <div key={row.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            {/* Mobile: stacked layout, Desktop: horizontal */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
              {/* Row number + Food search */}
              <div className="flex items-start gap-2 flex-1">
                {/* Row number */}
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium mt-2">
                  {index + 1}
                </div>

                {/* Food search input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={row.searchQuery}
                    onChange={(e) => handleSearchChange(row.id, e.target.value)}
                    onFocus={() => row.searchQuery.length >= 2 && setRows(prev => prev.map(r =>
                      r.id === row.id ? { ...r, showDropdown: true } : r
                    ))}
                    onBlur={() => handleBlur(row.id)}
                    placeholder="Cerca ingrediente..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />

                  {/* Loading indicator */}
                  {row.isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full"></div>
                    </div>
                  )}

                  {/* Warning badge for unconfigured ingredient */}
                  {!row.food && row.searchQuery.trim().length > 0 && !row.showDropdown && !row.isSearching && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                        Da config.
                      </span>
                    </div>
                  )}

                  {/* Search dropdown */}
                  {row.showDropdown && row.searchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {row.searchResults.map((food) => (
                        <button
                          key={food.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleFoodSelect(row.id, food)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-sm text-gray-900">{food.name}</div>
                          <div className="text-xs text-gray-500">{food.category}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results - use free text */}
                  {row.showDropdown && !row.isSearching && row.searchResults.length === 0 && row.searchQuery.length >= 2 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                      <div className="text-xs text-gray-500 text-center mb-2">
                        Nessun risultato
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setRows(prev => prev.map(r =>
                            r.id === row.id ? { ...r, showDropdown: false } : r
                          ))
                        }}
                        className="w-full text-xs text-amber-600 hover:text-amber-700 font-medium"
                      >
                        Usa "{row.searchQuery}" come testo libero
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity, Unit, and Action buttons */}
              <div className="flex items-center gap-2 ml-8 sm:ml-0">
                {/* Quantity input */}
                <input
                  type="number"
                  value={row.quantity || ''}
                  onChange={(e) => handleQuantityChange(row.id, e.target.value)}
                  min="0"
                  step="1"
                  placeholder="Qty"
                  className="w-16 sm:w-20 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-center"
                />

                {/* Unit selector */}
                <select
                  value={row.unit}
                  onChange={(e) => handleUnitChange(row.id, e.target.value)}
                  className="w-24 sm:w-28 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                >
                  {AVAILABLE_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>

                {/* Add button */}
                <button
                  type="button"
                  onClick={() => addRow(row.id)}
                  className="flex-shrink-0 p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="Aggiungi"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Rimuovi"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Nutrition preview */}
            {row.food && nutrition && (
              <div className="mt-2 ml-8 text-[10px] text-gray-500 flex flex-wrap gap-2">
                <span>{nutrition.calories} kcal</span>
                <span>P: {nutrition.proteins}g</span>
                <span>C: {nutrition.carbs}g</span>
                <span>G: {nutrition.fats}g</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Add row button */}
      <button
        type="button"
        onClick={() => addRow()}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Aggiungi ingrediente
      </button>
    </div>
  )
}
