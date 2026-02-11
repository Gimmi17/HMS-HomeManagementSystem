import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import shoppingListsService from '@/services/shoppingLists'
import productsService from '@/services/products'
import type { ProductSuggestion } from '@/services/products'
import categoriesService from '@/services/categories'
import dispensaService from '@/services/dispensa'
import ItemDetailModal, { type ItemDetailModalData } from '@/components/ItemDetailModal'
import type { ShoppingList, ShoppingListItem, ShoppingListStatus, Category } from '@/types'

const STATUS_LABELS: Record<ShoppingListStatus, string> = {
  active: 'Attiva',
  completed: 'Conclusa',
  cancelled: 'Annullata',
}

export function ShoppingListDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') // 'view', 'edit', or 'verify'

  const [list, setList] = useState<ShoppingList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [categories, setCategories] = useState<Category[]>([])


  // Dispensa
  const [isSendingToDispensa, setIsSendingToDispensa] = useState(false)

  // New item form state
  const [showNewItemForm, setShowNewItemForm] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemUnit, setNewItemUnit] = useState('')
  const [isSavingNewItem, setIsSavingNewItem] = useState(false)

  // Autocomplete state
  const [newItemSuggestions, setNewItemSuggestions] = useState<ProductSuggestion[]>([])
  const [newItemSuggestionIndex, setNewItemSuggestionIndex] = useState(-1)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRef = useRef<HTMLDivElement | null>(null)

  // Initial load
  useEffect(() => {
    const fetchList = async () => {
      if (!id) return

      setIsLoading(true)
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
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
      const houseId = localStorage.getItem('current_house_id') || ''
      if (!houseId) return
      try {
        const response = await categoriesService.getAll(houseId)
        setCategories(response.categories)
      } catch (error) {
        console.error('Failed to load categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Handle mode parameter from URL
  useEffect(() => {
    if (!list || isLoading) return

    if (mode === 'edit') {
      navigate(`/shopping-lists/${list.id}/edit`, { replace: true })
    }
  }, [list, mode, isLoading, navigate])

  // Live polling - refresh every 3 seconds to sync across devices
  useEffect(() => {
    if (!id || isLoading) return

    const pollInterval = setInterval(async () => {
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [id, isLoading])

  // Toggle check only (called from checkbox click)
  const toggleItemCheck = async (item: ShoppingListItem) => {
    if (!list) return

    // Prevent unchecking verified items
    if (item.checked && item.verified_at) {
      setScanResult({
        success: false,
        message: 'Non puoi togliere la spunta a un articolo già verificato',
      })
      setTimeout(() => setScanResult(null), 3000)
      return
    }

    // If unchecking, just toggle
    if (item.checked) {
      try {
        const updatedItem = await shoppingListsService.toggleItemCheck(list.id, item.id)
        setList((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) => (i.id === item.id ? updatedItem : i)),
              }
            : null
        )
      } catch (error) {
        console.error('Failed to toggle item:', error)
      }
      return
    }

    // If checking, open modal to enter details
    setEditingItem(item)
  }

  // Open modal to view/edit item data (called from row click)
  const openItemModal = (item: ShoppingListItem) => {
    setEditingItem(item)
  }

  // Handle save from modal - saves data and checks the item
  const handleModalSave = async (data: ItemDetailModalData) => {
    if (!list || !editingItem) return

    try {
      // Update item data
      const updateData: Partial<ShoppingListItem> = {
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
      }

      if (data.expiryDate) {
        updateData.expiry_date = data.expiryDate
      }
      if (data.categoryId) {
        updateData.category_id = data.categoryId
      }
      if (data.barcode) {
        updateData.scanned_barcode = data.barcode
      }

      // Save the data
      await shoppingListsService.updateItem(list.id, editingItem.id, updateData)

      // If item is not checked, also check it
      if (!editingItem.checked) {
        await shoppingListsService.toggleItemCheck(list.id, editingItem.id)
      }

      // Refresh list
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      setEditingItem(null)

      setScanResult({
        success: true,
        message: 'Articolo salvato e spuntato',
      })
      setTimeout(() => setScanResult(null), 3000)
    } catch (error) {
      console.error('Failed to save item:', error)
      setScanResult({
        success: false,
        message: 'Errore nel salvataggio',
      })
      setTimeout(() => setScanResult(null), 3000)
    }
  }

  const handleStatusChange = async (newStatus: ShoppingListStatus) => {
    if (!list) return

    try {
      const updated = await shoppingListsService.update(list.id, { status: newStatus })
      setList(updated)
      setShowActionsMenu(false)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleDelete = async () => {
    if (!list) return

    if (!confirm('Sei sicuro di voler eliminare questa lista?')) return

    try {
      await shoppingListsService.delete(list.id)
      navigate('/shopping-lists')
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  const handleSendToDispensa = async () => {
    if (!list) return
    const houseId = localStorage.getItem('current_house_id') || ''
    if (!houseId) return

    if (!confirm('Mandare gli articoli verificati alla Dispensa?')) return

    setIsSendingToDispensa(true)
    setShowActionsMenu(false)
    try {
      const result = await dispensaService.sendFromShoppingList(houseId, list.id)
      setScanResult({
        success: true,
        message: `${result.count} articoli inviati alla Dispensa!`,
      })
    } catch (error) {
      console.error('Failed to send to dispensa:', error)
      setScanResult({
        success: false,
        message: 'Errore nell\'invio alla Dispensa',
      })
    } finally {
      setIsSendingToDispensa(false)
      setTimeout(() => setScanResult(null), 3000)
    }
  }

  // Format date from YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }


  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setNewItemSuggestions([])
        setNewItemSuggestionIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced autocomplete search for new item
  const searchNewItemSuggestions = useCallback((value: string) => {
    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current)
    }

    const houseId = localStorage.getItem('current_house_id') || ''
    if (value.length < 3 || !houseId) {
      setNewItemSuggestions([])
      setNewItemSuggestionIndex(-1)
      return
    }

    suggestTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await productsService.suggestProducts(houseId, value)
        setNewItemSuggestions(result.suggestions)
        setNewItemSuggestionIndex(-1)
      } catch (error) {
        console.error('Autocomplete suggest failed:', error)
        setNewItemSuggestions([])
      }
    }, 300)
  }, [])

  const selectNewItemSuggestion = (suggestion: ProductSuggestion) => {
    const displayName = suggestion.brand
      ? `${suggestion.name} (${suggestion.brand})`
      : suggestion.name
    setNewItemName(displayName)
    setNewItemSuggestions([])
    setNewItemSuggestionIndex(-1)
  }

  // New item functions
  const openNewItemForm = () => {
    setShowNewItemForm(true)
    setNewItemName('')
    setNewItemQuantity(1)
    setNewItemUnit('')
  }

  const cancelNewItem = () => {
    setShowNewItemForm(false)
    setNewItemName('')
    setNewItemQuantity(1)
    setNewItemUnit('')
    setNewItemSuggestions([])
    setNewItemSuggestionIndex(-1)
  }

  const saveNewItem = async () => {
    if (!list || !newItemName.trim()) return

    setIsSavingNewItem(true)
    try {
      const newItem = await shoppingListsService.addItem(list.id, {
        name: newItemName.trim(),
        quantity: newItemQuantity,
        unit: newItemUnit.trim() || undefined,
      })

      setList((prev) =>
        prev
          ? {
              ...prev,
              items: [...prev.items, newItem],
            }
          : null
      )

      cancelNewItem()
      setScanResult({
        success: true,
        message: `"${newItem.name}" aggiunto alla lista`,
      })
      setTimeout(() => setScanResult(null), 3000)
    } catch (error) {
      console.error('Failed to add item:', error)
      setScanResult({
        success: false,
        message: 'Errore durante l\'aggiunta dell\'articolo',
      })
      setTimeout(() => setScanResult(null), 3000)
    } finally {
      setIsSavingNewItem(false)
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

  const checkedCount = list.items.filter((i) => i.checked).length
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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{list.name}</h1>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{STATUS_LABELS[list.status]}</span>
              {list.store_name && (
                <>
                  <span>-</span>
                  <span className="text-primary-600">{list.store_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showActionsMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {list.status === 'active' && (
                <>
                  <button
                    onClick={() => handleStatusChange('completed')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-green-600"
                  >
                    Completa lista
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-600"
                  >
                    Annulla lista
                  </button>
                </>
              )}
              {(list.status === 'completed' || list.status === 'cancelled') && (
                <>
                  <button
                    onClick={() => handleStatusChange('active')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Riapri lista
                  </button>
                  {list.status === 'completed' && list.items.some(i => i.verified_at && !i.not_purchased) && (
                    <button
                      onClick={handleSendToDispensa}
                      disabled={isSendingToDispensa}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-primary-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      {isSendingToDispensa ? 'Invio...' : 'Manda a Dispensa'}
                    </button>
                  )}
                </>
              )}
              <Link
                to={`/shopping-lists/${list.id}/receipt`}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scontrini d'acquisto
              </Link>
              <Link
                to={`/shopping-lists/${list.id}/edit`}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 block"
              >
                Modifica
              </Link>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600"
              >
                Elimina
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scan Result Toast */}
      {scanResult && (
        <div
          className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-40 ${
            scanResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {scanResult.message}
        </div>
      )}

      {/* Progress */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Spesa</span>
          <span className="text-sm font-medium">{checkedCount}/{totalCount}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {list.items.map((item) => (
          <div
            key={item.id}
            className={`card p-3 transition-colors ${
              item.checked ? 'bg-gray-50' : ''
            } ${item.not_purchased ? 'bg-red-50' : ''}`}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => openItemModal(item)}
            >
              {/* Picking sequence number */}
              {item.store_picking_position && (
                <span className="w-6 text-xs font-medium text-gray-400 text-center flex-shrink-0">
                  {item.store_picking_position}
                </span>
              )}

              {/* Checkbox - separate click handler for toggle */}
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  toggleItemCheck(item)
                }}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer hover:scale-110 ${
                  item.not_purchased
                    ? 'bg-red-500 border-red-500'
                    : item.checked
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {item.not_purchased ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : item.checked ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </div>

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${item.checked || item.not_purchased ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span>{item.quantity} {item.unit}</span>
                  {item.urgent && (
                    <span className="px-1.5 py-0.5 bg-red-600 text-white font-bold uppercase text-[10px] rounded">
                      URGENTE
                    </span>
                  )}
                  {item.grocy_product_name && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                      Grocy
                    </span>
                  )}
                  {item.not_purchased && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                      Non Acquistato
                    </span>
                  )}
                  {item.verified_at && !item.not_purchased && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Verificato
                    </span>
                  )}
                  {item.expiry_date && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openItemModal(item)
                      }}
                      className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    >
                      Scad: {formatDateForDisplay(item.expiry_date)}
                    </button>
                  )}
                  {item.category_id && (() => {
                    const cat = categories.find(c => c.id === item.category_id)
                    return cat ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-xs"
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
              </div>

              {/* Verified icon */}
              {item.verified_at && !item.not_purchased && (
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

          </div>
        ))}

        {/* New Item Form or Add Button */}
        {showNewItemForm ? (
          <div className="card p-3 border-2 border-dashed border-green-300 bg-green-50">
            <div className="flex items-center gap-2">
              {/* Name input with autocomplete */}
              <div className="flex-1 min-w-0 relative" ref={autocompleteRef}>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => {
                    setNewItemName(e.target.value)
                    searchNewItemSuggestions(e.target.value)
                  }}
                  placeholder="Nome articolo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (newItemSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setNewItemSuggestionIndex((prev) =>
                          prev < newItemSuggestions.length - 1 ? prev + 1 : 0
                        )
                        return
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setNewItemSuggestionIndex((prev) =>
                          prev > 0 ? prev - 1 : newItemSuggestions.length - 1
                        )
                        return
                      }
                      if (e.key === 'Enter' && newItemSuggestionIndex >= 0) {
                        e.preventDefault()
                        selectNewItemSuggestion(newItemSuggestions[newItemSuggestionIndex])
                        return
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setNewItemSuggestions([])
                        setNewItemSuggestionIndex(-1)
                        return
                      }
                    }
                    if (e.key === 'Enter' && newItemName.trim()) saveNewItem()
                    if (e.key === 'Escape') cancelNewItem()
                  }}
                />
                {newItemSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {newItemSuggestions.map((suggestion, sIdx) => (
                      <button
                        key={suggestion.barcode}
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-green-50 ${
                          sIdx === newItemSuggestionIndex ? 'bg-green-100 text-green-800' : 'text-gray-700'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectNewItemSuggestion(suggestion)
                        }}
                      >
                        <span className="font-medium">{suggestion.name}</span>
                        {suggestion.brand && (
                          <span className="text-gray-400 ml-1">({suggestion.brand})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity input */}
              <input
                type="number"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                min="1"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-base text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />

              {/* Unit input */}
              <input
                type="text"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                placeholder="pz"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-base text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />

              {/* Save button */}
              <button
                onClick={saveNewItem}
                disabled={!newItemName.trim() || isSavingNewItem}
                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingNewItem ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Cancel button */}
              <button
                onClick={cancelNewItem}
                className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openNewItemForm}
            className="w-full card p-3 border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Aggiungi articolo
          </button>
        )}
      </div>

      {/* Item Details Modal */}
      {editingItem && (
        <ItemDetailModal
          item={editingItem}
          categories={categories}
          mode="view"
          onSave={handleModalSave}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {/* Click outside to close menu */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActionsMenu(false)}
        />
      )}
    </div>
  )
}

export default ShoppingListDetail
