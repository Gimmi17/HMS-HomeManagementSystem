import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import shoppingListsService from '@/services/shoppingLists'
import storesService from '@/services/stores'
import { grocyHouseService } from '@/services/grocy'
import productsService from '@/services/products'
import type { ProductSuggestion } from '@/services/products'
import anagraficheService from '@/services/anagrafiche'
import SwipeableRow from '@/components/SwipeableRow'
import type { ShoppingListItem, GrocyProductSimple, Store } from '@/types'
import type { ShoppingListState } from './useShoppingListState'

interface EditModeProps {
  state: ShoppingListState
  onDone: () => void
}

interface ItemRow {
  id: string
  name: string
  grocyProductId?: number
  grocyProductName?: string
  quantity: number
  unit: string
  categoryId?: string
  urgent?: boolean
  productNotes?: string
  catalogBarcode?: string
  scannedBarcode?: string
  isNew?: boolean
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export default function EditMode({ state, onDone }: EditModeProps) {
  const { list, setList, categories, showToast } = state
  const { currentHouse } = useHouse()

  const [listName, setListName] = useState('')
  const [storeId, setStoreId] = useState<string | undefined>()
  const [stores, setStores] = useState<Store[]>([])
  const [newStoreName, setNewStoreName] = useState('')
  const [showNewStoreInput, setShowNewStoreInput] = useState(false)
  const [items, setItems] = useState<ItemRow[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showGrocyModal, setShowGrocyModal] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [grocyProducts, setGrocyProducts] = useState<GrocyProductSimple[]>([])
  const [grocySearch, setGrocySearch] = useState('')
  const [isLoadingGrocy, setIsLoadingGrocy] = useState(false)
  const [grocyError, setGrocyError] = useState<string | null>(null)
  const [focusItemId, setFocusItemId] = useState<string | null>(null)
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
  const [savingNoteItemId, setSavingNoteItemId] = useState<string | null>(null)
  const [noteSaveResult, setNoteSaveResult] = useState<{ itemId: string; success: boolean } | null>(null)
  const [lockError, setLockError] = useState<string | null>(null)
  const [hasLock, setHasLock] = useState(false)
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set())

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])
  const [activeAutocompleteId, setActiveAutocompleteId] = useState<string | null>(null)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRef = useRef<HTMLDivElement | null>(null)

  // Load stores
  useEffect(() => {
    if (!currentHouse?.id) return
    const loadStores = async () => {
      try {
        const response = await storesService.getAll(currentHouse.id)
        setStores(response.stores)
      } catch (error) {
        console.error('Failed to load stores:', error)
      }
    }
    loadStores()
  }, [currentHouse?.id])

  // Acquire lock and load list data into editable form
  useEffect(() => {
    if (!list || !state.id) return

    const acquireLockAndLoad = async () => {
      try {
        await shoppingListsService.acquireLock(state.id)
        setHasLock(true)
        setLockError(null)
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number; data?: { detail?: string } } }
        if (axiosError?.response?.status === 423) {
          setLockError(axiosError.response.data?.detail || 'Lista in modifica da un altro utente')
          return
        }
        console.error('Failed to acquire lock:', error)
      }

      // Load into form state
      setListName(list.name)
      setStoreId(list.store_id)
      if (list.items.length > 0) {
        setOriginalItemIds(new Set(list.items.map((item) => item.id)))
        setItems(
          list.items.map((item) => ({
            id: item.id,
            name: item.name,
            grocyProductId: item.grocy_product_id,
            grocyProductName: item.grocy_product_name,
            quantity: item.quantity,
            unit: item.unit || 'pz',
            categoryId: item.category_id,
            urgent: item.urgent,
            productNotes: item.product_notes,
            catalogBarcode: item.catalog_barcode,
            scannedBarcode: item.scanned_barcode,
            isNew: false,
          }))
        )
      } else {
        setItems([{ id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true }])
      }
    }

    acquireLockAndLoad()
  }, [list?.id]) // Only run when list id changes, not on every list update

  // Release lock on unmount (mode change)
  useEffect(() => {
    return () => {
      if (hasLock && state.id) {
        shoppingListsService.releaseLock(state.id).catch(() => {})
      }
    }
  }, [state.id, hasLock])

  // Search Grocy products
  useEffect(() => {
    if (!showGrocyModal || !currentHouse) return
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    setIsLoadingGrocy(true)
    setGrocyError(null)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const products = await grocyHouseService.getProducts(currentHouse.id, grocySearch || undefined)
        setGrocyProducts(products)
        setGrocyError(null)
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number } }
        if (axiosError?.response?.status !== 400) {
          console.error('Failed to fetch Grocy products:', error)
        }
        setGrocyError('Impossibile caricare i prodotti. Verifica la configurazione Grocy.')
        setGrocyProducts([])
      } finally {
        setIsLoadingGrocy(false)
      }
    }, 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [showGrocyModal, grocySearch, currentHouse])

  // Focus new item input
  useEffect(() => {
    if (focusItemId && inputRefs.current[focusItemId]) {
      inputRefs.current[focusItemId]?.focus()
      setFocusItemId(null)
    }
  }, [focusItemId, items])

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setActiveAutocompleteId(null)
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced autocomplete search
  const searchSuggestions = useCallback((itemId: string, value: string) => {
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    if (value.length < 3 || !currentHouse?.id) {
      setSuggestions([])
      setActiveAutocompleteId(null)
      return
    }
    suggestTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await productsService.suggestProducts(currentHouse.id, value)
        setSuggestions(result.suggestions)
        setActiveAutocompleteId(result.suggestions.length > 0 ? itemId : null)
        setSelectedSuggestionIndex(-1)
      } catch (error) {
        console.error('Autocomplete suggest failed:', error)
        setSuggestions([])
        setActiveAutocompleteId(null)
      }
    }, 300)
  }, [currentHouse?.id])

  const selectSuggestion = (itemId: string, suggestion: ProductSuggestion) => {
    const displayName = suggestion.brand ? `${suggestion.name} (${suggestion.brand})` : suggestion.name
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, name: displayName, catalogBarcode: suggestion.barcode, productNotes: suggestion.user_notes || item.productNotes }
          : item
      )
    )
    setSuggestions([])
    setActiveAutocompleteId(null)
    setSelectedSuggestionIndex(-1)
  }

  const handleItemChange = (itemId: string, field: keyof ItemRow, value: string | number | boolean | undefined) => {
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, [field]: value } : item))
    if (field === 'name' && typeof value === 'string') searchSuggestions(itemId, value)
  }

  const addItem = (afterId?: string, shouldFocus = false) => {
    const newItem: ItemRow = { id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true }
    if (afterId) {
      setItems((prev) => {
        const index = prev.findIndex((item) => item.id === afterId)
        const newItems = [...prev]
        newItems.splice(index + 1, 0, newItem)
        return newItems
      })
    } else {
      setItems((prev) => [...prev, newItem])
    }
    if (shouldFocus) setFocusItemId(newItem.id)
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (activeAutocompleteId === itemId && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestionIndex((prev) => prev < suggestions.length - 1 ? prev + 1 : 0); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestionIndex((prev) => prev > 0 ? prev - 1 : suggestions.length - 1); return }
      if (e.key === 'Enter' && selectedSuggestionIndex >= 0) { e.preventDefault(); selectSuggestion(itemId, suggestions[selectedSuggestionIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setSuggestions([]); setActiveAutocompleteId(null); setSelectedSuggestionIndex(-1); return }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const currentIndex = items.findIndex((item) => item.id === itemId)

      // Save current item to backend if it's new and has a name
      if (state.id) {
        const currentItem = items[currentIndex]
        if (currentItem && currentItem.name.trim() && currentItem.isNew) {
          try {
            const savedItem = await shoppingListsService.addItem(state.id, {
              name: currentItem.name.trim(),
              grocy_product_id: currentItem.grocyProductId,
              grocy_product_name: currentItem.grocyProductName,
              quantity: currentItem.quantity || 1,
              unit: currentItem.unit,
              category_id: currentItem.categoryId,
              urgent: currentItem.urgent,
            })
            if (currentItem.catalogBarcode) {
              await shoppingListsService.updateItem(state.id, savedItem.id, { scanned_barcode: currentItem.catalogBarcode })
            }
            const newItem: ItemRow = { id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true }
            setItems((prev) => {
              const newItems = prev.map((item) =>
                item.id === itemId ? { ...item, id: savedItem.id, isNew: false } : item
              )
              newItems.splice(currentIndex + 1, 0, newItem)
              return newItems
            })
            setFocusItemId(newItem.id)
            return
          } catch (error) {
            console.error('Failed to save item:', error)
          }
        }
      }
      addItem(itemId, true)
    }
  }

  const removeItem = (itemId: string) => {
    setItems((prev) => {
      if (prev.length === 1) return [{ id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true }]
      return prev.filter((item) => item.id !== itemId)
    })
  }

  const openGrocySelector = (itemId: string) => {
    setSelectedItemId(itemId)
    setGrocySearch('')
    setShowGrocyModal(true)
  }

  const selectGrocyProduct = (product: GrocyProductSimple) => {
    if (selectedItemId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItemId
            ? { ...item, name: product.name, grocyProductId: product.id, grocyProductName: product.name }
            : item
        )
      )
    }
    setShowGrocyModal(false)
    setSelectedItemId(null)
  }

  const saveItemNote = async (item: ItemRow) => {
    const barcode = item.scannedBarcode || item.catalogBarcode
    if (!barcode) { setEditingNoteItemId(null); return }
    setSavingNoteItemId(item.id)
    try {
      await anagraficheService.updateProductNotesByBarcode(barcode, item.productNotes?.trim() || null)
      setNoteSaveResult({ itemId: item.id, success: true })
    } catch (e) {
      console.warn('Failed to save product note:', e)
      setNoteSaveResult({ itemId: item.id, success: false })
    } finally {
      setSavingNoteItemId(null)
      setEditingNoteItemId(null)
      setTimeout(() => setNoteSaveResult(null), 2000)
    }
  }

  const handleSave = async () => {
    if (!currentHouse || !state.id) return
    const validItems = items.filter((item) => item.name.trim())
    if (validItems.length === 0) {
      alert('Aggiungi almeno un articolo alla lista')
      return
    }

    setIsSaving(true)
    try {
      // Update list name and store
      const updateData: { name?: string; store_id?: string } = {}
      if (listName.trim()) updateData.name = listName.trim()
      if (storeId) updateData.store_id = storeId
      if (Object.keys(updateData).length > 0) {
        await shoppingListsService.update(state.id, updateData)
      }

      // Find items to delete
      const currentItemIds = new Set(validItems.filter(i => !i.isNew).map(i => i.id))
      const itemsToDelete = [...originalItemIds].filter(origId => !currentItemIds.has(origId))

      for (const itemId of itemsToDelete) {
        await shoppingListsService.deleteItem(state.id, itemId)
      }

      // Update existing items and add new ones
      for (const item of validItems) {
        if (item.isNew) {
          const savedItem = await shoppingListsService.addItem(state.id, {
            name: item.name.trim(),
            grocy_product_id: item.grocyProductId,
            grocy_product_name: item.grocyProductName,
            quantity: item.quantity || 1,
            unit: item.unit,
            category_id: item.categoryId,
            urgent: item.urgent,
          })
          if (item.catalogBarcode) {
            await shoppingListsService.updateItem(state.id, savedItem.id, { scanned_barcode: item.catalogBarcode })
          }
        } else {
          const updateItemData: Partial<ShoppingListItem> = {
            name: item.name.trim(),
            grocy_product_id: item.grocyProductId,
            grocy_product_name: item.grocyProductName,
            quantity: item.quantity || 1,
            unit: item.unit,
            category_id: item.categoryId,
            urgent: item.urgent,
          }
          if (item.catalogBarcode) updateItemData.scanned_barcode = item.catalogBarcode
          await shoppingListsService.updateItem(state.id, item.id, updateItemData)
        }
      }

      // Refresh list and switch to view mode
      await state.refreshList()
      showToast(true, 'Lista salvata')
      onDone()
    } catch (error) {
      console.error('Failed to save list:', error)
      alert('Errore nel salvataggio')
    } finally {
      setIsSaving(false)
      setShowSaveModal(false)
    }
  }

  // Show lock error
  if (lockError) {
    return (
      <div className="card p-6 text-center">
        <div className="text-4xl mb-4">&#128274;</div>
        <p className="text-red-600 font-medium mb-2">{lockError}</p>
        <p className="text-gray-500 text-sm mb-4">Attendi che l'altro utente finisca di modificare la lista.</p>
        <button onClick={onDone} className="btn btn-primary">Torna alla vista</button>
      </div>
    )
  }

  return (
    <>
      {/* Store selector */}
      <div className="card p-3">
        <label className="label text-xs mb-1">Negozio</label>
        {showNewStoreInput ? (
          <div className="flex gap-2">
            <input type="text" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} placeholder="Nome negozio..." className="input flex-1" autoFocus />
            <button type="button" onClick={async () => {
              if (newStoreName.trim() && currentHouse) {
                try {
                  const newStore = await storesService.create(currentHouse.id, { name: newStoreName.trim() })
                  setStores((prev) => [...prev, newStore])
                  setStoreId(newStore.id)
                  setNewStoreName('')
                  setShowNewStoreInput(false)
                } catch (error) { console.error('Failed to create store:', error) }
              }
            }} className="btn btn-primary text-sm px-3">+</button>
            <button type="button" onClick={() => { setShowNewStoreInput(false); setNewStoreName('') }} className="btn btn-secondary text-sm px-3">x</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select value={storeId || ''} onChange={(e) => setStoreId(e.target.value || undefined)} className="input flex-1">
              <option value="">Nessun negozio</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.display_name || store.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setShowNewStoreInput(true)} className="btn btn-secondary text-sm px-3" title="Aggiungi negozio">+</button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <SwipeableRow key={item.id} onSwipeLeft={() => removeItem(item.id)}>
            <div className="card p-3">
              <div className="flex flex-col gap-2">
                {/* Row number and name input */}
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 relative" ref={activeAutocompleteId === item.id ? autocompleteRef : undefined}>
                    <input
                      ref={(el) => { inputRefs.current[item.id] = el }}
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      placeholder="Nome articolo..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-primary-500"
                    />
                    {activeAutocompleteId === item.id && suggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {suggestions.map((suggestion, sIdx) => (
                          <button
                            key={suggestion.barcode}
                            type="button"
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-primary-50 ${
                              sIdx === selectedSuggestionIndex ? 'bg-primary-100 text-primary-800' : 'text-gray-700'
                            }`}
                            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(item.id, suggestion) }}
                          >
                            <div>
                              <span className="font-medium">{suggestion.name}</span>
                              {suggestion.brand && <span className="text-gray-400 ml-1">({suggestion.brand})</span>}
                            </div>
                            {suggestion.user_notes && <div className="text-xs text-blue-600 italic mt-0.5">{suggestion.user_notes}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantity, Grocy button, actions */}
                <div className="flex items-center gap-2 ml-8">
                  <input
                    type="text" inputMode="decimal" value={item.quantity || ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.,]/g, '')
                      const parsed = parseFloat(raw.replace(',', '.'))
                      handleItemChange(item.id, 'quantity', isNaN(parsed) ? 0 : parsed)
                    }}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-base text-center"
                  />
                  <select value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} className="w-20 px-2 py-1.5 border border-gray-300 rounded-md text-base bg-white">
                    <option value="pz">pz</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                  </select>
                  <select value={item.categoryId || ''} onChange={(e) => handleItemChange(item.id, 'categoryId', e.target.value || undefined)} className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-base bg-white truncate" title="Categoria">
                    <option value="">Cat.</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => openGrocySelector(item.id)} className={`p-1.5 rounded-md transition-colors ${item.grocyProductId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title="Seleziona da Grocy">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </button>
                  <button type="button" onClick={() => handleItemChange(item.id, 'urgent', !item.urgent)} className={`p-1.5 rounded-md transition-colors ${item.urgent ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`} title={item.urgent ? 'Rimuovi urgente' : 'Segna come urgente'}>
                    <svg className="w-5 h-5" fill={item.urgent ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                  <button type="button" onClick={() => addItem(item.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <button type="button" onClick={() => setEditingNoteItemId(editingNoteItemId === item.id ? null : item.id)} className={`p-1.5 rounded-md transition-colors ${item.productNotes ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`} title={item.productNotes ? 'Modifica nota articolo' : 'Aggiungi nota articolo'}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                  </button>
                  <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Note input */}
                {editingNoteItemId === item.id && (
                  <div className="ml-8 flex items-center gap-2">
                    <input
                      type="text" value={item.productNotes || ''}
                      onChange={(e) => handleItemChange(item.id, 'productNotes', e.target.value)}
                      placeholder="Es: Buona marca, Evitare..."
                      className="flex-1 px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveItemNote(item) } }}
                    />
                    <button type="button" onClick={() => saveItemNote(item)} disabled={savingNoteItemId === item.id} className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center gap-1">
                      {savingNoteItemId === item.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      )}
                      Salva
                    </button>
                  </div>
                )}
                {noteSaveResult?.itemId === item.id && (
                  <div className={`ml-8 text-xs ${noteSaveResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {noteSaveResult.success ? 'Nota salvata!' : 'Errore nel salvataggio nota'}
                  </div>
                )}

                {/* Badges */}
                {(item.grocyProductId || item.categoryId || item.productNotes) && (
                  <div className="ml-8 flex flex-wrap gap-1">
                    {item.grocyProductId && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">Grocy: {item.grocyProductName}</span>
                    )}
                    {item.categoryId && (() => {
                      const cat = categories.find(c => c.id === item.categoryId)
                      return cat ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: cat.color ? `${cat.color}20` : '#E5E7EB', color: cat.color || '#374151' }}>
                          {cat.icon} {cat.name}
                        </span>
                      ) : null
                    })()}
                    {item.productNotes && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 italic">{item.productNotes}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SwipeableRow>
        ))}

        {/* Add row button */}
        <button type="button" onClick={() => addItem()} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 text-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Aggiungi articolo
        </button>
      </div>

      {/* Save button */}
      <button type="button" onClick={() => setShowSaveModal(true)} className="btn btn-primary w-full text-sm">
        Salva Lista
      </button>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 space-y-4">
            <h3 className="text-lg font-semibold">Salva Lista</h3>
            <div>
              <label className="label text-xs">Nome lista</label>
              <input type="text" value={listName} onChange={(e) => setListName(e.target.value)} placeholder={list?.name || 'Nome lista'} className="input w-full" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSaveModal(false)} className="btn btn-secondary flex-1 text-sm">Annulla</button>
              <button type="button" onClick={handleSave} disabled={isSaving} className="btn btn-primary flex-1 text-sm">{isSaving ? 'Salvataggio...' : 'Conferma'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Grocy Product Modal */}
      {showGrocyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Seleziona Prodotto</h3>
                <button onClick={() => setShowGrocyModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <input type="text" value={grocySearch} onChange={(e) => setGrocySearch(e.target.value)} placeholder="Cerca prodotto..." className="input w-full" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingGrocy ? (
                <div className="text-center py-8 text-gray-500">Caricamento...</div>
              ) : grocyError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 text-sm">{grocyError}</p>
                  <Link to="/settings/grocy" className="text-primary-600 text-sm mt-2 inline-block">Configura Grocy</Link>
                </div>
              ) : grocyProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">{grocySearch ? 'Nessun prodotto trovato' : 'Nessun prodotto disponibile'}</div>
              ) : (
                <div className="space-y-2">
                  {grocyProducts.map((product) => (
                    <button key={product.id} onClick={() => selectGrocyProduct(product)} className="w-full p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                      <div className="font-medium text-sm">{product.name}</div>
                      {product.description && <div className="text-xs text-gray-500 mt-0.5">{product.description}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
