import { useState, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'
import housesService from '@/services/houses'
import type { HouseInvite } from '@/types'

export function House() {
  const { user } = useAuth()
  const { currentHouse, houses, createHouse, joinHouse, refreshHouses } = useHouse()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [newHouseName, setNewHouseName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<HouseInvite | null>(null)
  const [error, setError] = useState('')

  const handleCreateHouse = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await createHouse({ name: newHouseName })
      setNewHouseName('')
      setShowCreateForm(false)
    } catch {
      setError('Errore nella creazione della casa')
    }
  }

  const handleJoinHouse = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await joinHouse(inviteCode.toUpperCase())
      setInviteCode('')
      setShowJoinForm(false)
    } catch {
      setError('Codice invito non valido o scaduto')
    }
  }

  const handleGenerateInvite = async () => {
    if (!currentHouse) return

    try {
      const invite = await housesService.createInvite(currentHouse.id)
      setGeneratedInvite(invite)
    } catch {
      setError('Errore nella generazione del codice invito')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!currentHouse || !confirm('Sei sicuro di voler rimuovere questo membro?')) return

    try {
      await housesService.removeMember(currentHouse.id, userId)
      refreshHouses()
    } catch {
      setError('Errore nella rimozione del membro')
    }
  }

  const isOwner = currentHouse?.owner_id === user?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestione Casa</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowJoinForm(true)} className="btn btn-secondary">
            Unisciti
          </button>
          <button onClick={() => setShowCreateForm(true)} className="btn btn-primary">
            Nuova Casa
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Create house form */}
      {showCreateForm && (
        <form onSubmit={handleCreateHouse} className="card space-y-4">
          <h3 className="font-semibold">Crea nuova casa</h3>
          <div>
            <label className="label">Nome casa</label>
            <input
              type="text"
              value={newHouseName}
              onChange={(e) => setNewHouseName(e.target.value)}
              className="input"
              required
              placeholder="Casa mia"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Crea
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="btn btn-secondary"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Join house form */}
      {showJoinForm && (
        <form onSubmit={handleJoinHouse} className="card space-y-4">
          <h3 className="font-semibold">Unisciti a una casa</h3>
          <div>
            <label className="label">Codice invito</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="input uppercase"
              required
              placeholder="ABC123"
              maxLength={6}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Unisciti
            </button>
            <button
              type="button"
              onClick={() => setShowJoinForm(false)}
              className="btn btn-secondary"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Current house info */}
      {currentHouse && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{currentHouse.name}</h2>
            {isOwner && (
              <button onClick={handleGenerateInvite} className="btn btn-secondary text-sm">
                Genera codice invito
              </button>
            )}
          </div>

          {/* Generated invite code */}
          {generatedInvite && (
            <div className="bg-primary-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600 mb-2">Condividi questo codice:</p>
              <p className="text-2xl font-mono font-bold text-primary-600">
                {generatedInvite.code}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Scade il {new Date(generatedInvite.expires_at).toLocaleDateString('it-IT')}
              </p>
            </div>
          )}

          {/* Members list */}
          <h3 className="font-medium mb-3">Membri ({currentHouse.members?.length || 0})</h3>
          <div className="space-y-2">
            {(currentHouse.members || []).map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <span className="font-medium">{member.full_name || member.email}</span>
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      member.role === 'OWNER'
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
                {isOwner && member.user_id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All houses */}
      {houses.length > 1 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Le tue case</h2>
          <div className="space-y-2">
            {houses.map((house) => (
              <div
                key={house.id}
                className={`p-3 rounded-lg border ${
                  house.id === currentHouse?.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200'
                }`}
              >
                <span className="font-medium">{house.name}</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({house.members?.length || 0} membri)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default House
