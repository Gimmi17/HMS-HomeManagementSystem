import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import shoppingListsService from '@/services/shoppingLists'
import productsService from '@/services/products'
import { grocyHouseService } from '@/services/grocy'
import BarcodeScanner from '@/components/BarcodeScanner'
import { useHouse } from '@/context/HouseContext'
import type { ShoppingList, ShoppingListItem, GrocyBulkAddItem, GrocyBulkAddStockResponse } from '@/types'

type VerificationState = 'pending' | 'not_purchased' | 'verified_no_info' | 'verified_with_info'

interface QuantityModalProps {
  item?: ShoppingListItem | null
  barcode: string
  productName?: string
  isExtraItem?: boolean
  onConfirm: (quantity: number, isWeight: boolean) => void
  onCancel: () => void
}

interface HardwareScannerModalProps {
  itemName?: string
  isExtraItem?: boolean
  onScan: (barcode: string) => void
  onCancel: () => void
}

function HardwareScannerModal({ itemName, isExtraItem, onScan, onCancel }: HardwareScannerModalProps) {
  const [barcode, setBarcode] = useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (barcode.trim()) {
      onScan(barcode.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcode.trim()) {
      e.preventDefault()
      onScan(barcode.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">
            {isExtraItem ? 'Aggiungi Prodotto Extra' : 'Scansiona Barcode'}
          </h3>
          {itemName && <p className="text-sm text-gray-500 mt-1">{itemName}</p>}
          {isExtraItem && <p className="text-sm text-green-600 mt-1">Scansiona un prodotto non in lista</p>}
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usa lo scanner hardware
            </label>
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scansiona o inserisci barcode..."
              className="w-full px-4 py-3 border rounded-lg text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-2">
              Premi Invio o clicca Avanti per confermare
            </p>
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
            onClick={handleSubmit}
            disabled={!barcode.trim()}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              barcode.trim()
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Avanti
          </button>
        </div>
      </div>
    </div>
  )
}

interface EditItemModalProps {
  item: ShoppingListItem
  onSave: (name: string, quantity: number, unit: string) => void
  onCancel: () => void
}

function EditItemModal({ item, onSave, onCancel }: EditItemModalProps) {
  const [name, setName] = useState(item.grocy_product_name || item.name)
  const [quantity, setQuantity] = useState(item.verified_quantity ?? item.quantity)
  const [quantityText, setQuantityText] = useState(String(item.verified_quantity ?? item.quantity).replace('.', ','))
  const [isWeight, setIsWeight] = useState(
    item.verified_unit === 'kg' || item.unit === 'kg' || item.unit === 'g'
  )
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Parse quantity from text (handles both comma and dot as decimal separator)
  const parseQuantity = (text: string): number => {
    const normalized = text.replace(',', '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? 0 : parsed
  }

  const handleQuantityChange = (text: string) => {
    // Allow only numbers, comma, and dot
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
      onSave(name.trim(), quantity, isWeight ? 'kg' : 'pz')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Modifica Prodotto</h3>
          {item.scanned_barcode && (
            <p className="text-xs text-gray-500 mt-1">Barcode: {item.scanned_barcode}</p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Product Name */}
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

          {/* Unit type */}
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

function QuantityModal({ item, barcode, productName, isExtraItem, onConfirm, onCancel }: QuantityModalProps) {
  const [quantity, setQuantity] = useState(item?.quantity || 1)
  const [quantityText, setQuantityText] = useState(String(item?.quantity || 1))
  const [isWeight, setIsWeight] = useState(item?.unit === 'kg' || item?.unit === 'g')

  // Parse quantity from text (handles both comma and dot as decimal separator)
  const parseQuantity = (text: string): number => {
    const normalized = text.replace(',', '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? 0 : parsed
  }

  const handleQuantityChange = (text: string) => {
    // Allow only numbers, comma, and dot
    const filtered = text.replace(/[^0-9.,]/g, '')
    setQuantityText(filtered)
    setQuantity(parseQuantity(filtered))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">
            {isExtraItem ? 'Prodotto Extra' : item?.name || 'Prodotto'}
          </h3>
          {productName && <p className="text-sm text-green-600 mt-1">{productName}</p>}
          <p className="text-xs text-gray-500 mt-1">Barcode: {barcode}</p>
        </div>

        <div className="p-4 space-y-4">
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
        </div>

        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            onClick={() => onConfirm(quantity, isWeight)}
            className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}

function getItemState(item: ShoppingListItem): VerificationState {
  if (item.not_purchased) return 'not_purchased'
  if (!item.verified_at) return 'pending'
  // Check if we have product info (grocy_product_name indicates we found product data)
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
  const [showScanner, setShowScanner] = useState(false)
  const [scanningItem, setScanningItem] = useState<ShoppingListItem | null>(null)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [scannedProductName, setScannedProductName] = useState<string | null>(null)
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [hardwareScannerMode, setHardwareScannerMode] = useState(false)
  const [showHardwareScanner, setShowHardwareScanner] = useState(false)
  const [addingExtraMode, setAddingExtraMode] = useState(false)
  const [isAddingExtra, setIsAddingExtra] = useState(false) // Currently scanning for extra item
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null) // Item being edited
  const [showGrocySyncModal, setShowGrocySyncModal] = useState(false) // Grocy sync modal
  const [grocySyncResult, setGrocySyncResult] = useState<GrocyBulkAddStockResponse | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const { currentHouse } = useHouse()

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

  // Live polling
  useEffect(() => {
    if (!id || isLoading || showScanner || showQuantityModal || showHardwareScanner) return

    const pollInterval = setInterval(async () => {
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [id, isLoading, showScanner, showQuantityModal, showHardwareScanner])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleItemClick = (item: ShoppingListItem) => {
    const state = getItemState(item)
    if (state === 'pending') {
      setScanningItem(item)
      if (hardwareScannerMode) {
        setShowHardwareScanner(true)
      } else {
        setShowScanner(true)
      }
    }
  }

  const handleHardwareScan = async (barcode: string) => {
    setShowHardwareScanner(false)
    // Use the same flow as camera scanner
    await handleBarcodeScan(barcode)
  }

  const handleStartExtraScanning = () => {
    setIsAddingExtra(true)
    setScanningItem(null) // No item selected, we're adding new ones
    if (hardwareScannerMode) {
      setShowHardwareScanner(true)
    } else {
      setShowScanner(true)
    }
  }

  const handleStopExtraMode = () => {
    setAddingExtraMode(false)
    setIsAddingExtra(false)
  }

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false)
    setScannedBarcode(barcode)

    // Look up product info
    try {
      const result = await productsService.lookupBarcode(barcode)
      if (result.found) {
        const name = result.brand ? `${result.product_name} (${result.brand})` : result.product_name
        setScannedProductName(name || null)
      } else {
        setScannedProductName(null)
      }
    } catch {
      setScannedProductName(null)
    }

    setShowQuantityModal(true)
  }

  const handleQuantityConfirm = async (quantity: number, isWeight: boolean) => {
    if (!list || !scannedBarcode) return

    setShowQuantityModal(false)

    try {
      if (isAddingExtra) {
        // Adding extra item (not originally on the list)
        await shoppingListsService.addExtraItem(
          list.id,
          scannedBarcode,
          quantity,
          isWeight ? 'kg' : 'pz',
          scannedProductName || undefined
        )

        showToast(
          scannedProductName
            ? `Aggiunto: ${scannedProductName}`
            : 'Prodotto extra aggiunto',
          'success'
        )

        // Refresh list
        const updatedList = await shoppingListsService.getById(list.id)
        setList(updatedList)

        // Reset state and reopen scanner if still in extra mode
        setScannedBarcode(null)
        setScannedProductName(null)

        if (addingExtraMode) {
          // Continue scanning - reopen scanner after a short delay
          setTimeout(() => {
            if (hardwareScannerMode) {
              setShowHardwareScanner(true)
            } else {
              setShowScanner(true)
            }
          }, 300)
        } else {
          setIsAddingExtra(false)
        }
      } else {
        // Regular item verification
        if (!scanningItem) return

        await shoppingListsService.verifyItemWithQuantity(
          list.id,
          scanningItem.id,
          scannedBarcode,
          quantity,
          isWeight ? 'kg' : 'pz',
          scannedProductName || undefined
        )

        // Refresh list
        const updatedList = await shoppingListsService.getById(list.id)
        setList(updatedList)

        showToast(
          scannedProductName
            ? `Verificato: ${scannedProductName}`
            : 'Articolo verificato (prodotto non in anagrafica)',
          'success'
        )

        // Check if all items are verified
        const allVerified = updatedList.items.every((item) => item.verified_at)
        if (allVerified && !addingExtraMode) {
          await shoppingListsService.update(list.id, { verification_status: 'completed' })
          showToast('Controllo carico completato!', 'success')
        }

        setScanningItem(null)
        setScannedBarcode(null)
        setScannedProductName(null)
      }
    } catch (error) {
      console.error('Failed to process item:', error)
      showToast('Errore durante l\'operazione. Riprova.', 'error')
      setIsAddingExtra(false)
      setScanningItem(null)
      setScannedBarcode(null)
      setScannedProductName(null)
    }
  }

  const handleMarkNotPurchased = async (item: ShoppingListItem) => {
    if (!list) return

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
      // Mark verification as completed AND list as completed
      await shoppingListsService.update(list.id, {
        verification_status: 'completed',
        status: 'completed'
      })

      // Check if there are items with grocy_product_id to sync
      const itemsToSync = list.items.filter(
        item => item.grocy_product_id && item.verified_at && !item.not_purchased
      )

      if (itemsToSync.length > 0 && currentHouse) {
        // Show Grocy sync modal
        setShowGrocySyncModal(true)
      } else {
        showToast('Controllo carico completato!', 'success')
        navigate('/shopping-lists')
      }
    } catch (error) {
      console.error('Failed to complete verification:', error)
      showToast('Errore durante il completamento', 'error')
    }
  }

  const getItemsToSync = (): GrocyBulkAddItem[] => {
    if (!list) return []

    return list.items
      .filter(item => item.grocy_product_id && item.verified_at && !item.not_purchased)
      .map(item => ({
        product_id: item.grocy_product_id!,
        amount: item.verified_quantity ?? item.quantity,
        // Note: In a real scenario, you might want to capture expiration dates during verification
      }))
  }

  const handleGrocySync = async () => {
    if (!currentHouse || !list) return

    const itemsToSync = getItemsToSync()
    if (itemsToSync.length === 0) {
      setShowGrocySyncModal(false)
      navigate('/shopping-lists')
      return
    }

    setIsSyncing(true)
    try {
      const result = await grocyHouseService.bulkAddStock(currentHouse.id, itemsToSync)
      setGrocySyncResult(result)
    } catch (error) {
      console.error('Failed to sync with Grocy:', error)
      showToast('Errore durante la sincronizzazione con Grocy', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSkipGrocySync = () => {
    setShowGrocySyncModal(false)
    showToast('Controllo carico completato!', 'success')
    navigate('/shopping-lists')
  }

  const handleGrocySyncComplete = () => {
    setShowGrocySyncModal(false)
    setGrocySyncResult(null)
    showToast('Prodotti aggiunti alla dispensa!', 'success')
    navigate('/shopping-lists')
  }

  const handleEditItem = (item: ShoppingListItem) => {
    // Only allow editing verified items (especially those without product info)
    const state = getItemState(item)
    if (state === 'verified_no_info' || state === 'verified_with_info') {
      setEditingItem(item)
    }
  }

  const handleSaveEdit = async (name: string, quantity: number, unit: string) => {
    if (!list || !editingItem) return

    try {
      await shoppingListsService.updateItem(list.id, editingItem.id, {
        name: name,
        grocy_product_name: name,
        verified_quantity: quantity,
        verified_unit: unit,
      })

      // Refresh list
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

    // Confirm deletion
    const itemName = item.grocy_product_name || item.name
    if (!confirm(`Eliminare "${itemName}"?`)) return

    try {
      await shoppingListsService.deleteItem(list.id, item.id)

      // Refresh list
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
          <button
            onClick={handlePause}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Controllo Carico</h1>
            <p className="text-xs text-gray-500">{list.name}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-blue-600">{verifiedCount}/{totalCount}</div>
          {notPurchasedCount > 0 && (
            <div className="text-xs text-red-500">{notPurchasedCount} non acquistati</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Complete Verification Button */}
      <button
        onClick={handleCompleteVerification}
        className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Completa Controllo Carico
      </button>

      {/* Hardware Scanner Mode Toggle */}
      <button
        onClick={() => setHardwareScannerMode(!hardwareScannerMode)}
        className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
          hardwareScannerMode
            ? 'bg-purple-500 text-white'
            : 'bg-gray-100 text-gray-700 border border-gray-300'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        {hardwareScannerMode ? 'Scanner Hardware Attivo' : 'Usa Scanner Hardware'}
      </button>

      {/* Add Extra Products Button */}
      {addingExtraMode ? (
        <div className="flex gap-2">
          <button
            onClick={handleStartExtraScanning}
            className="flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 bg-green-500 text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Scansiona Prodotto Extra
          </button>
          <button
            onClick={handleStopExtraMode}
            className="py-3 px-4 rounded-lg font-medium bg-red-500 text-white"
            title="Termina modalità extra"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setAddingExtraMode(true)
            handleStartExtraScanning()
          }}
          className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-100 text-gray-700 border border-gray-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi Prodotti Extra
        </button>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <span>Da verificare</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Con anagrafica</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Senza anagrafica</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Non acquistato</span>
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

      {/* Items */}
      <div className="space-y-2">
        {list.items.map((item) => {
          const state = getItemState(item)
          const colors = STATE_COLORS[state]
          const isPending = state === 'pending'

          return (
            <div
              key={item.id}
              className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-3`}
            >
              <div className="flex items-center gap-3">
                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${state === 'not_purchased' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.verified_quantity !== undefined && item.verified_quantity !== null ? (
                      <span className="text-blue-600 font-medium">
                        {item.verified_quantity} {item.verified_unit || 'pz'}
                      </span>
                    ) : (
                      <span>{item.quantity} {item.unit || 'pz'}</span>
                    )}
                    {item.scanned_barcode && (
                      <span className="ml-2 text-gray-400">({item.scanned_barcode})</span>
                    )}
                  </div>
                  {item.grocy_product_name && (
                    <div className="text-xs text-green-600 mt-0.5">{item.grocy_product_name}</div>
                  )}
                </div>

                {/* Status indicator / Action buttons */}
                <div className="flex items-center gap-2">
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleMarkNotPurchased(item)}
                        className="p-2 bg-red-500 text-white rounded-lg"
                        title="Non acquistato"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleItemClick(item)}
                        className="p-2 bg-blue-500 text-white rounded-lg"
                        title="Scansiona"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                  {!isPending && (
                    <div className="flex items-center gap-2">
                      {/* Edit button for verified items (except not_purchased) */}
                      {state !== 'not_purchased' && (
                        <button
                          onClick={() => handleEditItem(item)}
                          className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                          title="Modifica"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                      {/* Delete button for all verified items */}
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        title="Elimina"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        state === 'not_purchased' ? 'bg-red-500' :
                        state === 'verified_no_info' ? 'bg-orange-500' : 'bg-green-500'
                      }`}>
                        {state === 'not_purchased' ? (
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => {
            setShowScanner(false)
            setScanningItem(null)
            if (isAddingExtra && !addingExtraMode) {
              setIsAddingExtra(false)
            }
          }}
        />
      )}

      {/* Quantity Modal */}
      {showQuantityModal && scannedBarcode && (scanningItem || isAddingExtra) && (
        <QuantityModal
          item={scanningItem}
          barcode={scannedBarcode}
          productName={scannedProductName || undefined}
          isExtraItem={isAddingExtra}
          onConfirm={handleQuantityConfirm}
          onCancel={() => {
            setShowQuantityModal(false)
            setScanningItem(null)
            setScannedBarcode(null)
            setScannedProductName(null)
            if (isAddingExtra && !addingExtraMode) {
              setIsAddingExtra(false)
            }
          }}
        />
      )}

      {/* Hardware Scanner Modal */}
      {showHardwareScanner && (scanningItem || isAddingExtra) && (
        <HardwareScannerModal
          itemName={scanningItem?.name}
          isExtraItem={isAddingExtra}
          onScan={handleHardwareScan}
          onCancel={() => {
            setShowHardwareScanner(false)
            setScanningItem(null)
            if (isAddingExtra && !addingExtraMode) {
              setIsAddingExtra(false)
            }
          }}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={handleSaveEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {/* Grocy Sync Modal */}
      {showGrocySyncModal && list && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Sincronizza con Grocy</h3>
              <p className="text-sm text-gray-500 mt-1">
                Aggiungere i prodotti verificati alla dispensa?
              </p>
            </div>

            <div className="p-4">
              {!grocySyncResult ? (
                <>
                  {/* Items preview */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-60 overflow-y-auto">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {getItemsToSync().length} prodotti da aggiungere:
                    </p>
                    <ul className="space-y-1">
                      {list.items
                        .filter(item => item.grocy_product_id && item.verified_at && !item.not_purchased)
                        .map(item => (
                          <li key={item.id} className="text-sm text-gray-600 flex justify-between">
                            <span>{item.grocy_product_name || item.name}</span>
                            <span className="text-gray-400">
                              {item.verified_quantity ?? item.quantity} {item.verified_unit || item.unit || 'pz'}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSkipGrocySync}
                      disabled={isSyncing}
                      className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100 disabled:opacity-50"
                    >
                      Salta
                    </button>
                    <button
                      onClick={handleGrocySync}
                      disabled={isSyncing}
                      className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSyncing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sincronizzazione...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sincronizza
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Sync results */}
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        grocySyncResult.failed === 0 ? 'bg-green-100' : 'bg-yellow-100'
                      }`}>
                        {grocySyncResult.failed === 0 ? (
                          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {grocySyncResult.failed === 0
                            ? 'Sincronizzazione completata!'
                            : 'Sincronizzazione parziale'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {grocySyncResult.successful}/{grocySyncResult.total} prodotti aggiunti
                        </p>
                      </div>
                    </div>

                    {/* Show failed items if any */}
                    {grocySyncResult.failed > 0 && (
                      <div className="bg-red-50 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-red-700 mb-2">Errori:</p>
                        <ul className="space-y-1">
                          {grocySyncResult.results
                            .filter(r => !r.success)
                            .map(r => (
                              <li key={r.product_id} className="text-sm text-red-600">
                                Prodotto #{r.product_id}: {r.message}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGrocySyncComplete}
                    className="w-full py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
                  >
                    Chiudi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoadVerification
