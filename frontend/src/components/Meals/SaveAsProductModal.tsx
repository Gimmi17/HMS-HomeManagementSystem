/**
 * SaveAsProductModal Component
 *
 * Modal for saving a free meal as a product in the dispensa.
 * Supports barcode lookup via OpenFoodFacts, manual name entry,
 * expiry date, and environment zone selection.
 */

import { useState, useEffect } from 'react'
import { useHouse } from '@/context/HouseContext'
import productsService from '@/services/products'
import type { ProductLookupResult } from '@/services/products'
import areasService from '@/services/areas'
import type { Area } from '@/types'

export interface ProductSaveData {
  name: string
  barcode?: string
  expiryDate: string
  areaId: string
  fromApi: boolean
  nutrients?: ProductLookupResult['nutrients']
  imageUrl?: string
}

interface SaveAsProductModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: ProductSaveData) => void
  calculatedNutrition: { calories: number; proteins_g: number; carbs_g: number; fats_g: number }
}

export function SaveAsProductModal({
  open,
  onClose,
  onConfirm,
  calculatedNutrition,
}: SaveAsProductModalProps) {
  const { currentHouse } = useHouse()

  // Barcode lookup state
  const [barcode, setBarcode] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [lookupResult, setLookupResult] = useState<ProductLookupResult | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [skipped, setSkipped] = useState(false)

  // Form state
  const [productName, setProductName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [areaId, setAreaId] = useState('')

  // Areas
  const [areas, setAreas] = useState<Area[]>([])
  const [loadingAreas, setLoadingAreas] = useState(false)

  // Load areas on open
  useEffect(() => {
    if (!open || !currentHouse) return

    setLoadingAreas(true)
    areasService.getAll(currentHouse.id)
      .then((res) => {
        const foodStorageAreas = res.areas.filter((e) => e.area_type === 'food_storage')
        setAreas(foodStorageAreas)
        const defaultArea = foodStorageAreas.find((e) => e.is_default) || foodStorageAreas[0]
        if (defaultArea) setAreaId(defaultArea.id)
      })
      .catch((err) => console.error('Failed to load areas:', err))
      .finally(() => setLoadingAreas(false))
  }, [open, currentHouse])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setBarcode('')
      setIsSearching(false)
      setLookupResult(null)
      setLookupDone(false)
      setSkipped(false)
      setProductName('')
      setExpiryDate('')
    }
  }, [open])

  const handleSearch = async () => {
    if (!barcode.trim()) return
    setIsSearching(true)
    setLookupResult(null)
    setLookupDone(false)

    try {
      const result = await productsService.lookupBarcode(barcode.trim())
      setLookupResult(result)
      if (result.found && result.product_name) {
        setProductName(result.product_name)
      }
    } catch (err) {
      console.error('Barcode lookup failed:', err)
      setLookupResult({ found: false, barcode: barcode.trim() })
    } finally {
      setIsSearching(false)
      setLookupDone(true)
    }
  }

  const handleSkip = () => {
    setSkipped(true)
    setLookupResult(null)
    setLookupDone(false)
    setBarcode('')
  }

  const handleConfirm = () => {
    if (!productName.trim() || !areaId) return

    onConfirm({
      name: productName.trim(),
      barcode: barcode.trim() || undefined,
      expiryDate,
      areaId,
      fromApi: !!(lookupResult?.found && lookupResult.nutrients),
      nutrients: lookupResult?.found ? lookupResult.nutrients : undefined,
      imageUrl: lookupResult?.found ? lookupResult.image_url : undefined,
    })
  }

  const isNameEditable = skipped || !lookupResult?.found
  const canConfirm = productName.trim() && areaId

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-900">Salva come Prodotto</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Barcode section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Codice a barre (EAN)</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Es. 3298497058035"
                disabled={isSearching || (lookupDone && lookupResult?.found)}
                className="input flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
              />
              {!(lookupDone && lookupResult?.found) && (
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching || !barcode.trim()}
                  className="btn btn-primary text-sm px-4 flex-shrink-0"
                >
                  {isSearching ? '...' : 'Cerca'}
                </button>
              )}
            </div>

            {/* Skip barcode button */}
            {!lookupDone && !skipped && !isSearching && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Salta, inserisci manualmente
              </button>
            )}

            {/* Search spinner */}
            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ricerca in corso...
              </div>
            )}

            {/* Found result */}
            {lookupDone && lookupResult?.found && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-sm font-medium">Trovato su OpenFoodFacts</span>
                </div>
                <div className="flex items-center gap-3">
                  {lookupResult.image_url && (
                    <img
                      src={lookupResult.image_url}
                      alt={lookupResult.product_name || ''}
                      className="w-14 h-14 object-contain rounded bg-white border"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {lookupResult.product_name}
                    </div>
                    {lookupResult.brand && (
                      <div className="text-xs text-gray-500">{lookupResult.brand}</div>
                    )}
                    {lookupResult.nutrients?.['energy-kcal_100g'] != null && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {Math.round(lookupResult.nutrients['energy-kcal_100g'])} kcal/100g
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLookupResult(null)
                    setLookupDone(false)
                    setProductName('')
                    setBarcode('')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Cerca un altro
                </button>
              </div>
            )}

            {/* Not found */}
            {lookupDone && !lookupResult?.found && !skipped && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <span className="text-yellow-700 text-sm">Prodotto non trovato nel database</span>
              </div>
            )}
          </div>

          {/* Product name (editable if not found or skipped) */}
          {(isNameEditable || (lookupDone && lookupResult?.found)) && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Nome prodotto {isNameEditable && '*'}
              </label>
              {isNameEditable ? (
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Es. Pasta Barilla 500g"
                  className="input w-full"
                />
              ) : (
                <div className="input w-full bg-gray-50 text-gray-700">{productName}</div>
              )}
            </div>
          )}

          {/* Expiry date */}
          {(lookupDone || skipped) && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Data scadenza</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="input w-full"
              />
            </div>
          )}

          {/* Area zone */}
          {(lookupDone || skipped) && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Zona</label>
              {loadingAreas ? (
                <div className="text-sm text-gray-500">Caricamento zone...</div>
              ) : areas.length === 0 ? (
                <div className="text-sm text-yellow-600">Nessuna zona dispensa configurata</div>
              ) : (
                <select
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="input w-full"
                >
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.icon || ''} {area.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Nutrition info preview */}
          {(lookupDone || skipped) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 mb-1">
                Nutrienti ({lookupResult?.found && lookupResult.nutrients ? 'da OpenFoodFacts' : 'calcolati dagli ingredienti'})
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {lookupResult?.found && lookupResult.nutrients ? (
                  <>
                    <div>
                      <div className="font-bold text-gray-900">
                        {Math.round(lookupResult.nutrients['energy-kcal_100g'] || 0)}
                      </div>
                      <div className="text-gray-500">kcal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">
                        {Math.round(lookupResult.nutrients['proteins_100g'] || 0)}
                      </div>
                      <div className="text-gray-500">Prot</div>
                    </div>
                    <div>
                      <div className="font-bold text-yellow-600">
                        {Math.round(lookupResult.nutrients['carbohydrates_100g'] || 0)}
                      </div>
                      <div className="text-gray-500">Carb</div>
                    </div>
                    <div>
                      <div className="font-bold text-red-600">
                        {Math.round(lookupResult.nutrients['fat_100g'] || 0)}
                      </div>
                      <div className="text-gray-500">Grassi</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="font-bold text-gray-900">{Math.round(calculatedNutrition.calories)}</div>
                      <div className="text-gray-500">kcal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{Math.round(calculatedNutrition.proteins_g)}</div>
                      <div className="text-gray-500">Prot</div>
                    </div>
                    <div>
                      <div className="font-bold text-yellow-600">{Math.round(calculatedNutrition.carbs_g)}</div>
                      <div className="text-gray-500">Carb</div>
                    </div>
                    <div>
                      <div className="font-bold text-red-600">{Math.round(calculatedNutrition.fats_g)}</div>
                      <div className="text-gray-500">Grassi</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary flex-1 text-sm"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="btn btn-primary flex-1 text-sm"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveAsProductModal
