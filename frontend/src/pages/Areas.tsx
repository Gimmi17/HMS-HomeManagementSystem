import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import areasService from '@/services/areas'
import type { Area, AreaType } from '@/types'

const TYPE_OPTIONS: { value: AreaType; label: string }[] = [
  { value: 'food_storage', label: 'Conservazione Cibo' },
  { value: 'equipment', label: 'Attrezzatura' },
  { value: 'general', label: 'Generale' },
]

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

interface AreaFormData {
  name: string
  icon: string
  area_type: AreaType
  description: string
  position: number
  expiry_extension_enabled: boolean
  disable_expiry_tracking: boolean
  warranty_tracking_enabled: boolean
  default_warranty_months: string
  trial_period_enabled: boolean
  default_trial_days: string
}

const emptyForm: AreaFormData = {
  name: '',
  icon: '',
  area_type: 'general',
  description: '',
  position: 0,
  expiry_extension_enabled: false,
  disable_expiry_tracking: false,
  warranty_tracking_enabled: false,
  default_warranty_months: '',
  trial_period_enabled: false,
  default_trial_days: '',
}

export function Areas() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()
  const [areas, setAreas] = useState<Area[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [formData, setFormData] = useState<AreaFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  const loadAreas = async () => {
    if (!currentHouse) return
    setIsLoading(true)
    try {
      const response = await areasService.getAll(currentHouse.id)
      setAreas(response.areas)
    } catch (error) {
      console.error('Failed to load areas:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAreas()
  }, [currentHouse])

  const openCreateModal = () => {
    setEditingArea(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (area: Area, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingArea(area)
    setFormData({
      name: area.name,
      icon: area.icon || '',
      area_type: area.area_type,
      description: area.description || '',
      position: area.position,
      expiry_extension_enabled: area.expiry_extension_enabled,
      disable_expiry_tracking: area.disable_expiry_tracking,
      warranty_tracking_enabled: area.warranty_tracking_enabled,
      default_warranty_months: area.default_warranty_months != null ? String(area.default_warranty_months) : '',
      trial_period_enabled: area.trial_period_enabled,
      default_trial_days: area.default_trial_days != null ? String(area.default_trial_days) : '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingArea(null)
    setFormData(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouse) return
    if (!formData.name.trim()) return

    setIsSaving(true)
    try {
      const data = {
        name: formData.name.trim(),
        icon: formData.icon.trim() || undefined,
        area_type: formData.area_type,
        description: formData.description.trim() || undefined,
        position: formData.position,
        expiry_extension_enabled: formData.expiry_extension_enabled,
        disable_expiry_tracking: formData.disable_expiry_tracking,
        warranty_tracking_enabled: formData.warranty_tracking_enabled,
        default_warranty_months: formData.default_warranty_months ? parseInt(formData.default_warranty_months) : null,
        trial_period_enabled: formData.trial_period_enabled,
        default_trial_days: formData.default_trial_days ? parseInt(formData.default_trial_days) : null,
      }

      if (editingArea) {
        await areasService.update(editingArea.id, currentHouse.id, data)
      } else {
        await areasService.create(currentHouse.id, data)
      }

      closeModal()
      loadAreas()
    } catch (error) {
      console.error('Failed to save area:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSeed = async () => {
    if (!currentHouse) return
    setIsSeeding(true)
    try {
      const result = await areasService.seed(currentHouse.id)
      alert(result.message)
      loadAreas()
    } catch (error) {
      console.error('Failed to seed areas:', error)
      alert('Errore durante l\'inizializzazione')
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex-1">Aree</h1>
        <button
          onClick={openCreateModal}
          className="btn btn-primary text-sm px-3 py-2"
        >
          + Nuovo
        </button>
      </div>

      {/* Content */}
      {!currentHouse ? (
        <p className="text-gray-500 text-sm">Seleziona una casa per gestire le aree</p>
      ) : isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : areas.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Nessuna area configurata</p>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="btn btn-secondary text-sm mx-auto"
            >
              {isSeeding ? 'Inizializzazione...' : 'Inizializza aree predefinite'}
            </button>
            <span className="text-xs text-gray-400">oppure</span>
            <button
              onClick={openCreateModal}
              className="btn btn-primary text-sm mx-auto"
            >
              Aggiungi manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {areas.map((area) => (
            <div
              key={area.id}
              onClick={() => navigate(`/areas/${area.id}`)}
              className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <span className="text-3xl">{area.icon || '📦'}</span>
                <h3 className="font-semibold text-sm">{area.name}</h3>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {area.item_count} articoli
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[area.area_type]}`}>
                    {TYPE_LABELS[area.area_type]}
                  </span>
                </div>
                {!area.is_default && (
                  <button
                    onClick={(e) => openEditModal(area, e)}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                  >
                    Modifica
                  </button>
                )}
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
                  {editingArea ? 'Modifica Area' : 'Nuova Area'}
                </h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="label text-xs">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="es. Borsa Attrezzi, Garage..."
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="label text-xs">Icona (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="es. 🔧, 🏠, ❄️"
                    className="input w-full"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="label text-xs">Tipo</label>
                  <select
                    value={formData.area_type}
                    onChange={(e) => setFormData({ ...formData, area_type: e.target.value as AreaType })}
                    className="input w-full"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Descrizione</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrizione opzionale..."
                    className="input w-full"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="label text-xs">Posizione (ordinamento)</label>
                  <input
                    type="number"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                    min={0}
                  />
                </div>

                {/* Regole / Policies */}
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
                        <p className="text-xs text-gray-500">L'utente sceglie di quanti giorni estendere quando inserisce un articolo</p>
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
                        <p className="text-xs text-gray-500">Gli articoli non generano notifiche di scadenza</p>
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
                        <div>
                          <span className="text-sm font-medium">Tracciamento garanzia</span>
                        </div>
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
                        <div>
                          <span className="text-sm font-medium">Periodo di prova/reso</span>
                        </div>
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
    </div>
  )
}

export default Areas
