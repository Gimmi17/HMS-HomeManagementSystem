import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import anagraficheService from '@/services/anagrafiche'
import type { BrandListItem, BrandCreateRequest, BrandUpdateRequest, BrandExtractionProposal } from '@/services/anagrafiche'

export function AnagraficheBrands() {
  const navigate = useNavigate()
  const [brands, setBrands] = useState<BrandListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandListItem | null>(null)
  const [formData, setFormData] = useState({ name: '', notes: '' })
  const [isSaving, setIsSaving] = useState(false)

  // Extract modal states
  const [showExtractModal, setShowExtractModal] = useState(false)
  const [proposals, setProposals] = useState<BrandExtractionProposal[]>([])
  const [editedProposals, setEditedProposals] = useState<Map<string, { brand: string; name: string }>>(new Map())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchBrands = async () => {
    try {
      const response = await anagraficheService.getBrands(
        searchQuery ? { search: searchQuery } : undefined
      )
      setBrands(response.brands)
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to fetch brands:', err)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBrands()
  }, [searchQuery])

  const openCreateModal = () => {
    setEditingBrand(null)
    setFormData({ name: '', notes: '' })
    setShowEditModal(true)
  }

  const openEditModal = (brand: BrandListItem) => {
    setEditingBrand(brand)
    setFormData({
      name: brand.name,
      notes: brand.notes || '',
    })
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    setIsSaving(true)
    try {
      if (editingBrand) {
        const data: BrandUpdateRequest = {
          name: formData.name.trim(),
          notes: formData.notes.trim() || undefined,
        }
        await anagraficheService.updateBrand(editingBrand.id, data)
        showToast('Brand aggiornato', 'success')
      } else {
        const data: BrandCreateRequest = {
          name: formData.name.trim(),
          notes: formData.notes.trim() || undefined,
        }
        await anagraficheService.createBrand(data)
        showToast('Brand creato', 'success')
      }
      setShowEditModal(false)
      fetchBrands()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (brand: BrandListItem) => {
    if (!confirm(`Eliminare il brand "${brand.name}"?`)) return
    try {
      await anagraficheService.deleteBrand(brand.id)
      showToast('Brand eliminato', 'success')
      fetchBrands()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  // --- Extract Brand handlers ---

  const handleExtractBrands = async () => {
    setShowExtractModal(true)
    setIsScanning(true)
    setEditedProposals(new Map())
    setDismissedIds(new Set())
    try {
      const response = await anagraficheService.getBrandExtractionProposals()
      setProposals(response.proposals)
    } catch (err) {
      console.error('Failed to get extraction proposals:', err)
      showToast('Errore nella scansione', 'error')
    } finally {
      setIsScanning(false)
    }
  }

  const getProposalValues = (p: BrandExtractionProposal) => {
    const edited = editedProposals.get(p.product_id)
    return {
      brand: edited?.brand ?? p.detected_brand,
      name: edited?.name ?? p.proposed_clean_name,
    }
  }

  const updateProposal = (productId: string, field: 'brand' | 'name', value: string) => {
    setEditedProposals(prev => {
      const next = new Map(prev)
      const current = next.get(productId)
      const proposal = proposals.find(p => p.product_id === productId)
      if (!proposal) return prev
      next.set(productId, {
        brand: field === 'brand' ? value : (current?.brand ?? proposal.detected_brand),
        name: field === 'name' ? value : (current?.name ?? proposal.proposed_clean_name),
      })
      return next
    })
  }

  const handleConfirmOne = async (p: BrandExtractionProposal) => {
    const values = getProposalValues(p)
    if (!values.brand.trim() || !values.name.trim()) return
    try {
      await anagraficheService.applyBrandExtraction([{
        product_id: p.product_id,
        brand_name: values.brand.trim(),
        new_product_name: values.name.trim(),
      }])
      setProposals(prev => prev.filter(x => x.product_id !== p.product_id))
      showToast('Brand estratto', 'success')
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  const handleConfirmAll = async () => {
    const activeProposals = proposals.filter(p => !dismissedIds.has(p.product_id))
    if (activeProposals.length === 0) return
    setIsApplying(true)
    try {
      const items = activeProposals.map(p => {
        const values = getProposalValues(p)
        return {
          product_id: p.product_id,
          brand_name: values.brand.trim(),
          new_product_name: values.name.trim(),
        }
      })
      const result = await anagraficheService.applyBrandExtraction(items)
      showToast(`${result.applied} brand estratti`, 'success')
      setShowExtractModal(false)
      fetchBrands()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    } finally {
      setIsApplying(false)
    }
  }

  const handleDismissOne = (productId: string) => {
    setDismissedIds(prev => new Set(prev).add(productId))
  }

  const activeProposalCount = proposals.filter(p => !dismissedIds.has(p.product_id)).length

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/anagrafiche')}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Gestione Brand</h1>
          <p className="text-sm text-gray-500">{total} brand</p>
        </div>
        <button
          onClick={handleExtractBrands}
          className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          Estrai Brand
        </button>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          + Nuovo
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca brand..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input w-full"
      />

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Caricamento...</div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchQuery ? 'Nessun brand trovato' : 'Nessun brand presente'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className="card p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openEditModal(brand)}
            >
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="text-teal-700 font-bold text-lg">
                  {brand.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{brand.name}</p>
                {brand.notes && (
                  <p className="text-xs text-gray-500 truncate">{brand.notes}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600 flex-shrink-0">
                {brand.product_count} prodotti
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(brand)
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg text-gray-900">
                {editingBrand ? 'Modifica Brand' : 'Nuovo Brand'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="Es. Barilla"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input w-full"
                  placeholder="Note opzionali..."
                />
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
                disabled={isSaving || !formData.name.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extract Brand Modal */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex-shrink-0">
              <h3 className="font-semibold text-lg text-gray-900">
                Estrai Brand dai Prodotti
              </h3>
              <p className="text-sm text-gray-500">
                {isScanning ? 'Scansione in corso...' : `${activeProposalCount} proposte trovate`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isScanning ? (
                <div className="text-center py-12 text-gray-500">Scansione prodotti...</div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nessun prodotto con pattern "BRAND - Prodotto" trovato</p>
                </div>
              ) : (
                proposals.map(p => {
                  if (dismissedIds.has(p.product_id)) return null
                  const values = getProposalValues(p)
                  return (
                    <div key={p.product_id} className="border rounded-lg p-3 space-y-2">
                      <p className="text-xs text-gray-400 truncate">{p.original_name}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={values.brand}
                          onChange={(e) => updateProposal(p.product_id, 'brand', e.target.value)}
                          className="input w-32 text-sm flex-shrink-0"
                        />
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <input
                          type="text"
                          value={values.name}
                          onChange={(e) => updateProposal(p.product_id, 'name', e.target.value)}
                          className="input flex-1 text-sm"
                        />
                        <button
                          onClick={() => handleConfirmOne(p)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0"
                          title="Conferma"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDismissOne(p.product_id)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0"
                          title="Ignora"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="p-4 border-t flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowExtractModal(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Chiudi
              </button>
              <button
                onClick={handleConfirmAll}
                disabled={isApplying || activeProposalCount === 0}
                className="flex-1 py-2.5 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {isApplying ? 'Applicazione...' : `Conferma Tutti (${activeProposalCount})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 left-4 right-4 z-50 p-3 rounded-lg shadow-lg text-white text-center text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default AnagraficheBrands
