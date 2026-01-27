import { Link } from 'react-router-dom'

interface SettingsLink {
  to: string
  title: string
  description: string
  icon: string
}

const settingsLinks: SettingsLink[] = [
  {
    to: '/settings/stores',
    title: 'Negozi',
    description: 'Gestisci catene, punti vendita e dimensioni',
    icon: '🏪',
  },
  {
    to: '/settings/categories',
    title: 'Categorie',
    description: 'Gestisci categorie prodotti (Food, No Food, ecc.)',
    icon: '🏷️',
  },
  {
    to: '/settings/grocy',
    title: 'Grocy',
    description: 'Sincronizza la dispensa con Grocy',
    icon: '🥫',
  },
  {
    to: '/health',
    title: 'Salute',
    description: 'Obiettivi e monitoraggio peso',
    icon: '❤️',
  },
  {
    to: '/house',
    title: 'Casa',
    description: 'Gestisci membri e inviti',
    icon: '👥',
  },
  {
    to: '/settings/import-database',
    title: 'Backup & Restore',
    description: 'Esporta o importa dati del database',
    icon: '💾',
  },
]

export function Settings() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configura l'applicazione
        </p>
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
