interface ToastProps {
  toast: { message: string; type: 'success' | 'error' } | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-lg shadow-lg z-50 ${
        toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}
    >
      {toast.message}
    </div>
  )
}

export default Toast
