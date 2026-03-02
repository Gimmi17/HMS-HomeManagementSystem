import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import areasService from '@/services/areas'
import dispensaService from '@/services/dispensa'
import categoriesService from '@/services/categories'
import productsService from '@/services/products'
import ProductDetailCard from '@/components/ProductDetailCard'
import ExpiryGroupActionsModal, { type ExpiryDateGroup } from '@/components/ExpiryGroupActionsModal'
import ContinuousBarcodeScanner, { type ScanLogEntry } from '@/components/ContinuousBarcodeScanner'
import BatchScanReviewModal, { type BatchItemData } from '@/components/BatchScanReviewModal'
import type { Area, AreaExpenseStats, DispensaItem, DispensaStats, Category, AreaType, AreaUpdate } from '@/types'

const TYPE_COLORS: Record<AreaType, string> = {
  food_storage: 'bg-green-100 text-green-800',
  equipment: 'bg-orange-100 text-orange-800',
  general: 'bg-blue-100 text-blue-800',
}

const TYPE_LABELS: Record<AreaType, string> = {
  food_storage: 'Cibo',
  equipment: 'Attrezzatura',
  general: 'Generale',
}

export function AreaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentHouse } = useHouse()

  const [area, setArea] = useState<Area | null>(null)
  const [allAreas, setAllAreas] = useState<Area[]>([])
  const [items, setItems] = useState<DispensaItem[]>([])
  const [stats, setStats] = useState<DispensaStats>({ total: 0, expiring_soon: 0, expired: 0 })
  const [expenseStats, setExpenseStats] = useState<AreaExpenseStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 1,
    unit: '',
    category_id: '',
    expiry_date: '',
    purchase_price: '',
    notes: '',
    warranty_expiry_date: '',
    trial_expiry_date: '',
  })
  const [expiryExtensionDays, setExpiryExtensionDays] = useState<number | null>(null)

  // Edit area modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    icon: '',
    description: '',
    expiry_extension_enabled: false,
    disable_expiry_tracking: false,
    warranty_tracking_enabled: false,
    default_warranty_months: '',
    trial_period_enabled: false,
    default_trial_days: '',
  })

  // Delete area
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Move item to another zone
  const [movingItem, setMovingItem] = useState<DispensaItem | null>(null)

  // Aggregated view state
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Product detail card
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<AggregatedProduct | null>(null)

  // Expiry group actions modal
  const [selectedExpiryGroup, setSelectedExpiryGroup] = useState<{ product: AggregatedProduct; group: ExpiryDateGroup } | null>(null)

  // Continuous scanner
  const [showScanner, setShowScanner] = useState(false)
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([])
  const scanLogRef = useRef<ScanLogEntry[]>([])
  const [showBatchReview, setShowBatchReview] = useState(false)
  const [batchItems, setBatchItems] = useState<BatchItemData[]>([])

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    if (!currentHouse || !id) return

    // Check if already scanned in this session
    const existingIdx = scanLogRef.current.findIndex(e => e.barcode === barcode)
    if (existingIdx >= 0) {
      // Increment quantity
      const entry = scanLogRef.current[existingIdx]
      const newQty = entry.quantity + 1
      scanLogRef.current[existingIdx] = { ...entry, quantity: newQty, timestamp: Date.now() }
      setScanLog([...scanLogRef.current])
      return
    }

    // Look up product
    try {
      const result = await productsService.lookupBarcode(barcode)
      const name = result.product_name || barcode
      const brand = result.brand || undefined

      const newEntry: ScanLogEntry = {
        barcode,
        productName: name,
        brandText: brand,
        matched: result.found,
        quantity: 1,
        timestamp: Date.now(),
      }
      scanLogRef.current = [...scanLogRef.current, newEntry]
      setScanLog([...scanLogRef.current])
    } catch {
      // Fallback: add with barcode as name
      const newEntry: ScanLogEntry = {
        barcode,
        productName: barcode,
        matched: false,
        quantity: 1,
        timestamp: Date.now(),
      }
      scanLogRef.current = [...scanLogRef.current, newEntry]
      setScanLog([...scanLogRef.current])
    }
  }, [currentHouse, id])

  const handleScannerClose = useCallback(() => {
    setShowScanner(false)
    const log = scanLogRef.current
    if (log.length > 0) {
      const batch: BatchItemData[] = log.map(entry => ({
        barcode: entry.barcode,
        name: entry.productName || entry.barcode,
        brandText: entry.brandText || '',
        categoryId: '',
        expiryDate: '',
        quantity: entry.quantity,
        notes: '',
        matched: entry.matched,
      }))
      setBatchItems(batch)
      setShowBatchReview(true)
    }
    scanLogRef.current = []
    setScanLog([])
  }, [])

  const handleBatchSave = async (batchToSave: BatchItemData[]) => {
    if (!currentHouse || !id) return
    let errors = 0
    for (const item of batchToSave) {
      try {
        await dispensaService.createItem(currentHouse.id, {
          name: item.name,
          barcode: item.barcode,
          area_id: id,
          brand_text: item.brandText || undefined,
          category_id: item.categoryId || undefined,
          expiry_date: item.expiryDate || undefined,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })
      } catch {
        errors++
      }
    }
    setShowBatchReview(false)
    setBatchItems([])
    if (errors > 0) {
      alert(`${errors} articol${errors === 1 ? 'o non salvato' : 'i non salvati'}`)
    }
    loadData()
  }

  const loadData = async () => {
    if (!currentHouse || !id) return
    setIsLoading(true)
    try {
      const [areasResponse, itemsResponse, catsResponse] = await Promise.all([
        areasService.getAll(currentHouse.id),
        dispensaService.getItems(currentHouse.id, {
          area_id: id,
        }),
        categoriesService.getAll(currentHouse.id),
      ])

      const foundArea = areasResponse.areas.find(e => e.id === id)
      setArea(foundArea || null)
      setAllAreas(areasResponse.areas)
      setItems(itemsResponse.items)
      setStats(itemsResponse.stats)
      setCategories(catsResponse.categories)

      // Load expense stats
      const expStats = await areasService.getStats(id, currentHouse.id)
      setExpenseStats(expStats)
    } catch (error) {
      console.error('Failed to load area data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentHouse, id])

  const maxCategoryTotal = useMemo(() => {
    if (!expenseStats?.by_category.length) return 0
    return Math.max(...expenseStats.by_category.map(c => c.total))
  }, [expenseStats])

  const maxMonthTotal = useMemo(() => {
    if (!expenseStats?.by_month.length) return 0
    return Math.max(...expenseStats.by_month.map(m => m.total))
  }, [expenseStats])

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false
    return new Date(expiryDate) <= new Date()
  }

  const isExpiring = (expiryDate: string | null) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const now = new Date()
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    return expiry > now && expiry <= threeDays
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  interface AggregatedProduct {
    key: string
    name: string
    brandText: string | null
    totalQuantity: number
    unit: string | null
    entries: DispensaItem[]
    hasExpired: boolean
    hasExpiring: boolean
    categoryId: string | null
    barcode: string | null
    dateGroups: ExpiryDateGroup[]
  }

  const aggregatedProducts = useMemo((): AggregatedProduct[] => {
    const query = searchQuery.toLowerCase().trim()
    const filtered = query
      ? items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          (item.brand_text && item.brand_text.toLowerCase().includes(query)) ||
          (item.barcode && item.barcode.includes(query))
        )
      : items
    const groupMap = new Map<string, AggregatedProduct>()
    for (const item of filtered) {
      const key = `${item.name.toLowerCase()}_${(item.unit || 'pz').toLowerCase()}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.totalQuantity += item.quantity
        existing.entries.push(item)
        if (isExpired(item.expiry_date)) existing.hasExpired = true
        if (isExpiring(item.expiry_date)) existing.hasExpiring = true
        if (!existing.barcode && item.barcode) existing.barcode = item.barcode
      } else {
        groupMap.set(key, {
          key,
          name: item.name,
          brandText: item.brand_text,
          totalQuantity: item.quantity,
          unit: item.unit,
          entries: [item],
          hasExpired: isExpired(item.expiry_date),
          hasExpiring: isExpiring(item.expiry_date),
          categoryId: item.category_id,
          barcode: item.barcode,
          dateGroups: [],
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
      // Build date groups
      const dateMap = new Map<string, ExpiryDateGroup>()
      for (const entry of product.entries) {
        const dk = entry.expiry_date || '__none__'
        const existing = dateMap.get(dk)
        if (existing) {
          existing.totalQuantity += entry.quantity
          existing.entries.push(entry)
          if (isExpired(entry.expiry_date)) existing.hasExpired = true
          if (isExpiring(entry.expiry_date)) existing.hasExpiring = true
        } else {
          dateMap.set(dk, {
            dateKey: dk,
            label: dk === '__none__' ? 'Senza scadenza' : formatDate(entry.expiry_date),
            totalQuantity: entry.quantity,
            unit: entry.unit,
            entries: [entry],
            hasExpired: isExpired(entry.expiry_date),
            hasExpiring: isExpiring(entry.expiry_date),
          })
        }
      }
      product.dateGroups = Array.from(dateMap.values())
    }
    return Array.from(groupMap.values())
  }, [items, searchQuery])

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

    for (const [catId] of catMap) {
      if (!groups.find(g => g.key === catId)) {
        groups.push({ key: catId, label: 'Altro', products: catMap.get(catId)! })
      }
    }

    if (uncategorized.length > 0) {
      groups.push({ key: '_none', label: 'Senza categoria', products: uncategorized })
    }

    return groups
  }, [aggregatedProducts, categories])

  const toggleProduct = (key: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouse || !id || !newItem.name.trim()) return

    setIsSaving(true)
    try {
      // Calculate expiry extension
      let finalExpiryDate = newItem.expiry_date || undefined
      let originalExpiryDate: string | undefined = undefined
      if (expiryExtensionDays && newItem.expiry_date) {
        originalExpiryDate = newItem.expiry_date
        const d = new Date(newItem.expiry_date)
        d.setDate(d.getDate() + expiryExtensionDays)
        finalExpiryDate = d.toISOString().split('T')[0]
      }

      await dispensaService.createItem(currentHouse.id, {
        name: newItem.name.trim(),
        quantity: newItem.quantity,
        unit: newItem.unit.trim() || undefined,
        category_id: newItem.category_id || undefined,
        expiry_date: finalExpiryDate,
        original_expiry_date: originalExpiryDate,
        purchase_price: newItem.purchase_price ? parseFloat(newItem.purchase_price) : undefined,
        area_id: id,
        notes: newItem.notes.trim() || undefined,
        warranty_expiry_date: newItem.warranty_expiry_date || undefined,
        trial_expiry_date: newItem.trial_expiry_date || undefined,
      })
      setShowAddModal(false)
      setNewItem({ name: '', quantity: 1, unit: '', category_id: '', expiry_date: '', purchase_price: '', notes: '', warranty_expiry_date: '', trial_expiry_date: '' })
      setExpiryExtensionDays(null)
      loadData()
    } catch (error) {
      console.error('Failed to add item:', error)
      alert('Errore durante l\'aggiunta')
    } finally {
      setIsSaving(false)
    }
  }



  const handleMoveItem = async (targetAreaId: string) => {
    if (!currentHouse || !movingItem) return
    try {
      await dispensaService.updateItem(currentHouse.id, movingItem.id, { area_id: targetAreaId })
      setMovingItem(null)
      loadData()
    } catch (error) {
      console.error('Failed to move item:', error)
    }
  }

  const handleEditArea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouse || !id) return

    try {
      const data: AreaUpdate = {}
      if (editForm.name.trim()) data.name = editForm.name.trim()
      if (editForm.icon.trim()) data.icon = editForm.icon.trim()
      if (editForm.description.trim()) data.description = editForm.description.trim()
      data.expiry_extension_enabled = editForm.expiry_extension_enabled
      data.disable_expiry_tracking = editForm.disable_expiry_tracking
      data.warranty_tracking_enabled = editForm.warranty_tracking_enabled
      data.default_warranty_months = editForm.default_warranty_months ? parseInt(editForm.default_warranty_months) : null
      data.trial_period_enabled = editForm.trial_period_enabled
      data.default_trial_days = editForm.default_trial_days ? parseInt(editForm.default_trial_days) : null

      await areasService.update(id, currentHouse.id, data)
      setShowEditModal(false)
      loadData()
    } catch (error) {
      console.error('Failed to update area:', error)
      alert('Errore durante l\'aggiornamento')
    }
  }

  const handleDeleteArea = async () => {
    if (!currentHouse || !id) return
    try {
      await areasService.delete(id, currentHouse.id)
      navigate('/areas')
    } catch (error: unknown) {
      console.error('Failed to delete area:', error)
      const apiError = error as { response?: { data?: { detail?: string } } }
      alert(apiError.response?.data?.detail || 'Errore durante l\'eliminazione')
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return <p className="text-gray-500 text-sm">Caricamento...</p>
  }

  if (!area) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/areas')} className="text-sm text-primary-600 hover:underline">
          &larr; Torna alle aree
        </button>
        <p className="text-gray-500">Area non trovata</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/areas')}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{area.icon || '📦'}</span>
            <h1 className="text-xl font-bold text-gray-900 truncate">{area.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[area.area_type]}`}>
              {TYPE_LABELS[area.area_type]}
            </span>
          </div>
          {area.description && (
            <p className="text-sm text-gray-500 mt-1">{area.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setEditForm({
                name: area.name,
                icon: area.icon || '',
                description: area.description || '',
                expiry_extension_enabled: area.expiry_extension_enabled,
                disable_expiry_tracking: area.disable_expiry_tracking,
                warranty_tracking_enabled: area.warranty_tracking_enabled,
                default_warranty_months: area.default_warranty_months != null ? String(area.default_warranty_months) : '',
                trial_period_enabled: area.trial_period_enabled,
                default_trial_days: area.default_trial_days != null ? String(area.default_trial_days) : '',
              })
              setShowEditModal(true)
            }}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Modifica"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {!area.is_default && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="Elimina"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expense Stats */}
      {expenseStats && expenseStats.total_spent > 0 && (
        <div className="space-y-3">
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Totale Speso</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {expenseStats.total_spent.toFixed(2)} EUR
            </p>
          </div>
          {expenseStats.by_category.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Per Categoria</h3>
              <div className="space-y-2">
                {expenseStats.by_category.map((cat, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{cat.category_name}</span>
                      <span className="font-medium">{cat.total.toFixed(2)} EUR</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${maxCategoryTotal > 0 ? (cat.total / maxCategoryTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {expenseStats.by_month.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Per Mese</h3>
              <div className="space-y-2">
                {expenseStats.by_month.map((month, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{month.month}</span>
                      <span className="font-medium">{month.total.toFixed(2)} EUR</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${maxMonthTotal > 0 ? (month.total / maxMonthTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-800 flex-1">Articoli ({stats.total})</h2>
          <button
            onClick={() => setShowScanner(true)}
            className="btn bg-teal-600 text-white hover:bg-teal-700 text-sm px-3 py-1.5 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scansione
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary text-sm px-3 py-1.5">+ Aggiungi</button>
        </div>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca articoli..." className="input w-full" />
        {aggregatedProducts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {items.length === 0 ? 'Nessun articolo in questa area' : 'Nessun risultato per la ricerca'}
          </p>
        ) : (
          <div className="space-y-3">
            {groupedProducts.map((group) => {
              const isCollapsed = collapsedSections.has(group.key)
              return (
                <div key={group.key} className="card overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleSection(group.key)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {group.color && (
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
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
                        return (
                          <div key={product.key}>
                            {/* Product row */}
                            <div
                              className={`p-3 transition-colors ${
                                product.hasExpired && !area.disable_expiry_tracking ? 'bg-red-50' : ''
                              } ${
                                product.hasExpiring && !product.hasExpired && !area.disable_expiry_tracking ? 'bg-yellow-50' : ''
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
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm text-gray-900">{product.name}</span>
                                    {product.brandText && (
                                      <span className="text-xs text-purple-600">{product.brandText}</span>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedProductForDetail(product) }}
                                      className="p-0.5 text-gray-400 hover:text-blue-600 flex-shrink-0"
                                      title="Scheda prodotto"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                                    <span className="font-medium text-gray-700">
                                      {product.totalQuantity} {product.unit || 'pz'}
                                    </span>
                                    {product.entries.length > 1 && (
                                      <span className="text-gray-400">({product.entries.length} giacenze)</span>
                                    )}
                                    {!area.disable_expiry_tracking && product.hasExpired && (
                                      <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Scaduto</span>
                                    )}
                                    {!area.disable_expiry_tracking && product.hasExpiring && !product.hasExpired && (
                                      <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 font-medium">In scadenza</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded: date groups */}
                            {isExpanded && (
                              <div className="bg-gray-50 border-t">
                                {product.dateGroups.map((dg) => (
                                  <button
                                    key={dg.dateKey}
                                    onClick={() => setSelectedExpiryGroup({ product, group: dg })}
                                    className={`w-full px-3 py-2.5 pl-10 border-b border-gray-100 last:border-b-0 text-left hover:bg-gray-100 transition-colors ${
                                      !area.disable_expiry_tracking && dg.hasExpired ? 'bg-red-50/50' : ''
                                    } ${
                                      !area.disable_expiry_tracking && dg.hasExpiring && !dg.hasExpired ? 'bg-yellow-50/50' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <span className="font-medium">{dg.label}</span>
                                      <span className="text-gray-400">-</span>
                                      <span className="font-medium text-gray-700">
                                        {dg.totalQuantity} {dg.unit || 'pz'}
                                      </span>
                                      {dg.entries.length > 1 && (
                                        <span className="text-gray-400">({dg.entries.length})</span>
                                      )}
                                      {!area.disable_expiry_tracking && dg.hasExpired && (
                                        <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Scaduto</span>
                                      )}
                                      {!area.disable_expiry_tracking && dg.hasExpiring && !dg.hasExpired && (
                                        <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 font-medium">In scadenza</span>
                                      )}
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
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddItem}>
              <div className="p-4 border-b"><h3 className="text-lg font-semibold">Aggiungi Articolo</h3></div>
              <div className="p-4 space-y-4">
                <div><label className="label text-xs">Nome *</label><input type="text" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Nome articolo..." className="input w-full" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label text-xs">Quantita'</label><input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 1 })} className="input w-full" min={0.01} step={0.01} /></div>
                  <div><label className="label text-xs">Unita'</label><input type="text" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="pz, kg, g..." className="input w-full" /></div>
                </div>
                <div><label className="label text-xs">Categoria</label><select value={newItem.category_id} onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })} className="input w-full"><option value="">Nessuna</option>{categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}</select></div>
                {area.area_type === 'food_storage' && (<div><label className="label text-xs">Scadenza</label><input type="date" value={newItem.expiry_date} onChange={(e) => { setNewItem({ ...newItem, expiry_date: e.target.value }); setExpiryExtensionDays(null) }} className="input w-full" /></div>)}
                {area.expiry_extension_enabled && newItem.expiry_date && (
                  <div>
                    <label className="label text-xs">Estendi scadenza</label>
                    <div className="flex gap-2 flex-wrap">
                      {[30, 60, 90, 120].map(days => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setExpiryExtensionDays(expiryExtensionDays === days ? null : days)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${expiryExtensionDays === days ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          +{days}gg
                        </button>
                      ))}
                      {expiryExtensionDays && (
                        <button type="button" onClick={() => setExpiryExtensionDays(null)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200">
                          Nessuna
                        </button>
                      )}
                    </div>
                    {expiryExtensionDays && newItem.expiry_date && (
                      <p className="text-xs text-blue-600 mt-1">
                        Scadenza originale: {newItem.expiry_date.split('-').reverse().join('/')} → Nuova: {(() => { const d = new Date(newItem.expiry_date); d.setDate(d.getDate() + expiryExtensionDays); return d.toLocaleDateString('it-IT') })()}
                      </p>
                    )}
                  </div>
                )}
                {area.warranty_tracking_enabled && (
                  <div>
                    <label className="label text-xs">Data fine garanzia</label>
                    <input
                      type="date"
                      value={newItem.warranty_expiry_date}
                      onChange={(e) => setNewItem({ ...newItem, warranty_expiry_date: e.target.value })}
                      className="input w-full"
                    />
                    {!newItem.warranty_expiry_date && area.default_warranty_months && (
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date()
                          d.setMonth(d.getMonth() + (area.default_warranty_months || 0))
                          setNewItem({ ...newItem, warranty_expiry_date: d.toISOString().split('T')[0] })
                        }}
                        className="text-xs text-primary-600 hover:underline mt-1"
                      >
                        Auto: {area.default_warranty_months} mesi da oggi
                      </button>
                    )}
                  </div>
                )}
                {area.trial_period_enabled && (
                  <div>
                    <label className="label text-xs">Data fine prova/reso</label>
                    <input
                      type="date"
                      value={newItem.trial_expiry_date}
                      onChange={(e) => setNewItem({ ...newItem, trial_expiry_date: e.target.value })}
                      className="input w-full"
                    />
                    {!newItem.trial_expiry_date && area.default_trial_days && (
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date()
                          d.setDate(d.getDate() + (area.default_trial_days || 0))
                          setNewItem({ ...newItem, trial_expiry_date: d.toISOString().split('T')[0] })
                        }}
                        className="text-xs text-primary-600 hover:underline mt-1"
                      >
                        Auto: {area.default_trial_days} giorni da oggi
                      </button>
                    )}
                  </div>
                )}
                <div><label className="label text-xs">Prezzo di acquisto (EUR)</label><input type="number" value={newItem.purchase_price} onChange={(e) => setNewItem({ ...newItem, purchase_price: e.target.value })} placeholder="0.00" className="input w-full" min={0} step={0.01} /></div>
                <div><label className="label text-xs">Note</label><textarea value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} placeholder="Note opzionali..." className="input w-full" rows={2} /></div>
              </div>
              <div className="p-4 border-t flex gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1 text-sm">Annulla</button>
                <button type="submit" disabled={isSaving} className="btn btn-primary flex-1 text-sm">{isSaving ? 'Salvataggio...' : 'Aggiungi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Area Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <form onSubmit={handleEditArea}>
              <div className="p-4 border-b"><h3 className="text-lg font-semibold">Modifica Area</h3></div>
              <div className="p-4 space-y-4">
                <div><label className="label text-xs">Nome</label><input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input w-full" /></div>
                <div><label className="label text-xs">Icona</label><input type="text" value={editForm.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} className="input w-full" maxLength={10} /></div>
                <div><label className="label text-xs">Descrizione</label><textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="input w-full" rows={2} /></div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Regole</h4>
                  <div className="space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.expiry_extension_enabled} onChange={(e) => setEditForm({ ...editForm, expiry_extension_enabled: e.target.checked })} className="mt-0.5" />
                      <div>
                        <span className="text-sm font-medium">Estensione scadenza</span>
                        <p className="text-xs text-gray-500">L'utente sceglie di quanti giorni estendere</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.disable_expiry_tracking} onChange={(e) => setEditForm({ ...editForm, disable_expiry_tracking: e.target.checked })} className="mt-0.5" />
                      <div>
                        <span className="text-sm font-medium">Disabilita tracciamento scadenze</span>
                        <p className="text-xs text-gray-500">Gli articoli non generano notifiche</p>
                      </div>
                    </label>
                    <div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={editForm.warranty_tracking_enabled} onChange={(e) => setEditForm({ ...editForm, warranty_tracking_enabled: e.target.checked })} className="mt-0.5" />
                        <span className="text-sm font-medium">Tracciamento garanzia</span>
                      </label>
                      {editForm.warranty_tracking_enabled && (
                        <div className="ml-6 mt-1">
                          <label className="text-xs text-gray-500">Durata predefinita (mesi)</label>
                          <input type="number" value={editForm.default_warranty_months} onChange={(e) => setEditForm({ ...editForm, default_warranty_months: e.target.value })} placeholder="es. 24" className="input w-full mt-0.5" min={1} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={editForm.trial_period_enabled} onChange={(e) => setEditForm({ ...editForm, trial_period_enabled: e.target.checked })} className="mt-0.5" />
                        <span className="text-sm font-medium">Periodo di prova/reso</span>
                      </label>
                      {editForm.trial_period_enabled && (
                        <div className="ml-6 mt-1">
                          <label className="text-xs text-gray-500">Durata predefinita (giorni)</label>
                          <input type="number" value={editForm.default_trial_days} onChange={(e) => setEditForm({ ...editForm, default_trial_days: e.target.value })} placeholder="es. 30" className="input w-full mt-0.5" min={1} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1 text-sm">Annulla</button>
                <button type="submit" className="btn btn-primary flex-1 text-sm">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Card */}
      {selectedProductForDetail && (
        <ProductDetailCard
          barcode={selectedProductForDetail.barcode}
          productName={selectedProductForDetail.name}
          onClose={() => setSelectedProductForDetail(null)}
          onProductUpdated={() => loadData()}
        />
      )}

      {/* Expiry Group Actions Modal */}
      {selectedExpiryGroup && currentHouse && id && (
        <ExpiryGroupActionsModal
          productName={selectedExpiryGroup.product.name}
          group={selectedExpiryGroup.group}
          areaId={id}
          houseId={currentHouse.id}
          allAreas={allAreas}
          onComplete={() => {
            setSelectedExpiryGroup(null)
            loadData()
          }}
          onClose={() => setSelectedExpiryGroup(null)}
        />
      )}

      {/* Move Item Modal */}
      {movingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:w-auto sm:min-w-[320px] sm:rounded-xl rounded-t-xl p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Sposta in altra zona</h3>
              <p className="text-sm text-gray-500 mt-1">{movingItem.name}</p>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {allAreas.filter(a => a.id !== id).map((targetArea) => (
                <button
                  key={targetArea.id}
                  onClick={() => handleMoveItem(targetArea.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-primary-50 hover:border-primary-200 transition-colors text-left"
                >
                  <span className="text-xl">{targetArea.icon || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{targetArea.name}</p>
                    <p className="text-xs text-gray-500">{targetArea.item_count} articoli</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMovingItem(null)}
              className="btn btn-secondary w-full text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Continuous Barcode Scanner */}
      {showScanner && (
        <ContinuousBarcodeScanner
          onBarcodeDetected={handleBarcodeDetected}
          onClose={handleScannerClose}
          scanLog={scanLog}
        />
      )}

      {/* Batch Scan Review Modal */}
      {showBatchReview && currentHouse && id && (
        <BatchScanReviewModal
          items={batchItems}
          categories={categories}
          areaId={id}
          houseId={currentHouse.id}
          onSave={handleBatchSave}
          onClose={() => { setShowBatchReview(false); setBatchItems([]) }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h3 className="font-semibold">Elimina Area</h3>
                <p className="text-sm text-gray-500">{area.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">Sei sicuro di voler eliminare questa area? L'operazione non puo' essere annullata.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary flex-1 text-sm">Annulla</button>
              <button onClick={handleDeleteArea} className="btn bg-red-600 text-white hover:bg-red-700 flex-1 text-sm">Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AreaDetail
