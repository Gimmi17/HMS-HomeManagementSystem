import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import anagraficheService, { ProductListItem, ProductCreateRequest, ProductUpdateRequest, ProductCategoryTag, UnnamedProductWithDescriptions, ProductBarcodeItem } from '@/services/anagrafiche'
import CompositionModal from '@/components/CompositionModal'
import areasService from '@/services/areas'
import { useHouse } from '@/context/HouseContext'
import type { Area } from '@/types'

export function AnagraficheProducts() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Category manager modal
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [areas, setAreas] = useState<Area[]>([])
  const [categorySearch, setCategorySearch] = useState('')
  const [managerCategories, setManagerCategories] = useState<ProductCategoryTag[]>([])

  // Category filter
  const [categories, setCategories] = useState<ProductCategoryTag[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  // Certification filter: 'all' | 'certified' | 'uncertified'
  const [certificationFilter, setCertificationFilter] = useState<'all' | 'certified' | 'uncertified'>('all')

  // Detail modal
  const [viewingProduct, setViewingProduct] = useState<ProductListItem | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null)
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    brand: '',
    quantity_text: '',
    energy_kcal: '',
    nutriscore: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  // Bulk scan uncertified
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, found: 0 })

  // Product notes (inline edit in detail modal)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Report product
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportModalProduct, setReportModalProduct] = useState<ProductListItem | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // Composition modal
  const [showCompositionModal, setShowCompositionModal] = useState(false)

  // Product barcodes
  const [productBarcodes, setProductBarcodes] = useState<ProductBarcodeItem[]>([])
  const [newBarcodeValue, setNewBarcodeValue] = useState('')
  const [isAddingBarcode, setIsAddingBarcode] = useState(false)

  // Name recovery from receipts
  const [isRecoveringNames, setIsRecoveringNames] = useState(false)
  const [nameRecoveryProducts, setNameRecoveryProducts] = useState<UnnamedProductWithDescriptions[]>([])
  const [currentRecoveryIndex, setCurrentRecoveryIndex] = useState(0)
  const [recoveryStats, setRecoveryStats] = useState<{ found: number; updated: number } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const openReportModal = (e: React.MouseEvent, product: ProductListItem) => {
    e.stopPropagation()
    setReportModalProduct(product)
    setReportReason('')
  }

  const submitReport = async () => {
    if (!reportModalProduct) return
    setIsSubmittingReport(true)
    setReportingId(reportModalProduct.id)
    try {
      await anagraficheService.reportProduct(reportModalProduct.id, reportReason.trim() || undefined)
      showToast('Prodotto segnalato', 'success')
      setReportModalProduct(null)
      setReportReason('')
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('Prodotto gia segnalato', 'error')
        setReportModalProduct(null)
      } else {
        showToast(err.response?.data?.detail || 'Errore nella segnalazione', 'error')
      }
    } finally {
      setIsSubmittingReport(false)
      setReportingId(null)
    }
  }

  const handleSaveNotes = async () => {
    if (!viewingProduct) return
    setIsSavingNotes(true)
    try {
      const updated = await anagraficheService.updateProductNotes(viewingProduct.id, notesValue.trim() || null)
      setViewingProduct(updated)
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditingNotes(false)
      showToast('Commento salvato', 'success')
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore nel salvataggio', 'error')
    } finally {
      setIsSavingNotes(false)
    }
  }

  const loadProductBarcodes = async (productId: string) => {
    try {
      const barcodes = await anagraficheService.getProductBarcodes(productId)
      setProductBarcodes(barcodes)
    } catch (err) {
      console.error('Failed to load barcodes:', err)
    }
  }

  const handleAddBarcode = async () => {
    if (!viewingProduct || !newBarcodeValue.trim()) return
    setIsAddingBarcode(true)
    try {
      await anagraficheService.addProductBarcode(viewingProduct.id, newBarcodeValue.trim())
      setNewBarcodeValue('')
      await loadProductBarcodes(viewingProduct.id)
      showToast('Barcode aggiunto', 'success')
      fetchProducts()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore aggiunta barcode', 'error')
    } finally {
      setIsAddingBarcode(false)
    }
  }

  const handleDeleteBarcode = async (barcodeId: string) => {
    if (!viewingProduct) return
    if (!confirm('Rimuovere questo barcode?')) return
    try {
      await anagraficheService.deleteProductBarcode(viewingProduct.id, barcodeId)
      await loadProductBarcodes(viewingProduct.id)
      showToast('Barcode rimosso', 'success')
      fetchProducts()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore rimozione barcode', 'error')
    }
  }

  const handleSetBarcodePrimary = async (barcodeId: string) => {
    if (!viewingProduct) return
    try {
      await anagraficheService.setProductBarcodePrimary(viewingProduct.id, barcodeId)
      await loadProductBarcodes(viewingProduct.id)
      showToast('Barcode principale impostato', 'success')
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await anagraficheService.getProducts({
        search: searchQuery || undefined,
        category_tag_id: selectedCategoryId || undefined,
        certified: certificationFilter === 'all' ? undefined : certificationFilter === 'certified',
        limit: 100
      })
      setProducts(response.products)
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to fetch products:', err)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to check if product is certified
  const isProductCertified = (product: ProductListItem) => product.source !== 'not_found'

  const fetchCategories = async () => {
    try {
      const response = await anagraficheService.getProductCategories({
        min_products: 1,  // Only show categories with at least 1 product
        limit: 200
      })
      setCategories(response.categories)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [searchQuery, selectedCategoryId, certificationFilter])

  const openCreateModal = () => {
    setEditingProduct(null)
    setFormData({ barcode: '', name: '', brand: '', quantity_text: '', energy_kcal: '', nutriscore: '' })
    setShowEditModal(true)
  }

  const openEditModal = (product: ProductListItem) => {
    setViewingProduct(null) // Close detail modal
    setEditingProduct(product)
    setFormData({
      barcode: product.barcode || '',
      name: product.name || '',
      brand: product.brand || '',
      quantity_text: product.quantity_text || '',
      energy_kcal: product.energy_kcal?.toString() || '',
      nutriscore: product.nutriscore || ''
    })
    setShowEditModal(true)
  }

  const parseNumber = (val: string): number | undefined => {
    const parsed = parseFloat(val.replace(',', '.'))
    return isNaN(parsed) ? undefined : parsed
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const data = {
        barcode: formData.barcode.trim() || undefined,
        name: formData.name || undefined,
        brand: formData.brand || undefined,
        quantity_text: formData.quantity_text || undefined,
        energy_kcal: parseNumber(formData.energy_kcal),
        nutriscore: formData.nutriscore || undefined
      }

      if (editingProduct) {
        const { barcode, ...updateData } = data
        // Include barcode in update if product is not certified and barcode changed
        const finalUpdate = !isProductCertified(editingProduct) && barcode !== (editingProduct.barcode || '')
          ? { ...updateData, barcode: barcode || undefined }
          : updateData
        await anagraficheService.updateProduct(editingProduct.id, finalUpdate as ProductUpdateRequest)
        showToast('Prodotto aggiornato', 'success')
      } else {
        await anagraficheService.createProduct(data as ProductCreateRequest)
        showToast('Prodotto creato', 'success')
      }
      setShowEditModal(false)
      fetchProducts()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async (product: ProductListItem) => {
    if (!confirm(`Annullare il prodotto "${product.name || product.barcode}"? Non sarà più visibile nella lista.`)) return
    try {
      await anagraficheService.deleteProduct(product.id)
      showToast('Prodotto annullato', 'success')
      setViewingProduct(null)
      fetchProducts()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  const handleRefetchFromApi = async () => {
    if (!editingProduct) return
    setIsFetching(true)
    try {
      const updated = await anagraficheService.refetchProduct(editingProduct.id, formData.barcode)
      // Update form with fetched data
      setFormData({
        barcode: updated.barcode || '',
        name: updated.name || '',
        brand: updated.brand || '',
        quantity_text: updated.quantity_text || '',
        energy_kcal: updated.energy_kcal?.toString() || '',
        nutriscore: updated.nutriscore || ''
      })
      setEditingProduct(updated)
      showToast(`Dati aggiornati da ${updated.source}`, 'success')
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Prodotto non trovato nelle API', 'error')
    } finally {
      setIsFetching(false)
    }
  }

  // Name recovery from receipts
  const startNameRecovery = async () => {
    setIsRecoveringNames(true)
    try {
      const response = await anagraficheService.getUnnamedProductsWithDescriptions()
      if (response.products.length === 0) {
        showToast('Nessun prodotto senza nome con descrizioni disponibili', 'success')
        setIsRecoveringNames(false)
        return
      }

      // Separate products with single description (auto-update) from those with multiple (need choice)
      const singleDescProducts = response.products.filter(p => p.descriptions.length === 1)
      const multiDescProducts = response.products.filter(p => p.descriptions.length > 1)

      // Auto-update products with single description
      let autoUpdated = 0
      for (const product of singleDescProducts) {
        try {
          await anagraficheService.setProductName(product.id, product.descriptions[0])
          autoUpdated++
        } catch (err) {
          console.error(`Failed to update ${product.barcode}:`, err)
        }
      }

      // Set up modal for products with multiple descriptions
      if (multiDescProducts.length > 0) {
        setNameRecoveryProducts(multiDescProducts)
        setCurrentRecoveryIndex(0)
        setRecoveryStats({ found: response.products.length, updated: autoUpdated })
      } else {
        // All done, no modal needed
        showToast(`Recupero completato: ${autoUpdated} prodotti aggiornati automaticamente`, 'success')
        setIsRecoveringNames(false)
        fetchProducts()
      }
    } catch (err: any) {
      console.error('Failed to recover names:', err)
      showToast(err.response?.data?.detail || 'Errore nel recupero nomi', 'error')
      setIsRecoveringNames(false)
    }
  }

  const handleNameSelection = async (name: string) => {
    const currentProduct = nameRecoveryProducts[currentRecoveryIndex]
    try {
      await anagraficheService.setProductName(currentProduct.id, name)

      // Move to next product or close modal
      if (currentRecoveryIndex < nameRecoveryProducts.length - 1) {
        setCurrentRecoveryIndex(currentRecoveryIndex + 1)
        setRecoveryStats(prev => prev ? { ...prev, updated: prev.updated + 1 } : null)
      } else {
        // All done
        const totalUpdated = (recoveryStats?.updated || 0) + 1
        showToast(`Recupero completato: ${totalUpdated} prodotti aggiornati`, 'success')
        setNameRecoveryProducts([])
        setCurrentRecoveryIndex(0)
        setRecoveryStats(null)
        setIsRecoveringNames(false)
        fetchProducts()
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  const skipCurrentProduct = () => {
    if (currentRecoveryIndex < nameRecoveryProducts.length - 1) {
      setCurrentRecoveryIndex(currentRecoveryIndex + 1)
    } else {
      // All done
      showToast(`Recupero completato: ${recoveryStats?.updated || 0} prodotti aggiornati`, 'success')
      setNameRecoveryProducts([])
      setCurrentRecoveryIndex(0)
      setRecoveryStats(null)
      setIsRecoveringNames(false)
      fetchProducts()
    }
  }

  const cancelNameRecovery = () => {
    setNameRecoveryProducts([])
    setCurrentRecoveryIndex(0)
    setRecoveryStats(null)
    setIsRecoveringNames(false)
    fetchProducts()
  }

  const openCategoryManager = async () => {
    setShowCategoryManager(true)
    setCategorySearch('')
    try {
      const [catResponse, areasResponse] = await Promise.all([
        anagraficheService.getProductCategories({ min_products: 1, limit: 500 }),
        currentHouse ? areasService.getAll(currentHouse.id) : Promise.resolve({ areas: [] })
      ])
      setManagerCategories(catResponse.categories)
      setAreas(areasResponse.areas)
    } catch (err) {
      console.error('Failed to load category manager data:', err)
      showToast('Errore nel caricamento classi', 'error')
    }
  }

  const handleCategoryAreaChange = async (categoryId: string, areaId: string | null) => {
    try {
      const updated = await anagraficheService.updateCategoryDefaultArea(categoryId, areaId)
      setManagerCategories(prev => prev.map(c => c.id === updated.id ? updated : c))
      // Also update the filter categories list
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c))
      showToast('Destinazione aggiornata', 'success')
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore nel salvataggio', 'error')
    }
  }

  const filteredManagerCategories = managerCategories.filter(c => {
    if (!categorySearch) return true
    const term = categorySearch.toLowerCase()
    return (c.name || '').toLowerCase().includes(term) || c.tag_id.toLowerCase().includes(term)
  })

  const getNutriscoreColor = (score: string | null) => {
    if (!score) return 'bg-gray-100 text-gray-600'
    switch (score.toUpperCase()) {
      case 'A': return 'bg-green-100 text-green-700'
      case 'B': return 'bg-lime-100 text-lime-700'
      case 'C': return 'bg-yellow-100 text-yellow-700'
      case 'D': return 'bg-orange-100 text-orange-700'
      case 'E': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const formatValue = (value: number | null | undefined, unit: string = '') => {
    if (value == null) return '-'
    return `${value}${unit}`
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'openfoodfacts': return 'Open Food Facts'
      case 'openproductsfacts': return 'Open Products Facts'
      case 'openbeautyfacts': return 'Open Beauty Facts'
      case 'not_found': return 'Non certificato'
      default: return source
    }
  }

  const startBulkScan = async () => {
    // Get all uncertified products (need full list, not just current page)
    try {
      setIsScanning(true)
      const response = await anagraficheService.getProducts({ certified: false, limit: 500 })
      const uncertified = response.products
      if (uncertified.length === 0) {
        showToast('Nessun prodotto non certificato da scansionare', 'success')
        setIsScanning(false)
        return
      }
      setScanProgress({ current: 0, total: uncertified.length, found: 0 })
      let found = 0
      for (let i = 0; i < uncertified.length; i++) {
        setScanProgress(prev => ({ ...prev, current: i + 1 }))
        try {
          const updated = await anagraficheService.refetchProduct(uncertified[i].id)
          if (updated.source !== 'not_found') found++
        } catch {
          // Product not found on any source, continue
        }
      }
      setScanProgress(prev => ({ ...prev, found }))
      showToast(`Scansione completata: ${found}/${uncertified.length} prodotti certificati`, found > 0 ? 'success' : 'error')
      fetchProducts()
    } catch (err) {
      console.error('Bulk scan failed:', err)
      showToast('Errore durante la scansione', 'error')
    } finally {
      setIsScanning(false)
      setScanProgress({ current: 0, total: 0, found: 0 })
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/anagrafiche')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Catalogo Prodotti</h1>
          <p className="text-sm text-gray-500">{total} prodotti (mostrando {products.length})</p>
        </div>
        <button
          onClick={startBulkScan}
          disabled={isScanning || isRecoveringNames}
          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
          title="Scansiona tutti i prodotti non certificati"
        >
          {isScanning ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          <span className="hidden sm:inline">{isScanning ? `${scanProgress.current}/${scanProgress.total}` : 'Scansiona'}</span>
        </button>
        <button
          onClick={startNameRecovery}
          disabled={isRecoveringNames || isScanning}
          className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
          title="Recupera nomi prodotti dagli scontrini"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Recupera Nomi</span>
        </button>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          + Nuovo
        </button>
      </div>

      {/* Scan Progress */}
      {isScanning && scanProgress.total > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-blue-800 font-medium">Scansione prodotti non certificati...</span>
            <span className="text-blue-600">{scanProgress.current}/{scanProgress.total} {scanProgress.found > 0 && `(${scanProgress.found} trovati)`}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Cerca per nome, brand o barcode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full"
        />
        <div className="flex items-center gap-2">
          {/* Certification filter */}
          <select
            value={certificationFilter}
            onChange={(e) => setCertificationFilter(e.target.value as 'all' | 'certified' | 'uncertified')}
            className="input"
          >
            <option value="all">Tutti</option>
            <option value="certified">Certificati</option>
            <option value="uncertified">Non certificati</option>
          </select>

          {/* Category filter */}
          {categories.length > 0 && (
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="input flex-1"
            >
              <option value="">Tutte le categorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name || cat.tag_id} ({cat.product_count})
                </option>
              ))}
            </select>
          )}

          {/* Category manager button */}
          <button
            onClick={openCategoryManager}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Gestione Classi Prodotto"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Clear filters */}
          {(selectedCategoryId || certificationFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedCategoryId('')
                setCertificationFilter('all')
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Rimuovi filtri"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-gray-500 text-center py-8">Caricamento...</p>
      ) : products.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Nessun prodotto trovato</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className={`card p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 ${
                !isProductCertified(product) ? 'border-l-4 border-l-amber-400 bg-amber-50/50' : ''
              }`}
              onClick={() => { setImageLoaded(false); setEditingNotes(false); setNotesValue(product.user_notes || ''); setNewBarcodeValue(''); setViewingProduct(product); loadProductBarcodes(product.id) }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {product.name ? (
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                  ) : (
                    <p className="font-medium text-gray-900 font-mono">{product.barcode || '(senza barcode)'}</p>
                  )}
                  {!isProductCertified(product) && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                      Non certificato
                    </span>
                  )}
                </div>
                {product.name && product.barcode && (
                  <p className="text-sm text-gray-500 font-mono">
                    {product.barcode}
                  </p>
                )}
                {!product.name && product.brand && (
                  <p className="text-sm text-gray-500">{product.brand}</p>
                )}
                {product.user_notes && (
                  <p className="text-xs text-blue-600 italic truncate">{product.user_notes}</p>
                )}
              </div>
              <button
                onClick={(e) => openReportModal(e, product)}
                disabled={reportingId === product.id}
                className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Segnala dati errati"
              >
                {reportingId === product.id ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                  </svg>
                )}
              </button>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => { setViewingProduct(null); setFullscreenImage(null); setImageLoaded(false); setProductBarcodes([]) }}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b flex items-start gap-3 flex-shrink-0 ${!isProductCertified(viewingProduct) ? 'bg-amber-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {viewingProduct.name ? (
                    <h3 className="font-semibold text-lg text-gray-900">{viewingProduct.name}</h3>
                  ) : (
                    <h3 className="font-semibold text-lg text-gray-900 font-mono">{viewingProduct.barcode || '(senza barcode)'}</h3>
                  )}
                  {!isProductCertified(viewingProduct) && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                      Non certificato
                    </span>
                  )}
                </div>
                {viewingProduct.name && viewingProduct.barcode && (
                  <p className="text-sm text-gray-500 font-mono">{viewingProduct.barcode}</p>
                )}
              </div>
              <button
                onClick={() => { setViewingProduct(null); setFullscreenImage(null); setImageLoaded(false); setProductBarcodes([]) }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Product Image */}
              {viewingProduct.image_url && (
                <div className="flex justify-center">
                  {!imageLoaded && (
                    <div className="w-32 h-40 rounded-lg bg-gray-100 animate-pulse flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <img
                    src={viewingProduct.image_small_url || viewingProduct.image_url}
                    alt={viewingProduct.name || 'Prodotto'}
                    className={`max-h-48 rounded-lg object-contain cursor-pointer hover:opacity-80 transition-opacity ${!imageLoaded ? 'hidden' : ''}`}
                    onLoad={() => setImageLoaded(true)}
                    onClick={() => setFullscreenImage(viewingProduct.image_url)}
                  />
                </div>
              )}

              {/* Warning for uncertified products */}
              {!isProductCertified(viewingProduct) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <p className="font-medium">Prodotto non trovato su Open Food Facts</p>
                  <p className="text-amber-600 mt-1">I dati nutrizionali non sono disponibili. Puoi aggiungerli manualmente.</p>
                </div>
              )}

              {/* Info base */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informazioni</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Marca</span>
                    <span className="font-medium">{viewingProduct.brand || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quantità</span>
                    <span className="font-medium">{viewingProduct.quantity_text || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Categoria</span>
                    <span className="font-medium text-right max-w-[60%]">{viewingProduct.categories || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fonte dati</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${viewingProduct.source === 'not_found' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-700'}`}>{getSourceLabel(viewingProduct.source)}</span>
                  </div>
                  {viewingProduct.food_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Alimento collegato</span>
                      <span className="font-medium text-primary-600">{viewingProduct.food_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Composizione</span>
                    <span className="font-medium">
                      {viewingProduct.composition && viewingProduct.composition.length > 0
                        ? `${viewingProduct.composition.length} ingredienti`
                        : <span className="text-gray-400">Non definita</span>
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Barcodes */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Barcode</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {productBarcodes.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nessun barcode</p>
                  ) : (
                    productBarcodes.map((pb) => (
                      <div key={pb.id} className="flex items-center gap-2">
                        <span className="font-mono text-sm flex-1">{pb.barcode}</span>
                        {pb.is_primary ? (
                          <span className="text-xs text-amber-600 font-medium">★ primario</span>
                        ) : (
                          <button
                            onClick={() => handleSetBarcodePrimary(pb.id)}
                            className="text-xs text-gray-400 hover:text-amber-600"
                            title="Imposta come primario"
                          >
                            ☆
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBarcode(pb.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded"
                          title="Rimuovi barcode"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={newBarcodeValue}
                      onChange={(e) => setNewBarcodeValue(e.target.value)}
                      placeholder="Aggiungi barcode..."
                      className="input flex-1 text-sm py-1.5"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddBarcode() }}
                    />
                    <button
                      onClick={handleAddBarcode}
                      disabled={!newBarcodeValue.trim() || isAddingBarcode}
                      className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isAddingBarcode ? '...' : '+'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Commento utente */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Commento</h4>
                  {!editingNotes && (
                    <button
                      onClick={() => { setNotesValue(viewingProduct.user_notes || ''); setEditingNotes(true) }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {viewingProduct.user_notes ? 'Modifica' : 'Aggiungi'}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Es: Buona marca, Evitare, Preferito..."
                      className="input w-full text-sm"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNotes(); if (e.key === 'Escape') setEditingNotes(false) }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingNotes(false)}
                        className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="px-3 py-1 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingNotes ? 'Salvo...' : 'Salva'}
                      </button>
                    </div>
                  </div>
                ) : viewingProduct.user_notes ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800 italic">{viewingProduct.user_notes}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Nessun commento</p>
                )}
              </div>

              {/* Punteggi */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Punteggi</h4>
                <div className="flex gap-4">
                  <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Nutri-Score</p>
                    {viewingProduct.nutriscore ? (
                      <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold ${getNutriscoreColor(viewingProduct.nutriscore)}`}>
                        {viewingProduct.nutriscore.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Eco-Score</p>
                    {viewingProduct.ecoscore ? (
                      <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold ${getNutriscoreColor(viewingProduct.ecoscore)}`}>
                        {viewingProduct.ecoscore.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">NOVA</p>
                    {viewingProduct.nova_group ? (
                      <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold bg-gray-200 text-gray-700">
                        {viewingProduct.nova_group}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Valori nutrizionali */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valori Nutrizionali (per 100g)</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="font-medium text-gray-700">Energia</span>
                    <span className="font-semibold">{formatValue(viewingProduct.energy_kcal, ' kcal')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Proteine</span>
                    <span className="font-medium">{formatValue(viewingProduct.proteins_g, 'g')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Carboidrati</span>
                    <span className="font-medium">{formatValue(viewingProduct.carbs_g, 'g')}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-gray-400">di cui Zuccheri</span>
                    <span className="font-medium text-gray-600">{formatValue(viewingProduct.sugars_g, 'g')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Grassi</span>
                    <span className="font-medium">{formatValue(viewingProduct.fats_g, 'g')}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-gray-400">di cui Saturi</span>
                    <span className="font-medium text-gray-600">{formatValue(viewingProduct.saturated_fats_g, 'g')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Fibre</span>
                    <span className="font-medium">{formatValue(viewingProduct.fiber_g, 'g')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Sale</span>
                    <span className="font-medium">{formatValue(viewingProduct.salt_g, 'g')}</span>
                  </div>
                </div>
              </div>

              {/* Placeholder per futuri dati */}
              {/*
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Micronutrienti</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-400 text-center">
                  Dati non disponibili
                </div>
              </div>
              */}
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-3 flex-shrink-0">
              <button
                onClick={() => openEditModal(viewingProduct)}
                className="flex-1 py-2.5 px-3 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifica
              </button>
              <button
                onClick={() => setShowCompositionModal(true)}
                className="flex-1 py-2.5 px-3 text-sm font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Composizione
              </button>
              <button
                onClick={() => handleCancel(viewingProduct)}
                className="py-2.5 px-4 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">
                {editingProduct ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    disabled={!!editingProduct && isProductCertified(editingProduct)}
                    className="input flex-1 disabled:bg-gray-100"
                    autoFocus={!editingProduct}
                  />
                  {editingProduct && formData.barcode && formData.barcode.trim() !== '' && editingProduct.barcode !== null && (
                    <button
                      onClick={handleRefetchFromApi}
                      disabled={isFetching}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1 text-sm whitespace-nowrap"
                      title="Cerca dati prodotto nelle API esterne"
                    >
                      {isFetching ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                      Cerca API
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  autoFocus={!!editingProduct}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantita (es: 500g)</label>
                <input
                  type="text"
                  value={formData.quantity_text}
                  onChange={(e) => setFormData({ ...formData, quantity_text: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Energia (kcal/100g)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.energy_kcal}
                    onChange={(e) => setFormData({ ...formData, energy_kcal: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nutri-Score</label>
                  <select
                    value={formData.nutriscore}
                    onChange={(e) => setFormData({ ...formData, nutriscore: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">-</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name Recovery Modal */}
      {nameRecoveryProducts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="p-4 border-b bg-amber-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg text-gray-900">Recupero Nome Prodotto</h3>
                <span className="text-sm text-gray-500">
                  {currentRecoveryIndex + 1} di {nameRecoveryProducts.length}
                </span>
              </div>
              {recoveryStats && (
                <p className="text-sm text-amber-700 mt-1">
                  Trovati {recoveryStats.found} prodotti, {recoveryStats.updated} aggiornati automaticamente
                </p>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Barcode</p>
                <p className="font-mono text-lg font-medium">{nameRecoveryProducts[currentRecoveryIndex]?.barcode}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Quale descrizione vuoi usare per questo prodotto?
                </p>
                <div className="space-y-2">
                  {nameRecoveryProducts[currentRecoveryIndex]?.descriptions.map((desc, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleNameSelection(desc)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={cancelNameRecovery}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla tutto
              </button>
              <button
                onClick={skipCurrentProduct}
                className="flex-1 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
              >
                Salta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setReportModalProduct(null); setReportReason('') }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b bg-orange-50">
              <h3 className="font-semibold text-lg text-gray-900">Segnala Prodotto</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-700">
                Stai segnalando l'articolo <strong>{reportModalProduct.name || reportModalProduct.barcode}</strong>, per quale motivo?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inserisci una breve descrizione
                </label>
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Es: nome prodotto errato, dati nutrizionali sbagliati..."
                  className="input w-full"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && reportReason.trim()) submitReport() }}
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => { setReportModalProduct(null); setReportReason('') }}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason.trim() || isSubmittingReport}
                className="flex-1 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {isSubmittingReport ? 'Invio...' : 'Segnala'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={fullscreenImage}
            alt="Prodotto"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowCategoryManager(false)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg text-gray-900">Gestione Classi Prodotto</h3>
                <button
                  onClick={() => setShowCategoryManager(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                placeholder="Cerca classe..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="input w-full text-sm"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredManagerCategories.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">Nessuna classe trovata</p>
              ) : (
                <div className="divide-y">
                  {filteredManagerCategories.map((cat) => (
                    <div key={cat.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{cat.name || cat.tag_id}</p>
                        <p className="text-xs text-gray-500">{cat.product_count} prodotti</p>
                      </div>
                      <select
                        value={cat.default_area_id || ''}
                        onChange={(e) => handleCategoryAreaChange(cat.id, e.target.value || null)}
                        className="input text-sm py-1.5 w-40"
                      >
                        <option value="">-- Nessuna --</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Composition Modal */}
      {showCompositionModal && viewingProduct && (
        <CompositionModal
          product={viewingProduct}
          onClose={() => setShowCompositionModal(false)}
          onSaved={(updated) => {
            setShowCompositionModal(false)
            setViewingProduct(updated)
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
            showToast('Composizione salvata', 'success')
          }}
        />
      )}
    </div>
  )
}

export default AnagraficheProducts
