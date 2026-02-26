import React, { useEffect, useState } from 'react'
import productsService from '@/services/products'
import LiveBarcodeScanner from '@/components/LiveBarcodeScanner'
import type { ShoppingListItem, Category } from '@/types'

export type VerificationState = 'pending' | 'not_purchased' | 'verified_no_info' | 'verified_with_info'

export function getItemState(item: ShoppingListItem): VerificationState {
  if (item.not_purchased) return 'not_purchased'
  if (!item.verified_at) return 'pending'
  if (item.grocy_product_name) return 'verified_with_info'
  return 'verified_no_info'
}

export const STATE_COLORS: Record<VerificationState, { bg: string; border: string; icon: string }> = {
  pending: { bg: 'bg-gray-100', border: 'border-gray-300', icon: 'text-gray-400' },
  not_purchased: { bg: 'bg-red-100', border: 'border-red-400', icon: 'text-red-500' },
  verified_no_info: { bg: 'bg-orange-100', border: 'border-orange-400', icon: 'text-orange-500' },
  verified_with_info: { bg: 'bg-green-100', border: 'border-green-400', icon: 'text-green-500' },
}

export interface VerificationModalProps {
  item: ShoppingListItem
  categories: Category[]
  onConfirm: (data: {
    quantity: number
    isWeight: boolean
    expiryDate?: string | null
    categoryId?: string
    barcode?: string
    productName?: string
  }) => void
  onCancel: () => void
  onMarkNotPurchased: () => void
}

export default function VerificationModal({ item, categories, onConfirm, onCancel, onMarkNotPurchased }: VerificationModalProps) {
  const [quantity, setQuantity] = useState(item.quantity || 1)
  const [quantityText, setQuantityText] = useState(String(item.quantity || 1))
  const [isWeight, setIsWeight] = useState(item.unit === 'kg' || item.unit === 'g')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(item.category_id)
  const [catalogCategoryId, setCatalogCategoryId] = useState<string | undefined>(undefined)
  const [barcodeInput, setBarcodeInput] = useState(item.scanned_barcode || item.catalog_barcode || '')
  const [productName, setProductName] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [showLiveScanner, setShowLiveScanner] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Auto-lookup barcode if pre-filled from catalog
  useEffect(() => {
    if (!item.scanned_barcode && item.catalog_barcode) {
      lookupBarcode(item.catalog_barcode)
    }
  }, [])

  // Expiry date state
  const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }
  const [expiryDateInput, setExpiryDateInput] = useState(
    item.expiry_date ? formatDateForDisplay(item.expiry_date) : ''
  )
  const [expiryError, setExpiryError] = useState('')

  // Parse expiry date from various formats to YYYY-MM-DD
  const parseExpiryDate = (input: string): string | null => {
    if (!input.trim()) return null

    // Try compact format: DDMMYY or DDMMYYYY
    const compactMatch = input.match(/^(\d{2})(\d{2})(\d{2,4})$/)
    if (compactMatch) {
      const day = compactMatch[1]
      const month = compactMatch[2]
      const year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3]
      const d = parseInt(day, 10)
      const m = parseInt(month, 10)
      const y = parseInt(year, 10)
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020 || y > 2100) return null
      return `${year}-${month}-${day}`
    }

    // Try format with separators
    const separatorMatch = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (separatorMatch) {
      const day = separatorMatch[1].padStart(2, '0')
      const month = separatorMatch[2].padStart(2, '0')
      const year = separatorMatch[3].length === 2 ? `20${separatorMatch[3]}` : separatorMatch[3]
      const d = parseInt(day, 10)
      const m = parseInt(month, 10)
      const y = parseInt(year, 10)
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020 || y > 2100) return null
      return `${year}-${month}-${day}`
    }

    return null
  }

  // Parse quantity from text
  const parseQuantity = (text: string): number => {
    const normalized = text.replace(',', '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? 0 : parsed
  }

  const handleQuantityChange = (text: string) => {
    const filtered = text.replace(/[^0-9.,]/g, '')
    setQuantityText(filtered)
    setQuantity(parseQuantity(filtered))
  }

  // Lookup barcode when it changes
  const lookupBarcode = async (barcode: string) => {
    if (!barcode.trim()) {
      setProductName(null)
      setSourceName(null)
      return
    }

    setIsLookingUp(true)
    try {
      const result = await productsService.lookupBarcode(barcode)
      if (result.found) {
        const name = result.brand ? `${result.product_name} (${result.brand})` : result.product_name
        setProductName(name || null)
        setSourceName(result.source_name || null)
      } else {
        setProductName(null)
        setSourceName(null)
      }
      // Pre-select category from catalog if not already set by user
      if (result.category_id && !selectedCategoryId) {
        setSelectedCategoryId(result.category_id)
        setCatalogCategoryId(result.category_id)
      }
    } catch {
      setProductName(null)
    } finally {
      setIsLookingUp(false)
    }
  }

  // Handle barcode from live scanner
  const handleLiveBarcodeScanned = (barcode: string) => {
    setBarcodeInput(barcode)
    setShowLiveScanner(false)
    lookupBarcode(barcode)
  }

  // Handle manual barcode input on Enter
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      lookupBarcode(barcodeInput)
    }
  }

  const handleConfirm = () => {
    const trimmedExpiry = expiryDateInput.trim()
    if (trimmedExpiry) {
      const parsedExpiry = parseExpiryDate(trimmedExpiry)
      if (!parsedExpiry) {
        setExpiryError('Formato data non valido. Usa DDMMYY o DD/MM/YYYY')
        return
      }
      setExpiryError('')
      onConfirm({
        quantity,
        isWeight,
        expiryDate: parsedExpiry,
        categoryId: selectedCategoryId,
        barcode: barcodeInput.trim() || undefined,
        productName: productName || undefined,
      })
    } else {
      setExpiryError('')
      onConfirm({
        quantity,
        isWeight,
        expiryDate: null,
        categoryId: selectedCategoryId,
        barcode: barcodeInput.trim() || undefined,
        productName: productName || undefined,
      })
    }
  }

  // Show live scanner
  if (showLiveScanner) {
    return (
      <LiveBarcodeScanner
        onScan={handleLiveBarcodeScanned}
        onClose={() => setShowLiveScanner(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex-shrink-0">
          <h3 className="font-semibold text-lg">{item.name}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Richiesto: {item.quantity} {item.unit}
          </p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria {catalogCategoryId ? '(da catalogo)' : item.category_id ? '(conferma)' : '(opzionale)'}
              </label>
              <select
                value={selectedCategoryId || ''}
                onChange={(e) => setSelectedCategoryId(e.target.value || undefined)}
                className="w-full px-4 py-3 border rounded-lg text-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Seleziona categoria...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Barcode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Barcode {item.scanned_barcode ? '(conferma)' : '(opzionale)'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Inserisci o scansiona..."
                className="flex-1 px-4 py-3 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setShowLiveScanner(true)}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                title="Scansiona barcode"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            {isLookingUp && (
              <p className="text-xs text-gray-400 mt-1">Cercando prodotto...</p>
            )}
            {productName && (
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <p className="text-xs text-green-600">{productName}</p>
                {sourceName && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                    da {sourceName}
                  </span>
                )}
              </div>
            )}
            {barcodeInput && !productName && !isLookingUp && (
              <p className="text-xs text-gray-400 mt-1">Prodotto non trovato in anagrafica</p>
            )}
          </div>

          {/* Quantity + unit type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantit&agrave;
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setIsWeight(false)}
                  className={`px-4 py-2 rounded-lg text-xl font-bold transition-colors ${
                    !isWeight ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  pz
                </button>
                <button
                  onClick={() => setIsWeight(true)}
                  className={`px-4 py-2 rounded-lg text-xl font-bold transition-colors ${
                    isWeight ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  kg
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    const newQty = Math.max(isWeight ? 0.1 : 1, quantity - (isWeight ? 0.1 : 1))
                    setQuantity(newQty)
                    setQuantityText(String(Math.round(newQty * 10) / 10).replace('.', ','))
                  }}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold flex-shrink-0"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantityText}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  maxLength={5}
                  className="w-20 text-center text-xl font-bold py-2 border rounded-lg"
                />
                <button
                  onClick={() => {
                    const newQty = quantity + (isWeight ? 0.1 : 1)
                    setQuantity(newQty)
                    setQuantityText(String(Math.round(newQty * 10) / 10).replace('.', ','))
                  }}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold flex-shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Expiry date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Scadenza {item.expiry_date ? '(conferma)' : '(opzionale)'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={expiryDateInput}
              onChange={(e) => { setExpiryDateInput(e.target.value); setExpiryError('') }}
              placeholder="DDMMYY (es: 150226)"
              className={`w-full px-4 py-3 border rounded-lg text-center text-xl font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${expiryError ? 'border-red-500' : ''}`}
            />
            {expiryError && <p className="text-red-500 text-xs mt-1">{expiryError}</p>}
          </div>

        </div>

        <div className="p-4 border-t space-y-2 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-lg text-gray-600 font-bold hover:bg-gray-100"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600"
            >
              Certifica
            </button>
          </div>
          <button
            onClick={onMarkNotPurchased}
            className="w-full py-2.5 rounded-lg bg-red-100 text-red-700 font-bold hover:bg-red-200"
          >
            Non Acquistato
          </button>
        </div>
      </div>
    </div>
  )
}
