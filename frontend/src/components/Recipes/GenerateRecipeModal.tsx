/**
 * GenerateRecipeModal Component
 *
 * Bottom sheet / card modal that generates a recipe via AI.
 * Steps: form → loading → result → error
 */

import { useState } from 'react'
import { useHouse } from '@/context/HouseContext'
import { api } from '@/services/api'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (recipe: any) => void
  onEditGenerated: (data: any) => void
}

type Step = 'form' | 'loading' | 'result' | 'error'

export function GenerateRecipeModal({ open, onClose, onSaved, onEditGenerated }: Props) {
  const { currentHouse } = useHouse()

  const [step, setStep] = useState<Step>('form')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [usePantry, setUsePantry] = useState(true)
  const [constraints, setConstraints] = useState('')
  const [servings, setServings] = useState(2)

  if (!open) return null

  const handleGenerate = async () => {
    if (!currentHouse) return
    setStep('loading')
    try {
      const response = await api.post('/recipes/generate', {
        house_id: currentHouse.id,
        use_pantry: usePantry,
        constraints: constraints || undefined,
        servings,
      })
      setResult(response.data)
      setStep('result')
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status
      if (status === 503) {
        setError('LLM non configurato. Vai in Impostazioni > LLM.')
      } else {
        setError('Errore nella generazione. Riprova.')
      }
      setStep('error')
    }
  }

  const handleSave = async () => {
    if (!result) return
    try {
      onSaved(result)
      onClose()
    } catch {
      // parent handles
    }
  }

  const handleRegenerate = () => {
    setResult(null)
    setStep('form')
  }

  const handleEdit = () => {
    onEditGenerated(result)
    onClose()
  }

  const handleRetry = () => {
    setError('')
    setStep('form')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 inset-x-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:w-96 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 space-y-4 animate-slide-up z-50">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">✨ Genera ricetta con AI</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step: form */}
        {step === 'form' && (
          <div className="space-y-4">
            {/* Toggle pantry */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Usa ingredienti dalla dispensa
              </label>
              <button
                type="button"
                onClick={() => setUsePantry((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  usePantry ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    usePantry ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Constraints */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vincoli / preferenze
              </label>
              <input
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="es: veloce, senza glutine, proteica..."
                className="input w-full"
              />
            </div>

            {/* Servings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porzioni
              </label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                min={1}
                max={10}
                className="input w-full"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              className="btn btn-primary w-full"
            >
              Genera ricetta
            </button>
          </div>
        )}

        {/* Step: loading */}
        {step === 'loading' && (
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
            <p className="text-sm text-gray-500 text-center mt-3">L'AI sta elaborando...</p>
          </div>
        )}

        {/* Step: result */}
        {step === 'result' && result && (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900">{result.name}</h3>

            {/* Ingredients list */}
            {result.ingredients && result.ingredients.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Ingredienti
                </p>
                <ul className="space-y-0.5">
                  {result.ingredients.map((ing: any, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">
                      {ing.food_name || ing.name}
                      {ing.quantity_g ? ` — ${ing.quantity_g}g` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <button type="button" onClick={handleSave} className="btn btn-primary w-full">
                Salva ricetta
              </button>
              <button type="button" onClick={handleRegenerate} className="btn btn-secondary w-full">
                Rigenera
              </button>
              <button type="button" onClick={handleEdit} className="btn btn-ghost w-full">
                Modifica prima di salvare
              </button>
            </div>
          </div>
        )}

        {/* Step: error */}
        {step === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={handleRetry} className="btn btn-secondary w-full">
              Riprova
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default GenerateRecipeModal
