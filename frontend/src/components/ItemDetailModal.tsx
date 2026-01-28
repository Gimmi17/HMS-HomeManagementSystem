import { useState } from 'react'
import type { ShoppingListItem, Category } from '@/types'
import PhotoBarcodeScanner from './PhotoBarcodeScanner'

// Format date from YYYY-MM-DD to DD/MM/YYYY for display
const formatDateForDisplay = (dateStr: string | undefined): string => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

// Parse date from various formats to YYYY-MM-DD for API
const parseDateFromInput = (input: string): string | null => {
  // Try compact format: DDMMYY (6 digits) or DDMMYYYY (8 digits)
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
  // Try format with separators: DD/MM/YYYY or DD/MM/YY
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

export interface ItemDetailModalData {
  name: string
  quantity: number
  unit: string
  expiryDate?: string
  categoryId?: string
  barcode?: string
}

export type ItemDetailModalMode = 'view' | 'verify'

interface ItemDetailModalProps {
  item: ShoppingListItem
  categories: Category[]
  mode: ItemDetailModalMode
  onSave: (data: ItemDetailModalData) => void
  onCancel: () => void
}

export function ItemDetailModal({ item, categories, mode, onSave, onCancel }: ItemDetailModalProps) {
  const isVerified = !!item.verified_at
  const [name, setName] = useState(item.grocy_product_name || item.name)
  const [quantity, setQuantity] = useState(item.verified_quantity ?? item.quantity)
  const [quantityText, setQuantityText] = useState(String(item.verified_quantity ?? item.quantity).replace('.', ','))
  const [isWeight, setIsWeight] = useState(
    item.verified_unit === 'kg' || item.unit === 'kg' || item.unit === 'g'
  )
  const [expiryDateInput, setExpiryDateInput] = useState(item.expiry_date ? formatDateForDisplay(item.expiry_date) : '')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(item.category_id)
  const [barcodeInput, setBarcodeInput] = useState(item.scanned_barcode || '')
  const [showPhotoScanner, setShowPhotoScanner] = useState(false)
  const [showVerifiedConfirm, setShowVerifiedConfirm] = useState(false)

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
    if (!name.trim()) return

    // If item is verified, ask for confirmation first
    if (isVerified && !force) {
      setShowVerifiedConfirm(true)
      return
    }

    const parsedDate = expiryDateInput.trim() ? parseDateFromInput(expiryDateInput.trim()) : undefined
    onSave({
      name: name.trim(),
      quantity,
      unit: isWeight ? 'kg' : 'pz',
      expiryDate: parsedDate || undefined,
      categoryId: selectedCategoryId,
      barcode: barcodeInput.trim() || undefined,
    })
  }

  const handlePhotoBarcodeScanned = (barcode: string) => {
    setBarcodeInput(barcode)
    setShowPhotoScanner(false)
  }

  // Photo scanner view
  if (showPhotoScanner) {
    return (
      <PhotoBarcodeScanner
        onScan={handlePhotoBarcodeScanned}
        onClose={() => setShowPhotoScanner(false)}
      />
    )
  }

  // Verified confirmation dialog
  if (showVerifiedConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
            <button
              onClick={() => setShowVerifiedConfirm(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Annulla
            </button>
            <button
              onClick={() => handleSave(true)}
              className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600"
            >
              Prosegui
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Dettagli Articolo</h3>
          {isVerified && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              Verificato
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Descrizione */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome prodotto..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Unità di misura */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unità di misura
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsWeight(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !isWeight ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Pezzi (n°)
              </button>
              <button
                onClick={() => setIsWeight(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isWeight ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Peso (kg)
              </button>
            </div>
          </div>

          {/* Quantità */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantità {isWeight ? '(kg)' : '(pezzi)'}
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const newQty = Math.max(isWeight ? 0.1 : 1, quantity - (isWeight ? 0.1 : 1))
                  setQuantity(newQty)
                  setQuantityText(String(Math.round(newQty * 10) / 10).replace('.', ','))
                }}
                className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold"
              >
                -
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={quantityText}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="flex-1 text-center text-2xl font-bold py-2 border rounded-lg"
              />
              <button
                onClick={() => {
                  const newQty = quantity + (isWeight ? 0.1 : 1)
                  setQuantity(newQty)
                  setQuantityText(String(Math.round(newQty * 10) / 10).replace('.', ','))
                }}
                className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Data di Scadenza */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data di Scadenza
            </label>
            <input
              type="text"
              value={expiryDateInput}
              onChange={(e) => setExpiryDateInput(e.target.value)}
              placeholder="DDMMYY (es: 150226)"
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              inputMode="numeric"
            />
          </div>

          {/* Classe / Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classe
            </label>
            {categories.length > 0 ? (
              <select
                value={selectedCategoryId || ''}
                onChange={(e) => setSelectedCategoryId(e.target.value || undefined)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleziona classe...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 italic py-3">Nessuna classe disponibile</p>
            )}
          </div>

          {/* EAN / Barcode con icona fotocamera */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              EAN / Barcode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Inserisci barcode..."
                className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                inputMode="numeric"
              />
              <button
                onClick={() => setShowPhotoScanner(true)}
                className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center justify-center"
                title="Scansiona da foto"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Indietro
          </button>
          <button
            onClick={() => handleSave()}
            disabled={!name.trim()}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              name.trim()
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {mode === 'view' ? 'Salva e Spunta' : 'Salva e Certifica'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ItemDetailModal
