import { useState } from 'react'
import dispensaService from '@/services/dispensa'
import type { DispensaItem } from '@/types'

export interface ExpiryDateGroup {
  dateKey: string
  label: string
  totalQuantity: number
  unit: string | null
  entries: DispensaItem[]
  hasExpired: boolean
  hasExpiring: boolean
}

interface ExpiryGroupActionsModalProps {
  productName: string
  group: ExpiryDateGroup
  areaId: string
  houseId: string
  onComplete: () => void
  onClose: () => void
}

export default function ExpiryGroupActionsModal({
  productName,
  group,
  areaId,
  houseId,
  onComplete,
  onClose,
}: ExpiryGroupActionsModalProps) {
  const [activeTab, setActiveTab] = useState<'consume' | 'add' | 'change_date'>('consume')
  const [isProcessing, setIsProcessing] = useState(false)

  // Consume state
  const [consumeQty, setConsumeQty] = useState(group.totalQuantity)

  // Add state
  const [addQty, setAddQty] = useState(1)
  const [addUnit, setAddUnit] = useState(group.unit || '')

  // Change date state
  const [newDate, setNewDate] = useState(group.dateKey !== '__none__' ? group.dateKey : '')

  const handleConsume = async () => {
    if (consumeQty <= 0) return
    setIsProcessing(true)
    try {
      let remaining = consumeQty
      // FIFO: sorted entries (already sorted by expiry in the group)
      for (const entry of group.entries) {
        if (remaining <= 0) break
        if (remaining >= entry.quantity) {
          // Consume entire entry
          await dispensaService.consumeItem(houseId, entry.id)
          remaining -= entry.quantity
        } else {
          // Partial consume
          await dispensaService.consumeItem(houseId, entry.id, remaining)
          remaining = 0
        }
      }
      onComplete()
    } catch (err) {
      console.error('Consume failed:', err)
      alert('Errore durante il consumo')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAdd = async () => {
    if (addQty <= 0) return
    setIsProcessing(true)
    try {
      await dispensaService.createItem(houseId, {
        name: productName,
        quantity: addQty,
        unit: addUnit || undefined,
        expiry_date: group.dateKey !== '__none__' ? group.dateKey : undefined,
        area_id: areaId,
        category_id: group.entries[0]?.category_id || undefined,
      })
      onComplete()
    } catch (err) {
      console.error('Add failed:', err)
      alert('Errore durante l\'aggiunta')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleChangeDate = async () => {
    if (!newDate) return
    setIsProcessing(true)
    try {
      for (const entry of group.entries) {
        await dispensaService.updateItem(houseId, entry.id, { expiry_date: newDate })
      }
      onComplete()
    } catch (err) {
      console.error('Change date failed:', err)
      alert('Errore durante il cambio data')
    } finally {
      setIsProcessing(false)
    }
  }

  const tabs = [
    { id: 'consume' as const, label: 'Consuma', color: 'text-green-600' },
    { id: 'add' as const, label: 'Aggiungi', color: 'text-blue-600' },
    { id: 'change_date' as const, label: 'Cambia data', color: 'text-amber-600' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-auto sm:min-w-[360px] sm:max-w-md sm:rounded-xl rounded-t-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">{productName}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {group.label} &middot; {group.totalQuantity} {group.unit || 'pz'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? `${tab.color} border-b-2 border-current`
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeTab === 'consume' && (
            <>
              <div>
                <label className="label text-xs">Quantita' da consumare</label>
                <input
                  type="number"
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min={0.01}
                  max={group.totalQuantity}
                  step={0.01}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Max: {group.totalQuantity} {group.unit || 'pz'} ({group.entries.length} giacenze)
                </p>
              </div>
              <button
                onClick={handleConsume}
                disabled={isProcessing || consumeQty <= 0}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Consumo in corso...' : 'Consuma'}
              </button>
            </>
          )}

          {activeTab === 'add' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Quantita'</label>
                  <input
                    type="number"
                    value={addQty}
                    onChange={(e) => setAddQty(parseFloat(e.target.value) || 0)}
                    className="input w-full"
                    min={0.01}
                    step={0.01}
                  />
                </div>
                <div>
                  <label className="label text-xs">Unita'</label>
                  <input
                    type="text"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    placeholder="pz, kg, g..."
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs">Data scadenza</label>
                <input
                  type="text"
                  value={group.label}
                  className="input w-full bg-gray-50"
                  readOnly
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={isProcessing || addQty <= 0}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? 'Aggiunta in corso...' : 'Aggiungi'}
              </button>
            </>
          )}

          {activeTab === 'change_date' && (
            <>
              <div>
                <label className="label text-xs">Nuova data scadenza</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="input w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Aggiornera' {group.entries.length} {group.entries.length === 1 ? 'articolo' : 'articoli'}
                </p>
              </div>
              <button
                onClick={handleChangeDate}
                disabled={isProcessing || !newDate}
                className="w-full py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {isProcessing ? 'Aggiornamento...' : 'Cambia data'}
              </button>
            </>
          )}
        </div>

        {/* Cancel */}
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}
