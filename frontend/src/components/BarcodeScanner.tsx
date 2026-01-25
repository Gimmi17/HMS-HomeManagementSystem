import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

type PermissionState = 'checking' | 'granted' | 'denied' | 'prompt' | 'error'

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setPermissionState] = useState<PermissionState>('checking')
  const [retryCount, setRetryCount] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const checkCameraPermission = useCallback(async (): Promise<PermissionState> => {
    try {
      // First try the Permissions API (not supported in all browsers)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'denied') {
            return 'denied'
          }
          if (result.state === 'granted') {
            return 'granted'
          }
          return 'prompt'
        } catch {
          // Permissions API might not support camera, continue with fallback
        }
      }

      // Fallback: try to get user media to check permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      // Stop the stream immediately, we just wanted to check permission
      stream.getTracks().forEach(track => track.stop())
      return 'granted'
    } catch (err: unknown) {
      const error = err as { name?: string }
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'denied'
      }
      if (error.name === 'NotFoundError') {
        return 'error' // No camera found
      }
      return 'prompt'
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return

    setIsStarting(true)
    setError(null)

    try {
      // First check camera permission
      const permStatus = await checkCameraPermission()
      setPermissionState(permStatus)

      if (permStatus === 'denied') {
        setError('denied')
        setIsStarting(false)
        return
      }

      if (permStatus === 'error') {
        setError('Nessuna fotocamera trovata sul dispositivo.')
        setIsStarting(false)
        return
      }

      // Stop any existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {
          // Ignore stop errors
        }
      }

      const scanner = new Html5Qrcode('barcode-scanner-container')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          // Vibrate on successful scan
          if (navigator.vibrate) {
            navigator.vibrate(100)
          }
          onScan(decodedText)
        },
        () => {
          // Ignore QR code not found errors
        }
      )

      setIsStarting(false)
      setPermissionState('granted')
    } catch (err: unknown) {
      console.error('Scanner error:', err)
      const error = err as { name?: string; message?: string }
      if (error.name === 'NotAllowedError' || error.message?.includes('Permission')) {
        setPermissionState('denied')
        setError('denied')
      } else {
        // Show actual error for debugging
        const errorMsg = error.message || error.name || String(err)
        setError(`Errore fotocamera: ${errorMsg}`)
      }
      setIsStarting(false)
    }
  }, [checkCameraPermission, onScan])

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1)
  }, [])

  useEffect(() => {
    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [startScanner, retryCount])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <h2 className="text-white font-semibold">Scansiona Barcode</h2>
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex items-center justify-center p-4">
        {isStarting && !error && (
          <div className="text-white text-center">
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
            <p>Avvio fotocamera...</p>
          </div>
        )}

        {error === 'denied' && (
          <div className="text-center bg-gray-900 rounded-xl p-6 mx-4 max-w-sm">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">
              Fotocamera bloccata
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Per scansionare i barcode devi abilitare l'accesso alla fotocamera.
            </p>

            <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
              <p className="text-gray-400 text-xs font-medium mb-2">COME ABILITARE:</p>
              <ol className="text-gray-300 text-sm space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-400 font-bold">1.</span>
                  <span>Tocca l'icona <strong>lucchetto</strong> o <strong>⋮</strong> nella barra dell'indirizzo</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400 font-bold">2.</span>
                  <span>Seleziona <strong>"Autorizzazioni"</strong> o <strong>"Impostazioni sito"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400 font-bold">3.</span>
                  <span>Attiva <strong>"Fotocamera"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400 font-bold">4.</span>
                  <span>Torna qui e tocca <strong>"Riprova"</strong></span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-lg text-gray-400 font-medium hover:bg-gray-800"
              >
                Annulla
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
              >
                Riprova
              </button>
            </div>
          </div>
        )}

        {error && error !== 'denied' && (
          <div className="text-center bg-gray-900 rounded-xl p-6 mx-4 max-w-sm">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-300 mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-lg text-gray-400 font-medium hover:bg-gray-800"
              >
                Chiudi
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
              >
                Riprova
              </button>
            </div>
          </div>
        )}

        <div
          id="barcode-scanner-container"
          ref={containerRef}
          className={`w-full max-w-md ${isStarting || error ? 'hidden' : ''}`}
        />
      </div>

      {/* Instructions */}
      {!error && !isStarting && (
        <div className="p-4 bg-black/80 text-center">
          <p className="text-white text-sm">
            Inquadra il barcode del prodotto
          </p>
        </div>
      )}
    </div>
  )
}

export default BarcodeScanner
