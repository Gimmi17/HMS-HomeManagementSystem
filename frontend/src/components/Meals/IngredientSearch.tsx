/**
 * IngredientSearch Component
 *
 * Autocomplete search for ingredients/foods from the database
 * Features:
 * - Debounced search (300ms delay)
 * - Shows food name and category
 * - Handles loading and error states
 * - Keyboard navigation support
 */

import { useState, useEffect, useRef } from 'react'
import foodsService from '@/services/foods'
import type { Food } from '@/types'

interface IngredientSearchProps {
  onSelect: (food: Food) => void
  placeholder?: string
  disabled?: boolean
}

export function IngredientSearch({
  onSelect,
  placeholder = 'Cerca un ingrediente...',
  disabled = false,
}: IngredientSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchTimeoutRef = useRef<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const data = await foodsService.search(query, undefined, 20)
        setResults(data)
        setIsOpen(true)
      } catch (error) {
        console.error('Search failed:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (food: Food) => {
    onSelect(food)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="input w-full pr-10"
        />
        {/* Search icon or loading spinner */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((food, index) => (
            <button
              key={food.id}
              type="button"
              onClick={() => handleSelect(food)}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                border-b border-gray-100 last:border-b-0
                ${index === selectedIndex ? 'bg-blue-50' : ''}
              `}
            >
              <div className="font-medium text-gray-900">{food.name}</div>
              <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                  {food.category}
                </span>
                <span>{food.calories || 0} kcal/100g</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Nessun ingrediente trovato
        </div>
      )}
    </div>
  )
}

export default IngredientSearch
