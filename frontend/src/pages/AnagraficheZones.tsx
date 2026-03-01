import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import areasService from '@/services/areas'
import type { Area, AreaType } from '@/types'

const TYPE_OPTIONS: { value: AreaType; label: string }[] = [
  { value: 'food_storage', label: 'Cibo' },
  { value: 'equipment', label: 'Attrezzatura' },
  { value: 'general', label: 'Generale' },
]

const TYPE_COLORS: Record<AreaType, string> = {
  food_storage: 'bg-green-100 text-green-800',
  equipment: 'bg-orange-100 text-orange-800',
  general: 'bg-blue-100 text-blue-800',
}

export function AnagraficheZones() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()
  const [zones, setZones] = useState<Area[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingZone, setEditingZone] = useState<Area | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    area_type: 'food_storage' as AreaType,
    description: '',
    expiry_extension_enabled: false,
    disable_expiry_tracking: false,
    warranty_tracking_enabled: false,
    default_warranty_months: '',
    trial_period_enabled: false,
    default_trial_days: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchZones = async () => {
    if (!currentHouse) return
    try {
      const response = await areasService.getAll(currentHouse.id)
      let filtered = response.areas
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(a => a.name.toLowerCase().includes(q))
      }
      setZones(filtered)
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to fetch zones:', err)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchZones()
  }, [currentHouse, searchQuery])

  const openCreateModal = () => {
    setEditingZone(null)
    setFormData({
      name: '',
      icon: '',
      area_type: 'food_storage',
      description: '',
      expiry_extension_enabled: false,
      disable_expiry_tracking: false,
      warranty_tracking_enabled: false,
      default_warranty_months: '',
      trial_period_enabled: false,
      default_trial_days: '',
    })
    setShowEditModal(true)
  }

  const openEditModal = (zone: Area) => {
    setEditingZone(zone)
    setFormData({
      name: zone.name,
      icon: zone.icon || '',
      area_type: zone.area_type,
      description: zone.description || '',
      expiry_extension_enabled: zone.expiry_extension_enabled,
      disable_expiry_tracking: zone.disable_expiry_tracking,
      warranty_tracking_enabled: zone.warranty_tracking_enabled,
      default_warranty_months: zone.default_warranty_months != null ? String(zone.default_warranty_months) : '',
      trial_period_enabled: zone.trial_period_enabled,
      default_trial_days: zone.default_trial_days != null ? String(zone.default_trial_days) : '',
    })
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!currentHouse || !formData.name.trim()) return
    setIsSaving(true)
    try {
      const data = {
        name: formData.name.trim(),
        icon: formData.icon.trim() || undefined,
        area_type: formData.area_type,
        description: formData.description.trim() || undefined,
        expiry_extension_enabled: formData.expiry_extension_enabled,
        disable_expiry_tracking: formData.disable_expiry_tracking,
        warranty_tracking_enabled: formData.warranty_tracking_enabled,
        default_warranty_months: formData.default_warranty_months ? parseInt(formData.default_warranty_months) : null,
        trial_period_enabled: formData.trial_period_enabled,
        default_trial_days: formData.default_trial_days ? parseInt(formData.default_trial_days) : null,
      }
      if (editingZone) {
        await areasService.update(editingZone.id, currentHouse.id, data)
        showToast('Zona aggiornata', 'success')
      } else {
        await areasService.create(currentHouse.id, data)
        showToast('Zona creata', 'success')
      }
      setShowEditModal(false)
      fetchZones()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (zone: Area) => {
    if (!currentHouse) return
    if (!confirm(`Eliminare la zona "${zone.name}"?`)) return
    try {
      await areasService.delete(zone.id, currentHouse.id)
      showToast('Zona eliminata', 'success')
      fetchZones()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore nell\'eliminazione', 'error')
    }
  }

  const handleSeed = async () => {
    if (!currentHouse) return
    try {
      const result = await areasService.seed(currentHouse.id)
      showToast(`${result.areas_created} zone create, ${result.items_assigned} articoli assegnati`, 'success')
      fetchZones()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nessuna casa selezionata</p>
      </div>
    )
  }

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
          <h1 className="text-xl font-bold text-gray-900">Gestione Zone</h1>
          <p className="text-sm text-gray-500">{total} zone</p>
        </div>
        <button
          onClick={handleSeed}
          className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          Seed
        </button>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          + Nuova
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca zone..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input w-full"
      />

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Caricamento...</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchQuery ? 'Nessuna zona trovata' : 'Nessuna zona presente'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="card p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openEditModal(zone)}
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">{zone.icon || '📦'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{zone.name}</p>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[zone.area_type]}`}>
                    {TYPE_OPTIONS.find(t => t.value === zone.area_type)?.label}
                  </span>
                  {zone.is_default && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Default</span>
                  )}
                </div>
                {zone.description && (
                  <p className="text-xs text-gray-500 truncate">{zone.description}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600 flex-shrink-0">
                {zone.item_count} articoli
              </span>
              {!zone.is_default && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(zone)
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg text-gray-900">
                {editingZone ? 'Modifica Zona' : 'Nuova Zona'}
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
                  placeholder="Es. Frigorifero"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icona</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="input w-full"
                    placeholder="🧊"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={formData.area_type}
                    onChange={(e) => setFormData({ ...formData, area_type: e.target.value as AreaType })}
                    className="input w-full"
                  >
                    {TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Descrizione opzionale..."
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Regole</h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.expiry_extension_enabled}
                      onChange={(e) => setFormData({ ...formData, expiry_extension_enabled: e.target.checked })}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">Estensione scadenza</span>
                      <p className="text-xs text-gray-500">L'utente sceglie di quanti giorni estendere</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.disable_expiry_tracking}
                      onChange={(e) => setFormData({ ...formData, disable_expiry_tracking: e.target.checked })}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">Disabilita tracciamento scadenze</span>
                      <p className="text-xs text-gray-500">Gli articoli non generano notifiche</p>
                    </div>
                  </label>
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.warranty_tracking_enabled}
                        onChange={(e) => setFormData({ ...formData, warranty_tracking_enabled: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span className="text-sm font-medium">Tracciamento garanzia</span>
                    </label>
                    {formData.warranty_tracking_enabled && (
                      <div className="ml-6 mt-1">
                        <label className="text-xs text-gray-500">Durata predefinita (mesi)</label>
                        <input
                          type="number"
                          value={formData.default_warranty_months}
                          onChange={(e) => setFormData({ ...formData, default_warranty_months: e.target.value })}
                          placeholder="es. 24"
                          className="input w-full mt-0.5"
                          min={1}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.trial_period_enabled}
                        onChange={(e) => setFormData({ ...formData, trial_period_enabled: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span className="text-sm font-medium">Periodo di prova/reso</span>
                    </label>
                    {formData.trial_period_enabled && (
                      <div className="ml-6 mt-1">
                        <label className="text-xs text-gray-500">Durata predefinita (giorni)</label>
                        <input
                          type="number"
                          value={formData.default_trial_days}
                          onChange={(e) => setFormData({ ...formData, default_trial_days: e.target.value })}
                          placeholder="es. 30"
                          className="input w-full mt-0.5"
                          min={1}
                        />
                      </div>
                    )}
                  </div>
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
                disabled={isSaving || !formData.name.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
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

export default AnagraficheZones
