/**
 * LLM Settings Page
 * Configure LLM connections for OCR, chat, and other AI features
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import llmService, {
  LLMConnection,
  LLMConnectionCreate,
  LLMPurpose,
  LLMTestResult
} from '@/services/llm'

type FormMode = 'list' | 'add' | 'edit'

export function LLMSettings() {
  const { currentHouse } = useHouse()
  const currentHouseId = currentHouse?.id

  const [connections, setConnections] = useState<LLMConnection[]>([])
  const [purposes, setPurposes] = useState<LLMPurpose[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [mode, setMode] = useState<FormMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<LLMConnectionCreate>({
    name: '',
    url: '',
    model: '',
    purpose: 'ocr',
    enabled: true,
    timeout: 30,
    temperature: 0.3,
    max_tokens: 500,
    api_key: ''
  })

  // Test state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LLMTestResult | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [connectionVerified, setConnectionVerified] = useState(false)

  // Health check state
  const [healthStatus, setHealthStatus] = useState<Record<string, 'ok' | 'offline' | 'error' | 'checking'>>({})

  useEffect(() => {
    if (currentHouseId) {
      loadData()
    }
  }, [currentHouseId])

  const loadData = async () => {
    if (!currentHouseId) return

    try {
      setLoading(true)
      const [conns, purps] = await Promise.all([
        llmService.getConnections(currentHouseId),
        llmService.getPurposes()
      ])
      setConnections(conns)
      setPurposes(purps)
      setError(null)
    } catch (err) {
      setError('Errore nel caricamento delle connessioni')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    if (!formData.url) return

    setTesting(true)
    setTestResult(null)
    setAvailableModels([])
    setConnectionVerified(false)

    try {
      const result = await llmService.testConnection(formData.url, formData.model || 'default')
      setTestResult(result)

      if (result.status === 'ok' && result.models && result.models.length > 0) {
        setAvailableModels(result.models)
        setConnectionVerified(true)
        // Se non c'è già un modello selezionato, seleziona il primo
        if (!formData.model || formData.model === 'default') {
          setFormData(prev => ({ ...prev, model: result.models![0] }))
        }
      }
    } catch (err) {
      setTestResult({
        status: 'error',
        message: 'Errore nella connessione'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleCheckHealth = async (connectionId: string) => {
    if (!currentHouseId) return

    setHealthStatus(prev => ({ ...prev, [connectionId]: 'checking' }))

    try {
      const result = await llmService.checkHealth(connectionId, currentHouseId)
      setHealthStatus(prev => ({ ...prev, [connectionId]: result.status }))
    } catch {
      setHealthStatus(prev => ({ ...prev, [connectionId]: 'error' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouseId) return

    // Verifica che la connessione sia stata testata
    if (!connectionVerified && mode === 'add') {
      setError('Testa la connessione prima di salvare')
      return
    }

    try {
      if (mode === 'add') {
        await llmService.createConnection(formData, currentHouseId)
      } else if (mode === 'edit' && editingId) {
        await llmService.updateConnection(editingId, formData, currentHouseId)
      }
      await loadData()
      resetForm()
    } catch (err) {
      setError('Errore nel salvataggio')
      console.error(err)
    }
  }

  const handleDelete = async (connectionId: string) => {
    if (!currentHouseId) return
    if (!confirm('Eliminare questa connessione?')) return

    try {
      await llmService.deleteConnection(connectionId, currentHouseId)
      await loadData()
    } catch (err) {
      setError('Errore nell\'eliminazione')
      console.error(err)
    }
  }

  const handleEdit = (conn: LLMConnection) => {
    setFormData({
      name: conn.name,
      url: conn.url,
      model: conn.model,
      purpose: conn.purpose,
      enabled: conn.enabled,
      timeout: conn.timeout,
      temperature: conn.temperature,
      max_tokens: conn.max_tokens,
      api_key: ''  // Don't show existing key
    })
    setEditingId(conn.id)
    setMode('edit')
    setTestResult(null)
    setAvailableModels([])
    setConnectionVerified(true) // In edit mode, assume verified
  }

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      model: '',
      purpose: 'ocr',
      enabled: true,
      timeout: 30,
      temperature: 0.3,
      max_tokens: 500,
      api_key: ''
    })
    setMode('list')
    setEditingId(null)
    setTestResult(null)
    setAvailableModels([])
    setConnectionVerified(false)
    setError(null)
  }

  const getPurposeLabel = (purpose: string) => {
    const p = purposes.find(p => p.value === purpose)
    return p?.label || purpose
  }

  const getStatusIcon = (status: 'ok' | 'offline' | 'error' | 'checking') => {
    switch (status) {
      case 'ok':
        return <span className="w-2 h-2 bg-green-500 rounded-full" />
      case 'offline':
        return <span className="w-2 h-2 bg-red-500 rounded-full" />
      case 'error':
        return <span className="w-2 h-2 bg-yellow-500 rounded-full" />
      case 'checking':
        return <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
      default:
        return null
    }
  }

  // Reset verification when URL changes
  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, url }))
    setConnectionVerified(false)
    setTestResult(null)
    setAvailableModels([])
  }

  if (!currentHouseId) {
    return (
      <div className="p-4 text-center text-gray-500">
        Seleziona una casa per configurare le connessioni LLM
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Connessioni LLM</h1>
          <p className="text-sm text-gray-500">Configura server AI per OCR e altre funzioni</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* LIST VIEW */}
      {mode === 'list' && (
        <>
          {loading ? (
            <div className="card p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Add button */}
              <button
                onClick={() => setMode('add')}
                className="w-full py-3 border-2 border-dashed border-primary-300 bg-primary-50 rounded-xl text-primary-600 font-medium hover:bg-primary-100 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aggiungi Connessione
              </button>

              {/* Connections list */}
              {connections.length === 0 ? (
                <div className="card p-6 text-center text-gray-500">
                  <p>Nessuna connessione configurata</p>
                  <p className="text-sm mt-1">Aggiungi un server LLM per abilitare le funzioni AI</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map(conn => (
                    <div key={conn.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{conn.name}</h3>
                            {healthStatus[conn.id] && getStatusIcon(healthStatus[conn.id])}
                            {!conn.enabled && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                Disabilitato
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{conn.url}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                              {getPurposeLabel(conn.purpose)}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {conn.model}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCheckHealth(conn.id)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                            title="Verifica connessione"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(conn)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                            title="Modifica"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(conn.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Elimina"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ADD/EDIT FORM */}
      {(mode === 'add' || mode === 'edit') && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold text-gray-900">
              {mode === 'add' ? 'Nuova Connessione' : 'Modifica Connessione'}
            </h2>

            {/* Step 1: URL and Test */}
            <div className="p-3 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Connetti al Server
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Server
                </label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={e => handleUrlChange(e.target.value)}
                  placeholder="http://192.168.1.100:8080"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Inserisci l'IP del server MLX (es: http://192.168.1.100:8080)
                </p>
              </div>

              {/* Test button */}
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !formData.url}
                className="w-full py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Testa Connessione
                  </>
                )}
              </button>

              {/* Test result */}
              {testResult && (
                <div className={`p-3 rounded-lg ${
                  testResult.status === 'ok'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResult.status === 'ok' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`font-medium ${testResult.status === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.status === 'ok' ? 'Connessione riuscita!' : testResult.message || 'Connessione fallita'}
                    </span>
                  </div>
                  {testResult.test_response && (
                    <p className="text-sm text-green-600 mt-1">
                      Test risposta: "{testResult.test_response}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Select Model (only after successful test) */}
            {connectionVerified && availableModels.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                  Seleziona Modello
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modello ({availableModels.length} disponibili)
                  </label>
                  <select
                    value={formData.model}
                    onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    required
                  >
                    {availableModels.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 3: Configure (only after model selected) */}
            {connectionVerified && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                  Configura
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Connessione
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="es. MLX Mac Studio"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Utilizzo
                  </label>
                  <select
                    value={formData.purpose}
                    onChange={e => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    {purposes.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label} - {p.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* API Key (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key (opzionale)
                  </label>
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder={mode === 'edit' ? '(lascia vuoto per mantenere)' : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Advanced settings toggle */}
                <details className="pt-2">
                  <summary className="text-sm text-primary-600 cursor-pointer hover:text-primary-700">
                    Impostazioni avanzate
                  </summary>
                  <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-200">
                    {/* Timeout */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Timeout (secondi): {formData.timeout}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="120"
                        value={formData.timeout}
                        onChange={e => setFormData(prev => ({ ...prev, timeout: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    {/* Temperature */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Temperature: {formData.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={formData.temperature}
                        onChange={e => setFormData(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">0 = deterministico, 2 = creativo</p>
                    </div>

                    {/* Max Tokens */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Tokens: {formData.max_tokens}
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="4096"
                        step="100"
                        value={formData.max_tokens}
                        onChange={e => setFormData(prev => ({ ...prev, max_tokens: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    {/* Enabled */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Connessione abilitata</span>
                    </label>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!connectionVerified || !formData.name || !formData.model}
              className="flex-1 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {mode === 'add' ? 'Salva Connessione' : 'Aggiorna'}
            </button>
          </div>
        </form>
      )}

      {/* Info box */}
      {mode === 'list' && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <h3 className="font-medium text-blue-800 mb-2">Come funziona</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>OCR Scontrini</strong>: Interpreta le abbreviazioni e migliora il matching</li>
            <li>• <strong>Chat</strong>: Conversazione generale (futuro)</li>
            <li>• <strong>Suggerimenti</strong>: Suggerisce ricette e pasti (futuro)</li>
          </ul>
          <p className="text-sm text-blue-600 mt-2">
            Supporta server OpenAI-compatible: mlx-lm-server, LM Studio, Ollama, ecc.
          </p>
        </div>
      )}
    </div>
  )
}

export default LLMSettings
