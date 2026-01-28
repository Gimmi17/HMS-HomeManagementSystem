import { useEffect, useState } from 'react'
import grocyService from '@/services/grocy'
import { StockActionModal } from '@/components/Grocy'
import type {
  GrocyStockItem,
  GrocyStockActionType,
  GrocyLocation,
  GrocyConsumeStockParams,
  GrocyOpenProductParams,
  GrocyTransferStockParams,
  GrocyInventoryCorrectionParams,
} from '@/types'

export function Pantry() {
  const [stock, setStock] = useState<GrocyStockItem[]>([])
  const [locations, setLocations] = useState<GrocyLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<GrocyStockItem | null>(null)
  const [actionType, setActionType] = useState<GrocyStockActionType | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stockData, locationsData] = await Promise.all([
          grocyService.getStock(),
          grocyService.getLocations().catch(() => []),
        ])
        setStock(stockData)
        setLocations(locationsData)
      } catch (err) {
        setError('Impossibile connettersi a Grocy. Verifica la configurazione.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAction = (item: GrocyStockItem, action: GrocyStockActionType) => {
    setSelectedItem(item)
    setActionType(action)
  }

  const handleActionConfirm = async (
    action: GrocyStockActionType,
    params: GrocyConsumeStockParams | GrocyOpenProductParams | GrocyTransferStockParams | GrocyInventoryCorrectionParams
  ) => {
    if (!selectedItem) return

    setIsActionLoading(true)
    try {
      const productId = Number(selectedItem.product_id)
      let result

      switch (action) {
        case 'consume':
          result = await grocyService.consumeStock(productId, params as GrocyConsumeStockParams)
          break
        case 'open':
          result = await grocyService.openProduct(productId, params as GrocyOpenProductParams)
          break
        case 'transfer':
          result = await grocyService.transferStock(productId, params as GrocyTransferStockParams)
          break
        case 'inventory':
          result = await grocyService.inventoryCorrection(productId, params as GrocyInventoryCorrectionParams)
          break
      }

      if (result?.success) {
        showToast(result.message, 'success')
        // Refresh stock
        const newStock = await grocyService.getStock()
        setStock(newStock)
        setSelectedItem(null)
        setActionType(null)
      } else {
        showToast(result?.error || 'Operazione fallita', 'error')
      }
    } catch (err) {
      showToast('Errore durante l\'operazione', 'error')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleActionClose = () => {
    setSelectedItem(null)
    setActionType(null)
  }

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
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                      Azioni
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
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleAction(item, 'consume')}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Consuma"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleAction(item, 'open')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Apri"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleAction(item, 'inventory')}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Correggi"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Stock Action Modal */}
      {selectedItem && actionType && (
        <StockActionModal
          item={selectedItem}
          action={actionType}
          locations={locations}
          onConfirm={handleActionConfirm}
          onClose={handleActionClose}
          isLoading={isActionLoading}
        />
      )}
    </div>
  )
}

export default Pantry
