interface DeleteConfirmModalProps {
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({ itemName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 mx-4 max-w-sm w-full text-center">
        <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Eliminare &ldquo;{itemName}&rdquo;?</h3>
        <p className="text-sm text-gray-500 mb-4">L&apos;articolo verr&agrave; rimosso dalla lista</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
}
