import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import dispensaService from '@/services/dispensa'
import areasService from '@/services/areas'
import type { DispensaItem, DispensaStats, Area } from '@/types'

export function Giacenze() {
  const { currentHouse } = useHouse()

  const [stats, setStats] = useState<DispensaStats | null>(null)
  const [expiringItems, setExpiringItems] = useState<DispensaItem[]>([])
  const [expiredItems, setExpiredItems] = useState<DispensaItem[]>([])
  const [zones, setZones] = useState<Area[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentHouse) return

    const fetchAll = async () => {
      setIsLoading(true)
      try {
        const [statsRes, expiringRes, expiredRes, areasRes] = await Promise.all([
          dispensaService.getStats(currentHouse.id).catch(() => null),
          dispensaService.getItems(currentHouse.id, { expiring: true }).catch(() => ({ items: [] })),
          dispensaService.getItems(currentHouse.id, { expired: true }).catch(() => ({ items: [] })),
          areasService.getAll(currentHouse.id).catch(() => ({ areas: [] })),
        ])

        setStats(statsRes)
        setExpiringItems(expiringRes.items || [])
        setExpiredItems(expiredRes.items || [])
        setZones(
          (areasRes.areas || []).filter((e) => e.area_type === 'food_storage')
        )
      } catch (error) {
        console.error('Failed to fetch giacenze data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [currentHouse])

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <h2 className="text-lg font-medium text-gray-600">Nessuna casa selezionata</h2>
        <p className="text-gray-500 mt-2 text-sm">Crea o unisciti a una casa per iniziare</p>
      </div>
    )
  }

  // Combine expiring + expired, deduplicate, limit to 10
  const alertItems: (DispensaItem & { alertType: 'expiring' | 'expired' })[] = [
    ...expiredItems.map((item) => ({ ...item, alertType: 'expired' as const })),
    ...expiringItems.map((item) => ({ ...item, alertType: 'expiring' as const })),
  ]
  const uniqueAlertItems = alertItems.filter(
    (item, index, self) => self.findIndex((i) => i.id === item.id) === index
  )
  const displayAlertItems = uniqueAlertItems.slice(0, 10)
  const hasMoreAlerts = uniqueAlertItems.length > 10

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Giacenze</h1>
        <p className="text-gray-500 text-sm">Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Giacenze</h1>

      {/* Sezione Scadenze */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧊</span>
            <h2 className="text-base font-semibold">Scadenze</h2>
          </div>
          <Link to="/pantry" className="text-sm text-primary-600 hover:text-primary-700">
            Vedi tutti
          </Link>
        </div>

        {/* Badge stats */}
        {stats && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {stats.total} articoli
            </span>
            {stats.expiring_soon > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {stats.expiring_soon} in scadenza
              </span>
            )}
            {stats.expired > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {stats.expired} scaduti
              </span>
            )}
          </div>
        )}

        {/* Lista prodotti in scadenza/scaduti */}
        {displayAlertItems.length > 0 ? (
          <div className="space-y-2">
            {displayAlertItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-1.5 border-b last:border-0 border-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {item.expiry_date ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.alertType === 'expired'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {new Date(item.expiry_date).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {hasMoreAlerts && (
              <Link
                to="/pantry"
                className="block text-center text-xs text-primary-600 hover:text-primary-700 pt-1"
              >
                Vedi tutti →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Nessun prodotto in scadenza</p>
        )}
      </div>

      {/* Sezione Zone */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗄️</span>
            <h2 className="text-base font-semibold">Zone</h2>
          </div>
        </div>

        {zones.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {zones.map((zone) => (
              <Link
                key={zone.id}
                to={`/areas/${zone.id}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors shadow-sm"
              >
                <span className="text-2xl">{zone.icon || '📦'}</span>
                <span className="text-sm font-medium text-gray-700 text-center truncate w-full">
                  {zone.name}
                </span>
                <span className="text-xs text-gray-500">
                  {zone.item_count} {zone.item_count === 1 ? 'articolo' : 'articoli'}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Nessuna zona configurata</p>
        )}
      </div>

      {/* Link verso Pantry completa */}
      <Link
        to="/pantry"
        className="btn btn-primary w-full py-2.5 text-center flex items-center justify-center gap-2 text-sm"
      >
        Vedi tutti gli articoli
      </Link>
    </div>
  )
}

export default Giacenze
