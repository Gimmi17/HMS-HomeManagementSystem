import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import environmentsService from '@/services/environments'
import dispensaService from '@/services/dispensa'
import categoriesService from '@/services/categories'
import { useDebounce } from '@/hooks/useDebounce'
import type { Environment, EnvironmentExpenseStats, DispensaItem, DispensaStats, Category, EnvironmentType, EnvironmentUpdate } from '@/types'

const TYPE_COLORS: Record<EnvironmentType, string> = {
  food_storage: 'bg-green-100 text-green-800',
  equipment: 'bg-orange-100 text-orange-800',
  general: 'bg-blue-100 text-blue-800',
}

const TYPE_LABELS: Record<EnvironmentType, string> = {
  food_storage: 'Cibo',
  equipment: 'Attrezzatura',
  general: 'Generale',
}

export function EnvironmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentHouse } = useHouse()

  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [items, setItems] = useState<DispensaItem[]>([])
  const [stats, setStats] = useState<DispensaStats>({ total: 0, expiring_soon: 0, expired: 0 })
  const [expenseStats, setExpenseStats] = useState<EnvironmentExpenseStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery)

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
  })

  // Edit environment modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', icon: '', description: '' })

  // Delete environment
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const loadData = async () => {
    if (!currentHouse || !id) return
    setIsLoading(true)
    try {
      const [envsResponse, itemsResponse, catsResponse] = await Promise.all([
        environmentsService.getAll(currentHouse.id),
        dispensaService.getItems(currentHouse.id, {
          environment_id: id,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        }),
        categoriesService.getAll(currentHouse.id),
      ])

      const env = envsResponse.environments.find(e => e.id === id)
      setEnvironment(env || null)
      setItems(itemsResponse.items)
      setStats(itemsResponse.stats)
      setCategories(catsResponse.categories)

      // Load expense stats
      const expStats = await environmentsService.getStats(id, currentHouse.id)
      setExpenseStats(expStats)
    } catch (error) {
      console.error('Failed to load environment data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentHouse, id, debouncedSearch])

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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouse || !id || !newItem.name.trim()) return

    setIsSaving(true)
    try {
      await dispensaService.createItem(currentHouse.id, {
        name: newItem.name.trim(),
        quantity: newItem.quantity,
        unit: newItem.unit.trim() || undefined,
        category_id: newItem.category_id || undefined,
        expiry_date: newItem.expiry_date || undefined,
        purchase_price: newItem.purchase_price ? parseFloat(newItem.purchase_price) : undefined,
        environment_id: id,
        notes: newItem.notes.trim() || undefined,
      })
      setShowAddModal(false)
      setNewItem({ name: '', quantity: 1, unit: '', category_id: '', expiry_date: '', purchase_price: '', notes: '' })
      loadData()
    } catch (error) {
      console.error('Failed to add item:', error)
      alert('Errore durante l\'aggiunta')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConsumeItem = async (itemId: string) => {
    if (!currentHouse) return
    try {
      await dispensaService.consumeItem(currentHouse.id, itemId)
      loadData()
    } catch (error) {
      console.error('Failed to consume item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!currentHouse) return
    try {
      await dispensaService.deleteItem(currentHouse.id, itemId)
      loadData()
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const handleEditEnvironment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouse || !id) return

    try {
      const data: EnvironmentUpdate = {}
      if (editForm.name.trim()) data.name = editForm.name.trim()
      if (editForm.icon.trim()) data.icon = editForm.icon.trim()
      if (editForm.description.trim()) data.description = editForm.description.trim()

      await environmentsService.update(id, currentHouse.id, data)
      setShowEditModal(false)
      loadData()
    } catch (error) {
      console.error('Failed to update environment:', error)
      alert('Errore durante l\'aggiornamento')
    }
  }

  const handleDeleteEnvironment = async () => {
    if (!currentHouse || !id) return
    try {
      await environmentsService.delete(id, currentHouse.id)
      navigate('/environments')
    } catch (error: unknown) {
      console.error('Failed to delete environment:', error)
      const apiError = error as { response?: { data?: { detail?: string } } }
      alert(apiError.response?.data?.detail || 'Errore durante l\'eliminazione')
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return <p className="text-gray-500 text-sm">Caricamento...</p>
  }

  if (!environment) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/environments')} className="text-sm text-primary-600 hover:underline">
          &larr; Torna agli ambienti
        </button>
        <p className="text-gray-500">Ambiente non trovato</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/environments')}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{environment.icon || '📦'}</span>
            <h1 className="text-xl font-bold text-gray-900 truncate">{environment.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[environment.env_type]}`}>
              {TYPE_LABELS[environment.env_type]}
            </span>
          </div>
          {environment.description && (
            <p className="text-sm text-gray-500 mt-1">{environment.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setEditForm({
                name: environment.name,
                icon: environment.icon || '',
                description: environment.description || '',
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
          {!environment.is_default && (
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
          {/* Total */}
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Totale Speso</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {expenseStats.total_spent.toFixed(2)} EUR
            </p>
          </div>

          {/* By Category */}
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
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${maxCategoryTotal > 0 ? (cat.total / maxCategoryTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Month */}
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
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${maxMonthTotal > 0 ? (month.total / maxMonthTotal) * 100 : 0}%` }}
                      />
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
          <h2 className="text-base font-semibold text-gray-800 flex-1">
            Articoli ({stats.total})
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm px-3 py-1.5"
          >
            + Aggiungi
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca articoli..."
          className="input w-full"
        />

        {/* Items List */}
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nessun articolo in questo ambiente</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="card p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      <span className="text-xs text-gray-500">
                        {item.quantity} {item.unit || 'pz'}
                      </span>
                      {item.purchase_price != null && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          {item.purchase_price.toFixed(2)} EUR
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.expiry_date && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isExpired(item.expiry_date)
                            ? 'bg-red-100 text-red-700'
                            : isExpiring(item.expiry_date)
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          Scad. {item.expiry_date}
                        </span>
                      )}
                      {item.notes && (
                        <span className="text-xs text-gray-400 truncate">{item.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {environment.env_type === 'food_storage' && (
                      <button
                        onClick={() => handleConsumeItem(item.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Consuma"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Elimina"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddItem}>
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Aggiungi Articolo</h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="label text-xs">Nome *</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Nome articolo..."
                    className="input w-full"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Quantita'</label>
                    <input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 1 })}
                      className="input w-full"
                      min={0.01}
                      step={0.01}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Unita'</label>
                    <input
                      type="text"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      placeholder="pz, kg, g..."
                      className="input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Categoria</label>
                  <select
                    value={newItem.category_id}
                    onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Nessuna</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {environment.env_type === 'food_storage' && (
                  <div>
                    <label className="label text-xs">Scadenza</label>
                    <input
                      type="date"
                      value={newItem.expiry_date}
                      onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="label text-xs">Prezzo di acquisto (EUR)</label>
                  <input
                    type="number"
                    value={newItem.purchase_price}
                    onChange={(e) => setNewItem({ ...newItem, purchase_price: e.target.value })}
                    placeholder="0.00"
                    className="input w-full"
                    min={0}
                    step={0.01}
                  />
                </div>

                <div>
                  <label className="label text-xs">Note</label>
                  <textarea
                    value={newItem.notes}
                    onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                    placeholder="Note opzionali..."
                    className="input w-full"
                    rows={2}
                  />
                </div>
              </div>

              <div className="p-4 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary flex-1 text-sm"
                >
                  {isSaving ? 'Salvataggio...' : 'Aggiungi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Environment Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <form onSubmit={handleEditEnvironment}>
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Modifica Ambiente</h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="label text-xs">Nome</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="label text-xs">Icona</label>
                  <input
                    type="text"
                    value={editForm.icon}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    className="input w-full"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="label text-xs">Descrizione</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="input w-full"
                    rows={2}
                  />
                </div>
              </div>

              <div className="p-4 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 text-sm"
                >
                  Salva
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
                <h3 className="font-semibold">Elimina Ambiente</h3>
                <p className="text-sm text-gray-500">{environment.name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Sei sicuro di voler eliminare questo ambiente? L'operazione non puo' essere annullata.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary flex-1 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteEnvironment}
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

export default EnvironmentDetail
