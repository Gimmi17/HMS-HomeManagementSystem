import { useState } from 'react'
import type { Category } from '@/types'

interface PantryItemFormProps {
  mode: 'add' | 'edit'
  initialValues?: {
    name: string
    quantity: string
    unit: string
    expiry: string
    categoryId: string
    notes: string
  }
  categories: Category[]
  onSubmit: (data: {
    name: string
    quantity: string
    unit: string
    expiry: string
    categoryId: string
    notes: string
  }) => void
  onClose: () => void
  isSaving: boolean
}

export function PantryItemForm({ mode, initialValues, categories, onSubmit, onClose, isSaving }: PantryItemFormProps) {
  const [name, setName] = useState(initialValues?.name || '')
  const [quantity, setQuantity] = useState(initialValues?.quantity || '1')
  const [unit, setUnit] = useState(initialValues?.unit || '')
  const [expiry, setExpiry] = useState(initialValues?.expiry || '')
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId || '')
  const [notes, setNotes] = useState(initialValues?.notes || '')
  const [expiryError, setExpiryError] = useState('')

  const isValidExpiry = (input: string): boolean => {
    if (!input.trim()) return true
    if (/^(\d{2})(\d{2})(\d{2,4})$/.test(input)) return true
    if (/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/.test(input)) return true
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return true
    return false
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    if (expiry.trim() && !isValidExpiry(expiry.trim())) {
      setExpiryError('Formato data non valido. Usa DDMMYY o DD/MM/YYYY')
      return
    }
    setExpiryError('')
    onSubmit({ name, quantity, unit, expiry, categoryId, notes })
  }

  const title = mode === 'add' ? 'Aggiungi Prodotto' : 'Modifica Prodotto'
  const submitLabel = mode === 'add'
    ? (isSaving ? 'Salvataggio...' : 'Aggiungi')
    : 'Salva'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome prodotto"
              className="input w-full"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unita</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pz, kg, g..."
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
            <input
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={(e) => { setExpiry(e.target.value); setExpiryError('') }}
              placeholder="DDMMYY o DD/MM/YYYY"
              className={`input w-full ${expiryError ? 'border-red-500' : ''}`}
            />
            {expiryError && <p className="text-red-500 text-xs mt-1">{expiryError}</p>}
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input w-full"
              >
                <option value="">Nessuna</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note opzionali"
              className="input w-full"
            />
          </div>
        </div>
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSaving}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
