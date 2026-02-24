/**
 * ProductSearch Component
 *
 * Allows adding products to a meal via barcode lookup (OpenFoodFacts)
 * or manual name entry. Found products include nutritional data from the API.
 */

import { useState } from 'react'
import productsService from '@/services/products'
import type { ProductLookupResult } from '@/services/products'

export interface ProductEntry {
  tempId: string
  name: string
  barcode?: string
  quantity_g: number
  nutrients?: ProductLookupResult['nutrients']
  imageUrl?: string
  fromApi: boolean
}

interface ProductSearchProps {
  onAdd: (product: ProductEntry) => void
  disabled?: boolean
}

export function ProductSearch({ onAdd, disabled = false }: ProductSearchProps) {
  const [barcode, setBarcode] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [lookupResult, setLookupResult] = useState<ProductLookupResult | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')

  const handleSearch = async () => {
    if (!barcode.trim()) return
    setIsSearching(true)
    setLookupResult(null)
    setLookupDone(false)
    setManualMode(false)

    try {
      const result = await productsService.lookupBarcode(barcode.trim())
      setLookupResult(result)
    } catch (err) {
      console.error('Barcode lookup failed:', err)
      setLookupResult({ found: false, barcode: barcode.trim() })
    } finally {
      setIsSearching(false)
      setLookupDone(true)
    }
  }

  const handleAddFromApi = () => {
    if (!lookupResult?.found || !lookupResult.product_name) return
    onAdd({
      tempId: crypto.randomUUID(),
      name: lookupResult.product_name,
      barcode: barcode.trim() || undefined,
      quantity_g: 100,
      nutrients: lookupResult.nutrients,
      imageUrl: lookupResult.image_url,
      fromApi: true,
    })
    reset()
  }

  const handleAddManual = () => {
    const name = manualName.trim() || (lookupDone ? '' : '')
    if (!name) return
    onAdd({
      tempId: crypto.randomUUID(),
      name,
      barcode: barcode.trim() || undefined,
      quantity_g: 100,
      fromApi: false,
    })
    reset()
  }

  const reset = () => {
    setBarcode('')
    setLookupResult(null)
    setLookupDone(false)
    setManualMode(false)
    setManualName('')
  }

  return (
    <div className="space-y-2">
      {/* Barcode input row */}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Codice a barre (EAN)..."
          disabled={disabled || isSearching}
          className="input flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSearch()
            }
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={disabled || isSearching || !barcode.trim()}
          className="btn btn-primary text-sm px-3 flex-shrink-0"
        >
          {isSearching ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Found product */}
      {lookupDone && lookupResult?.found && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          {lookupResult.image_url && (
            <img
              src={lookupResult.image_url}
              alt=""
              className="w-10 h-10 object-contain rounded bg-white border flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {lookupResult.product_name}
            </div>
            {lookupResult.nutrients?.['energy-kcal_100g'] != null && (
              <div className="text-xs text-gray-500">
                {Math.round(lookupResult.nutrients['energy-kcal_100g'])} kcal/100g
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddFromApi}
            className="btn btn-primary text-xs px-3 py-1.5 flex-shrink-0"
          >
            + Aggiungi
          </button>
        </div>
      )}

      {/* Not found */}
      {lookupDone && !lookupResult?.found && (
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
          <div className="text-xs text-yellow-700">Prodotto non trovato. Inserisci il nome:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Nome prodotto..."
              className="input flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddManual()
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddManual}
              disabled={!manualName.trim()}
              className="btn btn-primary text-xs px-3 flex-shrink-0"
            >
              + Aggiungi
            </button>
          </div>
        </div>
      )}

      {/* Manual mode (no barcode) */}
      {!lookupDone && !isSearching && !manualMode && (
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Aggiungi senza codice a barre
        </button>
      )}

      {manualMode && (
        <div className="flex gap-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Nome prodotto..."
            className="input flex-1 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddManual()
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddManual}
            disabled={!manualName.trim()}
            className="btn btn-primary text-xs px-3 flex-shrink-0"
          >
            + Aggiungi
          </button>
          <button
            type="button"
            onClick={() => { setManualMode(false); setManualName('') }}
            className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default ProductSearch
