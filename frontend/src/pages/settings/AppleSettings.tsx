/**
 * Apple Settings Page
 * Installa Apple Health Shortcut per sincronizzazione automatica calorie
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const HEALTH_SERVER_DEFAULT = '192.168.1.52:8765'

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

// Direct file URL — iOS ATS blocks shortcuts:// from fetching HTTP/IP,
// but Safari can download .shortcut files directly and iOS prompts "Open in Comandi"
function buildInstallUrl(serverHost: string): string {
  return `http://${serverHost}/shortcut.file`
}

// Genera QR code via Google Charts API (no dep extra)
function qrUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&bgcolor=1a1f2e&color=e2e8f0&margin=10`
}

export function AppleSettings() {
  const [onIOS] = useState(isIOS)
  const [serverHost, setServerHost] = useState(HEALTH_SERVER_DEFAULT)
  const [, setInstallUrl] = useState('')
  const [installPageUrl, setInstallPageUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setInstallUrl(buildInstallUrl(serverHost))
    setInstallPageUrl(`http://${serverHost}/shortcut-install`)
  }, [serverHost])

  // Direct download: navigates to .shortcut file URL, Safari triggers "Open in Comandi"
  const handleInstall = () => {
    window.location.href = buildInstallUrl(serverHost)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/settings" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">🍎 Apple</h1>
          <p className="text-gray-500 text-sm">Integrazione con Apple Salute</p>
        </div>
      </div>

      {/* Card: Apple Health Sync */}
      <div className="card p-4 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">⚡</span>
          <div>
            <h2 className="font-semibold text-gray-900">Apple Health Shortcut</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Shortcut iOS che legge le calorie attive da Apple Salute e le sincronizza automaticamente ogni sera.
            </p>
          </div>
        </div>

        {/* Server host config */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Indirizzo server Mac
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverHost}
              onChange={e => setServerHost(e.target.value)}
              placeholder="192.168.1.x:8765"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Avvia il server sul Mac:&nbsp;
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-orange-600">
              python3 ~/HomeLab/doc/tools/health_receiver.py
            </code>
          </p>
        </div>

        {/* iOS: bottone diretto — scarica il .shortcut file, Safari apre Comandi */}
        {onIOS ? (
          <div className="space-y-3">
            <button
              onClick={handleInstall}
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-4 px-4 rounded-xl text-base transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span>⬇️</span>
              <span>Scarica Shortcut su questo iPhone</span>
            </button>
            <p className="text-xs text-center text-gray-400">
              Safari scarica il file → tocca "Apri" → Comandi si avvia
            </p>
          </div>
        ) : (
          /* Desktop: QR code */
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3 bg-gray-50 rounded-xl p-4">
              <img
                src={qrUrl(installPageUrl)}
                alt="QR Installa Shortcut"
                className="w-44 h-44 rounded-lg"
              />
              <p className="text-sm text-gray-500 text-center">
                📱 Scansiona con iPhone (stesso WiFi)
              </p>
              <div
                className="text-xs text-blue-500 bg-blue-50 rounded-lg px-3 py-1.5 cursor-pointer text-center break-all"
                onClick={() => copyToClipboard(installPageUrl)}
              >
                {copied ? '✅ Copiato!' : installPageUrl}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Istruzioni post-installazione */}
      <div className="card p-4 space-y-2">
        <h3 className="font-semibold text-gray-800 text-sm">📋 Dopo l'installazione</h3>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-bold text-gray-400 w-4 flex-shrink-0">1.</span>
            <span>Apri l'app <strong>Comandi</strong> → trova <strong>Weekly Calories Sync</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-gray-400 w-4 flex-shrink-0">2.</span>
            <span>Tocca i <strong>⋯</strong> → <strong>Aggiungi automazione</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-gray-400 w-4 flex-shrink-0">3.</span>
            <span>Scegli <strong>Ogni giorno → 23:00</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-gray-400 w-4 flex-shrink-0">4.</span>
            <span>Disattiva <strong>"Chiedi prima di eseguire"</strong></span>
          </li>
        </ol>
      </div>

      {/* Warning una-tantum */}
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-1">
        <p className="text-sm font-semibold text-orange-700">⚠️ Prima volta (una-tantum)</p>
        <p className="text-sm text-orange-600">
          Impostazioni → <strong>Comandi</strong> → attiva{' '}
          <strong>"Consenti comandi non attendibili"</strong>
        </p>
      </div>

    </div>
  )
}

export default AppleSettings
