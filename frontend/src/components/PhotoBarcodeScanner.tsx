import { useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface PhotoBarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function PhotoBarcodeScanner({ onScan, onClose }: PhotoBarcodeScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [showCamera, setShowCamera] = useState(false)

  const processImage = async (imageFile: File | Blob) => {
    setIsProcessing(true)
    setError(null)

    try {
      const html5QrCode = new Html5Qrcode("photo-scanner-temp")
      const result = await html5QrCode.scanFile(imageFile as File, true)

      // Vibrate on success
      if (navigator.vibrate) {
        navigator.vibrate(100)
      }

      onScan(result)
    } catch (err) {
      console.error('Scan error:', err)
      setError('Nessun barcode trovato nella foto. Riprova.')
      setIsProcessing(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    await processImage(file)
  }

  const startCamera = async () => {
    setShowCamera(true)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('Impossibile accedere alla fotocamera')
      setShowCamera(false)
    }
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    setShowCamera(false)

    // Get image as blob
    canvas.toBlob(async (blob) => {
      if (!blob) return

      // Show preview
      setCapturedImage(canvas.toDataURL('image/jpeg'))

      await processImage(blob)
    }, 'image/jpeg', 0.95)
  }

  const cancelCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    setShowCamera(false)
  }

  const resetScan = () => {
    setCapturedImage(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Hidden element for scanner */}
      <div id="photo-scanner-temp" className="hidden"></div>
      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <h2 className="text-white font-semibold">Scatta Foto Barcode</h2>
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {showCamera ? (
          // Camera view
          <div className="w-full max-w-md">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={cancelCamera}
                className="flex-1 py-3 rounded-lg bg-gray-700 text-white font-medium"
              >
                Annulla
              </button>
              <button
                onClick={capturePhoto}
                className="flex-1 py-3 rounded-lg bg-blue-500 text-white font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Scatta
              </button>
            </div>
          </div>
        ) : capturedImage ? (
          // Preview captured image
          <div className="w-full max-w-md text-center">
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full rounded-lg mb-4"
            />
            {isProcessing && (
              <div className="text-white">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                <p>Analisi barcode...</p>
              </div>
            )}
            {error && (
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={resetScan}
                  className="py-3 px-6 rounded-lg bg-blue-500 text-white font-medium"
                >
                  Riprova
                </button>
              </div>
            )}
          </div>
        ) : (
          // Initial state - choose method
          <div className="w-full max-w-md space-y-4">
            <p className="text-white text-center mb-6">
              Scegli come acquisire il barcode
            </p>

            {/* Camera button */}
            <button
              onClick={startCamera}
              className="w-full py-4 rounded-lg bg-blue-500 text-white font-medium flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              Scatta Foto
            </button>

            {/* File input button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-lg bg-gray-700 text-white font-medium flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Scegli dalla Galleria
            </button>

            {error && (
              <p className="text-red-400 text-center mt-4">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PhotoBarcodeScanner
