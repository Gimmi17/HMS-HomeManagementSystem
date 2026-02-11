import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import anagraficheService, { ProductListItem, HouseListItem } from '@/services/anagrafiche'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface OrphanStats {
  categories: number
  stores: number
  foods: number
  products: number
  total: number
}

interface ProductRowProps {
  product: ProductListItem
  houses: HouseListItem[]
  onHouseChange: (productId: string, houseId: string | null) => Promise<void>
}

function ProductRow({ product, houses, onHouseChange }: ProductRowProps) {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const houseId = value === '' ? null : value
    setStatus('saving')
    try {
      await onHouseChange(product.id, houseId)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {product.name || 'Senza nome'}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {product.barcode}
          {product.brand && ` · ${product.brand}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          value={product.house_id || ''}
          onChange={handleChange}
          disabled={status === 'saving'}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">GENERICO</option>
          {houses.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <span className="w-5 text-center flex-shrink-0">
          {status === 'saving' && (
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {status === 'saved' && <span className="text-green-500 text-sm">✓</span>}
          {status === 'error' && <span className="text-red-500 text-sm">✗</span>}
        </span>
      </div>
    </div>
  )
}

export function Admin() {
  const navigate = useNavigate()

  // Product ownership modal
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [houses, setHouses] = useState<HouseListItem[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Bulk association
  const [showBulk, setShowBulk] = useState(false)
  const [orphanStats, setOrphanStats] = useState<OrphanStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<string | null>(null)
  const [bulkHouses, setBulkHouses] = useState<{ id: string; name: string }[]>([])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [productsRes, housesRes] = await Promise.all([
        anagraficheService.getProducts({ limit: 500 }),
        anagraficheService.getHouses(),
      ])
      setProducts(productsRes.products)
      setHouses(housesRes.houses)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showModal) {
      loadData()
    }
  }, [showModal, loadData])

  const loadOrphanStats = async () => {
    setIsLoadingStats(true)
    try {
      const [stats, housesRes] = await Promise.all([
        anagraficheService.getOrphanStats(),
        anagraficheService.getHouses(),
      ])
      setOrphanStats(stats)
      setBulkHouses(housesRes.houses.map(h => ({ id: h.id, name: h.name })))
    } catch (error) {
      console.error('Failed to load orphan stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  useEffect(() => {
    if (showBulk && orphanStats === null) {
      loadOrphanStats()
    }
  }, [showBulk])

  const handleMigrate = async (houseId: string) => {
    setIsMigrating(true)
    setMigrationResult(null)
    try {
      const result = await anagraficheService.linkOrphanDataToHouse(houseId)
      setMigrationResult(
        `Associazione completata: ${result.total_linked} elementi collegati a "${result.house_name}"\n` +
        `- Categorie: ${result.categories_linked}\n` +
        `- Negozi: ${result.stores_linked}\n` +
        `- Alimenti: ${result.foods_linked}\n` +
        `- Prodotti: ${result.products_linked}`
      )
      loadOrphanStats()
    } catch (error: any) {
      setMigrationResult(`Errore: ${error.response?.data?.detail || 'Associazione fallita'}`)
    } finally {
      setIsMigrating(false)
    }
  }

  const handleHouseChange = async (productId: string, houseId: string | null) => {
    const updated = await anagraficheService.updateProductHouse(productId, houseId)
    setProducts(prev => prev.map(p => p.id === productId ? updated : p))
  }

  const filteredProducts = products.filter(p => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Amministrazione</h1>
        <p className="text-gray-600 text-sm mt-1">
          Gestione sistema, anagrafiche e strumenti avanzati
        </p>
      </div>

      <div className="space-y-3">
          {/* Gestione Proprietà Prodotti */}
          <button
            onClick={() => setShowModal(true)}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
          >
            <span className="text-2xl">🏠</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">Gestione Proprietà Prodotti</h3>
              <p className="text-gray-500 text-xs truncate">Assegna prodotti a una casa o rendili generici</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Associazione Massiva */}
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
          >
            <span className="text-2xl">🔗</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Associazione Massiva</h3>
                {orphanStats && orphanStats.total > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    {orphanStats.total} da associare
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs truncate">Collega tutti i dati orfani a una casa</p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${showBulk ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showBulk && (
            <div className="card p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Collega in blocco i dati esistenti (categorie, negozi, alimenti, prodotti)
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
                        {orphanStats.categories > 0 && <li>• Categorie: {orphanStats.categories}</li>}
                        {orphanStats.stores > 0 && <li>• Negozi: {orphanStats.stores}</li>}
                        {orphanStats.foods > 0 && <li>• Alimenti: {orphanStats.foods}</li>}
                        {orphanStats.products > 0 && <li>• Prodotti: {orphanStats.products}</li>}
                      </ul>
                      <p className="text-xs text-orange-600 mt-2">Totale: {orphanStats.total} elementi</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Seleziona la casa a cui collegare tutti i dati:
                      </p>
                      <div className="space-y-2">
                        {bulkHouses.map(house => (
                          <button
                            key={house.id}
                            onClick={() => handleMigrate(house.id)}
                            disabled={isMigrating}
                            className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-3"
                          >
                            <span className="text-lg">🏠</span>
                            <span className="font-medium">{house.name}</span>
                            {isMigrating && (
                              <span className="text-xs text-gray-500 ml-auto">Associazione in corso...</span>
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

          {/* Sorgenti Barcode */}
          <button
            onClick={() => navigate('/anagrafiche/barcode-sources')}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
          >
            <span className="text-2xl">🌐</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">Sorgenti Barcode</h3>
              <p className="text-gray-500 text-xs truncate">Siti API per la ricerca prodotti tramite codice a barre</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Backup & Restore */}
          <button
            onClick={() => navigate('/settings/import-database')}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
          >
            <span className="text-2xl">💾</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">Backup & Restore</h3>
              <p className="text-gray-500 text-xs truncate">Esporta o importa dati del database</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* SQL Console */}
          <button
            onClick={() => navigate('/settings/sql-console')}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left"
          >
            <span className="text-2xl">🗄️</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">SQL Console</h3>
              <p className="text-gray-500 text-xs truncate">Esegui query SQL direttamente sul database</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
      </div>

      {/* Modal Proprietà Prodotti */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Proprietà Prodotti</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Cerca prodotto per nome, barcode o marca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-gray-500">Caricamento prodotti...</div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-gray-500">
                    {search ? 'Nessun prodotto trovato' : 'Nessun prodotto in anagrafica'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                    {filteredProducts.length} prodott{filteredProducts.length === 1 ? 'o' : 'i'}
                  </div>
                  {filteredProducts.map(product => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      houses={houses}
                      onHouseChange={handleHouseChange}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
