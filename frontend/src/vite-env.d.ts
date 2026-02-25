/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// BarcodeDetector API (native, Chrome/Android)
interface BarcodeDetectorOptions {
  formats: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: Array<{ x: number; y: number }>
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
  static getSupportedFormats(): Promise<string[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}

// Extend MediaTrackCapabilities with zoom (not in default TS types)
interface MediaTrackCapabilities {
  zoom?: { min: number; max: number; step: number }
}
