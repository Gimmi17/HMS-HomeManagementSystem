import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface ScanLogEntry {
  barcode: string
  productName?: string
  matched: boolean
  quantity: number
  timestamp: number
}

interface Props {
  onBarcodeDetected: (barcode: string) => void
  onClose: () => void
  scanLog: ScanLogEntry[]
}

type CameraError = 'not-allowed' | 'not-found' | 'generic' | null

export default function ContinuousBarcodeScanner({ onBarcodeDetected, onClose, scanLog }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const lastScanTimeRef = useRef<Map<string, number>>(new Map())
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [cameraError, setCameraError] = useState<CameraError>(null)
  const [flashColor, setFlashColor] = useState<'none' | 'green' | 'yellow'>('none')
  const [isStarting, setIsStarting] = useState(true)
  const [apiUsed, setApiUsed] = useState<'native' | 'zxing' | null>(null)

  // Feedback toggles (beep OFF, vibration ON by default)
  const [beepEnabled, setBeepEnabled] = useState(false)
  const [vibrateEnabled, setVibrateEnabled] = useState(true)
  const beepRef = useRef(false)
  const vibrateRef = useRef(true)
  beepRef.current = beepEnabled
  vibrateRef.current = vibrateEnabled

  const COOLDOWN_MS = 2500

  const playBeep = useCallback(() => {
    if (!beepRef.current) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.type = 'square'
      oscillator.frequency.value = 1200
      gain.gain.value = 0.3
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.1)
    } catch {
      // Audio not available
    }
  }, [])

  const vibrate = useCallback(() => {
    if (!vibrateRef.current) return
    try {
      navigator.vibrate?.(100)
    } catch {
      // Vibration not available
    }
  }, [])

  const handleDetection = useCallback((barcode: string) => {
    const now = Date.now()
    const lastTime = lastScanTimeRef.current.get(barcode) || 0

    if (now - lastTime < COOLDOWN_MS) return

    lastScanTimeRef.current.set(barcode, now)

    playBeep()
    vibrate()
    onBarcodeDetected(barcode)
  }, [onBarcodeDetected, playBeep, vibrate])

  // Flash feedback when scanLog changes
  useEffect(() => {
    if (scanLog.length === 0) return
    const last = scanLog[scanLog.length - 1]
    setFlashColor(last.matched ? 'green' : 'yellow')
    const t = setTimeout(() => setFlashColor('none'), 300)
    return () => clearTimeout(t)
  }, [scanLog])

  // Start camera and detection
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
          setApiUsed('native')
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
                }
              }
            } catch {
              // Detection frame error, skip
            }
          }, 150)
        } else {
          // Strategy B: zxing fallback (lazy load)
          setApiUsed('zxing')
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
    }
  }, [handleDetection])

  const borderColor =
    flashColor === 'green' ? 'border-green-400' :
    flashColor === 'yellow' ? 'border-yellow-400' :
    'border-white/60'

  const content = (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white z-10">
        <div>
          <h2 className="text-lg font-semibold">Scansione Continua</h2>
          {apiUsed && (
            <span className="text-xs text-gray-400">
              {apiUsed === 'native' ? 'BarcodeDetector API' : 'zxing fallback'}
            </span>
          )}
        </div>
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
            onClick={onClose}
            className="px-4 py-2 bg-white/20 rounded-lg text-white font-medium hover:bg-white/30"
          >
            Fatto
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
                    La fotocamera non e' accessibile. Vai nelle impostazioni del browser e consenti l'accesso alla fotocamera per questo sito.
                  </p>
                </>
              )}
              {cameraError === 'not-found' && (
                <>
                  <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-xl font-bold mb-2">Nessuna Fotocamera</h3>
                  <p className="text-gray-300 text-sm">
                    Nessuna fotocamera trovata sul dispositivo.
                  </p>
                </>
              )}
              {cameraError === 'generic' && (
                <>
                  <h3 className="text-xl font-bold mb-2">Errore Fotocamera</h3>
                  <p className="text-gray-300 text-sm">
                    Impossibile avviare la fotocamera. Verifica che il sito sia servito via HTTPS.
                  </p>
                </>
              )}
              <button
                onClick={onClose}
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

            {/* Scanning guide rectangle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-72 h-36 border-2 rounded-lg transition-colors duration-150 ${borderColor}`}
                style={{ boxShadow: flashColor !== 'none' ? `0 0 20px ${flashColor === 'green' ? '#4ade80' : '#facc15'}` : 'none' }}
              />
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

      {/* Scan log panel */}
      {scanLog.length > 0 && (
        <div className="max-h-[40vh] overflow-y-auto bg-gray-900/95 border-t border-gray-700">
          <div className="px-4 py-2 border-b border-gray-700">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Scansioni ({scanLog.length})
            </span>
          </div>
          <div className="divide-y divide-gray-800">
            {[...scanLog].reverse().map((entry, idx) => (
              <div key={`${entry.barcode}-${idx}`} className="px-4 py-2.5 flex items-center gap-3">
                {entry.matched ? (
                  <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {entry.productName || entry.barcode}
                  </p>
                  {entry.productName && (
                    <p className="text-xs text-gray-500 font-mono">{entry.barcode}</p>
                  )}
                </div>
                {entry.quantity > 1 && (
                  <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
                    x{entry.quantity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
