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
type FacingMode = 'environment' | 'user'
type ScanMode = 'focused' | 'extended'

const FRONT_CAMERA_ZOOM = 2.5
const GUIDE_SIZE = 224
const SCAN_CANVAS_SIZE = 400

async function applyZoomToStream(stream: MediaStream, zoom: number) {
  try {
    const track = stream.getVideoTracks()[0]
    const capabilities = track.getCapabilities?.()
    if (capabilities?.zoom) {
      const maxZoom = (capabilities.zoom as { max: number }).max || zoom
      const targetZoom = Math.min(zoom, maxZoom)
      await track.applyConstraints({ advanced: [{ zoom: targetZoom } as Record<string, unknown>] })
      return true
    }
  } catch { /* zoom not supported */ }
  return false
}

function getGuideCrop(
  video: HTMLVideoElement,
  container: HTMLDivElement,
  guideSize: number,
  zoom: number = 1,
) {
  const cw = container.clientWidth
  const ch = container.clientHeight
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!cw || !ch || !vw || !vh) return null

  const coverScale = Math.max(cw / vw, ch / vh)
  const effScale = coverScale * zoom
  const visW = cw / effScale
  const visH = ch / effScale
  const offX = (vw - visW) / 2
  const offY = (vh - visH) / 2
  const gx = (cw - guideSize) / 2
  const gy = (ch - guideSize) / 2

  return {
    x: offX + gx / effScale,
    y: offY + gy / effScale,
    w: guideSize / effScale,
    h: guideSize / effScale,
  }
}

export default function ContinuousBarcodeScanner({ onBarcodeDetected, onClose, scanLog }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rotCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastScanTimeRef = useRef<Map<string, number>>(new Map())
  const audioCtxRef = useRef<AudioContext | null>(null)

  const onBarcodeDetectedRef = useRef(onBarcodeDetected)
  onBarcodeDetectedRef.current = onBarcodeDetected

  const [cameraError, setCameraError] = useState<CameraError>(null)
  const [flashColor, setFlashColor] = useState<'none' | 'green' | 'yellow'>('none')
  const [isStarting, setIsStarting] = useState(true)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [cssZoom, setCssZoom] = useState(1)
  const cssZoomRef = useRef(1)
  cssZoomRef.current = cssZoom
  const [cooldownBarcode, setCooldownBarcode] = useState<string | null>(null)

  const [scanMode, setScanMode] = useState<ScanMode>('focused')
  const scanModeRef = useRef<ScanMode>('focused')
  scanModeRef.current = scanMode

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
    } catch { /* */ }
  }, [])

  const vibrate = useCallback(() => {
    if (!vibrateRef.current) return
    try { navigator.vibrate?.([50, 30, 50]) } catch { /* */ }
  }, [])

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const handleDetection = useCallback((barcode: string) => {
    const now = Date.now()
    const lastTime = lastScanTimeRef.current.get(barcode) || 0

    if (now - lastTime < COOLDOWN_MS) return

    lastScanTimeRef.current.set(barcode, now)

    playBeep()
    vibrate()

    setCooldownBarcode(barcode)
    setTimeout(() => setCooldownBarcode(null), 1200)

    onBarcodeDetectedRef.current(barcode)
  }, [playBeep, vibrate])

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
    setCameraError(null)
    setIsStarting(true)
    setCssZoom(1)
  }

  // Flash feedback when scanLog changes
  useEffect(() => {
    if (scanLog.length === 0) return
    const last = scanLog[scanLog.length - 1]
    setFlashColor(last.matched ? 'green' : 'yellow')
    const t = setTimeout(() => setFlashColor('none'), 800)
    return () => clearTimeout(t)
  }, [scanLog])

  // Start camera and detection
  useEffect(() => {
    let cancelled = false

    const startScanning = async () => {
      stopCamera()
      setCssZoom(1)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        })

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        if (facingMode === 'user') {
          const hwZoomApplied = await applyZoomToStream(stream, FRONT_CAMERA_ZOOM)
          if (!hwZoomApplied) setCssZoom(FRONT_CAMERA_ZOOM)
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setIsStarting(false)

        if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
        if (!rotCanvasRef.current) rotCanvasRef.current = document.createElement('canvas')

        const useNative = 'BarcodeDetector' in window && window.BarcodeDetector

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let nativeDetector: any = null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let zxingReader: any = null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let ZxingLuminance: any = null, ZxingBitmap: any = null, ZxingBinarizer: any = null

        if (useNative) {
          nativeDetector = new window.BarcodeDetector!({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
          })
        } else {
          const zxing = await import('@zxing/library')
          const hints = new Map()
          hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
            zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8,
            zxing.BarcodeFormat.UPC_A, zxing.BarcodeFormat.UPC_E,
          ])
          hints.set(zxing.DecodeHintType.TRY_HARDER, true)

          zxingReader = new zxing.MultiFormatReader()
          zxingReader.setHints(hints)
          ZxingLuminance = zxing.HTMLCanvasElementLuminanceSource
          ZxingBitmap = zxing.BinaryBitmap
          ZxingBinarizer = zxing.HybridBinarizer
        }

        const tryDetectCanvas = async (canvas: HTMLCanvasElement): Promise<string | null> => {
          if (nativeDetector) {
            try {
              const barcodes = await nativeDetector.detect(canvas)
              for (const bc of barcodes) {
                if (bc.rawValue) return bc.rawValue
              }
            } catch { /* skip */ }
            return null
          } else {
            try {
              const lum = new ZxingLuminance(canvas)
              const bmp = new ZxingBitmap(new ZxingBinarizer(lum))
              const result = zxingReader.decode(bmp)
              return result.getText()
            } catch { return null }
          }
        }

        intervalRef.current = setInterval(async () => {
          const video = videoRef.current
          if (!video || video.readyState < 2) return

          const mode = scanModeRef.current
          const canvas = canvasRef.current!

          // Canvas-based scanning
          if (mode === 'focused' && containerRef.current) {
            const crop = getGuideCrop(video, containerRef.current, GUIDE_SIZE, cssZoomRef.current)
            if (!crop) return
            canvas.width = SCAN_CANVAS_SIZE
            canvas.height = SCAN_CANVAS_SIZE
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, SCAN_CANVAS_SIZE, SCAN_CANVAS_SIZE)
          } else {
            const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
            canvas.width = Math.round(video.videoWidth * scale)
            canvas.height = Math.round(video.videoHeight * scale)
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          }

          let barcode = await tryDetectCanvas(canvas)
          if (barcode) { handleDetection(barcode); return }

          // Try 90° rotation for vertical barcodes
          const rot = rotCanvasRef.current!
          rot.width = canvas.height
          rot.height = canvas.width
          const rctx = rot.getContext('2d')!
          rctx.save()
          rctx.translate(canvas.height / 2, canvas.width / 2)
          rctx.rotate(Math.PI / 2)
          rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
          rctx.restore()

          barcode = await tryDetectCanvas(rot)
          if (barcode) handleDetection(barcode)
        }, 200)
      } catch (err: unknown) {
        if (cancelled) return
        setIsStarting(false)
        const error = err as DOMException
        if (error.name === 'NotAllowedError') setCameraError('not-allowed')
        else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') setCameraError('not-found')
        else setCameraError('generic')
      }
    }

    startScanning()

    return () => {
      cancelled = true
      stopCamera()
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [facingMode, handleDetection, stopCamera])

  const guideColor =
    flashColor === 'green' ? 'border-green-400' :
    flashColor === 'yellow' ? 'border-yellow-400' :
    'border-white/60'

  const videoStyle = facingMode === 'user'
    ? { transform: `scaleX(-1) scale(${cssZoom})`, transformOrigin: 'center center' }
    : cssZoom > 1 ? { transform: `scale(${cssZoom})`, transformOrigin: 'center center' } : undefined

  const content = (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white z-10">
        <div>
          <h2 className="text-lg font-semibold">Scansione Continua</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Scan mode toggle */}
          <button
            onClick={() => setScanMode(prev => prev === 'focused' ? 'extended' : 'focused')}
            className={`p-2 rounded-lg transition-colors ${
              scanMode === 'extended' ? 'bg-blue-500/30 text-blue-300' : 'bg-transparent text-white/40'
            }`}
            title={scanMode === 'focused' ? 'Attiva scansione estesa' : 'Torna a scansione focalizzata'}
          >
            {scanMode === 'focused' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            )}
          </button>
          {/* Camera flip */}
          <button
            onClick={toggleCamera}
            className="p-2 rounded-lg transition-colors bg-transparent text-white/70 hover:bg-white/20 hover:text-white"
            title="Cambia fotocamera"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3l1.5 1.5M15 3l-1.5 1.5" />
            </svg>
          </button>
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
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex items-center justify-center h-full px-8">
            <div className="text-center text-white">
              {cameraError === 'not-allowed' && (
                <>
                  <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <h3 className="text-xl font-bold mb-2">Permesso Negato</h3>
                  <p className="text-gray-300 text-sm">Vai nelle impostazioni del browser e consenti l'accesso alla fotocamera per questo sito.</p>
                </>
              )}
              {cameraError === 'not-found' && (
                <>
                  <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-xl font-bold mb-2">Nessuna Fotocamera</h3>
                  <p className="text-gray-300 text-sm">Nessuna fotocamera trovata sul dispositivo.</p>
                </>
              )}
              {cameraError === 'generic' && (
                <>
                  <h3 className="text-xl font-bold mb-2">Errore Fotocamera</h3>
                  <p className="text-gray-300 text-sm">Impossibile avviare la fotocamera. Verifica che il sito sia servito via HTTPS.</p>
                </>
              )}
              <button onClick={onClose} className="mt-6 px-6 py-2 bg-white/20 rounded-lg text-white hover:bg-white/30">Chiudi</button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={videoStyle}
              playsInline
              muted
            />

            {/* Focused mode: dark overlay with transparent cutout + corner markers */}
            {scanMode === 'focused' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="relative rounded-2xl"
                  style={{
                    width: GUIDE_SIZE,
                    height: GUIDE_SIZE,
                    boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)${
                      flashColor === 'green' ? ', 0 0 40px 5px #4ade80' :
                      flashColor === 'yellow' ? ', 0 0 40px 5px #facc15' : ''
                    }`,
                  }}
                >
                  <div className={`absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] rounded-tl-2xl transition-colors duration-300 ${guideColor}`} />
                  <div className={`absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] rounded-tr-2xl transition-colors duration-300 ${guideColor}`} />
                  <div className={`absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] rounded-bl-2xl transition-colors duration-300 ${guideColor}`} />
                  <div className={`absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] rounded-br-2xl transition-colors duration-300 ${guideColor}`} />
                </div>
              </div>
            )}

            {/* Extended mode: full-frame dashed border */}
            {scanMode === 'extended' && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className={`absolute inset-3 border border-dashed rounded-xl transition-colors duration-150 ${
                    flashColor === 'green' ? 'border-green-400' :
                    flashColor === 'yellow' ? 'border-yellow-400' :
                    'border-white/20'
                  }`}
                  style={{ boxShadow: flashColor !== 'none' ? `0 0 30px ${flashColor === 'green' ? '#4ade80' : '#facc15'}` : 'none' }}
                />
              </div>
            )}

            {/* Cooldown overlay */}
            {cooldownBarcode && (
              <div className="absolute inset-x-0 top-16 flex justify-center pointer-events-none z-20">
                <div className="bg-black/70 backdrop-blur-sm px-5 py-3 rounded-xl flex items-center gap-3 animate-pulse">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white font-mono text-sm">{cooldownBarcode}</span>
                </div>
              </div>
            )}

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
