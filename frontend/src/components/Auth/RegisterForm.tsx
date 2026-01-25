import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function RegisterForm() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Le password non coincidono')
      return
    }

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri')
      return
    }

    setIsLoading(true)

    try {
      await register({ email, password, full_name: fullName })
      navigate('/')
    } catch (err) {
      setError('Errore durante la registrazione. Email potrebbe essere già in uso.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Meal Planner</h1>
          <p className="text-gray-600 mt-2">Crea il tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="label">
              Nome completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">
              Conferma password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Registrazione...' : 'Registrati'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Hai già un account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline">
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default RegisterForm
