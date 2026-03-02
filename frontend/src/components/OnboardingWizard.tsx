import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'

interface OnboardingWizardProps {
  hasHouse: boolean
  onComplete: () => void
}

const ONBOARDING_KEY = 'onboarding_completed'

const STEP_LABELS_FULL = ['Benvenuto', 'Casa', 'Panoramica', 'Fine']
const STEP_LABELS_SHORT = ['Benvenuto', 'Panoramica', 'Fine']

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              i < current
                ? 'bg-blue-600 text-white'
                : i === current
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                  : 'bg-gray-200 text-gray-500'
            }`}
          >
            {i < current ? '\u2713' : i + 1}
          </div>
          <span
            className={`ml-1 text-xs hidden sm:inline ${
              i === current ? 'text-blue-600 font-semibold' : 'text-gray-400'
            }`}
          >
            {label}
          </span>
          {i < labels.length - 1 && (
            <div className={`w-6 sm:w-10 h-0.5 mx-1 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

const OVERVIEW_CARDS = [
  {
    icon: '📦',
    title: 'Dispensa',
    description: 'Tieni traccia di tutti i prodotti in casa, con scadenze e quantita\'.',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    icon: '🛒',
    title: 'Liste Spesa',
    description: 'Crea liste condivise con la famiglia e spunta al supermercato.',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    icon: '🍽️',
    title: 'Pasti',
    description: 'Pianifica i pasti settimanali e monitora calorie e nutrienti.',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    icon: '📍',
    title: 'Zone',
    description: 'Organizza la dispensa per aree: frigo, freezer, dispensa, ecc.',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
]

export function OnboardingWizard({ hasHouse, onComplete }: OnboardingWizardProps) {
  const { user } = useAuth()
  const { createHouse, joinHouse, currentHouse } = useHouse()

  // Build step list: skip "Casa" step if hasHouse
  const steps = hasHouse ? [0, 2, 3] : [0, 1, 2, 3]
  const stepLabels = hasHouse ? STEP_LABELS_SHORT : STEP_LABELS_FULL

  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = steps[stepIndex]

  // House creation state
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [houseName, setHouseName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [houseError, setHouseError] = useState('')
  const [houseLoading, setHouseLoading] = useState(false)
  const [houseCreated, setHouseCreated] = useState(hasHouse)

  const handleSkip = () => {
    // Step 1 (Casa) is mandatory when no house exists
    if (currentStep === 1 && !houseCreated) return
    handleComplete()
  }

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onComplete()
  }

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1)
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1)
    }
  }

  const handleCreateHouse = async () => {
    if (!houseName.trim()) return
    setHouseError('')
    setHouseLoading(true)
    try {
      await createHouse({ name: houseName.trim() })
      setHouseCreated(true)
      handleNext()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore nella creazione'
      setHouseError(msg)
    } finally {
      setHouseLoading(false)
    }
  }

  const handleJoinHouse = async () => {
    if (!inviteCode.trim()) return
    setHouseError('')
    setHouseLoading(true)
    try {
      await joinHouse(inviteCode.trim())
      setHouseCreated(true)
      handleNext()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Codice non valido'
      setHouseError(msg)
    } finally {
      setHouseLoading(false)
    }
  }

  const canSkip = currentStep !== 1 || houseCreated

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="w-16" />
        <StepIndicator current={stepIndex} labels={stepLabels} />
        {canSkip ? (
          <button onClick={handleSkip} className="text-sm text-gray-500 hover:text-gray-700 w-16 text-right">
            Salta
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Step 0 - Benvenuto */}
          {currentStep === 0 && (
            <div className="text-center space-y-6">
              <div className="text-6xl">🏠</div>
              <h1 className="text-2xl font-bold text-gray-900">
                Benvenuto{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
              </h1>
              <p className="text-gray-600">
                HMS ti aiuta a gestire la tua casa in modo semplice e organizzato.
              </p>
              <ul className="text-left space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">📦</span>
                  <span>Gestisci la <strong>dispensa</strong> e tieni traccia delle scadenze</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">🛒</span>
                  <span>Crea <strong>liste della spesa</strong> condivise con la famiglia</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">🍽️</span>
                  <span>Pianifica i <strong>pasti</strong> e monitora la nutrizione</span>
                </li>
              </ul>
              <button onClick={handleNext} className="btn btn-primary w-full py-3 text-base">
                Iniziamo
              </button>
            </div>
          )}

          {/* Step 1 - Crea/Unisciti Casa */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl mb-3">🏡</div>
                <h2 className="text-xl font-bold text-gray-900">La tua casa</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Crea una nuova casa o unisciti a una esistente con un codice invito.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => { setTab('create'); setHouseError('') }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    tab === 'create'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Crea nuova
                </button>
                <button
                  onClick={() => { setTab('join'); setHouseError('') }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    tab === 'join'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Unisciti
                </button>
              </div>

              {houseError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {houseError}
                </div>
              )}

              {tab === 'create' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome della casa
                    </label>
                    <input
                      type="text"
                      value={houseName}
                      onChange={(e) => setHouseName(e.target.value)}
                      placeholder="es. Casa Rossi"
                      className="input w-full"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateHouse()}
                    />
                  </div>
                  <button
                    onClick={handleCreateHouse}
                    disabled={!houseName.trim() || houseLoading}
                    className="btn btn-primary w-full py-3"
                  >
                    {houseLoading ? 'Creazione...' : 'Crea casa'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Codice invito
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Inserisci il codice"
                      className="input w-full"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinHouse()}
                    />
                  </div>
                  <button
                    onClick={handleJoinHouse}
                    disabled={!inviteCode.trim() || houseLoading}
                    className="btn btn-primary w-full py-3"
                  >
                    {houseLoading ? 'Connessione...' : 'Unisciti'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2 - Panoramica */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900">Cosa puoi fare</h2>
                <p className="text-gray-600 text-sm mt-1">Ecco le funzionalita' principali</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {OVERVIEW_CARDS.map((card) => (
                  <div
                    key={card.title}
                    className={`p-4 rounded-xl border ${card.bg} ${card.border}`}
                  >
                    <div className="text-3xl mb-2">{card.icon}</div>
                    <h3 className="font-semibold text-gray-900 text-sm">{card.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 - Fine */}
          {currentStep === 3 && (
            <div className="text-center space-y-6">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">Tutto pronto!</h2>
              {currentHouse && (
                <p className="text-gray-600">
                  La tua casa <strong>{currentHouse.name}</strong> e' pronta.
                </p>
              )}
              <p className="text-gray-500 text-sm">
                Puoi riaprire questa guida in qualsiasi momento dalle Impostazioni.
              </p>
              <button onClick={handleComplete} className="btn btn-primary w-full py-3 text-base">
                Vai alla Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation (not on first/last step) */}
      {stepIndex > 0 && currentStep !== 3 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <button onClick={handleBack} className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Indietro
          </button>
          {currentStep !== 1 && (
            <button onClick={handleNext} className="btn btn-primary px-6 py-2 text-sm">
              Avanti
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default OnboardingWizard
