import type { ShoppingListItem } from '@/types'

interface ItemActionMenuProps {
  item: ShoppingListItem
  onEdit: () => void
  onEditNote: () => void
  onSendTo: () => void
  onClose: () => void
}

export function ItemActionMenu({ item, onEdit, onEditNote, onSendTo, onClose }: ItemActionMenuProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl shadow-xl w-full max-w-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <h3 className="font-semibold text-lg">{item.grocy_product_name || item.name}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
            <span>{item.quantity} {item.unit || 'pz'}</span>
            {item.checked && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Spuntato</span>
            )}
            {item.verified_at && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Verificato</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-2">
          {/* Modifica */}
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            <div className="text-left">
              <p className="font-medium">Modifica</p>
              <p className="text-xs text-gray-500">Modifica i dettagli dell'articolo</p>
            </div>
          </button>

          {/* Modifica nota articolo */}
          <button
            onClick={onEditNote}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </span>
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium">Modifica nota articolo</p>
              <p className="text-xs text-gray-500">Aggiungi o modifica il commento sul prodotto</p>
              {item.product_notes && (
                <p className="text-xs text-blue-600 italic mt-1 truncate">{item.product_notes}</p>
              )}
            </div>
          </button>

          {/* Invia a... */}
          <button
            onClick={onSendTo}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </span>
            <div className="text-left">
              <p className="font-medium">Invia a...</p>
              <p className="text-xs text-gray-500">Sposta l'articolo in un'altra lista</p>
            </div>
          </button>
        </div>

        {/* Close button */}
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

export default ItemActionMenu
