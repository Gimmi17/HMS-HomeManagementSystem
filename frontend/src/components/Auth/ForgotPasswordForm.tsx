import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard } from './AuthCard'
import { PasswordInput } from './PasswordInput'
import authService from '@/services/auth'

type Step = 'email' | 'reset' | 'success'

export function ForgotPasswordForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [recoveryPin, setRecoveryPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authService.checkRecovery(email)
      if (response.has_recovery) {
        setStep('reset')
      } else {
        setError('Recupero password non configurato per questo account. Contatta un amministratore.')
      }
    } catch (err) {
      setError('Errore durante la verifica. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (recoveryPin.length !== 6 || !/^\d+$/.test(recoveryPin)) {
      setError('Il PIN deve essere di 6 cifre numeriche')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono')
      return
    }

    if (newPassword.length < 8) {
      setError('La password deve essere di almeno 8 caratteri')
      return
    }

    setIsLoading(true)

    try {
      await authService.resetPassword({
        email,
        recovery_pin: recoveryPin,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      })
      setStep('success')
    } catch (err) {
      setError('PIN di recupero non valido')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepIndicator = () => {
    const steps = [
      { key: 'email', label: '1' },
      { key: 'reset', label: '2' },
    ]
    const currentIndex = steps.findIndex(s => s.key === step)

    return (
      <div className="flex justify-center gap-2 mb-6">
        {steps.map((s, index) => (
          <div
            key={s.key}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              index <= currentIndex
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>
    )
  }

  if (step === 'success') {
    return (
      <AuthCard title="Password Aggiornata" subtitle="La tua password è stata modificata con successo">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-600">
            Ora puoi accedere con la tua nuova password.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            Vai al Login
          </button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Recupera Password"
      subtitle={
        step === 'email' ? 'Inserisci la tua email' : 'Inserisci il PIN e la nuova password'
      }
    >
      {step !== 'success' && renderStepIndicator()}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 mb-5">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Email */}
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="nome@esempio.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Verifica in corso...</span>
              </>
            ) : (
              'Continua'
            )}
          </button>

          <p className="text-center text-sm text-gray-600">
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors">
              Torna al login
            </Link>
          </p>
        </form>
      )}

      {/* Step 2: Reset Password with PIN */}
      {step === 'reset' && (
        <form onSubmit={handleResetSubmit} className="space-y-5">
          <div>
            <label htmlFor="recoveryPin" className="block text-sm font-medium text-gray-700 mb-1.5">
              PIN di Recupero (6 cifre)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="recoveryPin"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={recoveryPin}
                onChange={(e) => setRecoveryPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-center text-xl tracking-widest font-mono"
                placeholder="000000"
                required
              />
            </div>
          </div>

          <div>
            <PasswordInput
              id="newPassword"
              label="Nuova Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Crea una nuova password"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div>
            <PasswordInput
              id="confirmPassword"
              label="Conferma Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ripeti la nuova password"
              required
              autoComplete="new-password"
              error={confirmPassword && newPassword !== confirmPassword ? 'Le password non coincidono' : undefined}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Indietro
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Salvataggio...</span>
                </>
              ) : (
                'Salva Password'
              )}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  )
}

export default ForgotPasswordForm
