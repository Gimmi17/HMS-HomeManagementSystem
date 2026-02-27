import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dispensaService from '@/services/dispensa'
import grocyService from '@/services/grocy'
import { StockActionModal } from '@/components/Grocy'
import shoppingListsService from '@/services/shoppingLists'
import type {
  DispensaItem,
  DispensaStats,
  GrocyStockItem,
  GrocyStockActionType,
  GrocyLocation,
  GrocyConsumeStockParams,
  GrocyOpenProductParams,
  GrocyTransferStockParams,
  GrocyInventoryCorrectionParams,
  Category,
  ShoppingListSummary,
} from '@/types'
import categoriesService from '@/services/categories'
import SwipeableRow from '@/components/SwipeableRow'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/useToast'
import { Toast } from '@/components/Toast'
import {
  PantryItemForm,
  PantryEntryActions,
  PantryConsumeModal,
  PantryAddToListModal,
  PantryGrocySection,
  MealTypeModal,
} from '@/components/Pantry'
import mealsService from '@/services/meals'

type FilterMode = 'all' | 'expiring' | 'expired' | 'consumed'

interface AggregatedProduct {
  key: string
  name: string
  totalQuantity: number
  unit: string | null
  entries: DispensaItem[]
  hasExpired: boolean
  hasExpiring: boolean
  categoryId: string | null
}

export function Pantry() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  // Core data
  const [items, setItems] = useState<DispensaItem[]>([])
  const [stats, setStats] = useState<DispensaStats>({ total: 0, expiring_soon: 0, expired: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingItem, setEditingItem] = useState<DispensaItem | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<DispensaItem | null>(null)
  const [consumingItem, setConsumingItem] = useState<DispensaItem | null>(null)
  const [addToListEntry, setAddToListEntry] = useState<DispensaItem | null>(null)
  const [activeLists, setActiveLists] = useState<ShoppingListSummary[]>([])
  const [isAddingToList, setIsAddingToList] = useState(false)
  const [mealTypeItem, setMealTypeItem] = useState<DispensaItem | null>(null)

  // Grocy
  const [selectedItem, setSelectedItem] = useState<GrocyStockItem | null>(null)
  const [actionType, setActionType] = useState<GrocyStockActionType | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [locations, setLocations] = useState<GrocyLocation[]>([])
  const [grocyStock, setGrocyStock] = useState<GrocyStockItem[]>([])
  const [showGrocy, setShowGrocy] = useState(false)
  const [grocyError, setGrocyError] = useState(false)

  // UI collapse state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  const houseId = localStorage.getItem('current_house_id') || ''

  // --- Data fetching ---

  const fetchData = async () => {
    if (!houseId) return
    try {
      const params: Record<string, unknown> = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (filterMode === 'expiring') params.expiring = true
      if (filterMode === 'expired') params.expired = true
      if (filterMode === 'consumed') params.consumed = true
      if (filterMode === 'all') params.show_all = false

      const response = await dispensaService.getItems(houseId, params as Parameters<typeof dispensaService.getItems>[1])
      setItems(response.items)
      setStats(response.stats)
    } catch (err) {
      console.error('Failed to fetch dispensa:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [houseId, debouncedSearch, filterMode])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await categoriesService.getAll(houseId)
        setCategories(response.categories)
      } catch (err) {
        console.error('Failed to load categories:', err)
      }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    if (!showGrocy) return
    const fetchGrocy = async () => {
      try {
        const [data, locs] = await Promise.all([
          grocyService.getStock(),
          grocyService.getLocations().catch(() => []),
        ])
        setGrocyStock(data)
        setLocations(locs)
        setGrocyError(false)
      } catch {
        setGrocyError(true)
      }
    }
    fetchGrocy()
  }, [showGrocy])

  // --- Helpers ---

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false
    const expiryDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays > 0 && diffDays <= 3
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    const expiryDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return expiryDate < today
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  const parseExpiryInput = (input: string): string | undefined => {
    if (!input.trim()) return undefined
    const compactMatch = input.match(/^(\d{2})(\d{2})(\d{2,4})$/)
    if (compactMatch) {
      const day = compactMatch[1]
      const month = compactMatch[2]
      const year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3]
      return `${year}-${month}-${day}`
    }
    const sepMatch = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (sepMatch) {
      const day = sepMatch[1].padStart(2, '0')
      const month = sepMatch[2].padStart(2, '0')
      const year = sepMatch[3].length === 2 ? `20${sepMatch[3]}` : sepMatch[3]
      return `${year}-${month}-${day}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
    return undefined
  }

  // --- Aggregation (useMemo) ---

  const aggregatedProducts = useMemo((): AggregatedProduct[] => {
    const groupMap = new Map<string, AggregatedProduct>()

    for (const item of items) {
      const key = `${item.name.toLowerCase()}_${(item.unit || 'pz').toLowerCase()}`
      const existing = groupMap.get(key)

      if (existing) {
        existing.totalQuantity += item.quantity
        existing.entries.push(item)
        if (isExpired(item.expiry_date)) existing.hasExpired = true
        if (isExpiringSoon(item.expiry_date)) existing.hasExpiring = true
      } else {
        groupMap.set(key, {
          key,
          name: item.name,
          totalQuantity: item.quantity,
          unit: item.unit,
          entries: [item],
          hasExpired: isExpired(item.expiry_date),
          hasExpiring: isExpiringSoon(item.expiry_date),
          categoryId: item.category_id,
        })
      }
    }

    for (const product of groupMap.values()) {
      product.entries.sort((a, b) => {
        if (!a.expiry_date && !b.expiry_date) return 0
        if (!a.expiry_date) return 1
        if (!b.expiry_date) return -1
        return a.expiry_date.localeCompare(b.expiry_date)
      })
    }

    return Array.from(groupMap.values())
  }, [items])

  const groupedProducts = useMemo(() => {
    const groups: { key: string; label: string; icon?: string; color?: string; products: AggregatedProduct[] }[] = []
    const catMap = new Map<string, AggregatedProduct[]>()
    const uncategorized: AggregatedProduct[] = []

    for (const product of aggregatedProducts) {
      if (product.categoryId) {
        const arr = catMap.get(product.categoryId) || []
        arr.push(product)
        catMap.set(product.categoryId, arr)
      } else {
        uncategorized.push(product)
      }
    }

    for (const cat of categories) {
      const catProducts = catMap.get(cat.id)
      if (catProducts && catProducts.length > 0) {
        groups.push({
          key: cat.id,
          label: cat.name,
          icon: cat.icon || undefined,
          color: cat.color || undefined,
          products: catProducts,
        })
      }
    }

    for (const [catId, catProducts] of catMap) {
      if (!groups.find(g => g.key === catId)) {
        groups.push({ key: catId, label: 'Altro', products: catProducts })
      }
    }

    if (uncategorized.length > 0) {
      groups.push({ key: '_none', label: 'Senza categoria', products: uncategorized })
    }

    return groups
  }, [aggregatedProducts, categories])

  // --- Handlers ---

  const handleAddItem = async (data: { name: string; quantity: string; unit: string; expiry: string; categoryId: string; notes: string }) => {
    setIsSaving(true)
    try {
      await dispensaService.createItem(houseId, {
        name: data.name.trim(),
        quantity: parseFloat(data.quantity.replace(',', '.')) || 1,
        unit: data.unit.trim() || undefined,
        expiry_date: parseExpiryInput(data.expiry),
        category_id: data.categoryId || undefined,
        notes: data.notes.trim() || undefined,
      })
      setShowAddModal(false)
      showToast('Prodotto aggiunto', 'success')
      fetchData()
    } catch {
      showToast('Errore durante l\'aggiunta', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditItem = async (data: { name: string; quantity: string; unit: string; expiry: string; categoryId: string; notes: string }) => {
    if (!editingItem) return
    try {
      await dispensaService.updateItem(houseId, editingItem.id, {
        name: data.name.trim(),
        quantity: parseFloat(data.quantity.replace(',', '.')) || 1,
        unit: data.unit.trim() || undefined,
        expiry_date: parseExpiryInput(data.expiry),
        category_id: data.categoryId || undefined,
        notes: data.notes.trim() || undefined,
      })
      setEditingItem(null)
      showToast('Prodotto aggiornato', 'success')
      fetchData()
    } catch {
      showToast('Errore durante l\'aggiornamento', 'error')
    }
  }

  const handleDeleteItem = async (item: DispensaItem) => {
    if (!confirm(`Eliminare "${item.name}"?`)) return
    try {
      await dispensaService.deleteItem(houseId, item.id)
      showToast('Prodotto eliminato', 'success')
      fetchData()
    } catch {
      showToast('Errore durante l\'eliminazione', 'error')
    }
  }

  const handleConsumeEntry = (entry: DispensaItem) => {
    setSelectedEntry(null)
    setMealTypeItem(entry)
  }

  const doConsumeWithMeal = async (entry: DispensaItem, mealType?: 'colazione' | 'spuntino' | 'pranzo' | 'cena') => {
    try {
      await dispensaService.consumeItem(houseId, entry.id)
      if (mealType) {
        await mealsService.create(houseId, {
          meal_type: mealType,
          consumed_at: new Date().toISOString(),
          notes: entry.name,
        })
      }
      showToast(`"${entry.name}" consumato`, 'success')
      fetchData()
    } catch {
      showToast('Errore', 'error')
    }
  }

  const handleConsumePartial = async (qty: number) => {
    if (!consumingItem) return
    try {
      await dispensaService.consumeItem(houseId, consumingItem.id, qty)
      setConsumingItem(null)
      showToast('Quantita ridotta', 'success')
      fetchData()
    } catch {
      showToast('Errore', 'error')
    }
  }

  const handleUnconsume = async (item: DispensaItem) => {
    try {
      await dispensaService.unconsumeItem(houseId, item.id)
      showToast(`"${item.name}" ripristinato`, 'success')
      fetchData()
    } catch {
      showToast('Errore', 'error')
    }
  }

  const openAddToListModal = async (entry: DispensaItem) => {
    setSelectedEntry(null)
    try {
      const response = await shoppingListsService.getAll(houseId, { status: 'active' })
      setActiveLists(response.lists)
      setAddToListEntry(entry)
    } catch {
      showToast('Errore nel caricamento delle liste', 'error')
    }
  }

  const handleAddToList = async (listId: string, quantity: number) => {
    if (!addToListEntry) return
    setIsAddingToList(true)
    try {
      await shoppingListsService.addItem(listId, {
        name: addToListEntry.name,
        quantity,
        unit: addToListEntry.unit || undefined,
        grocy_product_id: addToListEntry.grocy_product_id || undefined,
        grocy_product_name: addToListEntry.grocy_product_name || undefined,
        category_id: addToListEntry.category_id || undefined,
      })
      showToast('Aggiunto alla lista', 'success')
      setAddToListEntry(null)
      setActiveLists([])
    } catch {
      showToast('Errore durante l\'aggiunta', 'error')
    } finally {
      setIsAddingToList(false)
    }
  }

  const handleCreateListAndAdd = async (quantity: number) => {
    if (!addToListEntry) return
    setIsAddingToList(true)
    try {
      const newList = await shoppingListsService.create({
        house_id: houseId,
        items: [{
          name: addToListEntry.name,
          quantity,
          unit: addToListEntry.unit || undefined,
          grocy_product_id: addToListEntry.grocy_product_id || undefined,
          grocy_product_name: addToListEntry.grocy_product_name || undefined,
          category_id: addToListEntry.category_id || undefined,
        }]
      })
      showToast(`Lista "${newList.name}" creata con l'articolo`, 'success')
      setAddToListEntry(null)
      setActiveLists([])
    } catch {
      showToast('Errore durante la creazione', 'error')
    } finally {
      setIsAddingToList(false)
    }
  }

  // Grocy handlers
  const handleGrocyAction = (item: GrocyStockItem, action: GrocyStockActionType) => {
    setSelectedItem(item)
    setActionType(action)
  }

  const handleActionConfirm = async (
    action: GrocyStockActionType,
    params: GrocyConsumeStockParams | GrocyOpenProductParams | GrocyTransferStockParams | GrocyInventoryCorrectionParams
  ) => {
    if (!selectedItem) return

    setIsActionLoading(true)
    try {
      const productId = Number(selectedItem.product_id)
      let result

      switch (action) {
        case 'consume':
          result = await grocyService.consumeStock(productId, params as GrocyConsumeStockParams)
          break
        case 'open':
          result = await grocyService.openProduct(productId, params as GrocyOpenProductParams)
          break
        case 'transfer':
          result = await grocyService.transferStock(productId, params as GrocyTransferStockParams)
          break
        case 'inventory':
          result = await grocyService.inventoryCorrection(productId, params as GrocyInventoryCorrectionParams)
          break
      }

      if (result?.success) {
        showToast(result.message, 'success')
        const newStock = await grocyService.getStock()
        setGrocyStock(newStock)
        setSelectedItem(null)
        setActionType(null)
      } else {
        showToast(result?.error || 'Operazione fallita', 'error')
      }
    } catch {
      showToast('Errore durante l\'operazione', 'error')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleActionClose = () => {
    setSelectedItem(null)
    setActionType(null)
  }

  // UI toggles
  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleProduct = (key: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const getExpiryBadge = (dateStr: string | null) => {
    if (!dateStr) return null
    if (isExpired(dateStr)) {
      return <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Scaduto</span>
    }
    if (isExpiringSoon(dateStr)) {
      return <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 font-medium">In scadenza</span>
    }
    return <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700">OK</span>
  }

  const filterButtons: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'expiring', label: 'In scadenza' },
    { key: 'expired', label: 'Scaduti' },
    { key: 'consumed', label: 'Consumati' },
  ]

  // --- Render ---

  return (
    <div className="space-y-4 pb-20">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dispensa</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <p className="text-xs text-gray-500">Prodotti</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">In scadenza</p>
          <p className="text-xl font-bold text-yellow-600">{stats.expiring_soon}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Scaduti</p>
          <p className="text-xl font-bold text-red-600">{stats.expired}</p>
        </div>
      </div>

      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-10 bg-gray-50 -mx-4 px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 space-y-3">
        <input
          type="text"
          placeholder="Cerca prodotti..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full"
        />

        <div className="flex gap-2 overflow-x-auto">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterMode(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterMode === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items list grouped by category, then aggregated by product */}
      {isLoading ? (
        <p className="text-gray-500 text-center py-8">Caricamento...</p>
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">
            {searchQuery || filterMode !== 'all'
              ? 'Nessun prodotto trovato'
              : 'Dispensa vuota'}
          </p>
          {!searchQuery && filterMode === 'all' && (
            <p className="text-sm text-gray-400 mt-2">
              Aggiungi prodotti manualmente o inviali dalla lista della spesa
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedProducts.map((group) => {
            const isCollapsed = collapsedSections.has(group.key)
            return (
              <div key={group.key} className="card overflow-hidden">
                {/* Category header - collapsible */}
                <button
                  onClick={() => toggleSection(group.key)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {group.color && (
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                    )}
                    <span className="font-semibold text-sm text-gray-800">
                      {group.icon ? `${group.icon} ` : ''}{group.label}
                    </span>
                    <span className="text-xs text-gray-400">({group.products.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Aggregated products */}
                {!isCollapsed && (
                  <div className="border-t divide-y">
                    {group.products.map((product) => {
                      const isExpanded = expandedProducts.has(product.key)
                      const isConsumedView = filterMode === 'consumed'

                      return (
                        <div key={product.key}>
                          {/* Aggregated product row */}
                          <div
                            className={`p-3 transition-colors ${
                              isConsumedView ? 'opacity-50 bg-gray-50' : ''
                            } ${
                              product.hasExpired && !isConsumedView ? 'bg-red-50' : ''
                            } ${
                              product.hasExpiring && !product.hasExpired && !isConsumedView ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleProduct(product.key)}
                                className="mt-0.5 p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
                              >
                                <svg
                                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>

                              <div className="flex-1 min-w-0" onClick={() => toggleProduct(product.key)}>
                                <div className={`font-medium text-sm ${isConsumedView ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {product.name}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                                  <span className="font-medium text-gray-700">
                                    {product.totalQuantity} {product.unit || 'pz'}
                                  </span>
                                  {product.entries.length > 1 && (
                                    <span className="text-gray-400">
                                      ({product.entries.length} giacenze)
                                    </span>
                                  )}
                                  {product.hasExpired && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Scaduto</span>
                                  )}
                                  {product.hasExpiring && !product.hasExpired && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 font-medium">In scadenza</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded entries list */}
                          {isExpanded && (
                            <div className="bg-gray-50 border-t">
                              {product.entries.map((entry) => (
                                <SwipeableRow
                                  key={entry.id}
                                  onSwipeLeft={() => setSelectedEntry(entry)}
                                  className=""
                                >
                                  <button
                                    onClick={() => setSelectedEntry(entry)}
                                    className={`w-full text-left px-3 py-2.5 pl-10 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 transition-colors ${
                                      isExpired(entry.expiry_date) ? 'bg-red-50/50' : ''
                                    } ${
                                      isExpiringSoon(entry.expiry_date) ? 'bg-yellow-50/50' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <span className="font-medium">
                                        {entry.quantity} {entry.unit || 'pz'}
                                      </span>
                                      <span className="text-gray-400">-</span>
                                      <span>
                                        {entry.expiry_date
                                          ? `Scad: ${formatDate(entry.expiry_date)}`
                                          : 'Senza scadenza'}
                                      </span>
                                      {getExpiryBadge(entry.expiry_date)}
                                      {entry.notes && (
                                        <span className="text-gray-400 italic ml-1 truncate max-w-[100px]">{entry.notes}</span>
                                      )}
                                    </div>
                                  </button>
                                </SwipeableRow>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Grocy Section */}
      <PantryGrocySection
        grocyStock={grocyStock}
        showGrocy={showGrocy}
        grocyError={grocyError}
        onToggle={() => setShowGrocy(!showGrocy)}
        onAction={handleGrocyAction}
      />

      {/* Add Item Modal */}
      {showAddModal && (
        <PantryItemForm
          mode="add"
          categories={categories}
          onSubmit={handleAddItem}
          onClose={() => setShowAddModal(false)}
          isSaving={isSaving}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <PantryItemForm
          mode="edit"
          initialValues={{
            name: editingItem.name,
            quantity: String(editingItem.quantity),
            unit: editingItem.unit || '',
            expiry: editingItem.expiry_date ? formatDate(editingItem.expiry_date) : '',
            categoryId: editingItem.category_id || '',
            notes: editingItem.notes || '',
          }}
          categories={categories}
          onSubmit={handleEditItem}
          onClose={() => setEditingItem(null)}
          isSaving={false}
        />
      )}

      {/* Partial Consume Modal */}
      {consumingItem && (
        <PantryConsumeModal
          item={consumingItem}
          onConfirm={handleConsumePartial}
          onClose={() => setConsumingItem(null)}
        />
      )}

      {/* Entry Actions Bottom Sheet */}
      {selectedEntry && (
        <PantryEntryActions
          entry={selectedEntry}
          onConsume={() => handleConsumeEntry(selectedEntry)}
          onPartialConsume={() => {
            setConsumingItem(selectedEntry)
            setSelectedEntry(null)
          }}
          onUnconsume={() => {
            handleUnconsume(selectedEntry)
            setSelectedEntry(null)
          }}
          onEdit={() => {
            setEditingItem(selectedEntry)
            setSelectedEntry(null)
          }}
          onDelete={() => {
            handleDeleteItem(selectedEntry)
            setSelectedEntry(null)
          }}
          onAddToList={() => openAddToListModal(selectedEntry)}
          onGoToSource={() => {
            if (selectedEntry.source_list_id) {
              navigate(`/shopping-lists/${selectedEntry.source_list_id}`)
            }
          }}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Add to Shopping List Modal */}
      {addToListEntry && (
        <PantryAddToListModal
          entry={addToListEntry}
          activeLists={activeLists}
          onAddToList={handleAddToList}
          onCreateNewList={handleCreateListAndAdd}
          onClose={() => {
            setAddToListEntry(null)
            setActiveLists([])
          }}
          isLoading={isAddingToList}
        />
      )}

      {/* Grocy Stock Action Modal */}
      {selectedItem && actionType && (
        <StockActionModal
          item={selectedItem}
          action={actionType}
          locations={locations}
          onConfirm={handleActionConfirm}
          onClose={handleActionClose}
          isLoading={isActionLoading}
        />
      )}

      {/* Meal Type Selection Modal */}
      {mealTypeItem && (
        <MealTypeModal
          item={mealTypeItem}
          onSelect={(mealType) => {
            const item = mealTypeItem
            setMealTypeItem(null)
            doConsumeWithMeal(item, mealType)
          }}
          onSkip={() => {
            const item = mealTypeItem
            setMealTypeItem(null)
            doConsumeWithMeal(item)
          }}
          onClose={() => setMealTypeItem(null)}
        />
      )}
    </div>
  )
}

export default Pantry
