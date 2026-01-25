import { useEffect, useState } from 'react'
import grocyService from '@/services/grocy'
import type { GrocyStockItem } from '@/types'

export function Pantry() {
  const [stock, setStock] = useState<GrocyStockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const data = await grocyService.getStock()
        setStock(data)
      } catch (err) {
        setError('Impossibile connettersi a Grocy. Verifica la configurazione.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStock()
  }, [])

  const filteredStock = stock.filter((item) =>
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort by expiration date (closest first)
  const sortedStock = [...filteredStock].sort((a, b) => {
    if (!a.best_before_date) return 1
    if (!b.best_before_date) return -1
    return a.best_before_date.localeCompare(b.best_before_date)
  })

  const isExpiringSoon = (date?: string) => {
    if (!date) return false
    const expiryDate = new Date(date)
    const today = new Date()
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 3
  }

  const isExpired = (date?: string) => {
    if (!date) return false
    return new Date(date) < new Date()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dispensa</h1>
        <span className="text-sm text-gray-500">
          Sincronizzato con Grocy
        </span>
      </div>

      {error ? (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-red-500 mt-2">
            Assicurati che Grocy sia configurato correttamente nel backend.
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Cerca prodotti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input max-w-md"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">Prodotti totali</p>
              <p className="text-2xl font-bold">{stock.length}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">In scadenza (3 giorni)</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stock.filter((item) => isExpiringSoon(item.best_before_date) && !isExpired(item.best_before_date)).length}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Scaduti</p>
              <p className="text-2xl font-bold text-red-600">
                {stock.filter((item) => isExpired(item.best_before_date)).length}
              </p>
            </div>
          </div>

          {/* Stock list */}
          {isLoading ? (
            <p className="text-gray-500">Caricamento da Grocy...</p>
          ) : sortedStock.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">
                {searchQuery ? 'Nessun prodotto trovato' : 'Dispensa vuota'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Prodotto
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Quantità
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      Scadenza
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedStock.map((item) => (
                    <tr
                      key={item.product_id}
                      className={
                        isExpired(item.best_before_date)
                          ? 'bg-red-50'
                          : isExpiringSoon(item.best_before_date)
                          ? 'bg-yellow-50'
                          : ''
                      }
                    >
                      <td className="px-4 py-3 font-medium">{item.product_name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        {item.best_before_date ? (
                          <span
                            className={
                              isExpired(item.best_before_date)
                                ? 'text-red-600 font-medium'
                                : isExpiringSoon(item.best_before_date)
                                ? 'text-yellow-600 font-medium'
                                : 'text-gray-600'
                            }
                          >
                            {new Date(item.best_before_date).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Pantry
