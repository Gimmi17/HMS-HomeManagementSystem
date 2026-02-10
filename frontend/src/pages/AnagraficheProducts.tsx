import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import anagraficheService, { ProductListItem, ProductCreateRequest, ProductUpdateRequest, ProductCategoryTag, UnnamedProductWithDescriptions } from '@/services/anagrafiche'

export function AnagraficheProducts() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Category filter
  const [categories, setCategories] = useState<ProductCategoryTag[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  // Certification filter: 'all' | 'certified' | 'uncertified'
  const [certificationFilter, setCertificationFilter] = useState<'all' | 'certified' | 'uncertified'>('all')

  // Detail modal
  const [viewingProduct, setViewingProduct] = useState<ProductListItem | null>(null)

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

  // Name recovery from receipts
  const [isRecoveringNames, setIsRecoveringNames] = useState(false)
  const [nameRecoveryProducts, setNameRecoveryProducts] = useState<UnnamedProductWithDescriptions[]>([])
  const [currentRecoveryIndex, setCurrentRecoveryIndex] = useState(0)
  const [recoveryStats, setRecoveryStats] = useState<{ found: number; updated: number } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
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
      barcode: product.barcode,
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
    if (!formData.barcode) return
    setIsSaving(true)
    try {
      const data = {
        barcode: formData.barcode,
        name: formData.name || undefined,
        brand: formData.brand || undefined,
        quantity_text: formData.quantity_text || undefined,
        energy_kcal: parseNumber(formData.energy_kcal),
        nutriscore: formData.nutriscore || undefined
      }

      if (editingProduct) {
        const { barcode, ...updateData } = data
        await anagraficheService.updateProduct(editingProduct.id, updateData as ProductUpdateRequest)
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
      const updated = await anagraficheService.refetchProduct(editingProduct.id)
      // Update form with fetched data
      setFormData({
        barcode: updated.barcode,
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
          onClick={startNameRecovery}
          disabled={isRecoveringNames}
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
              onClick={() => setViewingProduct(product)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {product.name ? (
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                  ) : (
                    <p className="font-medium text-gray-900 font-mono">{product.barcode}</p>
                  )}
                  {!isProductCertified(product) && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                      Non certificato
                    </span>
                  )}
                </div>
                {product.name && (
                  <p className="text-sm text-gray-500 font-mono">
                    {product.barcode}
                  </p>
                )}
                {!product.name && product.brand && (
                  <p className="text-sm text-gray-500">{product.brand}</p>
                )}
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setViewingProduct(null)}>
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
                    <h3 className="font-semibold text-lg text-gray-900 font-mono">{viewingProduct.barcode}</h3>
                  )}
                  {!isProductCertified(viewingProduct) && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                      Non certificato
                    </span>
                  )}
                </div>
                {viewingProduct.name && (
                  <p className="text-sm text-gray-500 font-mono">{viewingProduct.barcode}</p>
                )}
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">{viewingProduct.source}</span>
                  </div>
                </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    disabled={!!editingProduct}
                    className="input flex-1 disabled:bg-gray-100"
                    autoFocus={!editingProduct}
                  />
                  {editingProduct && formData.barcode && formData.barcode.trim() !== '' && (
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
                disabled={!formData.barcode || isSaving}
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
    </div>
  )
}

export default AnagraficheProducts
