import { useState, useEffect, useRef, useCallback } from 'react'
import anagraficheService from '@/services/anagrafiche'
import type { ProductListItem, CompositionItem, FoodListItem, FoodDetailItem } from '@/services/anagrafiche'
import CreateFoodMiniModal from './CreateFoodMiniModal'

interface CompositionModalProps {
  product: ProductListItem
  onClose: () => void
  onSaved: (updatedProduct: ProductListItem) => void
}

export default function CompositionModal({ product, onClose, onSaved }: CompositionModalProps) {
  const [items, setItems] = useState<CompositionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Food search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodListItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Create food mini modal
  const [showCreateFood, setShowCreateFood] = useState(false)

  // Load existing composition
  useEffect(() => {
    const load = async () => {
      try {
        const response = await anagraficheService.getProductComposition(product.id)
        setItems(response.items)
      } catch {
        // No composition yet, start empty
        setItems([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [product.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced food search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!query.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await anagraficheService.getFoods({ search: query, limit: 20 })
        setSearchResults(response.foods)
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const addFoodToComposition = (food: FoodListItem | FoodDetailItem) => {
    // Don't add duplicates
    if (items.some(item => item.food_id === food.id)) {
      setSearchQuery('')
      setShowDropdown(false)
      return
    }
    setItems(prev => [...prev, {
      food_id: food.id,
      food_name: food.name,
      percentage: 0
    }])
    setSearchQuery('')
    setShowDropdown(false)
  }

  const updatePercentage = (index: number, value: string) => {
    const parsed = parseFloat(value.replace(',', '.'))
    const percentage = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed))
    setItems(prev => prev.map((item, i) => i === index ? { ...item, percentage } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const totalPercentage = items.reduce((sum, item) => sum + item.percentage, 0)

  const handleSave = async () => {
    if (totalPercentage > 100) {
      setError('Il totale delle percentuali non puo superare 100%')
      return
    }

    // Filter out items with 0 percentage
    const validItems = items.filter(item => item.percentage > 0)
    if (validItems.length === 0) {
      setError('Aggiungi almeno un ingrediente con percentuale > 0')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await anagraficheService.saveProductComposition(product.id, validItems)
      // Refresh the product to get updated food_id etc.
      const refreshed = await anagraficheService.getProducts({ search: product.barcode ?? undefined, limit: 1 })
      const updatedProduct = refreshed.products.find(p => p.id === product.id)
      onSaved(updatedProduct || { ...product, composition: validItems })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore nel salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFoodCreated = (food: FoodDetailItem) => {
    setShowCreateFood(false)
    addFoodToComposition(food)
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]" onClick={onClose}>
        <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg p-8 text-center" onClick={e => e.stopPropagation()}>
          <p className="text-gray-500">Caricamento composizione...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]" onClick={onClose}>
        <div
          className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">Composizione Prodotto</h3>
                <p className="text-sm text-gray-500 truncate">{product.name || product.barcode}</p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Search bar */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Cerca alimento..."
                    className="input w-full pr-8"
                  />
                  {isSearching && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowCreateFood(true)}
                  className="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium whitespace-nowrap flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crea
                </button>
              </div>

              {/* Dropdown results */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border max-h-48 overflow-y-auto">
                  {searchResults.map(food => (
                    <button
                      key={food.id}
                      onClick={() => addFoodToComposition(food)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 ${
                        items.some(i => i.food_id === food.id) ? 'opacity-40' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{food.name}</p>
                      <p className="text-xs text-gray-500">{food.category || 'Senza categoria'}</p>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && searchResults.length === 0 && searchQuery.trim() && !isSearching && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border p-3">
                  <p className="text-sm text-gray-500 text-center">Nessun alimento trovato</p>
                  <button
                    onClick={() => { setShowDropdown(false); setShowCreateFood(true) }}
                    className="w-full mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Crea "{searchQuery.trim()}"
                  </button>
                </div>
              )}
            </div>

            {/* Ingredients list */}
            {items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Nessun ingrediente aggiunto</p>
                <p className="text-gray-400 text-xs mt-1">Cerca un alimento per iniziare</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.food_id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.food_name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={item.percentage || ''}
                        onChange={(e) => updatePercentage(index, e.target.value)}
                        className="input w-20 text-right text-sm"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {items.length > 0 && (
              <div className={`flex items-center justify-between p-3 rounded-lg border ${
                totalPercentage > 100 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <span className={`text-sm font-medium ${totalPercentage > 100 ? 'text-red-700' : 'text-green-700'}`}>
                  Totale
                </span>
                <span className={`text-lg font-bold ${totalPercentage > 100 ? 'text-red-700' : 'text-green-700'}`}>
                  {totalPercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t flex gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || items.length === 0 || totalPercentage > 100}
              className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>

      {/* Create Food Mini Modal */}
      {showCreateFood && (
        <CreateFoodMiniModal
          initialName={searchQuery.trim()}
          onCreated={handleFoodCreated}
          onClose={() => setShowCreateFood(false)}
        />
      )}
    </>
  )
}
