import type { GrocyStockItem, GrocyStockActionType } from '@/types'

interface PantryGrocySectionProps {
  grocyStock: GrocyStockItem[]
  showGrocy: boolean
  grocyError: boolean
  onToggle: () => void
  onAction: (item: GrocyStockItem, actionType: GrocyStockActionType) => void
}

export function PantryGrocySection({
  grocyStock,
  showGrocy,
  grocyError,
  onToggle,
  onAction,
}: PantryGrocySectionProps) {
  return (
    <div className="mt-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-600">Stock Grocy</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${showGrocy ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showGrocy && (
        <div className="mt-2">
          {grocyError ? (
            <div className="card bg-red-50 border-red-200 p-3">
              <p className="text-red-600 text-sm">Impossibile connettersi a Grocy.</p>
            </div>
          ) : grocyStock.length === 0 ? (
            <div className="card text-center py-6">
              <p className="text-gray-500 text-sm">Nessun prodotto in Grocy</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Prodotto</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Scadenza</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grocyStock.map((item) => (
                    <tr key={item.product_id}>
                      <td className="px-3 py-2 font-medium">{item.product_name}</td>
                      <td className="px-3 py-2 text-gray-600">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-2">
                        {item.best_before_date ? (
                          <span className="text-gray-600">
                            {new Date(item.best_before_date).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => onAction(item, 'consume')}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Consuma"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onAction(item, 'open')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Apri"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onAction(item, 'inventory')}
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
        </div>
      )}
    </div>
  )
}
