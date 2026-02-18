import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ShoppingListItem } from '@/types'

interface ProductNoteModalProps {
  item: ShoppingListItem
  onSave: (note: string) => void
  onCancel: () => void
}

export function ProductNoteModal({ item, onSave, onCancel }: ProductNoteModalProps) {
  const [note, setNote] = useState(item.product_notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const barcode = item.scanned_barcode || item.catalog_barcode
    if (!barcode) {
      onSave(note.trim())
      return
    }

    setIsSaving(true)
    try {
      const { default: anagraficheService } = await import('@/services/anagrafiche')
      await anagraficheService.updateProductNotesByBarcode(barcode, note.trim() || null)
      onSave(note.trim())
    } catch (e) {
      console.warn('Failed to save product note:', e)
      onSave(note.trim())
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Nota Prodotto</h3>
          <p className="text-sm text-gray-500 mt-0.5">{item.grocy_product_name || item.name}</p>
        </div>

        {/* Content */}
        <div className="p-4">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es: Buona marca, Evitare..."
            className="w-full px-3 py-2.5 border rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
            autoFocus
          />
          {!(item.scanned_barcode || item.catalog_barcode) && (
            <p className="text-xs text-orange-500 mt-2">
              Nessun barcode associato: la nota sarà visibile solo localmente.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 border border-gray-200"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50"
          >
            {isSaving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ProductNoteModal
