import { useState } from 'react'
import type { DispensaItem, ShoppingListSummary } from '@/types'

interface PantryAddToListModalProps {
  entry: DispensaItem
  activeLists: ShoppingListSummary[]
  onAddToList: (listId: string, quantity: number) => void
  onCreateNewList: (quantity: number) => void
  onClose: () => void
  isLoading: boolean
}

export function PantryAddToListModal({
  entry,
  activeLists,
  onAddToList,
  onCreateNewList,
  onClose,
  isLoading,
}: PantryAddToListModalProps) {
  const [selectedListId, setSelectedListId] = useState(
    activeLists.length === 1 ? activeLists[0].id : ''
  )
  const [addQuantity, setAddQuantity] = useState('1')

  const quantity = parseFloat(addQuantity.replace(',', '.')) || 1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Aggiungi alla spesa</h3>
          <p className="text-sm text-gray-500 mt-1">{entry.name}</p>
        </div>
        <div className="p-4 space-y-4">
          {activeLists.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-gray-500">Nessuna lista attiva</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
              </div>
              <button
                onClick={() => onCreateNewList(quantity)}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isLoading ? 'Creazione...' : 'Crea nuova lista'}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
              </div>
              {activeLists.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lista *</label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Seleziona lista...</option>
                    {activeLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.item_count} articoli)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {activeLists.length === 1 && (
                <p className="text-sm text-gray-500">
                  Verra aggiunto a: <span className="font-medium">{activeLists[0].name}</span>
                </p>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
          {activeLists.length > 0 && (
            <button
              onClick={() => onAddToList(selectedListId, quantity)}
              disabled={!selectedListId || isLoading}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Aggiunta...' : 'Aggiungi'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
