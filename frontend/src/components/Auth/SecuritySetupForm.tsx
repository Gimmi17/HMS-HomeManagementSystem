import { useState, useEffect, FormEvent } from 'react'
import { PasswordInput } from './PasswordInput'
import authService from '@/services/auth'

interface SecuritySetupFormProps {
  onSuccess?: () => void
}

export function SecuritySetupForm({ onSuccess }: SecuritySetupFormProps) {
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form fields
  const [recoveryPin, setRecoveryPin] = useState('')
  const [recoveryPinConfirm, setRecoveryPinConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  useEffect(() => {
    loadRecoveryStatus()
  }, [])

  const loadRecoveryStatus = async () => {
    try {
      const status = await authService.getRecoveryStatus()
      setIsConfigured(status.has_recovery_setup)
    } catch (err) {
      console.error('Error loading recovery status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): boolean => {
    setError('')

    if (recoveryPin.length !== 6 || !/^\d+$/.test(recoveryPin)) {
      setError('Il PIN deve essere di 6 cifre numeriche')
      return false
    }

    if (recoveryPin !== recoveryPinConfirm) {
      setError('I PIN non coincidono')
      return false
    }

    if (isConfigured && !currentPassword) {
      setError('Inserisci la password attuale per modificare il PIN')
      return false
    }

    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      if (isConfigured) {
        await authService.updateRecovery({
          current_password: currentPassword,
          recovery_pin: recoveryPin,
          recovery_pin_confirm: recoveryPinConfirm,
        })
      } else {
        await authService.setupRecovery({
          recovery_pin: recoveryPin,
          recovery_pin_confirm: recoveryPinConfirm,
        })
      }

      setSuccess('PIN di recupero salvato con successo!')
      setIsConfigured(true)

      // Reset sensitive fields
      setRecoveryPin('')
      setRecoveryPinConfirm('')
      setCurrentPassword('')

      onSuccess?.()
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Errore durante il salvataggio. Riprova.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {isConfigured ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">PIN di recupero configurato</p>
            <p className="text-sm text-green-700 mt-1">
              Puoi usare il PIN per recuperare la password in caso di smarrimento.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-yellow-800">PIN di recupero non configurato</p>
            <p className="text-sm text-yellow-700 mt-1">
              Configura un PIN di recupero per poter recuperare la password in caso di smarrimento.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <h3 className="font-medium text-gray-900">
          {isConfigured ? 'Modifica PIN di recupero' : 'Configura PIN di recupero'}
        </h3>

        {/* Recovery PIN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="recoveryPin" className="block text-sm font-medium text-gray-700 mb-1.5">
              PIN di Recupero (6 cifre)
            </label>
            <input
              id="recoveryPin"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={recoveryPin}
              onChange={(e) => setRecoveryPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-center text-lg tracking-widest font-mono"
              placeholder="000000"
              required
            />
          </div>
          <div>
            <label htmlFor="recoveryPinConfirm" className="block text-sm font-medium text-gray-700 mb-1.5">
              Conferma PIN
            </label>
            <input
              id="recoveryPinConfirm"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={recoveryPinConfirm}
              onChange={(e) => setRecoveryPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-center text-lg tracking-widest font-mono ${
                recoveryPinConfirm && recoveryPin !== recoveryPinConfirm ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="000000"
              required
            />
            {recoveryPinConfirm && recoveryPin !== recoveryPinConfirm && (
              <p className="mt-1 text-sm text-red-600">I PIN non coincidono</p>
            )}
          </div>
        </div>

        {/* Current password (only when updating) */}
        {isConfigured && (
          <div>
            <PasswordInput
              id="currentPassword"
              label="Password attuale"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Inserisci la password attuale"
              required
              autoComplete="current-password"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Salvataggio...</span>
            </>
          ) : (
            isConfigured ? 'Aggiorna PIN' : 'Configura PIN'
          )}
        </button>
      </form>
    </div>
  )
}

export default SecuritySetupForm
