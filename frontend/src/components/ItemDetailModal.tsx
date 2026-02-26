import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import productsService from '@/services/products'
import LiveBarcodeScanner from './LiveBarcodeScanner'
import type { ShoppingListItem, Category } from '@/types'

// Format date from YYYY-MM-DD to DD/MM/YYYY for display
const formatDateForDisplay = (dateStr: string | undefined): string => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

// Validate that a date actually exists (e.g. reject Feb 30)
const isValidDate = (d: number, m: number, y: number): boolean => {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// Parse date from various formats to YYYY-MM-DD for API
const parseDateFromInput = (input: string): { date: string | null; error?: string } => {
  let d = 0, m = 0, y = 0, day = '', month = '', year = ''

  const compactMatch = input.match(/^(\d{2})(\d{2})(\d{2,4})$/)
  if (compactMatch) {
    day = compactMatch[1]
    month = compactMatch[2]
    year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3]
    d = parseInt(day, 10)
    m = parseInt(month, 10)
    y = parseInt(year, 10)
  } else {
    const separatorMatch = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (separatorMatch) {
      day = separatorMatch[1].padStart(2, '0')
      month = separatorMatch[2].padStart(2, '0')
      year = separatorMatch[3].length === 2 ? `20${separatorMatch[3]}` : separatorMatch[3]
      d = parseInt(day, 10)
      m = parseInt(month, 10)
      y = parseInt(year, 10)
    } else {
      return { date: null, error: 'Formato non riconosciuto. Usa DDMMYY o DD/MM/YYYY' }
    }
  }

  if (m < 1 || m > 12) return { date: null, error: `Mese ${m} non valido` }
  if (d < 1 || d > 31) return { date: null, error: `Giorno ${d} non valido` }
  if (y < 2020 || y > 2100) return { date: null, error: `Anno ${y} non valido` }
  if (!isValidDate(d, m, y)) return { date: null, error: `La data ${d}/${m}/${y} non esiste` }

  return { date: `${year}-${month}-${day}` }
}

export interface ItemDetailModalData {
  name: string
  quantity: number
  unit: string
  expiryDate?: string | null
  categoryId?: string
  barcode?: string
  productName?: string
}

export type ItemDetailModalMode = 'view' | 'verify' | 'certify'

interface ItemDetailModalProps {
  item: ShoppingListItem
  categories: Category[]
  mode: ItemDetailModalMode
  onSave: (data: ItemDetailModalData) => void
  onCancel: () => void
  onMarkNotPurchased?: () => void
}

export function ItemDetailModal({ item, categories, mode, onSave, onCancel, onMarkNotPurchased }: ItemDetailModalProps) {
  const isVerified = !!item.verified_at
  const isCertify = mode === 'certify'

  const [name, setName] = useState(item.grocy_product_name || item.name)
  const [quantity, setQuantity] = useState((item.verified_quantity ?? item.quantity) || 1)
  const [quantityText, setQuantityText] = useState(String((item.verified_quantity ?? item.quantity) || 1).replace('.', ','))
  const [isWeight, setIsWeight] = useState(
    item.verified_unit === 'kg' || item.unit === 'kg' || item.unit === 'g'
  )
  const [expiryDateInput, setExpiryDateInput] = useState(item.expiry_date ? formatDateForDisplay(item.expiry_date) : '')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(item.category_id)
  const [catalogCategoryId, setCatalogCategoryId] = useState<string | undefined>(undefined)
  const [barcodeInput, setBarcodeInput] = useState(item.scanned_barcode || item.catalog_barcode || '')
  const [showLiveScanner, setShowLiveScanner] = useState(false)
  const [showVerifiedConfirm, setShowVerifiedConfirm] = useState(false)
  const [expiryError, setExpiryError] = useState('')

  // Barcode lookup states
  const [productName, setProductName] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Auto-lookup barcode if pre-filled from catalog
  useEffect(() => {
    if (!item.scanned_barcode && item.catalog_barcode) {
      lookupBarcode(item.catalog_barcode)
    }
  }, [])

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
        const foundName = result.brand ? `${result.product_name} (${result.brand})` : result.product_name
        setProductName(foundName || null)
        setSourceName(result.source_name || null)
      } else {
        setProductName(null)
        setSourceName(null)
      }
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

  const handleLiveBarcodeScanned = (barcode: string) => {
    setBarcodeInput(barcode)
    setShowLiveScanner(false)
    lookupBarcode(barcode)
  }

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      lookupBarcode(barcodeInput)
    }
  }

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

  const handleSave = (force = false) => {
    if (!isCertify && !name.trim()) return

    // If item is verified, ask for confirmation first (edit modes only)
    if (isVerified && !isCertify && !force) {
      setShowVerifiedConfirm(true)
      return
    }

    const trimmedExpiry = expiryDateInput.trim()
    let expiryDate: string | null | undefined = undefined

    if (trimmedExpiry) {
      const result = parseDateFromInput(trimmedExpiry)
      if (!result.date) {
        setExpiryError(result.error || 'Data non valida')
        return
      }
      expiryDate = result.date
    } else if (isCertify) {
      expiryDate = null
    }

    setExpiryError('')
    onSave({
      name: isCertify ? (item.grocy_product_name || item.name) : name.trim(),
      quantity,
      unit: isWeight ? 'kg' : 'pz',
      expiryDate,
      categoryId: selectedCategoryId,
      barcode: barcodeInput.trim() || undefined,
      productName: productName || undefined,
    })
  }

  // Verified confirmation dialog
  if (showVerifiedConfirm) {
    return createPortal(
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Articolo già verificato</h3>
              <p className="text-sm text-gray-500">Proseguire con la modifica?</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowVerifiedConfirm(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200">Annulla</button>
            <button onClick={() => handleSave(true)} className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600">Prosegui</button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[60] bg-white overflow-y-auto animate-slide-up">
      {/* Header */}
      <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between z-10">
        <div>
          <h3 className="font-semibold text-lg">
            {isCertify ? (item.grocy_product_name || item.name) : 'Dettagli Articolo'}
          </h3>
          {isCertify && (
            <p className="text-xs text-gray-500 mt-0.5">
              Richiesto: {item.quantity} {item.unit}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isVerified && !isCertify && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Verificato</span>
          )}
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Name - only in edit modes, not certify */}
        {!isCertify && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome prodotto..."
              className="w-full px-4 py-3 border rounded-lg text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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

        {/* Barcode / EAN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
              inputMode="numeric"
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
          {isLookingUp && <p className="text-xs text-gray-400 mt-1">Cercando prodotto...</p>}
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

        {/* Quantity + unit type combined */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantità</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
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

      {/* Buttons - sticky at bottom */}
      <div className="sticky bottom-0 bg-white px-4 py-3 border-t space-y-2 safe-area-bottom">
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg text-gray-600 font-bold hover:bg-gray-100 border border-gray-200"
          >
            {isCertify ? 'Annulla' : 'Indietro'}
          </button>
          <button
            onClick={() => handleSave()}
            disabled={!isCertify && !name.trim()}
            className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
              (isCertify || name.trim())
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isCertify ? 'Certifica' : mode === 'view' ? 'Salva e Spunta' : 'Salva'}
          </button>
        </div>
        {isCertify && onMarkNotPurchased && (
          <button
            onClick={onMarkNotPurchased}
            className="w-full py-2.5 rounded-lg bg-red-100 text-red-700 font-bold hover:bg-red-200"
          >
            Non Acquistato
          </button>
        )}
      </div>

      {/* Live barcode scanner overlay */}
      {showLiveScanner && (
        <LiveBarcodeScanner
          onScan={handleLiveBarcodeScanned}
          onClose={() => setShowLiveScanner(false)}
        />
      )}
    </div>,
    document.body
  )
}

export default ItemDetailModal
