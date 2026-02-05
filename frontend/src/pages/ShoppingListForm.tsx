import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import shoppingListsService from '@/services/shoppingLists'
import storesService from '@/services/stores'
import categoriesService from '@/services/categories'
import { grocyHouseService } from '@/services/grocy'
import type { ShoppingListItemCreate, GrocyProductSimple, Store, Category } from '@/types'

interface ItemRow {
  id: string
  name: string
  grocyProductId?: number
  grocyProductName?: string
  quantity: number
  unit: string
  categoryId?: string
  urgent?: boolean
  isNew?: boolean  // Track if item needs to be saved to backend
}

const generateId = () => Math.random().toString(36).substring(2, 9)

const getPlaceholderName = () => {
  const now = new Date()
  return `Lista del ${now.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`
}

export function ShoppingListForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentHouse } = useHouse()
  const isEditing = Boolean(id)

  const [listName, setListName] = useState('')
  const [storeId, setStoreId] = useState<string | undefined>()
  const [stores, setStores] = useState<Store[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [newStoreName, setNewStoreName] = useState('')
  const [showNewStoreInput, setShowNewStoreInput] = useState(false)
  const [items, setItems] = useState<ItemRow[]>([
    { id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true },
  ])
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showGrocyModal, setShowGrocyModal] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [grocyProducts, setGrocyProducts] = useState<GrocyProductSimple[]>([])
  const [grocySearch, setGrocySearch] = useState('')
  const [isLoadingGrocy, setIsLoadingGrocy] = useState(false)
  const [grocyError, setGrocyError] = useState<string | null>(null)
  const [focusItemId, setFocusItemId] = useState<string | null>(null)
  const [lockError, setLockError] = useState<string | null>(null)
  const [hasLock, setHasLock] = useState(false)
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set())
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [recoveryItems, setRecoveryItems] = useState<{
    items: Array<{
      id: string
      name: string
      grocy_product_id?: number
      grocy_product_name?: string
      quantity: number
      unit?: string
    }>
    source_list_name?: string
    source_list_id?: string
  } | null>(null)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Load stores and categories
  useEffect(() => {
    const loadStores = async () => {
      try {
        const response = await storesService.getAll()
        setStores(response.stores)
      } catch (error) {
        console.error('Failed to load stores:', error)
      }
    }
    const loadCategories = async () => {
      try {
        const response = await categoriesService.getAll()
        setCategories(response.categories)
      } catch (error) {
        console.error('Failed to load categories:', error)
      }
    }
    loadStores()
    loadCategories()
  }, [])

  // Check for recoverable not-purchased items when creating new list
  useEffect(() => {
    const checkRecoveryItems = async () => {
      if (isEditing || !currentHouse) return

      try {
        const recovery = await shoppingListsService.getNotPurchasedItems(currentHouse.id)
        if (recovery.items.length > 0) {
          setRecoveryItems(recovery)
          setShowRecoveryModal(true)
        }
      } catch (error) {
        console.error('Failed to check for recovery items:', error)
      }
    }
    checkRecoveryItems()
  }, [isEditing, currentHouse])

  // Acquire lock and load list when editing
  useEffect(() => {
    if (isEditing && id) {
      const acquireLockAndLoad = async () => {
        // First try to acquire lock
        try {
          await shoppingListsService.acquireLock(id)
          setHasLock(true)
          setLockError(null)
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number; data?: { detail?: string } } }
          if (axiosError?.response?.status === 423) {
            setLockError(axiosError.response.data?.detail || 'Lista in modifica da un altro utente')
            return // Don't load the list if we can't get the lock
          }
          console.error('Failed to acquire lock:', error)
        }

        // Load the list
        try {
          const list = await shoppingListsService.getById(id)
          setListName(list.name)
          setStoreId(list.store_id)
          if (list.items.length > 0) {
            // Track original item IDs to detect deletions later
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
                isNew: false,  // Items from backend are already saved
              }))
            )
          }
        } catch (error) {
          console.error('Failed to load list:', error)
        }
      }
      acquireLockAndLoad()
    }
  }, [id, isEditing])

  // Release lock when leaving the page
  useEffect(() => {
    return () => {
      if (isEditing && id && hasLock) {
        shoppingListsService.releaseLock(id).catch(() => {
          // Ignore errors on cleanup
        })
      }
    }
  }, [id, isEditing, hasLock])

  // Search Grocy products
  useEffect(() => {
    if (!showGrocyModal || !currentHouse) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    setIsLoadingGrocy(true)
    setGrocyError(null)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const products = await grocyHouseService.getProducts(
          currentHouse.id,
          grocySearch || undefined
        )
        setGrocyProducts(products)
        setGrocyError(null)
      } catch (error: unknown) {
        // Don't log 400 errors (Grocy not configured) - expected behavior
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

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [showGrocyModal, grocySearch, currentHouse])

  // Focus new item input when focusItemId changes
  useEffect(() => {
    if (focusItemId && inputRefs.current[focusItemId]) {
      inputRefs.current[focusItemId]?.focus()
      setFocusItemId(null)
    }
  }, [focusItemId, items])

  const handleItemChange = (itemId: string, field: keyof ItemRow, value: string | number | boolean | undefined) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    )
  }

  const addItem = (afterId?: string, shouldFocus = false) => {
    const newItem: ItemRow = {
      id: generateId(),
      name: '',
      quantity: 1,
      unit: 'pz',
      isNew: true,
    }

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

    if (shouldFocus) {
      setFocusItemId(newItem.id)
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      // Find current index before any async operations
      const currentIndex = items.findIndex((item) => item.id === itemId)

      // In edit mode, save the current item to backend if it's new and has a name
      if (isEditing && id) {
        const currentItem = items[currentIndex]
        if (currentItem && currentItem.name.trim() && currentItem.isNew) {
          try {
            const savedItem = await shoppingListsService.addItem(id, {
              name: currentItem.name.trim(),
              grocy_product_id: currentItem.grocyProductId,
              grocy_product_name: currentItem.grocyProductName,
              quantity: currentItem.quantity || 1,
              unit: currentItem.unit,
              category_id: currentItem.categoryId,
              urgent: currentItem.urgent,
            })

            // Create new item and update state in one operation
            const newItem: ItemRow = {
              id: generateId(),
              name: '',
              quantity: 1,
              unit: 'pz',
              isNew: true,
            }

            setItems((prev) => {
              const newItems = prev.map((item) =>
                item.id === itemId
                  ? { ...item, id: savedItem.id, isNew: false }
                  : item
              )
              // Insert new item after the current position
              newItems.splice(currentIndex + 1, 0, newItem)
              return newItems
            })

            setFocusItemId(newItem.id)
            return // Exit early, we've handled everything
          } catch (error) {
            console.error('Failed to save item:', error)
          }
        }
      }

      // For new lists or items that don't need saving, just add new row
      addItem(itemId, true)
    }
  }

  const removeItem = (itemId: string) => {
    setItems((prev) => {
      if (prev.length === 1) {
        return [{ id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true }]
      }
      return prev.filter((item) => item.id !== itemId)
    })
  }

  const handleRecoveryAccept = () => {
    if (!recoveryItems) return

    // Convert recovery items to ItemRow format
    const recoveredItems: ItemRow[] = recoveryItems.items.map((item) => ({
      id: generateId(),
      name: item.name,
      grocyProductId: item.grocy_product_id,
      grocyProductName: item.grocy_product_name,
      quantity: item.quantity,
      unit: item.unit || 'pz',
      isNew: true,
    }))

    // Replace the initial empty item with recovered items + one empty item
    setItems([...recoveredItems, { id: generateId(), name: '', quantity: 1, unit: 'pz', isNew: true }])
    setShowRecoveryModal(false)
  }

  const handleRecoveryDecline = () => {
    setShowRecoveryModal(false)
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
            ? {
                ...item,
                name: product.name,
                grocyProductId: product.id,
                grocyProductName: product.name,
              }
            : item
        )
      )
    }
    setShowGrocyModal(false)
    setSelectedItemId(null)
  }

  const handleSave = async () => {
    if (!currentHouse) return

    // Filter out empty items
    const validItems = items.filter((item) => item.name.trim())
    if (validItems.length === 0) {
      alert('Aggiungi almeno un articolo alla lista')
      return
    }

    setIsSaving(true)

    try {
      const itemsData: ShoppingListItemCreate[] = validItems.map((item, index) => ({
        name: item.name.trim(),
        grocy_product_id: item.grocyProductId,
        grocy_product_name: item.grocyProductName,
        quantity: item.quantity || 1,
        unit: item.unit,
        position: index,
        category_id: item.categoryId,
        urgent: item.urgent,
      }))

      if (isEditing && id) {
        // Update list name and store
        const updateData: { name?: string; store_id?: string } = {}
        if (listName.trim()) {
          updateData.name = listName.trim()
        }
        if (storeId) {
          updateData.store_id = storeId
        }
        if (Object.keys(updateData).length > 0) {
          await shoppingListsService.update(id, updateData)
        }

        // Find items to delete (were in original but not in current)
        const currentItemIds = new Set(validItems.filter(i => !i.isNew).map(i => i.id))
        const itemsToDelete = [...originalItemIds].filter(origId => !currentItemIds.has(origId))

        // Delete removed items
        for (const itemId of itemsToDelete) {
          await shoppingListsService.deleteItem(id, itemId)
        }

        // Update existing items and add new ones
        for (const item of validItems) {
          if (item.isNew) {
            // Add new item
            await shoppingListsService.addItem(id, {
              name: item.name.trim(),
              grocy_product_id: item.grocyProductId,
              grocy_product_name: item.grocyProductName,
              quantity: item.quantity || 1,
              unit: item.unit,
              category_id: item.categoryId,
              urgent: item.urgent,
            })
          } else {
            // Update existing item (preserves checked status from backend)
            await shoppingListsService.updateItem(id, item.id, {
              name: item.name.trim(),
              grocy_product_id: item.grocyProductId,
              grocy_product_name: item.grocyProductName,
              quantity: item.quantity || 1,
              unit: item.unit,
              category_id: item.categoryId,
              urgent: item.urgent,
            })
          }
        }
      } else {
        await shoppingListsService.create({
          house_id: currentHouse.id,
          store_id: storeId,
          name: listName.trim() || undefined,  // Let backend generate if empty
          items: itemsData,
        })
      }

      navigate('/shopping-lists')
    } catch (error) {
      console.error('Failed to save list:', error)
      alert('Errore nel salvataggio')
    } finally {
      setIsSaving(false)
      setShowSaveModal(false)
    }
  }

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Seleziona una casa per creare una lista</p>
      </div>
    )
  }

  // Show lock error if someone else is editing
  if (lockError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            to="/shopping-lists"
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Lista non disponibile</h1>
        </div>
        <div className="card p-6 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-red-600 font-medium mb-2">{lockError}</p>
          <p className="text-gray-500 text-sm mb-4">
            Attendi che l'altro utente finisca di modificare la lista.
          </p>
          <Link to="/shopping-lists" className="btn btn-primary">
            Torna alle liste
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/shopping-lists"
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {isEditing ? 'Modifica Lista' : 'Nuova Lista'}
        </h1>
      </div>

      {/* Store selector (visible in edit mode) */}
      {isEditing && (
        <div className="card p-3">
          <label className="label text-xs mb-1">Negozio</label>
          {showNewStoreInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="Nome negozio..."
                className="input flex-1 text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={async () => {
                  if (newStoreName.trim()) {
                    try {
                      const newStore = await storesService.create({ name: newStoreName.trim() })
                      setStores((prev) => [...prev, newStore])
                      setStoreId(newStore.id)
                      setNewStoreName('')
                      setShowNewStoreInput(false)
                    } catch (error) {
                      console.error('Failed to create store:', error)
                    }
                  }
                }}
                className="btn btn-primary text-sm px-3"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewStoreInput(false)
                  setNewStoreName('')
                }}
                className="btn btn-secondary text-sm px-3"
              >
                x
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={storeId || ''}
                onChange={(e) => setStoreId(e.target.value || undefined)}
                className="input flex-1 text-sm"
              >
                <option value="">Nessun negozio</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.display_name || store.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewStoreInput(true)}
                className="btn btn-secondary text-sm px-3"
                title="Aggiungi negozio"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="card p-3">
            <div className="flex flex-col gap-2">
              {/* Row number and name input */}
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <input
                  ref={(el) => { inputRefs.current[item.id] = el }}
                  type="text"
                  value={item.name}
                  onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                  placeholder="Nome articolo..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Quantity, Grocy button, actions */}
              <div className="flex items-center gap-2 ml-8">
                <input
                  type="number"
                  value={item.quantity || ''}
                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value === '' ? 0 : parseInt(e.target.value))}
                  min={1}
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center"
                />
                <select
                  value={item.unit}
                  onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                >
                  <option value="pz">pz</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                </select>

                {/* Category selector */}
                <select
                  value={item.categoryId || ''}
                  onChange={(e) => handleItemChange(item.id, 'categoryId', e.target.value || undefined)}
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white truncate"
                  title="Categoria"
                >
                  <option value="">Cat.</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>

                {/* Grocy selector button */}
                <button
                  type="button"
                  onClick={() => openGrocySelector(item.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    item.grocyProductId
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Seleziona da Grocy"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </button>

                {/* Urgent toggle */}
                <button
                  type="button"
                  onClick={() => handleItemChange(item.id, 'urgent', !item.urgent)}
                  className={`p-1.5 rounded-md transition-colors ${
                    item.urgent
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  title={item.urgent ? 'Rimuovi urgente' : 'Segna come urgente'}
                >
                  <svg className="w-5 h-5" fill={item.urgent ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>

                {/* Add button */}
                <button
                  type="button"
                  onClick={() => addItem(item.id)}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-md"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Badges (Grocy + Category) */}
              {(item.grocyProductId || item.categoryId) && (
                <div className="ml-8 flex flex-wrap gap-1">
                  {item.grocyProductId && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                      Grocy: {item.grocyProductName}
                    </span>
                  )}
                  {item.categoryId && (() => {
                    const cat = categories.find(c => c.id === item.categoryId)
                    return cat ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}20` : '#E5E7EB',
                          color: cat.color || '#374151'
                        }}
                      >
                        {cat.icon} {cat.name}
                      </span>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add row button */}
        <button
          type="button"
          onClick={() => addItem()}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi articolo
        </button>
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-20 sm:bottom-4 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          className="btn btn-primary w-full text-sm"
        >
          Salva Lista
        </button>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 space-y-4">
            <h3 className="text-lg font-semibold">Salva Lista</h3>

            <div>
              <label className="label text-xs">Nome lista (opzionale)</label>
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder={getPlaceholderName()}
                className="input w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lascia vuoto per generare automaticamente
              </p>
            </div>

            <div>
              <label className="label text-xs">Negozio</label>
              {showNewStoreInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="Nome negozio..."
                    className="input flex-1 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (newStoreName.trim()) {
                        try {
                          const newStore = await storesService.create({ name: newStoreName.trim() })
                          setStores((prev) => [...prev, newStore])
                          setStoreId(newStore.id)
                          setNewStoreName('')
                          setShowNewStoreInput(false)
                        } catch (error) {
                          console.error('Failed to create store:', error)
                        }
                      }
                    }}
                    className="btn btn-primary text-sm px-3"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewStoreInput(false)
                      setNewStoreName('')
                    }}
                    className="btn btn-secondary text-sm px-3"
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={storeId || ''}
                    onChange={(e) => setStoreId(e.target.value || undefined)}
                    className="input flex-1 text-sm"
                  >
                    <option value="">Nessun negozio</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.display_name || store.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewStoreInput(true)}
                    className="btn btn-secondary text-sm px-3"
                    title="Aggiungi negozio"
                  >
                    +
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Seleziona un negozio per ordinare gli articoli automaticamente
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="btn btn-secondary flex-1 text-sm"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary flex-1 text-sm"
              >
                {isSaving ? 'Salvataggio...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Modal */}
      {showRecoveryModal && recoveryItems && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Articoli non acquistati</h3>
                <p className="text-sm text-gray-500">
                  dalla "{recoveryItems.source_list_name}"
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Hai {recoveryItems.items.length} articol{recoveryItems.items.length === 1 ? 'o' : 'i'} non
              acquistat{recoveryItems.items.length === 1 ? 'o' : 'i'} nell'ultima spesa.
              Vuoi aggiungerl{recoveryItems.items.length === 1 ? 'o' : 'i'} a questa lista?
            </p>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-2">
              {recoveryItems.items.map((item) => (
                <div key={item.id} className="text-sm flex items-center gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-gray-500 text-xs">
                    {item.quantity} {item.unit || 'pz'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRecoveryDecline}
                className="btn btn-secondary flex-1 text-sm"
              >
                No, grazie
              </button>
              <button
                type="button"
                onClick={handleRecoveryAccept}
                className="btn btn-primary flex-1 text-sm"
              >
                Sì, aggiungi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grocy Product Modal */}
      {showGrocyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Seleziona Prodotto</h3>
                <button
                  onClick={() => setShowGrocyModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                value={grocySearch}
                onChange={(e) => setGrocySearch(e.target.value)}
                placeholder="Cerca prodotto..."
                className="input w-full text-sm"
                autoFocus
              />
            </div>

            {/* Products list */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingGrocy ? (
                <div className="text-center py-8 text-gray-500">Caricamento...</div>
              ) : grocyError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 text-sm">{grocyError}</p>
                  <Link to="/settings/grocy" className="text-primary-600 text-sm mt-2 inline-block">
                    Configura Grocy
                  </Link>
                </div>
              ) : grocyProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {grocySearch ? 'Nessun prodotto trovato' : 'Nessun prodotto disponibile'}
                </div>
              ) : (
                <div className="space-y-2">
                  {grocyProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => selectGrocyProduct(product)}
                      className="w-full p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-sm">{product.name}</div>
                      {product.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{product.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShoppingListForm
