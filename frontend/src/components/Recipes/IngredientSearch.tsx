import { useState, useEffect, useRef } from 'react'
import { foodsService } from '@/services/foods'
import type { Food } from '@/types'

/**
 * IngredientSearch Component
 *
 * Autocomplete component for searching ingredients with debounced search.
 * Features:
 * - Debounce search after 300ms of typing
 * - Show dropdown with matching foods from database
 * - Click to select food and add to recipe
 * - Close dropdown when clicking outside
 */

interface IngredientSearchProps {
  onSelect: (food: Food) => void
}

export function IngredientSearch({ onSelect }: IngredientSearchProps) {
  // State management for search input and results
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Refs for managing debounce timer and click outside detection
  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>()
  const dropdownRef = useRef<HTMLDivElement>(null)

  /**
   * Debounced search effect
   * Waits 300ms after user stops typing before making API call
   */
  useEffect(() => {
    // Clear previous timeout on each keystroke
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    // Don't search if query is empty or too short
    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    // Set loading state and schedule search after 300ms
    setIsLoading(true)
    debounceTimeout.current = setTimeout(async () => {
      try {
        const foods = await foodsService.search(query)
        setResults(foods)
        setIsOpen(true)
      } catch (error) {
        console.error('Errore nella ricerca ingredienti:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    // Cleanup timeout on unmount or when query changes
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [query])

  /**
   * Click outside handler to close dropdown
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  /**
   * Handle food selection
   * - Call parent callback with selected food
   * - Clear search input and close dropdown
   */
  const handleSelect = (food: Food) => {
    onSelect(food)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca ingrediente (es. pollo, riso, olio...)"
          className="input pr-10"
        />
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((food) => (
            <button
              key={food.id}
              onClick={() => handleSelect(food)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{food.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{food.category}</div>
                </div>
                {/* Quick nutrition preview */}
                <div className="text-xs text-gray-600 text-right ml-4">
                  <div>{food.calories?.toFixed(0) || '-'} kcal</div>
                  <div className="text-gray-500">
                    P:{food.proteins_g.toFixed(1)}g C:{food.carbs_g.toFixed(1)}g F:{food.fats_g.toFixed(1)}g
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {isOpen && !isLoading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Nessun ingrediente trovato per "{query}"
        </div>
      )}
    </div>
  )
}
