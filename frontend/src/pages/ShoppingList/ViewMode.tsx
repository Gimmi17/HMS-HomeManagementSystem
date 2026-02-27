import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import shoppingListsService from '@/services/shoppingLists'
import productsService from '@/services/products'
import type { ProductSuggestion } from '@/services/products'
import dispensaService from '@/services/dispensa'
import SwipeableRow from '@/components/SwipeableRow'
import type { ShoppingListItem, ShoppingListStatus } from '@/types'
import type { ShoppingListState } from './useShoppingListState'

interface ViewModeProps {
  state: ShoppingListState
  onEdit: () => void
  onMoveItem: (item: ShoppingListItem) => void
}

export default function ViewMode({ state, onEdit, onMoveItem }: ViewModeProps) {
  const { list, setList, categories, showToast } = state

  // Swipe-left action modal (not purchased / delete)
  const [swipeLeftItem, setSwipeLeftItem] = useState<ShoppingListItem | null>(null)

  // Actions menu
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [isSendingToDispensa, setIsSendingToDispensa] = useState(false)

  // New item form state
  const [showNewItemForm, setShowNewItemForm] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemUnit, setNewItemUnit] = useState('')
  const [newItemBarcode, setNewItemBarcode] = useState('')
  const [isSavingNewItem, setIsSavingNewItem] = useState(false)

  // Autocomplete state
  const [newItemSuggestions, setNewItemSuggestions] = useState<ProductSuggestion[]>([])
  const [newItemSuggestionIndex, setNewItemSuggestionIndex] = useState(-1)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRef = useRef<HTMLDivElement | null>(null)

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

  if (!list) return null

  const checkedCount = list.items.filter((i) => i.checked).length
  const totalCount = list.items.length

  // Toggle check (swipe right handler)
  const toggleItemCheck = async (item: ShoppingListItem) => {
    if (!list) return

    // Prevent unchecking verified items (but allow re-picking not_purchased)
    if (item.checked && item.verified_at && !item.not_purchased) {
      showToast(false, 'Non puoi togliere la spunta a un articolo già verificato')
      return
    }

    // Not purchased → re-pick: open check modal (backend clears not_purchased on check)
    if (item.not_purchased) {
      state.setEditingItem(item)
      return
    }

    // If unchecking, just toggle
    if (item.checked) {
      try {
        const updatedItem = await shoppingListsService.toggleItemCheck(list.id, item.id)
        setList((prev) =>
          prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? updatedItem : i)) } : null
        )
      } catch (error) {
        console.error('Failed to toggle item:', error)
      }
      return
    }

    // If checking, open modal to enter details
    state.setEditingItem(item)
  }

  // Handle swipe right based on item state
  const handleSwipeRight = (item: ShoppingListItem) => {
    toggleItemCheck(item)
  }

  // Mark not purchased (swipe left option)
  const handleMarkNotPurchased = async (item: ShoppingListItem) => {
    if (!list) return
    setSwipeLeftItem(null)
    try {
      await shoppingListsService.markNotPurchased(list.id, item.id)
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      showToast(true, 'Articolo segnato come non acquistato')
    } catch (error) {
      console.error('Failed to mark as not purchased:', error)
      showToast(false, 'Errore durante l\'operazione')
    }
  }

  // Undo not purchased (swipe left on not_purchased item)
  const handleUndoNotPurchased = async (item: ShoppingListItem) => {
    if (!list) return
    try {
      await shoppingListsService.undoNotPurchased(list.id, item.id)
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      showToast(true, 'Articolo ripristinato')
    } catch (error) {
      console.error('Failed to undo not purchased:', error)
      showToast(false, 'Errore durante l\'operazione')
    }
  }

  // Delete item (swipe left option)
  const handleDeleteItem = async (item: ShoppingListItem) => {
    if (!list) return
    setSwipeLeftItem(null)
    try {
      await shoppingListsService.deleteItem(list.id, item.id)
      setList(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== item.id) } : null)
    } catch (error) {
      console.error('Failed to delete item:', error)
      showToast(false, 'Errore durante l\'eliminazione')
    }
  }

  // Status change
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

  // Delete list
  const handleDeleteList = async () => {
    if (!list) return
    if (!confirm('Sei sicuro di voler eliminare questa lista?')) return
    try {
      await shoppingListsService.delete(list.id)
      window.location.href = '/shopping-lists'
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  // Dispensa
  const handleSendToDispensa = async () => {
    if (!list) return
    const houseId = localStorage.getItem('current_house_id') || ''
    if (!houseId) return
    if (!confirm('Mandare gli articoli verificati alla Dispensa?')) return

    setIsSendingToDispensa(true)
    setShowActionsMenu(false)
    try {
      const result = await dispensaService.sendFromShoppingList(houseId, list.id)
      showToast(true, `${result.count} articoli inviati alla Dispensa!`)
    } catch (error) {
      console.error('Failed to send to dispensa:', error)
      showToast(false, 'Errore nell\'invio alla Dispensa')
    } finally {
      setIsSendingToDispensa(false)
    }
  }

  // Format date
  const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  // Autocomplete search
  const searchNewItemSuggestions = useCallback((value: string) => {
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
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
    setNewItemBarcode(suggestion.barcode)
    setNewItemSuggestions([])
    setNewItemSuggestionIndex(-1)
  }

  // New item
  const openNewItemForm = () => {
    setShowNewItemForm(true)
    setNewItemName('')
    setNewItemQuantity(1)
    setNewItemUnit('')
    setNewItemBarcode('')
  }

  const cancelNewItem = () => {
    setShowNewItemForm(false)
    setNewItemName('')
    setNewItemQuantity(1)
    setNewItemUnit('')
    setNewItemBarcode('')
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
      if (newItemBarcode) {
        await shoppingListsService.updateItem(list.id, newItem.id, { scanned_barcode: newItemBarcode })
      }
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      cancelNewItem()
      showToast(true, `"${newItem.name}" aggiunto alla lista`)
    } catch (error) {
      console.error('Failed to add item:', error)
      showToast(false, 'Errore durante l\'aggiunta dell\'articolo')
    } finally {
      setIsSavingNewItem(false)
    }
  }

  return (
    <>
      {/* Progress */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Spesa</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{checkedCount}/{totalCount}</span>
            {/* Edit button */}
            <button
              onClick={onEdit}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Modifica lista"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* Actions menu */}
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {list.status === 'active' && (
                    <>
                      <button onClick={() => handleStatusChange('completed')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-green-600">
                        Completa lista
                      </button>
                      <button onClick={() => handleStatusChange('cancelled')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-600">
                        Annulla lista
                      </button>
                    </>
                  )}
                  {(list.status === 'completed' || list.status === 'cancelled') && (
                    <>
                      <button onClick={() => handleStatusChange('active')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Riapri lista
                      </button>
                      {list.status === 'completed' && list.items.some(i => i.verified_at && !i.not_purchased) && (
                        <button onClick={handleSendToDispensa} disabled={isSendingToDispensa} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-primary-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          {isSendingToDispensa ? 'Invio...' : 'Manda a Dispensa'}
                        </button>
                      )}
                    </>
                  )}
                  <Link to={`/shopping-lists/${list.id}/receipt`} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Scontrini d'acquisto
                  </Link>
                  <button onClick={handleDeleteList} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600">
                    Elimina
                  </button>
                </div>
              )}
            </div>
          </div>
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
          <SwipeableRow
            key={item.id}
            onSwipeLeft={() => item.not_purchased ? handleUndoNotPurchased(item) : setSwipeLeftItem(item)}
            onSwipeRight={() => handleSwipeRight(item)}
          >
            <div
              className={`card p-3 transition-colors ${
                item.not_purchased ? 'bg-red-100' : item.checked ? 'bg-gray-100' : ''
              }`}
            >
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => item.checked ? state.setEditingItem(item) : state.setActionMenuItem(item)}
              >
                {/* Picking sequence number */}
                {item.store_picking_position && (
                  <span className="w-6 text-xs font-medium text-gray-400 text-center flex-shrink-0">
                    {item.store_picking_position}
                  </span>
                )}

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${item.checked || item.not_purchased ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    <span>{item.quantity} {item.unit}</span>
                    {item.urgent && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white font-bold uppercase text-[10px] rounded">URGENTE</span>
                    )}
                    {item.grocy_product_name && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Grocy</span>
                    )}
                    {item.not_purchased && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Non Acquistato</span>
                    )}
                    {item.verified_at && !item.not_purchased && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Verificato</span>
                    )}
                    {item.expiry_date && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                        Scad: {formatDateForDisplay(item.expiry_date)}
                      </span>
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
                  {item.product_notes && (
                    <p className="text-xs text-blue-600 italic truncate">{item.product_notes}</p>
                  )}
                </div>

                {/* Verified icon */}
                {item.verified_at && !item.not_purchased && (
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </SwipeableRow>
        ))}

        {/* New Item Form or Add Button */}
        {showNewItemForm ? (
          <div className="card p-3 border-2 border-dashed border-green-300 bg-green-50">
            <div className="flex items-center gap-2">
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
                      if (e.key === 'ArrowDown') { e.preventDefault(); setNewItemSuggestionIndex((prev) => prev < newItemSuggestions.length - 1 ? prev + 1 : 0); return }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setNewItemSuggestionIndex((prev) => prev > 0 ? prev - 1 : newItemSuggestions.length - 1); return }
                      if (e.key === 'Enter' && newItemSuggestionIndex >= 0) { e.preventDefault(); selectNewItemSuggestion(newItemSuggestions[newItemSuggestionIndex]); return }
                      if (e.key === 'Escape') { e.preventDefault(); setNewItemSuggestions([]); setNewItemSuggestionIndex(-1); return }
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
                        onMouseDown={(e) => { e.preventDefault(); selectNewItemSuggestion(suggestion) }}
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
              <input
                type="number"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                min="1"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-base text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <input
                type="text"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                placeholder="pz"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-base text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
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
              <button onClick={cancelNewItem} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
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

      {/* Swipe-left action modal */}
      {swipeLeftItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setSwipeLeftItem(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md p-4 pb-8 space-y-3 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <p className="font-medium text-gray-900">{swipeLeftItem.name}</p>
            </div>
            <button
              onClick={() => handleMarkNotPurchased(swipeLeftItem)}
              className="w-full py-3 rounded-lg bg-yellow-50 text-yellow-800 font-medium border border-yellow-200 hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Non acquistato
            </button>
            <button
              onClick={() => {
                state.setNoteEditItem(swipeLeftItem)
                setSwipeLeftItem(null)
              }}
              className="w-full py-3 rounded-lg bg-green-50 text-green-700 font-medium border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifica nota
            </button>
            <button
              onClick={() => {
                onMoveItem(swipeLeftItem)
                setSwipeLeftItem(null)
              }}
              className="w-full py-3 rounded-lg bg-orange-50 text-orange-700 font-medium border border-orange-200 hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Invia a...
            </button>
            <button
              onClick={() => handleDeleteItem(swipeLeftItem)}
              className="w-full py-3 rounded-lg bg-red-50 text-red-700 font-medium border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Elimina dalla lista
            </button>
            <button
              onClick={() => setSwipeLeftItem(null)}
              className="w-full py-3 rounded-lg text-gray-500 font-medium hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close actions menu */}
      {showActionsMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setShowActionsMenu(false)} />
      )}
    </>
  )
}
