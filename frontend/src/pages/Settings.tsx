import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SecuritySetupForm } from '@/components/Auth'
import { useAuth } from '@/context/AuthContext'

interface SettingsLink {
  to: string
  title: string
  description: string
  icon: string
}

const settingsLinks: SettingsLink[] = [
  {
    to: '/settings/grocy',
    title: 'Grocy',
    description: 'Sincronizza la dispensa con Grocy',
    icon: '🥫',
  },
]

export function Settings() {
  const [showSecuritySetup, setShowSecuritySetup] = useState(false)
  const { hasRecoverySetup, refreshRecoveryStatus } = useAuth()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configura l'applicazione
        </p>
      </div>

      {/* Security Section */}
      <div className="space-y-3">
        <button
          onClick={() => setShowSecuritySetup(!showSecuritySetup)}
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
        >
          <span className="text-2xl">🔐</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Sicurezza</h2>
              {hasRecoverySetup ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Configurato
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  Da configurare
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs truncate">Recupero password e domanda di sicurezza</p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${showSecuritySetup ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {showSecuritySetup && (
          <div className="card">
            <SecuritySetupForm onSuccess={() => refreshRecoveryStatus()} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {settingsLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">{link.icon}</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900">{link.title}</h2>
              <p className="text-gray-500 text-xs truncate">{link.description}</p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Settings
