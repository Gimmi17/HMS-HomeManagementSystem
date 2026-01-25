import { useEffect, useState, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'
import healthService from '@/services/health'
import type { Weight } from '@/types'

export function Health() {
  const { user } = useAuth()
  const { currentHouse } = useHouse()
  const [weights, setWeights] = useState<Weight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const fetchWeights = async () => {
      if (!currentHouse || !user) return

      try {
        const data = await healthService.getWeights(currentHouse.id, user.id)
        setWeights(data.sort((a, b) => b.measured_at.localeCompare(a.measured_at)))
      } catch (error) {
        console.error('Failed to fetch weights:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWeights()
  }, [currentHouse, user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentHouse) return

    try {
      const weight = await healthService.addWeight(currentHouse.id, {
        weight_kg: parseFloat(newWeight),
        measured_at: new Date().toISOString(),
        notes: notes || undefined,
      })
      setWeights((prev) => [weight, ...prev])
      setNewWeight('')
      setNotes('')
      setShowForm(false)
    } catch (error) {
      console.error('Failed to add weight:', error)
    }
  }

  const latestWeight = weights[0]
  const previousWeight = weights[1]
  const weightDiff = latestWeight && previousWeight
    ? latestWeight.weight_kg - previousWeight.weight_kg
    : null

  if (!currentHouse) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Seleziona una casa per vedere i dati</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Salute</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          Registra Peso
        </button>
      </div>

      {/* Weight form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h3 className="font-semibold">Nuovo peso</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="input"
                required
                placeholder="75.5"
              />
            </div>
            <div>
              <label className="label">Note (opzionale)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                placeholder="es. dopo allenamento"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Salva
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Current stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Peso attuale</p>
          <p className="text-3xl font-bold">
            {latestWeight ? `${latestWeight.weight_kg} kg` : '-'}
          </p>
          {latestWeight && (
            <p className="text-xs text-gray-400 mt-1">
              {new Date(latestWeight.measured_at).toLocaleDateString('it-IT')}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Variazione</p>
          <p
            className={`text-3xl font-bold ${
              weightDiff === null
                ? 'text-gray-400'
                : weightDiff > 0
                ? 'text-red-600'
                : weightDiff < 0
                ? 'text-green-600'
                : 'text-gray-600'
            }`}
          >
            {weightDiff === null
              ? '-'
              : weightDiff > 0
              ? `+${weightDiff.toFixed(1)} kg`
              : `${weightDiff.toFixed(1)} kg`}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Registrazioni</p>
          <p className="text-3xl font-bold">{weights.length}</p>
        </div>
      </div>

      {/* Weight history */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Storico peso</h2>

        {isLoading ? (
          <p className="text-gray-500">Caricamento...</p>
        ) : weights.length === 0 ? (
          <p className="text-gray-500">Nessun dato registrato</p>
        ) : (
          <div className="space-y-2">
            {weights.slice(0, 20).map((weight) => (
              <div
                key={weight.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <span className="font-medium">{weight.weight_kg} kg</span>
                  {weight.notes && (
                    <span className="text-sm text-gray-500 ml-2">({weight.notes})</span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(weight.measured_at).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Health
