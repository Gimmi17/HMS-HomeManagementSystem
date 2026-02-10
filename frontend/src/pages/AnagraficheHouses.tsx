import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import anagraficheService, { HouseListItem, HouseCreateRequest, HouseUpdateRequest, UserListItem } from '@/services/anagrafiche'

export function AnagraficheHouses() {
  const navigate = useNavigate()
  const [houses, setHouses] = useState<HouseListItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingHouse, setEditingHouse] = useState<HouseListItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    owner_id: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = async () => {
    try {
      const [housesRes, usersRes] = await Promise.all([
        anagraficheService.getHouses(searchQuery || undefined),
        anagraficheService.getUsers()
      ])
      setHouses(housesRes.houses)
      setUsers(usersRes.users)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [searchQuery])

  const openCreateModal = () => {
    setEditingHouse(null)
    setFormData({ name: '', description: '', location: '', owner_id: users[0]?.id || '' })
    setShowModal(true)
  }

  const openEditModal = (house: HouseListItem) => {
    setEditingHouse(house)
    setFormData({
      name: house.name,
      description: house.description || '',
      location: house.location || '',
      owner_id: house.owner_id
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.owner_id) return
    setIsSaving(true)
    try {
      if (editingHouse) {
        const updateData: HouseUpdateRequest = {}
        if (formData.name !== editingHouse.name) updateData.name = formData.name
        if (formData.description !== (editingHouse.description || '')) updateData.description = formData.description
        if (formData.location !== (editingHouse.location || '')) updateData.location = formData.location
        if (formData.owner_id !== editingHouse.owner_id) updateData.owner_id = formData.owner_id
        await anagraficheService.updateHouse(editingHouse.id, updateData)
        showToast('Casa aggiornata', 'success')
      } else {
        await anagraficheService.createHouse(formData as HouseCreateRequest)
        showToast('Casa creata', 'success')
      }
      setShowModal(false)
      fetchData()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (house: HouseListItem) => {
    if (!confirm(`Eliminare la casa "${house.name}"?`)) return
    try {
      await anagraficheService.deleteHouse(house.id)
      showToast('Casa eliminata', 'success')
      fetchData()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
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
          <h1 className="text-xl font-bold text-gray-900">Gestione Case</h1>
          <p className="text-sm text-gray-500">{houses.length} case</p>
        </div>
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
        placeholder="Cerca per nome o localita..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input w-full"
      />

      {/* List */}
      {isLoading ? (
        <p className="text-gray-500 text-center py-8">Caricamento...</p>
      ) : houses.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Nessuna casa trovata</p>
        </div>
      ) : (
        <div className="space-y-2">
          {houses.map((house) => (
            <div key={house.id} className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                  🏠
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{house.name}</p>
                  <p className="text-sm text-gray-500">
                    {house.location || 'Nessuna localita'} - {house.owner_name || 'Senza proprietario'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(house)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(house)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">
                {editingHouse ? 'Modifica Casa' : 'Nuova Casa'}
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
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Localita</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proprietario *</label>
                <select
                  value={formData.owner_id}
                  onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Seleziona...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.owner_id || isSaving}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnagraficheHouses
