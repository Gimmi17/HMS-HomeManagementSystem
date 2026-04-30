interface DeleteConfirmModalProps {
  // New unified props
  title?: string          // default: 'Conferma eliminazione'
  message?: string
  confirmLabel?: string   // default: 'Elimina'
  onConfirm: () => void
  onClose?: () => void
  isDeleting?: boolean    // default: false

  // Legacy props (backward compatibility with VerifyMode and others)
  itemName?: string
  onCancel?: () => void
}

export default function DeleteConfirmModal({
  title = 'Conferma eliminazione',
  message,
  confirmLabel = 'Elimina',
  onConfirm,
  onClose,
  isDeleting = false,
  // Legacy
  itemName,
  onCancel,
}: DeleteConfirmModalProps) {
  const resolvedMessage =
    message ?? (itemName ? `Eliminare "${itemName}"? L'articolo verrà rimosso dalla lista.` : '')
  const resolvedClose = onClose ?? onCancel ?? (() => {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 mx-4 max-w-sm w-full text-center">
        <svg
          className="w-12 h-12 text-red-500 mx-auto mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        {resolvedMessage && (
          <p className="text-sm text-gray-500 mb-4">{resolvedMessage}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={resolvedClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50"
          >
            {isDeleting ? 'Eliminazione...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
