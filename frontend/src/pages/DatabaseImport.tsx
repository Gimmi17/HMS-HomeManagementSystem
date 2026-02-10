import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'

interface ImportError {
  statement: string
  error: string
}

interface ImportResult {
  success: boolean
  message: string
  executed: number
  skipped: number
  errors: ImportError[]
}

function ErrorRow({ index, error }: { index: number; error: ImportError }) {
  const [open, setOpen] = useState(false)
  // Show a short preview: first meaningful part of the statement
  const preview = error.statement.length > 80
    ? error.statement.substring(0, 80) + '...'
    : error.statement

  return (
    <div className="bg-red-100 rounded overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-red-700 hover:bg-red-200/50 transition-colors"
      >
        <span className="truncate flex-1 font-medium">
          #{index + 1} - {preview}
        </span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-red-200">
          <div className="mt-1.5">
            <span className="text-red-500 font-medium">Errore:</span>
            <pre className="text-red-700 font-mono whitespace-pre-wrap break-all mt-0.5">{error.error}</pre>
          </div>
          <div>
            <span className="text-red-500 font-medium">Statement:</span>
            <pre className="text-red-600 font-mono whitespace-pre-wrap break-all mt-0.5 max-h-32 overflow-y-auto">{error.statement}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorsSection({ errors }: { errors: ImportError[] }) {
  const [copied, setCopied] = useState(false)

  const handleCopyAll = async () => {
    const text = errors
      .map((err, i) => `--- Errore #${i + 1} ---\nStatement: ${err.statement}\nErrore: ${err.error}`)
      .join('\n\n')

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts (HTTP)
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Last resort: open in a new window so user can copy manually
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      window.open(url)
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-red-700">
          Errori ({errors.length}):
        </p>
        <button
          type="button"
          onClick={handleCopyAll}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors
            bg-white border-red-300 text-red-600 hover:bg-red-50"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copiati!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copia tutti
            </>
          )}
        </button>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {errors.map((err, i) => (
          <ErrorRow key={i} index={i} error={err} />
        ))}
      </div>
    </div>
  )
}

export function DatabaseImport() {
  const token = localStorage.getItem('access_token')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)
    setExportSuccess(false)

    try {
      const response = await fetch('/api/v1/admin/export-database', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Errore durante l\'export')
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'backup.sql'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) {
          filename = match[1]
        }
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.sql')) {
        setError('Seleziona un file .sql')
        return
      }
      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Seleziona un file prima')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/v1/admin/import-database', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Errore durante l\'import')
      }

      // Log full result to browser console
      console.log('=== IMPORT RESULT ===')
      console.log('Executed:', data.executed)
      console.log('Skipped:', data.skipped)
      if (data.errors && data.errors.length > 0) {
        console.log('=== ERRORS ===')
        data.errors.forEach((err: ImportError, i: number) => {
          console.log(`\n--- Error ${i + 1} ---`)
          console.log('Statement:', err.statement)
          console.log('Error:', err.error)
        })
      }
      console.log('====================')

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-gray-600 text-sm mt-1">
            Esporta o importa i dati del database
          </p>
        </div>
      </div>

      {/* Export Section */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📤</span>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Export Database</h2>
            <p className="text-sm text-gray-500">Scarica un backup completo dei dati</p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Esportazione in corso...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Scarica Backup
            </span>
          )}
        </button>

        {exportSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex gap-2">
              <span className="text-green-600">✅</span>
              <p className="text-sm text-green-800">Backup scaricato con successo!</p>
            </div>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📥</span>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Import Database</h2>
            <p className="text-sm text-gray-500">Ripristina dati da un backup SQL</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex gap-2">
            <span className="text-yellow-600">⚠️</span>
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Attenzione</p>
              <p>Questa operazione importerà i dati dal file SQL nel database. I dati esistenti potrebbero essere sovrascritti.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            File SQL
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-green-50 file:text-green-700
              hover:file:bg-green-100
              cursor-pointer"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              File selezionato: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importazione...
              </span>
            ) : (
              'Importa Database'
            )}
          </button>
          {(file || result) && (
            <button onClick={handleReset} className="btn-secondary">
              Reset
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex gap-2">
              <span className="text-red-600">❌</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-2">
              <span className="text-xl">{result.success ? '✅' : '❌'}</span>
              <div className="flex-1">
                <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.message}
                </p>
                <div className="mt-2 text-sm space-y-1">
                  <p className="text-gray-600">
                    Statement eseguiti: <span className="font-medium text-green-700">{result.executed}</span>
                  </p>
                  <p className="text-gray-600">
                    Statement saltati: <span className="font-medium text-yellow-700">{result.skipped}</span>
                  </p>
                </div>
                {result.errors.length > 0 && (
                  <ErrorsSection errors={result.errors} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DatabaseImport
