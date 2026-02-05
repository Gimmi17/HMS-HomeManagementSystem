import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import storesService from '@/services/stores'
import type { Store, StoreSize } from '@/types'

const SIZE_OPTIONS: { value: StoreSize; label: string }[] = [
  { value: 'S', label: 'S - Piccolo' },
  { value: 'M', label: 'M - Medio' },
  { value: 'L', label: 'L - Grande' },
  { value: 'XL', label: 'XL - Molto Grande' },
  { value: 'XXL', label: 'XXL - Ipermercato' },
]

const SIZE_COLORS: Record<StoreSize, string> = {
  S: 'bg-blue-100 text-blue-800',
  M: 'bg-green-100 text-green-800',
  L: 'bg-yellow-100 text-yellow-800',
  XL: 'bg-orange-100 text-orange-800',
  XXL: 'bg-red-100 text-red-800',
}

interface StoreFormData {
  chain: string
  name: string
  address: string
  country: string
  size: StoreSize | ''
}

const emptyForm: StoreFormData = {
  chain: '',
  name: '',
  address: '',
  country: 'Italia',
  size: '',
}

export function Stores() {
  const [stores, setStores] = useState<Store[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [formData, setFormData] = useState<StoreFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Store | null>(null)

  const loadStores = async () => {
    setIsLoading(true)
    try {
      const response = await storesService.getAll()
      setStores(response.stores)
    } catch (error) {
      console.error('Failed to load stores:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  const openCreateModal = () => {
    setEditingStore(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (store: Store) => {
    setEditingStore(store)
    setFormData({
      chain: store.chain || '',
      name: store.name,
      address: store.address || '',
      country: store.country || 'Italia',
      size: store.size || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStore(null)
    setFormData(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('Il nome del negozio è obbligatorio')
      return
    }

    setIsSaving(true)
    try {
      const data = {
        chain: formData.chain.trim() || undefined,
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        country: formData.country.trim() || undefined,
        size: formData.size || undefined,
      }

      if (editingStore) {
        await storesService.update(editingStore.id, data)
      } else {
        await storesService.create(data)
      }

      closeModal()
      loadStores()
    } catch (error) {
      console.error('Failed to save store:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (store: Store) => {
    try {
      await storesService.delete(store.id)
      setShowDeleteConfirm(null)
      loadStores()
    } catch (error) {
      console.error('Failed to delete store:', error)
      alert('Errore durante l\'eliminazione. Potrebbe essere in uso.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Gestione Negozi</h1>
        <button
          onClick={openCreateModal}
          className="btn btn-primary text-sm px-3 py-2"
        >
          + Nuovo
        </button>
      </div>

      {/* Stores List */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : stores.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Nessun negozio configurato</p>
          <button
            onClick={openCreateModal}
            className="btn btn-primary mt-4 text-sm"
          >
            Aggiungi il primo negozio
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div
              key={store.id}
              className="card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {store.chain && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                        {store.chain}
                      </span>
                    )}
                    <h3 className="font-semibold text-base">{store.name}</h3>
                    {store.size && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SIZE_COLORS[store.size]}`}>
                        {store.size}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {store.country && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {store.country}
                      </span>
                    )}
                    {store.address && (
                      <span className="truncate">{store.address}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(store)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="Modifica"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(store)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Elimina"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <form onSubmit={handleSubmit}>
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">
                  {editingStore ? 'Modifica Negozio' : 'Nuovo Negozio'}
                </h3>
              </div>

              <div className="p-4 space-y-4">
                {/* Chain */}
                <div>
                  <label className="label text-xs">Catena</label>
                  <input
                    type="text"
                    value={formData.chain}
                    onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                    placeholder="es. Esselunga, Lidl, Conad..."
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nome della catena di supermercati
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="label text-xs">Nome Negozio *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="es. Via Roma, Centro Commerciale..."
                    className="input w-full"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Identificativo del punto vendita
                  </p>
                </div>

                {/* Country */}
                <div>
                  <label className="label text-xs">Paese</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="es. Italia, Svizzera..."
                    className="input w-full"
                  />
                </div>

                {/* Size */}
                <div>
                  <label className="label text-xs">Dimensione</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value as StoreSize | '' })}
                    className="input w-full"
                  >
                    <option value="">Seleziona dimensione</option>
                    {SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div>
                  <label className="label text-xs">Indirizzo (opzionale)</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Via, numero civico, città..."
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="p-4 border-t flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary flex-1 text-sm"
                >
                  {isSaving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Elimina Negozio</h3>
                <p className="text-sm text-gray-500">
                  {showDeleteConfirm.display_name}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Sei sicuro di voler eliminare questo negozio? L'operazione non può essere annullata.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn-secondary flex-1 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1 text-sm"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Stores
