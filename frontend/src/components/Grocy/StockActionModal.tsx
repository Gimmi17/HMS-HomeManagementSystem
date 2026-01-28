import { useState, useEffect } from 'react'
import type {
  GrocyStockItem,
  GrocyStockActionType,
  GrocyLocation,
  GrocyConsumeStockParams,
  GrocyOpenProductParams,
  GrocyTransferStockParams,
  GrocyInventoryCorrectionParams,
} from '@/types'

interface StockActionModalProps {
  item: GrocyStockItem
  action: GrocyStockActionType
  locations?: GrocyLocation[]
  onConfirm: (
    action: GrocyStockActionType,
    params: GrocyConsumeStockParams | GrocyOpenProductParams | GrocyTransferStockParams | GrocyInventoryCorrectionParams
  ) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const ACTION_TITLES: Record<GrocyStockActionType, string> = {
  consume: 'Consuma Prodotto',
  open: 'Apri Prodotto',
  transfer: 'Trasferisci Prodotto',
  inventory: 'Correggi Inventario',
}

const ACTION_DESCRIPTIONS: Record<GrocyStockActionType, string> = {
  consume: 'Rimuovi quantità dallo stock (prodotto usato o scartato)',
  open: 'Segna il prodotto come aperto',
  transfer: 'Sposta il prodotto in un\'altra posizione',
  inventory: 'Correggi la quantità totale in magazzino',
}

export function StockActionModal({
  item,
  action,
  locations = [],
  onConfirm,
  onClose,
  isLoading = false,
}: StockActionModalProps) {
  // Form state
  const [amount, setAmount] = useState(1)
  const [amountText, setAmountText] = useState('1')
  const [spoiled, setSpoiled] = useState(false)
  const [locationFrom, setLocationFrom] = useState<number | undefined>()
  const [locationTo, setLocationTo] = useState<number | undefined>()
  const [newAmount, setNewAmount] = useState(item.quantity)
  const [newAmountText, setNewAmountText] = useState(String(item.quantity).replace('.', ','))
  const [error, setError] = useState<string | null>(null)

  // Initialize location selectors
  useEffect(() => {
    if (locations.length > 0) {
      setLocationFrom(locations[0].id)
      setLocationTo(locations.length > 1 ? locations[1].id : locations[0].id)
    }
  }, [locations])

  // Parse quantity from text (handles both comma and dot as decimal separator)
  const parseQuantity = (text: string): number => {
    const normalized = text.replace(',', '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? 0 : parsed
  }

  const handleAmountChange = (text: string) => {
    const filtered = text.replace(/[^0-9.,]/g, '')
    setAmountText(filtered)
    setAmount(parseQuantity(filtered))
  }

  const handleNewAmountChange = (text: string) => {
    const filtered = text.replace(/[^0-9.,]/g, '')
    setNewAmountText(filtered)
    setNewAmount(parseQuantity(filtered))
  }

  const incrementAmount = (delta: number, isForNewAmount = false) => {
    if (isForNewAmount) {
      const newVal = Math.max(0, newAmount + delta)
      setNewAmount(newVal)
      setNewAmountText(String(Math.round(newVal * 10) / 10).replace('.', ','))
    } else {
      const newVal = Math.max(0.1, amount + delta)
      setAmount(newVal)
      setAmountText(String(Math.round(newVal * 10) / 10).replace('.', ','))
    }
  }

  const handleSubmit = async () => {
    setError(null)

    try {
      let params: GrocyConsumeStockParams | GrocyOpenProductParams | GrocyTransferStockParams | GrocyInventoryCorrectionParams

      switch (action) {
        case 'consume':
          if (amount <= 0) {
            setError('La quantità deve essere maggiore di 0')
            return
          }
          if (amount > item.quantity) {
            setError(`Non puoi consumare più di ${item.quantity} ${item.unit}`)
            return
          }
          params = { amount, spoiled }
          break

        case 'open':
          params = { amount: 1 }
          break

        case 'transfer':
          if (!locationFrom || !locationTo) {
            setError('Seleziona entrambe le posizioni')
            return
          }
          if (locationFrom === locationTo) {
            setError('Le posizioni devono essere diverse')
            return
          }
          if (amount <= 0 || amount > item.quantity) {
            setError(`Quantità non valida (max ${item.quantity})`)
            return
          }
          params = {
            amount,
            location_id_from: locationFrom,
            location_id_to: locationTo,
          }
          break

        case 'inventory':
          if (newAmount < 0) {
            setError('La quantità non può essere negativa')
            return
          }
          params = { new_amount: newAmount }
          break

        default:
          return
      }

      await onConfirm(action, params)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'operazione')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">{ACTION_TITLES[action]}</h3>
          <p className="text-sm text-gray-500 mt-1">{item.product_name}</p>
          <p className="text-xs text-gray-400 mt-1">{ACTION_DESCRIPTIONS[action]}</p>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Current stock info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Stock attuale:</span>
              <span className="font-medium">
                {item.quantity} {item.unit}
              </span>
            </div>
            {item.best_before_date && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Scadenza:</span>
                <span className="font-medium">
                  {new Date(item.best_before_date).toLocaleDateString('it-IT')}
                </span>
              </div>
            )}
          </div>

          {/* Consume form */}
          {action === 'consume' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantità da consumare
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => incrementAmount(-1)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="flex-1 text-center text-xl font-bold py-2 border rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => incrementAmount(1)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {item.unit}
                </p>
              </div>

              <label className="flex items-center gap-3 p-3 bg-red-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={spoiled}
                  onChange={(e) => setSpoiled(e.target.checked)}
                  className="w-5 h-5 text-red-600 rounded"
                />
                <div>
                  <span className="font-medium text-red-700">Prodotto scaduto/avariato</span>
                  <p className="text-xs text-red-600">Segna come spreco alimentare</p>
                </div>
              </label>
            </>
          )}

          {/* Open form */}
          {action === 'open' && (
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-gray-600">
                Segna 1 unità di <strong>{item.product_name}</strong> come aperta
              </p>
            </div>
          )}

          {/* Transfer form */}
          {action === 'transfer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantità da trasferire
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => incrementAmount(-1)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="flex-1 text-center text-xl font-bold py-2 border rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => incrementAmount(1)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Da posizione
                  </label>
                  <select
                    value={locationFrom}
                    onChange={(e) => setLocationFrom(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    A posizione
                  </label>
                  <select
                    value={locationTo}
                    onChange={(e) => setLocationTo(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Inventory correction form */}
          {action === 'inventory' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nuova quantità totale
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => incrementAmount(-1, true)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newAmountText}
                  onChange={(e) => handleNewAmountChange(e.target.value)}
                  className="flex-1 text-center text-xl font-bold py-2 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => incrementAmount(1, true)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {item.unit}
              </p>
              {newAmount !== item.quantity && (
                <p className="text-sm text-center mt-2">
                  {newAmount > item.quantity ? (
                    <span className="text-green-600">
                      +{(newAmount - item.quantity).toFixed(1)} {item.unit}
                    </span>
                  ) : (
                    <span className="text-red-600">
                      {(newAmount - item.quantity).toFixed(1)} {item.unit}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              action === 'consume' && spoiled
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isLoading ? 'Elaborazione...' : 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StockActionModal
