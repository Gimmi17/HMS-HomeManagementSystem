/**
 * SearchableSelect Component
 *
 * Generic searchable dropdown with keyboard navigation.
 * Supports label+sublabel filtering, clear button, and a renderSuffix slot.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface Option {
  value: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string | null
  onChange: (value: string | null, option: Option | null) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  renderSuffix?: React.ReactNode
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Cerca...',
  emptyLabel = 'Nessun risultato',
  disabled = false,
  renderSuffix,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = value ? options.find((o) => o.value === value) ?? null : null

  const filtered = options.filter((o) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel?.toLowerCase().includes(q) ?? false)
    )
  })

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [query])

  const selectOption = useCallback(
    (opt: Option) => {
      onChange(opt.value, opt)
      setQuery('')
      setIsOpen(false)
    },
    [onChange]
  )

  const clearSelection = useCallback(() => {
    onChange(null, null)
    setQuery('')
    inputRef.current?.focus()
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightedIndex]) {
          selectOption(filtered[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  // Display value in input: query if typing, else selected label
  const inputValue = isOpen ? query : (selectedOption ? selectedOption.label : query)

  return (
    <div ref={containerRef} className="flex gap-2 items-center">
      {/* Input + dropdown wrapper */}
      <div className="relative flex-1 min-w-0">
        <div className="relative">
          {/* Search icon */}
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={selectedOption ? selectedOption.label : placeholder}
            disabled={disabled}
            className="input w-full pl-9 pr-8 truncate"
          />

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={clearSelection}
              disabled={disabled}
              className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">{emptyLabel}</div>
            ) : (
              filtered.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectOption(opt)
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    idx === highlightedIndex
                      ? 'bg-primary-50 text-primary-900'
                      : 'hover:bg-gray-50 text-gray-900'
                  } ${opt.value === value ? 'font-medium' : ''}`}
                >
                  <span>{opt.label}</span>
                  {opt.sublabel && (
                    <span className="ml-2 text-xs text-gray-400">{opt.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Suffix slot */}
      {renderSuffix}
    </div>
  )
}

export default SearchableSelect
