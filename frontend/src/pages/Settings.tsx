import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SecuritySetupForm } from '@/components/Auth'
import { useAuth } from '@/context/AuthContext'
import anagraficheService from '@/services/anagrafiche'

interface SettingsLink {
  to: string
  title: string
  description: string
  icon: string
}

interface OrphanStats {
  categories: number
  stores: number
  foods: number
  products: number
  total: number
}

interface HouseOption {
  id: string
  name: string
}

const settingsLinks: SettingsLink[] = [
  {
    to: '/settings/grocy',
    title: 'Grocy',
    description: 'Sincronizza la dispensa con Grocy',
    icon: '🥫',
  },
  {
    to: '/settings/llm',
    title: 'LLM / AI',
    description: 'Configura server AI per OCR e chat',
    icon: '🤖',
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
  {
    to: '/settings/sql-console',
    title: 'SQL Console',
    description: 'Esegui query SQL direttamente sul database',
    icon: '🗄️',
  },
]

export function Settings() {
  const [showSecuritySetup, setShowSecuritySetup] = useState(false)
  const { hasRecoverySetup, refreshRecoveryStatus } = useAuth()

  // Migration state
  const [showMigration, setShowMigration] = useState(false)
  const [orphanStats, setOrphanStats] = useState<OrphanStats | null>(null)
  const [houses, setHouses] = useState<HouseOption[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<string | null>(null)

  const loadOrphanStats = async () => {
    setIsLoadingStats(true)
    try {
      const stats = await anagraficheService.getOrphanStats()
      setOrphanStats(stats)

      // Also load houses if there's orphan data
      if (stats.total > 0) {
        const housesResponse = await anagraficheService.getHouses()
        setHouses(housesResponse.houses.map(h => ({ id: h.id, name: h.name })))
      }
    } catch (error) {
      console.error('Failed to load orphan stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  useEffect(() => {
    if (showMigration && orphanStats === null) {
      loadOrphanStats()
    }
  }, [showMigration])

  const handleMigrate = async (houseId: string) => {
    setIsMigrating(true)
    setMigrationResult(null)
    try {
      const result = await anagraficheService.linkOrphanDataToHouse(houseId)
      setMigrationResult(
        `Migrazione completata: ${result.total_linked} elementi collegati a "${result.house_name}"\n` +
        `- Categorie: ${result.categories_linked}\n` +
        `- Negozi: ${result.stores_linked}\n` +
        `- Alimenti: ${result.foods_linked}\n` +
        `- Prodotti: ${result.products_linked}`
      )
      // Reload stats
      loadOrphanStats()
    } catch (error: any) {
      setMigrationResult(`Errore: ${error.response?.data?.detail || 'Migrazione fallita'}`)
    } finally {
      setIsMigrating(false)
    }
  }

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

      {/* Data Migration Section */}
      <div className="space-y-3">
        <button
          onClick={() => setShowMigration(!showMigration)}
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
        >
          <span className="text-2xl">🔗</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Migrazione Dati</h2>
              {orphanStats && orphanStats.total > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  {orphanStats.total} da migrare
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs truncate">Lega dati orfani a una casa</p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${showMigration ? 'rotate-90' : ''}`}
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

        {showMigration && (
          <div className="card p-4 space-y-4">
            <p className="text-sm text-gray-600">
              Questa funzione permette di collegare i dati esistenti (categorie, negozi, alimenti, prodotti)
              che non sono ancora associati a nessuna casa.
            </p>

            {isLoadingStats ? (
              <p className="text-sm text-gray-500">Caricamento statistiche...</p>
            ) : orphanStats ? (
              orphanStats.total === 0 ? (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">
                    Tutti i dati sono già collegati a una casa.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-orange-50 rounded-lg space-y-2">
                    <p className="text-sm text-orange-800 font-medium">
                      Dati non collegati trovati:
                    </p>
                    <ul className="text-sm text-orange-700 space-y-1">
                      {orphanStats.categories > 0 && (
                        <li>• Categorie: {orphanStats.categories}</li>
                      )}
                      {orphanStats.stores > 0 && (
                        <li>• Negozi: {orphanStats.stores}</li>
                      )}
                      {orphanStats.foods > 0 && (
                        <li>• Alimenti: {orphanStats.foods}</li>
                      )}
                      {orphanStats.products > 0 && (
                        <li>• Prodotti: {orphanStats.products}</li>
                      )}
                    </ul>
                    <p className="text-xs text-orange-600 mt-2">
                      Totale: {orphanStats.total} elementi
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Seleziona la casa a cui collegare tutti i dati:
                    </p>
                    <div className="space-y-2">
                      {houses.map(house => (
                        <button
                          key={house.id}
                          onClick={() => handleMigrate(house.id)}
                          disabled={isMigrating}
                          className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-3"
                        >
                          <span className="text-lg">🏠</span>
                          <span className="font-medium">{house.name}</span>
                          {isMigrating && (
                            <span className="text-xs text-gray-500 ml-auto">Migrazione in corso...</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )
            ) : null}

            {migrationResult && (
              <div className={`p-3 rounded-lg text-sm whitespace-pre-line ${
                migrationResult.startsWith('Errore')
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}>
                {migrationResult}
              </div>
            )}
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
