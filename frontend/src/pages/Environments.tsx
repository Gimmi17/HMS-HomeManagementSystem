import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import environmentsService from '@/services/environments'
import type { Environment, EnvironmentType } from '@/types'

const TYPE_OPTIONS: { value: EnvironmentType; label: string }[] = [
  { value: 'food_storage', label: 'Conservazione Cibo' },
  { value: 'equipment', label: 'Attrezzatura' },
  { value: 'general', label: 'Generale' },
]

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

interface EnvFormData {
  name: string
  icon: string
  env_type: EnvironmentType
  description: string
  position: number
}

const emptyForm: EnvFormData = {
  name: '',
  icon: '',
  env_type: 'general',
  description: '',
  position: 0,
}

export function Environments() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [formData, setFormData] = useState<EnvFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  const loadEnvironments = async () => {
    if (!currentHouse) return
    setIsLoading(true)
    try {
      const response = await environmentsService.getAll(currentHouse.id)
      setEnvironments(response.environments)
    } catch (error) {
      console.error('Failed to load environments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEnvironments()
  }, [currentHouse])

  const openCreateModal = () => {
    setEditingEnv(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (env: Environment, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEnv(env)
    setFormData({
      name: env.name,
      icon: env.icon || '',
      env_type: env.env_type,
      description: env.description || '',
      position: env.position,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingEnv(null)
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
        env_type: formData.env_type,
        description: formData.description.trim() || undefined,
        position: formData.position,
      }

      if (editingEnv) {
        await environmentsService.update(editingEnv.id, currentHouse.id, data)
      } else {
        await environmentsService.create(currentHouse.id, data)
      }

      closeModal()
      loadEnvironments()
    } catch (error) {
      console.error('Failed to save environment:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSeed = async () => {
    if (!currentHouse) return
    setIsSeeding(true)
    try {
      const result = await environmentsService.seed(currentHouse.id)
      alert(result.message)
      loadEnvironments()
    } catch (error) {
      console.error('Failed to seed environments:', error)
      alert('Errore durante l\'inizializzazione')
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex-1">Ambienti</h1>
        <button
          onClick={openCreateModal}
          className="btn btn-primary text-sm px-3 py-2"
        >
          + Nuovo
        </button>
      </div>

      {/* Content */}
      {!currentHouse ? (
        <p className="text-gray-500 text-sm">Seleziona una casa per gestire gli ambienti</p>
      ) : isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : environments.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Nessun ambiente configurato</p>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="btn btn-secondary text-sm mx-auto"
            >
              {isSeeding ? 'Inizializzazione...' : 'Inizializza ambienti predefiniti'}
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
          {environments.map((env) => (
            <div
              key={env.id}
              onClick={() => navigate(`/environments/${env.id}`)}
              className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <span className="text-3xl">{env.icon || '📦'}</span>
                <h3 className="font-semibold text-sm">{env.name}</h3>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {env.item_count} articoli
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[env.env_type]}`}>
                    {TYPE_LABELS[env.env_type]}
                  </span>
                </div>
                {!env.is_default && (
                  <button
                    onClick={(e) => openEditModal(env, e)}
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
                  {editingEnv ? 'Modifica Ambiente' : 'Nuovo Ambiente'}
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
                    value={formData.env_type}
                    onChange={(e) => setFormData({ ...formData, env_type: e.target.value as EnvironmentType })}
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

export default Environments
