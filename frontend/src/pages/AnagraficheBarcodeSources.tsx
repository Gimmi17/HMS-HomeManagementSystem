import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import anagraficheService, { BarcodeLookupSource, BarcodeLookupSourceCreate } from '@/services/anagrafiche'

export function AnagraficheBarcodeSources() {
  const navigate = useNavigate()
  const [sources, setSources] = useState<BarcodeLookupSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    base_url: '',
    api_path: '/api/v2/product/{barcode}',
    sort_order: 0,
    description: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSources = async () => {
    try {
      const response = await anagraficheService.getBarcodeSources()
      setSources(response.sources)
    } catch (err) {
      console.error('Failed to fetch barcode sources:', err)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSources()
  }, [])

  const handleToggleCancelled = async (source: BarcodeLookupSource) => {
    try {
      if (source.cancelled) {
        await anagraficheService.restoreBarcodeSource(source.id)
        showToast(`${source.name} ripristinata`, 'success')
      } else {
        await anagraficheService.cancelBarcodeSource(source.id)
        showToast(`${source.name} disattivata`, 'success')
      }
      await fetchSources()
    } catch (err) {
      console.error('Failed to toggle source:', err)
      showToast('Errore durante l\'aggiornamento', 'error')
    }
  }

  const handleDelete = async (source: BarcodeLookupSource) => {
    if (source.is_hardcoded) {
      showToast('Le sorgenti predefinite non possono essere eliminate, solo disattivate', 'error')
      return
    }
    if (!confirm(`Eliminare "${source.name}"? Questa azione non puo essere annullata.`)) return

    try {
      await anagraficheService.deleteBarcodeSource(source.id)
      showToast('Sorgente eliminata', 'success')
      await fetchSources()
    } catch (err) {
      console.error('Failed to delete source:', err)
      showToast('Errore durante l\'eliminazione', 'error')
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newSources = [...sources]
    const temp = newSources[index]
    newSources[index] = newSources[index - 1]
    newSources[index - 1] = temp
    setSources(newSources)

    try {
      await anagraficheService.reorderBarcodeSources(newSources.map(s => s.id))
      await fetchSources()
    } catch (err) {
      console.error('Failed to reorder:', err)
      showToast('Errore durante il riordinamento', 'error')
      await fetchSources()
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index >= sources.length - 1) return
    const newSources = [...sources]
    const temp = newSources[index]
    newSources[index] = newSources[index + 1]
    newSources[index + 1] = temp
    setSources(newSources)

    try {
      await anagraficheService.reorderBarcodeSources(newSources.map(s => s.id))
      await fetchSources()
    } catch (err) {
      console.error('Failed to reorder:', err)
      showToast('Errore durante il riordinamento', 'error')
      await fetchSources()
    }
  }

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.code.trim() || !formData.base_url.trim()) {
      showToast('Nome, codice e URL base sono obbligatori', 'error')
      return
    }

    setIsSaving(true)
    try {
      const createData: BarcodeLookupSourceCreate = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        base_url: formData.base_url.trim(),
        api_path: formData.api_path.trim() || '/api/v2/product/{barcode}',
        sort_order: formData.sort_order || sources.length + 1,
        description: formData.description.trim() || undefined,
      }
      await anagraficheService.createBarcodeSource(createData)
      showToast('Sorgente creata', 'success')
      setShowAddForm(false)
      setFormData({
        name: '',
        code: '',
        base_url: '',
        api_path: '/api/v2/product/{barcode}',
        sort_order: 0,
        description: '',
      })
      await fetchSources()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Errore durante la creazione'
      showToast(detail, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-40 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/anagrafiche')}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Sorgenti Barcode</h1>
        </div>
        <button
          onClick={() => {
            setFormData({
              name: '',
              code: '',
              base_url: '',
              api_path: '/api/v2/product/{barcode}',
              sort_order: sources.length + 1,
              description: '',
            })
            setShowAddForm(true)
          }}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + Aggiungi
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Siti API per la ricerca prodotti tramite codice a barre. Le sorgenti vengono provate in ordine fino al primo risultato.
      </p>

      {/* Sources list */}
      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={source.id}
            className={`card p-4 border-2 transition-colors ${
              source.cancelled
                ? 'bg-gray-50 border-gray-200 opacity-60'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Order arrows */}
              <div className="flex flex-col gap-0.5 pt-0.5">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index >= sources.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Order number */}
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {index + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold ${source.cancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {source.name}
                  </span>
                  {source.is_hardcoded && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">
                      predefinita
                    </span>
                  )}
                  {source.cancelled && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-600 font-medium">
                      disattivata
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {source.base_url}{source.api_path}
                </p>
                {source.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{source.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleCancelled(source)}
                  className={`p-1.5 rounded ${
                    source.cancelled
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-orange-500 hover:bg-orange-50'
                  }`}
                  title={source.cancelled ? 'Ripristina' : 'Disattiva'}
                >
                  {source.cancelled ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                </button>
                {!source.is_hardcoded && (
                  <button
                    onClick={() => handleDelete(source)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    title="Elimina"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sources.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">Nessuna sorgente configurata</p>
        </div>
      )}

      {/* Info box */}
      <div className="card bg-blue-50 border-blue-100 p-4">
        <div className="flex gap-3">
          <span className="text-blue-500 text-xl flex-shrink-0">i</span>
          <div>
            <p className="text-sm text-blue-800 font-medium">
              Ordine di fallback
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Quando si cerca un barcode, le sorgenti vengono provate dall'alto verso il basso.
              La ricerca si ferma al primo risultato trovato. Le sorgenti disattivate vengono saltate.
            </p>
          </div>
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Nuova Sorgente Barcode</h3>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es: Open Pet Food Facts"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice identificativo *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="Es: openpetfoodfacts"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Base *</label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder="Es: https://world.openpetfoodfacts.org"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Path API</label>
                <input
                  type="text"
                  value={formData.api_path}
                  onChange={(e) => setFormData({ ...formData, api_path: e.target.value })}
                  placeholder="/api/v2/product/{barcode}"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Usa {'{barcode}'} come placeholder per il codice a barre</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione opzionale..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleAdd}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnagraficheBarcodeSources
