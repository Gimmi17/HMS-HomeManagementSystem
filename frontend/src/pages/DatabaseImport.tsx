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

export function DatabaseImport() {
  const token = localStorage.getItem('access_token')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Import Database</h1>
          <p className="text-gray-600 text-sm mt-1">
            Importa dati da un backup SQL
          </p>
        </div>
      </div>

      <div className="card p-4 space-y-4">
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
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-700 mb-1">
                      Errori ({result.errors.length}) - vedi console per dettagli:
                    </p>
                    <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <li key={i} className="bg-red-100 p-1 rounded">
                          {err.statement.substring(0, 60)}...
                        </li>
                      ))}
                    </ul>
                  </div>
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
