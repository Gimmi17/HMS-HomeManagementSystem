import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import shoppingListsService from '@/services/shoppingLists'
import productsService from '@/services/products'
import categoriesService from '@/services/categories'
import PhotoBarcodeScanner from '@/components/PhotoBarcodeScanner'
import type { ShoppingList, ShoppingListItem, Category } from '@/types'

type VerificationState = 'pending' | 'not_purchased' | 'verified_no_info' | 'verified_with_info'

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

interface VerificationModalProps {
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

function VerificationModal({ item, categories, onConfirm, onCancel, onMarkNotPurchased }: VerificationModalProps) {
  const [quantity, setQuantity] = useState(item.quantity || 1)
  const [quantityText, setQuantityText] = useState(String(item.quantity || 1))
  const [isWeight, setIsWeight] = useState(item.unit === 'kg' || item.unit === 'g')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(item.category_id)
  const [barcodeInput, setBarcodeInput] = useState(item.scanned_barcode || '')
  const [productName, setProductName] = useState<string | null>(null)
  const [showPhotoScanner, setShowPhotoScanner] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Expiry date state
  const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }
  const [expiryDateInput, setExpiryDateInput] = useState(
    item.expiry_date ? formatDateForDisplay(item.expiry_date) : ''
  )

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
      return
    }

    setIsLookingUp(true)
    try {
      const result = await productsService.lookupBarcode(barcode)
      if (result.found) {
        const name = result.brand ? `${result.product_name} (${result.brand})` : result.product_name
        setProductName(name || null)
      } else {
        setProductName(null)
      }
    } catch {
      setProductName(null)
    } finally {
      setIsLookingUp(false)
    }
  }

  // Handle barcode from photo scanner
  const handlePhotoBarcodeScanned = (barcode: string) => {
    setBarcodeInput(barcode)
    setShowPhotoScanner(false)
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
    const parsedExpiry = expiryDateInput.trim() ? parseExpiryDate(expiryDateInput.trim()) : null
    onConfirm({
      quantity,
      isWeight,
      expiryDate: parsedExpiry,
      categoryId: selectedCategoryId,
      barcode: barcodeInput.trim() || undefined,
      productName: productName || undefined,
    })
  }

  // Show photo scanner
  if (showPhotoScanner) {
    return (
      <PhotoBarcodeScanner
        onScan={handlePhotoBarcodeScanned}
        onClose={() => setShowPhotoScanner(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">{item.name}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Richiesto: {item.quantity} {item.unit}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Quantity type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo di misura
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

          {/* Quantity */}
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
                onClick={() => setShowPhotoScanner(true)}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                title="Scatta foto per leggere barcode"
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
              <p className="text-xs text-green-600 mt-1">{productName}</p>
            )}
            {barcodeInput && !productName && !isLookingUp && (
              <p className="text-xs text-gray-400 mt-1">Prodotto non trovato in anagrafica</p>
            )}
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
              onChange={(e) => setExpiryDateInput(e.target.value)}
              placeholder="DDMMYY (es: 150226)"
              className="w-full px-4 py-3 border rounded-lg text-center text-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria {item.category_id ? '(conferma)' : '(opzionale)'}
              </label>
              <select
                value={selectedCategoryId || ''}
                onChange={(e) => setSelectedCategoryId(e.target.value || undefined)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
        </div>

        <div className="p-4 border-t space-y-2">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
            >
              Verifica
            </button>
          </div>
          <button
            onClick={onMarkNotPurchased}
            className="w-full py-2.5 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 text-sm"
          >
            Non Acquistato
          </button>
        </div>
      </div>
    </div>
  )
}

interface EditItemModalProps {
  item: ShoppingListItem
  categories: Category[]
  onSave: (data: { name: string; quantity: number; unit: string; expiryDate?: string; categoryId?: string; barcode?: string }) => void
  onCancel: () => void
}

function EditItemModal({ item, categories, onSave, onCancel }: EditItemModalProps) {
  const [name, setName] = useState(item.grocy_product_name || item.name)
  const [quantity, setQuantity] = useState(item.verified_quantity ?? item.quantity)
  const [quantityText, setQuantityText] = useState(String(item.verified_quantity ?? item.quantity).replace('.', ','))
  const [isWeight, setIsWeight] = useState(
    item.verified_unit === 'kg' || item.unit === 'kg' || item.unit === 'g'
  )
  const [expiryDateInput, setExpiryDateInput] = useState(item.expiry_date ? formatDateForDisplay(item.expiry_date) : '')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(item.category_id)
  const [barcodeInput, setBarcodeInput] = useState(item.scanned_barcode || '')
  const inputRef = React.useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSave = () => {
    if (name.trim()) {
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
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Modifica Prodotto</h3>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome prodotto
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inserisci nome prodotto..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo di misura
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

          {/* Expiry Date */}
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

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            {categories.length > 0 ? (
              <select
                value={selectedCategoryId || ''}
                onChange={(e) => setSelectedCategoryId(e.target.value || undefined)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleziona categoria...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 italic">Nessuna categoria disponibile</p>
            )}
          </div>

          {/* Barcode / EAN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              EAN / Barcode
            </label>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Inserisci barcode..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              name.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  )
}

function getItemState(item: ShoppingListItem): VerificationState {
  if (item.not_purchased) return 'not_purchased'
  if (!item.verified_at) return 'pending'
  if (item.grocy_product_name) return 'verified_with_info'
  return 'verified_no_info'
}

const STATE_COLORS: Record<VerificationState, { bg: string; border: string; icon: string }> = {
  pending: { bg: 'bg-gray-100', border: 'border-gray-300', icon: 'text-gray-400' },
  not_purchased: { bg: 'bg-red-100', border: 'border-red-400', icon: 'text-red-500' },
  verified_no_info: { bg: 'bg-orange-100', border: 'border-orange-400', icon: 'text-orange-500' },
  verified_with_info: { bg: 'bg-green-100', border: 'border-green-400', icon: 'text-green-500' },
}

export function LoadVerification() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [list, setList] = useState<ShoppingList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [verifyingItem, setVerifyingItem] = useState<ShoppingListItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  // Initial load
  useEffect(() => {
    const fetchList = async () => {
      if (!id) return

      setIsLoading(true)
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)

        // Auto-start verification if not started
        if (data.verification_status === 'not_started' || data.verification_status === 'paused') {
          const updated = await shoppingListsService.update(id, { verification_status: 'in_progress' })
          setList(updated)
        }
      } catch (error) {
        console.error('Failed to fetch list:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchList()
  }, [id])

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await categoriesService.getAll()
        setCategories(response.categories)
      } catch (error) {
        console.error('Failed to load categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Live polling
  useEffect(() => {
    if (!id || isLoading || verifyingItem || editingItem) return

    const pollInterval = setInterval(async () => {
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [id, isLoading, verifyingItem, editingItem])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleItemClick = (item: ShoppingListItem) => {
    const state = getItemState(item)
    if (state === 'pending') {
      setVerifyingItem(item)
    }
  }

  const handleVerificationConfirm = async (data: {
    quantity: number
    isWeight: boolean
    expiryDate?: string | null
    categoryId?: string
    barcode?: string
    productName?: string
  }) => {
    if (!list || !verifyingItem) return

    setVerifyingItem(null)

    try {
      // If barcode provided, verify with it
      if (data.barcode) {
        await shoppingListsService.verifyItemWithQuantity(
          list.id,
          verifyingItem.id,
          data.barcode,
          data.quantity,
          data.isWeight ? 'kg' : 'pz',
          data.productName
        )
      } else {
        // Verify without barcode (just quantity)
        await shoppingListsService.verifyItemWithQuantity(
          list.id,
          verifyingItem.id,
          '', // empty barcode
          data.quantity,
          data.isWeight ? 'kg' : 'pz',
          undefined
        )
      }

      // Update expiry date and category if provided
      const updateData: { expiry_date?: string; category_id?: string } = {}
      if (data.expiryDate) {
        updateData.expiry_date = data.expiryDate
      }
      if (data.categoryId) {
        updateData.category_id = data.categoryId
      }
      if (Object.keys(updateData).length > 0) {
        await shoppingListsService.updateItem(list.id, verifyingItem.id, updateData)
      }

      // Refresh list
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)

      showToast(
        data.productName
          ? `Verificato: ${data.productName}`
          : 'Articolo verificato',
        'success'
      )

      // Check if all items are verified
      const allVerified = updatedList.items.every((item) => item.verified_at)
      if (allVerified) {
        await shoppingListsService.update(list.id, { verification_status: 'completed' })
        showToast('Controllo carico completato!', 'success')
      }
    } catch (error) {
      console.error('Failed to verify item:', error)
      showToast('Errore durante la verifica. Riprova.', 'error')
    }
  }

  const handleMarkNotPurchased = async (item: ShoppingListItem) => {
    if (!list) return

    setVerifyingItem(null)

    try {
      await shoppingListsService.markNotPurchased(list.id, item.id)
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      showToast('Articolo segnato come non acquistato', 'success')

      // Check if all items are verified
      const allVerified = updatedList.items.every((i) => i.verified_at)
      if (allVerified) {
        await shoppingListsService.update(list.id, { verification_status: 'completed' })
        showToast('Controllo carico completato!', 'success')
      }
    } catch (error) {
      console.error('Failed to mark as not purchased:', error)
      showToast('Errore. Riprova.', 'error')
    }
  }

  const handlePause = async () => {
    if (!list) return
    try {
      await shoppingListsService.update(list.id, { verification_status: 'paused' })
      navigate('/shopping-lists')
    } catch (error) {
      console.error('Failed to pause:', error)
    }
  }

  const handleCompleteVerification = async () => {
    if (!list) return

    const pendingCount = list.items.filter(i => !i.verified_at).length
    const message = pendingCount > 0
      ? `Ci sono ancora ${pendingCount} articoli non verificati. Completare comunque?`
      : 'Confermi di voler completare il controllo carico?'

    if (!confirm(message)) {
      return
    }

    try {
      await shoppingListsService.update(list.id, {
        verification_status: 'completed',
        status: 'completed'
      })
      alert('Controllo carico completato! Lista conclusa.')
      navigate('/shopping-lists')
    } catch (error) {
      console.error('Failed to complete verification:', error)
      alert('Errore durante il completamento')
    }
  }

  const handleEditItem = (item: ShoppingListItem) => {
    const state = getItemState(item)
    if (state === 'verified_no_info' || state === 'verified_with_info') {
      setEditingItem(item)
    }
  }

  const handleSaveEdit = async (data: { name: string; quantity: number; unit: string; expiryDate?: string; categoryId?: string; barcode?: string }) => {
    if (!list || !editingItem) return

    try {
      // Only update grocy_product_name if it was already set (from API lookup)
      // This prevents manual edits from changing the item to "verified_with_info" (green)
      const updateData: Partial<ShoppingListItem> = {
        name: data.name,
        verified_quantity: data.quantity,
        verified_unit: data.unit,
      }

      // Only update grocy_product_name if item already had it (was found via API)
      if (editingItem.grocy_product_name) {
        updateData.grocy_product_name = data.name
      }

      // Add expiry date if provided
      if (data.expiryDate) {
        updateData.expiry_date = data.expiryDate
      }

      // Add category if provided
      if (data.categoryId) {
        updateData.category_id = data.categoryId
      }

      // Add barcode if provided
      if (data.barcode) {
        updateData.scanned_barcode = data.barcode
      }

      await shoppingListsService.updateItem(list.id, editingItem.id, updateData)

      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      setEditingItem(null)
      showToast('Prodotto aggiornato', 'success')
    } catch (error) {
      console.error('Failed to update item:', error)
      showToast('Errore durante il salvataggio', 'error')
    }
  }

  const handleDeleteItem = async (item: ShoppingListItem) => {
    if (!list) return

    if (!confirm(`Eliminare "${item.grocy_product_name || item.name}"?`)) {
      return
    }

    try {
      await shoppingListsService.deleteItem(list.id, item.id)
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      showToast('Articolo eliminato', 'success')
    } catch (error) {
      console.error('Failed to delete item:', error)
      showToast('Errore durante l\'eliminazione', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Caricamento...</p>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Lista non trovata</p>
        <Link to="/shopping-lists" className="text-primary-600 text-sm mt-2 inline-block">
          Torna alle liste
        </Link>
      </div>
    )
  }

  const verifiedCount = list.items.filter((i) => i.verified_at).length
  const notPurchasedCount = list.items.filter((i) => i.not_purchased).length
  const totalCount = list.items.length

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/shopping-lists"
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Controllo Carico</h1>
            <p className="text-xs text-gray-500">{list.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePause}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Pausa
          </button>
          <button
            onClick={handleCompleteVerification}
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Completa
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-40 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Progress */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Progresso</span>
          <span className="text-sm font-medium">
            {verifiedCount}/{totalCount}
            {notPurchasedCount > 0 && (
              <span className="text-red-500 ml-1">({notPurchasedCount} non acquistati)</span>
            )}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {list.items.map((item) => {
          const state = getItemState(item)
          const colors = STATE_COLORS[state]

          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`card p-3 border-2 transition-colors cursor-pointer ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`mt-0.5 ${colors.icon}`}>
                  {state === 'pending' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {state === 'not_purchased' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {(state === 'verified_no_info' || state === 'verified_with_info') && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {item.grocy_product_name || item.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {item.verified_quantity ?? item.quantity} {item.verified_unit || item.unit}
                    {item.scanned_barcode && (
                      <span className="ml-2 text-gray-400">EAN: {item.scanned_barcode}</span>
                    )}
                  </div>
                  {item.expiry_date && (
                    <div className="text-xs text-orange-600 mt-0.5">
                      Scad: {item.expiry_date.split('-').reverse().join('/')}
                    </div>
                  )}
                </div>

                {/* Edit button for verified items */}
                {(state === 'verified_no_info' || state === 'verified_with_info') && (
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditItem(item)
                      }}
                      className="p-1.5 text-gray-500 hover:bg-white/50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item)
                      }}
                      className="p-1.5 text-red-500 hover:bg-white/50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Verification Modal */}
      {verifyingItem && (
        <VerificationModal
          item={verifyingItem}
          categories={categories}
          onConfirm={handleVerificationConfirm}
          onCancel={() => setVerifyingItem(null)}
          onMarkNotPurchased={() => handleMarkNotPurchased(verifyingItem)}
        />
      )}

      {/* Edit Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          categories={categories}
          onSave={handleSaveEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}

export default LoadVerification
