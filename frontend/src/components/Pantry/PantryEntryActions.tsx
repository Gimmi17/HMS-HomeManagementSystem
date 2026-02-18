import type { DispensaItem } from '@/types'

interface PantryEntryActionsProps {
  entry: DispensaItem
  onConsume: () => void
  onPartialConsume: () => void
  onUnconsume: () => void
  onEdit: () => void
  onDelete: () => void
  onAddToList: () => void
  onGoToSource: () => void
  onClose: () => void
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function PantryEntryActions({
  entry,
  onConsume,
  onPartialConsume,
  onUnconsume,
  onEdit,
  onDelete,
  onAddToList,
  onGoToSource,
  onClose,
}: PantryEntryActionsProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl shadow-xl w-full max-w-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <h3 className="font-semibold text-lg">{entry.name}</h3>
          <p className="text-sm text-gray-500">
            {entry.quantity} {entry.unit || 'pz'}
            {entry.expiry_date && ` - Scad: ${formatDate(entry.expiry_date)}`}
          </p>
        </div>
        <div className="p-2">
          {entry.is_consumed ? (
            <button
              onClick={onUnconsume}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </span>
              <div className="text-left">
                <p className="font-medium">Ripristina</p>
                <p className="text-xs text-gray-500">Riporta in dispensa</p>
              </div>
            </button>
          ) : (
            <>
              <button
                onClick={onConsume}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div className="text-left">
                  <p className="font-medium">Consuma</p>
                  <p className="text-xs text-gray-500">Segna come consumato</p>
                </div>
              </button>

              {entry.quantity > 1 && (
                <button
                  onClick={onPartialConsume}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </span>
                  <div className="text-left">
                    <p className="font-medium">Consumo parziale</p>
                    <p className="text-xs text-gray-500">Riduci la quantita</p>
                  </div>
                </button>
              )}
            </>
          )}

          <button
            onClick={onEdit}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            <div className="text-left">
              <p className="font-medium">Modifica</p>
              <p className="text-xs text-gray-500">Modifica i dettagli</p>
            </div>
          </button>

          {entry.source_list_id && (
            <button
              onClick={onGoToSource}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
              <div className="text-left">
                <p className="font-medium">Vai alla spesa</p>
                <p className="text-xs text-gray-500">Vedi la lista da cui proviene</p>
              </div>
            </button>
          )}

          <button
            onClick={onAddToList}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            <div className="text-left">
              <p className="font-medium">Aggiungi alla spesa</p>
              <p className="text-xs text-gray-500">Aggiungi a una lista attiva</p>
            </div>
          </button>

          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </span>
            <div className="text-left">
              <p className="font-medium text-red-600">Elimina</p>
              <p className="text-xs text-gray-500">Rimuovi dalla dispensa</p>
            </div>
          </button>
        </div>
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}
