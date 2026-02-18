import { useState } from 'react'
import type { DispensaItem } from '@/types'

interface PantryConsumeModalProps {
  item: DispensaItem
  onConfirm: (quantity: number) => void
  onClose: () => void
}

export function PantryConsumeModal({ item, onConfirm, onClose }: PantryConsumeModalProps) {
  const [consumeQuantity, setConsumeQuantity] = useState('')

  const handleConfirm = () => {
    const qty = parseFloat(consumeQuantity.replace(',', '.'))
    if (!qty || qty <= 0) return
    onConfirm(qty)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold">Consumo parziale</h3>
          <p className="text-sm text-gray-500 mt-1">
            {item.name} - Disponibile: {item.quantity} {item.unit || 'pz'}
          </p>
        </div>
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantita da consumare</label>
          <input
            type="text"
            inputMode="decimal"
            value={consumeQuantity}
            onChange={(e) => setConsumeQuantity(e.target.value)}
            placeholder="es: 2"
            className="input w-full text-center text-lg"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
          />
        </div>
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!consumeQuantity}
            className="flex-1 py-2 rounded-lg bg-yellow-500 text-white font-medium hover:bg-yellow-600 disabled:opacity-50"
          >
            Consuma
          </button>
        </div>
      </div>
    </div>
  )
}
