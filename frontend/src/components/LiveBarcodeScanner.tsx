import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onScan: (barcode: string) => void
  onClose: () => void
}

type CameraError = 'not-allowed' | 'not-found' | 'generic' | null

export default function LiveBarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const scannedRef = useRef(false)

  const [cameraError, setCameraError] = useState<CameraError>(null)
  const [isStarting, setIsStarting] = useState(true)
  const [flashColor, setFlashColor] = useState(false)

  // Feedback toggles (beep OFF, vibration ON by default)
  const [beepEnabled, setBeepEnabled] = useState(false)
  const [vibrateEnabled, setVibrateEnabled] = useState(true)
  const beepRef = useRef(false)
  const vibrateRef = useRef(true)
  beepRef.current = beepEnabled
  vibrateRef.current = vibrateEnabled

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop()
      zxingControlsRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  const handleDetection = useCallback((barcode: string) => {
    if (scannedRef.current) return
    scannedRef.current = true

    // Beep
    if (beepRef.current) {
      try {
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.type = 'square'
        oscillator.frequency.value = 1200
        gain.gain.value = 0.3
        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.1)
      } catch { /* */ }
    }

    // Vibrate
    if (vibrateRef.current) {
      try { navigator.vibrate?.(100) } catch { /* */ }
    }

    // Flash green
    setFlashColor(true)

    // Return barcode after brief visual feedback
    setTimeout(() => {
      cleanup()
      onScan(barcode)
    }, 250)
  }, [onScan, cleanup])

  useEffect(() => {
    let cancelled = false

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setIsStarting(false)

        // Strategy A: Native BarcodeDetector
        if ('BarcodeDetector' in window && window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
          })

          intervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              for (const bc of barcodes) {
                if (bc.rawValue) {
                  handleDetection(bc.rawValue)
                  return
                }
              }
            } catch { /* skip frame */ }
          }, 150)
        } else {
          // Strategy B: zxing fallback
          try {
            const { BrowserMultiFormatReader } = await import('@zxing/browser')
            const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')

            const hints = new Map()
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
            ])

            const reader = new BrowserMultiFormatReader(hints)

            const controls = await reader.decodeFromVideoElement(videoRef.current!, (result) => {
              if (result) {
                handleDetection(result.getText())
              }
            })
            zxingControlsRef.current = controls
          } catch (e) {
            console.error('zxing init failed:', e)
          }
        }
      } catch (err: unknown) {
        if (cancelled) return
        setIsStarting(false)
        const error = err as DOMException
        if (error.name === 'NotAllowedError') {
          setCameraError('not-allowed')
        } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
          setCameraError('not-found')
        } else {
          setCameraError('generic')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [handleDetection, cleanup])

  const handleClose = () => {
    cleanup()
    onClose()
  }

  const borderColor = flashColor ? 'border-green-400' : 'border-white/60'

  const content = (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white z-10">
        <h2 className="text-lg font-semibold">Scansiona Barcode</h2>
        <div className="flex items-center gap-2">
          {/* Beep toggle */}
          <button
            onClick={() => setBeepEnabled(v => !v)}
            className={`p-2 rounded-lg transition-colors ${beepEnabled ? 'bg-white/20 text-white' : 'bg-transparent text-white/40'}`}
            title={beepEnabled ? 'Beep attivo' : 'Beep disattivo'}
          >
            {beepEnabled ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.788V15.21a.5.5 0 00.724.447l5.776-3.212a.5.5 0 000-.894L7.224 8.34A.5.5 0 006.5 8.788z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
          {/* Vibration toggle */}
          <button
            onClick={() => setVibrateEnabled(v => !v)}
            className={`p-2 rounded-lg transition-colors ${vibrateEnabled ? 'bg-white/20 text-white' : 'bg-transparent text-white/40'}`}
            title={vibrateEnabled ? 'Vibrazione attiva' : 'Vibrazione disattiva'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {vibrateEnabled ? (
                <>
                  <rect x="8" y="4" width="8" height="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8v8M19 8v8M2 10v4M22 10v4" />
                </>
              ) : (
                <>
                  <rect x="8" y="4" width="8" height="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </>
              )}
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex items-center justify-center h-full px-8">
            <div className="text-center text-white">
              {cameraError === 'not-allowed' && (
                <>
                  <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <h3 className="text-xl font-bold mb-2">Permesso Negato</h3>
                  <p className="text-gray-300 text-sm">
                    La fotocamera non e' accessibile. Vai nelle impostazioni del browser e consenti l'accesso alla fotocamera.
                  </p>
                </>
              )}
              {cameraError === 'not-found' && (
                <>
                  <h3 className="text-xl font-bold mb-2">Nessuna Fotocamera</h3>
                  <p className="text-gray-300 text-sm">Nessuna fotocamera trovata sul dispositivo.</p>
                </>
              )}
              {cameraError === 'generic' && (
                <>
                  <h3 className="text-xl font-bold mb-2">Errore Fotocamera</h3>
                  <p className="text-gray-300 text-sm">Impossibile avviare la fotocamera. Verifica HTTPS.</p>
                </>
              )}
              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2 bg-white/20 rounded-lg text-white hover:bg-white/30"
              >
                Chiudi
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scanning guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-72 h-36 border-2 rounded-lg transition-colors duration-150 ${borderColor}`}
                style={{ boxShadow: flashColor ? '0 0 20px #4ade80' : 'none' }}
              />
            </div>

            {/* Bottom bar: hint + back button */}
            <div className="absolute bottom-0 left-0 right-0 pb-6 pt-3 flex flex-col items-center gap-3 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white/80 text-sm">
                Inquadra il barcode nel riquadro
              </p>
              <button
                onClick={handleClose}
                className="px-8 py-2.5 bg-white/20 rounded-lg text-white font-medium hover:bg-white/30 backdrop-blur-sm"
              >
                Indietro
              </button>
            </div>

            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-white text-center">
                  <svg className="w-8 h-8 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm">Avvio fotocamera...</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
