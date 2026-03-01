import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import dispensaService from '@/services/dispensa'
import type { MissingCatalogItem, ConflictCatalogItem, ApplyConflictResolution } from '@/services/dispensa'
import areasService from '@/services/areas'
import type { DispensaItem, DispensaStats, Area } from '@/types'

export function Giacenze() {
  const { currentHouse } = useHouse()

  const [stats, setStats] = useState<DispensaStats | null>(null)
  const [expiringItems, setExpiringItems] = useState<DispensaItem[]>([])
  const [expiredItems, setExpiredItems] = useState<DispensaItem[]>([])
  const [zones, setZones] = useState<Area[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Missing catalogs state
  const [showMissingModal, setShowMissingModal] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [toCreate, setToCreate] = useState<MissingCatalogItem[]>([])
  const [conflicts, setConflicts] = useState<ConflictCatalogItem[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, 'dispensa' | 'catalog'>>(new Map())
  const [dismissedBarcodes, setDismissedBarcodes] = useState<Set<string>>(new Set())
  const [scanSummary, setScanSummary] = useState<{ already_linked: number; no_barcode: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleScanMissing = async () => {
    if (!currentHouse) return
    setShowMissingModal(true)
    setIsScanning(true)
    setDismissedBarcodes(new Set())
    setConflictResolutions(new Map())
    try {
      const result = await dispensaService.scanMissingCatalogs(currentHouse.id)
      setToCreate(result.to_create)
      setConflicts(result.conflicts)
      setScanSummary({ already_linked: result.already_linked, no_barcode: result.no_barcode })
    } catch {
      setToast({ message: 'Errore durante la scansione', type: 'error' })
      setShowMissingModal(false)
    } finally {
      setIsScanning(false)
    }
  }

  const handleApplyAll = async () => {
    if (!currentHouse) return
    setIsApplying(true)
    try {
      const createItems = toCreate
        .filter((item) => !dismissedBarcodes.has(item.barcode))
        .map((item) => ({
          barcode: item.barcode,
          name: item.dispensa_name,
          brand_text: item.brand_text,
        }))

      const conflictRes: ApplyConflictResolution[] = []
      conflictResolutions.forEach((keep, barcode) => {
        conflictRes.push({ barcode, keep })
      })

      const result = await dispensaService.applyMissingCatalogs(currentHouse.id, {
        create_items: createItems,
        conflict_resolutions: conflictRes,
      })

      const parts: string[] = []
      if (result.created > 0) parts.push(`${result.created} anagrafiche create`)
      if (result.conflicts_resolved > 0) parts.push(`${result.conflicts_resolved} conflitti risolti`)
      if (result.errors.length > 0) parts.push(`${result.errors.length} errori`)

      setToast({
        message: parts.join(', ') || 'Nessuna modifica',
        type: result.errors.length > 0 ? 'error' : 'success',
      })
      setShowMissingModal(false)
    } catch {
      setToast({ message: 'Errore durante l\'applicazione', type: 'error' })
    } finally {
      setIsApplying(false)
    }
  }

  const activeCreates = toCreate.filter((item) => !dismissedBarcodes.has(item.barcode))
  const hasWork = activeCreates.length > 0 || conflictResolutions.size > 0

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Giacenze</h1>
        <button
          onClick={handleScanMissing}
          className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
        >
          Crea Anagrafiche
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Missing Catalogs Modal */}
      {showMissingModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Crea Anagrafiche Mancanti</h2>
              {scanSummary && !isScanning && (
                <p className="text-xs text-gray-500 mt-1">
                  {scanSummary.already_linked} già collegati &middot; {scanSummary.no_barcode} senza barcode
                </p>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isScanning ? (
                <p className="text-gray-500 text-sm text-center py-8">Scansione in corso...</p>
              ) : (
                <>
                  {/* Section: Da creare */}
                  {toCreate.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Da creare ({activeCreates.length})
                      </h3>
                      <div className="space-y-2">
                        {toCreate.map((item) => {
                          if (dismissedBarcodes.has(item.barcode)) return null
                          return (
                            <div
                              key={item.barcode}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{item.dispensa_name}</p>
                                <p className="text-xs text-gray-500">
                                  EAN: {item.barcode}
                                  {item.brand_text && <> &middot; {item.brand_text}</>}
                                </p>
                              </div>
                              <button
                                onClick={() => setDismissedBarcodes((prev) => new Set(prev).add(item.barcode))}
                                className="ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                                title="Ignora"
                              >
                                &times;
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section: Conflitti */}
                  {conflicts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-orange-700 mb-2">
                        Conflitti ({conflicts.length})
                      </h3>
                      <div className="space-y-2">
                        {conflicts.map((item) => (
                          <div
                            key={item.barcode}
                            className="p-3 bg-orange-50 border border-orange-200 rounded-lg"
                          >
                            <p className="text-xs text-gray-500 mb-2">EAN: {item.barcode}</p>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name={`conflict-${item.barcode}`}
                                checked={conflictResolutions.get(item.barcode) === 'dispensa'}
                                onChange={() => setConflictResolutions((prev) => {
                                  const next = new Map(prev)
                                  next.set(item.barcode, 'dispensa')
                                  return next
                                })}
                                className="accent-teal-600"
                              />
                              <span>Dispensa: <strong>{item.dispensa_name}</strong></span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
                              <input
                                type="radio"
                                name={`conflict-${item.barcode}`}
                                checked={conflictResolutions.get(item.barcode) === 'catalog'}
                                onChange={() => setConflictResolutions((prev) => {
                                  const next = new Map(prev)
                                  next.set(item.barcode, 'catalog')
                                  return next
                                })}
                                className="accent-teal-600"
                              />
                              <span>Anagrafica: <strong>{item.catalog_name}</strong></span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {toCreate.length === 0 && conflicts.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">
                      Tutti gli articoli con barcode hanno già un'anagrafica.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowMissingModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={handleApplyAll}
                disabled={!hasWork || isApplying || isScanning}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isApplying ? 'Applicazione...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}

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
