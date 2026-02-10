import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthCard } from './AuthCard'
import { PasswordInput } from './PasswordInput'

export function LoginForm() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [errorDetailOpen, setErrorDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorDetail('')
    setErrorDetailOpen(false)
    setIsLoading(true)

    try {
      await login({ identifier, password })
      navigate('/')
    } catch (err: unknown) {
      setError('Errore durante il login')
      let detail = 'Errore sconosciuto'
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string | unknown[] }; status?: number } }
        const data = axiosErr.response?.data
        const status = axiosErr.response?.status
        if (data?.detail) {
          if (typeof data.detail === 'string') {
            detail = `${status ?? ''} - ${data.detail}`
          } else {
            detail = `${status ?? ''} - ${JSON.stringify(data.detail)}`
          }
        } else {
          detail = `HTTP ${status ?? '?'} - ${JSON.stringify(data)}`
        }
      } else if (err instanceof Error) {
        detail = err.message
      }
      setErrorDetail(detail)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthCard title="HMS" subtitle="Accedi al tuo account">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl text-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            {errorDetail && (
              <div className="border-t border-red-200">
                <button
                  type="button"
                  onClick={() => setErrorDetailOpen(!errorDetailOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs text-red-500 hover:bg-red-100/50 transition-colors"
                >
                  <span>Dettaglio errore</span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${errorDetailOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                {errorDetailOpen && (
                  <div className="px-4 pb-3 text-xs text-red-600 font-mono break-all whitespace-pre-wrap">
                    {errorDetail}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email o nome utente
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="nome@esempio.com o nome utente"
              required
              autoComplete="username"
            />
          </div>
        </div>

        <div>
          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Inserisci la password"
            required
            autoComplete="current-password"
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors"
            >
              Password dimenticata?
            </Link>
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
              <span>Accesso in corso...</span>
            </>
          ) : (
            'Accedi'
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">oppure</span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600">
          Non hai un account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors">
            Registrati
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}

export default LoginForm
