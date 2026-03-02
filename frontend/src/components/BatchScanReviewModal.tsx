import { useState } from 'react'
import type { Category } from '@/types'

export interface BatchItemData {
  barcode: string
  name: string
  brandText: string
  categoryId: string
  expiryDate: string
  quantity: number
  notes: string
  matched: boolean
}

interface BatchScanReviewModalProps {
  items: BatchItemData[]
  categories: Category[]
  areaId: string
  houseId: string
  onSave: (items: BatchItemData[]) => void
  onClose: () => void
}

export default function BatchScanReviewModal({
  items: initialItems,
  categories,
  onSave,
  onClose,
}: BatchScanReviewModalProps) {
  const [items, setItems] = useState<BatchItemData[]>(initialItems)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const updateItem = (idx: number, updates: Partial<BatchItemData>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item))
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    if (expandedIdx === idx) setExpandedIdx(null)
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1)
  }

  const handleSave = async () => {
    if (items.length === 0) return
    setIsSaving(true)
    try {
      await onSave(items)
    } finally {
      setIsSaving(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white w-full sm:w-auto sm:min-w-[360px] sm:max-w-md sm:rounded-xl rounded-t-xl" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">Revisione Scansioni</h3>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-500 text-sm">Nessun articolo da salvare</p>
          </div>
          <div className="p-4 border-t">
            <button onClick={onClose} className="w-full py-2.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              Chiudi
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-auto sm:min-w-[360px] sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0">
          <h3 className="font-semibold text-lg">Revisione Scansioni</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length} {items.length === 1 ? 'articolo' : 'articoli'} scansionati
          </p>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {items.map((item, idx) => {
            const isExpanded = expandedIdx === idx
            return (
              <div key={`${item.barcode}-${idx}`} className="bg-white">
                {/* Row summary */}
                <div className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.matched ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{item.barcode}</span>
                        <span>x{item.quantity}</span>
                        {item.brandText && <span className="text-purple-600">{item.brandText}</span>}
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    title="Rimuovi"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Expanded edit form */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 bg-gray-50 border-t">
                    <div className="pt-3">
                      <label className="text-xs font-medium text-gray-500">Nome</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        className="input w-full mt-0.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Marca</label>
                        <input
                          type="text"
                          value={item.brandText}
                          onChange={(e) => updateItem(idx, { brandText: e.target.value })}
                          className="input w-full mt-0.5"
                          placeholder="Marca"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Quantita'</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="input w-full mt-0.5"
                          min={1}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Categoria</label>
                      <select
                        value={item.categoryId}
                        onChange={(e) => updateItem(idx, { categoryId: e.target.value })}
                        className="input w-full mt-0.5"
                      >
                        <option value="">Nessuna</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Scadenza</label>
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => updateItem(idx, { expiryDate: e.target.value })}
                        className="input w-full mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Note</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItem(idx, { notes: e.target.value })}
                        className="input w-full mt-0.5"
                        placeholder="Note opzionali"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0 flex gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || items.length === 0}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Salvataggio...' : `Salva tutto (${items.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
