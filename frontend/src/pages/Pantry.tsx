import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dispensaService from '@/services/dispensa'
import grocyService from '@/services/grocy'
import shoppingListsService from '@/services/shoppingLists'
import type { DispensaItem, DispensaStats, GrocyStockItem, Category, ShoppingListSummary } from '@/types'
import categoriesService from '@/services/categories'

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
  const [items, setItems] = useState<DispensaItem[]>([])
  const [stats, setStats] = useState<DispensaStats>({ total: 0, expiring_soon: 0, expired: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [categories, setCategories] = useState<Category[]>([])

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQuantity, setNewQuantity] = useState('1')
  const [newUnit, setNewUnit] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Edit item modal
  const [editingItem, setEditingItem] = useState<DispensaItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editExpiry, setEditExpiry] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Consume partial modal
  const [consumingItem, setConsumingItem] = useState<DispensaItem | null>(null)
  const [consumeQuantity, setConsumeQuantity] = useState('')

  // Entry actions modal (for individual stock entry)
  const [selectedEntry, setSelectedEntry] = useState<DispensaItem | null>(null)

  // Add to shopping list modal
  const [addToListEntry, setAddToListEntry] = useState<DispensaItem | null>(null)
  const [activeLists, setActiveLists] = useState<ShoppingListSummary[]>([])
  const [selectedListId, setSelectedListId] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [isAddingToList, setIsAddingToList] = useState(false)

  // Collapsed category sections (by category id, '_none' for uncategorized)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Expanded aggregated products (by aggregation key)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // Grocy section
  const [grocyStock, setGrocyStock] = useState<GrocyStockItem[]>([])
  const [showGrocy, setShowGrocy] = useState(false)
  const [grocyError, setGrocyError] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const houseId = localStorage.getItem('current_house_id') || ''

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = async () => {
    if (!houseId) return
    try {
      const params: Record<string, unknown> = {}
      if (searchQuery) params.search = searchQuery
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
  }, [houseId, searchQuery, filterMode])

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

  // Load Grocy stock on demand
  useEffect(() => {
    if (!showGrocy) return
    const fetchGrocy = async () => {
      try {
        const data = await grocyService.getStock()
        setGrocyStock(data)
        setGrocyError(false)
      } catch {
        setGrocyError(true)
      }
    }
    fetchGrocy()
  }, [showGrocy])

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
    // Try DDMMYY or DDMMYYYY
    const compactMatch = input.match(/^(\d{2})(\d{2})(\d{2,4})$/)
    if (compactMatch) {
      const day = compactMatch[1]
      const month = compactMatch[2]
      const year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3]
      return `${year}-${month}-${day}`
    }
    // Try DD/MM/YY or DD/MM/YYYY
    const sepMatch = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (sepMatch) {
      const day = sepMatch[1].padStart(2, '0')
      const month = sepMatch[2].padStart(2, '0')
      const year = sepMatch[3].length === 2 ? `20${sepMatch[3]}` : sepMatch[3]
      return `${year}-${month}-${day}`
    }
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
    return undefined
  }

  // Aggregate items by name+unit for display
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

    // Sort entries within each group by expiry_date ASC (nulls last)
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

  // Group aggregated products by category
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

    // Build ordered groups from categories that have products
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

    // Add any categories not in the categories list
    for (const [catId, catProducts] of catMap) {
      if (!groups.find(g => g.key === catId)) {
        groups.push({ key: catId, label: 'Altro', products: catProducts })
      }
    }

    // Uncategorized last
    if (uncategorized.length > 0) {
      groups.push({ key: '_none', label: 'Senza categoria', products: uncategorized })
    }

    return groups
  }, [aggregatedProducts, categories])

  // Add item
  const handleAddItem = async () => {
    if (!newName.trim()) return
    setIsSaving(true)
    try {
      await dispensaService.createItem(houseId, {
        name: newName.trim(),
        quantity: parseFloat(newQuantity.replace(',', '.')) || 1,
        unit: newUnit.trim() || undefined,
        expiry_date: parseExpiryInput(newExpiry),
        category_id: newCategoryId || undefined,
        notes: newNotes.trim() || undefined,
      })
      setShowAddModal(false)
      setNewName('')
      setNewQuantity('1')
      setNewUnit('')
      setNewExpiry('')
      setNewCategoryId('')
      setNewNotes('')
      showToast('Prodotto aggiunto', 'success')
      fetchData()
    } catch {
      showToast('Errore durante l\'aggiunta', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Edit item - opens with first entry of aggregated product
  const openEditModal = (item: DispensaItem) => {
    setEditingItem(item)
    setEditName(item.name)
    setEditQuantity(String(item.quantity))
    setEditUnit(item.unit || '')
    setEditExpiry(item.expiry_date ? formatDate(item.expiry_date) : '')
    setEditCategoryId(item.category_id || '')
    setEditNotes(item.notes || '')
  }

  const handleEditItem = async () => {
    if (!editingItem) return
    try {
      await dispensaService.updateItem(houseId, editingItem.id, {
        name: editName.trim(),
        quantity: parseFloat(editQuantity.replace(',', '.')) || 1,
        unit: editUnit.trim() || undefined,
        expiry_date: parseExpiryInput(editExpiry),
        category_id: editCategoryId || undefined,
        notes: editNotes.trim() || undefined,
      })
      setEditingItem(null)
      showToast('Prodotto aggiornato', 'success')
      fetchData()
    } catch {
      showToast('Errore durante l\'aggiornamento', 'error')
    }
  }

  // Delete item
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

  const handleConsumePartial = async () => {
    if (!consumingItem) return
    const qty = parseFloat(consumeQuantity.replace(',', '.'))
    if (!qty || qty <= 0) return
    try {
      await dispensaService.consumeItem(houseId, consumingItem.id, qty)
      setConsumingItem(null)
      setConsumeQuantity('')
      showToast('Quantita ridotta', 'success')
      fetchData()
    } catch {
      showToast('Errore', 'error')
    }
  }

  // Unconsume item
  const handleUnconsume = async (item: DispensaItem) => {
    try {
      await dispensaService.unconsumeItem(houseId, item.id)
      showToast(`"${item.name}" ripristinato`, 'success')
      fetchData()
    } catch {
      showToast('Errore', 'error')
    }
  }

  // Consume specific entry (not FIFO)
  const handleConsumeEntry = async (entry: DispensaItem) => {
    try {
      await dispensaService.consumeItem(houseId, entry.id)
      showToast(`"${entry.name}" consumato`, 'success')
      setSelectedEntry(null)
      fetchData()
    } catch {
      showToast('Errore', 'error')
    }
  }

  // Open add to list modal - fetch active lists first
  const openAddToListModal = async (entry: DispensaItem) => {
    setSelectedEntry(null)
    try {
      const response = await shoppingListsService.getAll(houseId, { status: 'active' })
      setActiveLists(response.lists)
      setAddToListEntry(entry)
      setAddQuantity('1')
      // If only one list, preselect it
      if (response.lists.length === 1) {
        setSelectedListId(response.lists[0].id)
      } else {
        setSelectedListId('')
      }
    } catch {
      showToast('Errore nel caricamento delle liste', 'error')
    }
  }

  // Add item to shopping list
  const handleAddToList = async () => {
    if (!addToListEntry || !selectedListId) return
    setIsAddingToList(true)
    try {
      await shoppingListsService.addItem(selectedListId, {
        name: addToListEntry.name,
        quantity: parseFloat(addQuantity.replace(',', '.')) || 1,
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

  // Create new list and add item to it
  const handleCreateListAndAdd = async () => {
    if (!addToListEntry) return
    setIsAddingToList(true)
    try {
      // Create new list with the item
      const newList = await shoppingListsService.create({
        house_id: houseId,
        items: [{
          name: addToListEntry.name,
          quantity: parseFloat(addQuantity.replace(',', '.')) || 1,
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

  // Navigate to source shopping list
  const goToSourceList = (entry: DispensaItem) => {
    if (entry.source_list_id) {
      navigate(`/shopping-lists/${entry.source_list_id}`)
    }
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

  const filterButtons: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'expiring', label: 'In scadenza' },
    { key: 'expired', label: 'Scaduti' },
    { key: 'consumed', label: 'Consumati' },
  ]

  return (
    <div className="space-y-4 pb-20">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

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

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca prodotti..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input w-full"
      />

      {/* Filter buttons */}
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
                              {/* Expand chevron */}
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

                              {/* No action buttons on aggregate row - actions are on individual entries */}
                            </div>
                          </div>

                          {/* Expanded entries list - clickable rows */}
                          {isExpanded && (
                            <div className="bg-gray-50 border-t">
                              {product.entries.map((entry) => (
                                <button
                                  key={entry.id}
                                  onClick={() => setSelectedEntry(entry)}
                                  className={`w-full text-left px-3 py-2.5 pl-10 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 transition-colors ${
                                    isExpired(entry.expiry_date) ? 'bg-red-50/50' : ''
                                  } ${
                                    isExpiringSoon(entry.expiry_date) ? 'bg-yellow-50/50' : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
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
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
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

      {/* Grocy Section (collapsible) */}
      <div className="mt-6">
        <button
          onClick={() => setShowGrocy(!showGrocy)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-600">Stock Grocy</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showGrocy ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showGrocy && (
          <div className="mt-2">
            {grocyError ? (
              <div className="card bg-red-50 border-red-200 p-3">
                <p className="text-red-600 text-sm">Impossibile connettersi a Grocy.</p>
              </div>
            ) : grocyStock.length === 0 ? (
              <div className="card text-center py-6">
                <p className="text-gray-500 text-sm">Nessun prodotto in Grocy</p>
              </div>
            ) : (
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Prodotto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Scadenza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {grocyStock.map((item) => (
                      <tr key={item.product_id}>
                        <td className="px-3 py-2 font-medium">{item.product_name}</td>
                        <td className="px-3 py-2 text-gray-600">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2">
                          {item.best_before_date ? (
                            <span className="text-gray-600">
                              {new Date(item.best_before_date).toLocaleDateString('it-IT')}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Aggiungi Prodotto</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome prodotto"
                  className="input w-full"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem() }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unita</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="pz, kg, g..."
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  placeholder="DDMMYY o DD/MM/YYYY"
                  className="input w-full"
                />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Nessuna</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Note opzionali"
                  className="input w-full"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleAddItem}
                disabled={!newName.trim() || isSaving}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Modifica Prodotto</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unita</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="pz, kg, g..."
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                  placeholder="DDMMYY o DD/MM/YYYY"
                  className="input w-full"
                />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Nessuna</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Note opzionali"
                  className="input w-full"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleEditItem}
                disabled={!editName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Consume Modal */}
      {consumingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConsumingItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold">Consumo parziale</h3>
              <p className="text-sm text-gray-500 mt-1">
                {consumingItem.name} - Disponibile: {consumingItem.quantity} {consumingItem.unit || 'pz'}
              </p>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantita da consumare</label>
              <input
                type="text"
                inputMode="decimal"
                value={consumeQuantity}
                onChange={(e) => setConsumeQuantity(e.target.value)}
                placeholder="es: 2"
                className="input w-full text-center text-lg"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleConsumePartial() }}
              />
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setConsumingItem(null)}
                className="flex-1 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleConsumePartial}
                disabled={!consumeQuantity}
                className="flex-1 py-2 rounded-lg bg-yellow-500 text-white font-medium hover:bg-yellow-600 disabled:opacity-50"
              >
                Consuma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Actions Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setSelectedEntry(null)}>
          <div
            className="bg-white rounded-t-xl shadow-xl w-full max-w-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <h3 className="font-semibold text-lg">{selectedEntry.name}</h3>
              <p className="text-sm text-gray-500">
                {selectedEntry.quantity} {selectedEntry.unit || 'pz'}
                {selectedEntry.expiry_date && ` - Scad: ${formatDate(selectedEntry.expiry_date)}`}
              </p>
            </div>
            <div className="p-2">
              {/* Consume or Unconsume based on state */}
              {selectedEntry.is_consumed ? (
                <button
                  onClick={() => {
                    handleUnconsume(selectedEntry)
                    setSelectedEntry(null)
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </span>
                  <div className="text-left">
                    <p className="font-medium">Ripristina</p>
                    <p className="text-xs text-gray-500">Riporta in dispensa</p>
                  </div>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleConsumeEntry(selectedEntry)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <div className="text-left">
                      <p className="font-medium">Consuma</p>
                      <p className="text-xs text-gray-500">Segna come consumato</p>
                    </div>
                  </button>

                  {/* Partial consume */}
                  {selectedEntry.quantity > 1 && (
                    <button
                      onClick={() => {
                        setConsumingItem(selectedEntry)
                        setConsumeQuantity('')
                        setSelectedEntry(null)
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <span className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-medium">Consumo parziale</p>
                        <p className="text-xs text-gray-500">Riduci la quantita</p>
                      </div>
                    </button>
                  )}
                </>
              )}

              {/* Edit */}
              <button
                onClick={() => {
                  openEditModal(selectedEntry)
                  setSelectedEntry(null)
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>
                <div className="text-left">
                  <p className="font-medium">Modifica</p>
                  <p className="text-xs text-gray-500">Modifica i dettagli</p>
                </div>
              </button>

              {/* Go to source list */}
              {selectedEntry.source_list_id && (
                <button
                  onClick={() => goToSourceList(selectedEntry)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </span>
                  <div className="text-left">
                    <p className="font-medium">Vai alla spesa</p>
                    <p className="text-xs text-gray-500">Vedi la lista da cui proviene</p>
                  </div>
                </button>
              )}

              {/* Add to shopping list */}
              <button
                onClick={() => openAddToListModal(selectedEntry)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
                <div className="text-left">
                  <p className="font-medium">Aggiungi alla spesa</p>
                  <p className="text-xs text-gray-500">Aggiungi a una lista attiva</p>
                </div>
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  handleDeleteItem(selectedEntry)
                  setSelectedEntry(null)
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </span>
                <div className="text-left">
                  <p className="font-medium text-red-600">Elimina</p>
                  <p className="text-xs text-gray-500">Rimuovi dalla dispensa</p>
                </div>
              </button>
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Shopping List Modal */}
      {addToListEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAddToListEntry(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Aggiungi alla spesa</h3>
              <p className="text-sm text-gray-500 mt-1">{addToListEntry.name}</p>
            </div>
            <div className="p-4 space-y-4">
              {activeLists.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <p className="text-gray-500">Nessuna lista attiva</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(e.target.value)}
                      className="input w-full"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handleCreateListAndAdd}
                    disabled={isAddingToList}
                    className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {isAddingToList ? 'Creazione...' : 'Crea nuova lista'}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(e.target.value)}
                      className="input w-full"
                      autoFocus
                    />
                  </div>
                  {activeLists.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lista *</label>
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Seleziona lista...</option>
                        {activeLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name} ({list.item_count} articoli)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {activeLists.length === 1 && (
                    <p className="text-sm text-gray-500">
                      Verra aggiunto a: <span className="font-medium">{activeLists[0].name}</span>
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setAddToListEntry(null)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              {activeLists.length > 0 && (
                <button
                  onClick={handleAddToList}
                  disabled={!selectedListId || isAddingToList}
                  className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {isAddingToList ? 'Aggiunta...' : 'Aggiungi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Pantry
