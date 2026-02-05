import { useState, useEffect, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import housesService from '@/services/houses'
import api from '@/services/api'

interface GrocyConfig {
  grocy_url: string
  grocy_api_key: string
}

export function GrocySettings() {
  const { currentHouse, refreshHouses } = useHouse()
  const [grocyUrl, setGrocyUrl] = useState('')
  const [grocyApiKey, setGrocyApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (currentHouse?.settings) {
      const settings = currentHouse.settings as unknown as GrocyConfig
      setGrocyUrl(settings.grocy_url || '')
      setGrocyApiKey(settings.grocy_api_key || '')
    }
  }, [currentHouse])

  const handleTestConnection = async () => {
    if (!grocyUrl) {
      setTestResult({ success: false, message: 'Inserisci l\'URL del server Grocy' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await api.post('/grocy/test-connection', {
        grocy_url: grocyUrl,
        grocy_api_key: grocyApiKey,
      })

      setTestResult({
        success: response.data.success,
        message: response.data.message,
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Errore durante il test della connessione. Riprova.',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()

    if (!currentHouse) {
      setSaveMessage({ type: 'error', text: 'Nessuna casa selezionata' })
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const updatedSettings = {
        ...(currentHouse.settings || {}),
        grocy_url: grocyUrl.replace(/\/$/, ''),
        grocy_api_key: grocyApiKey,
      }

      await housesService.update(currentHouse.id, {
        settings: updatedSettings,
      })

      await refreshHouses()
      setSaveMessage({ type: 'success', text: 'Salvato!' })
    } catch (error) {
      console.error('Failed to save Grocy settings:', error)
      setSaveMessage({ type: 'error', text: 'Errore nel salvataggio' })
    } finally {
      setIsSaving(false)
    }
  }

  if (!currentHouse) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800 text-sm mb-3">
            Seleziona una casa prima di configurare Grocy.
          </p>
          <Link to="/house" className="btn btn-primary text-sm">
            Vai alla gestione casa
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link to="/settings" className="text-primary-600 text-sm flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Impostazioni
      </Link>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Grocy</h1>
        <p className="text-gray-600 text-sm mt-1">
          Connetti a Grocy per sincronizzare la dispensa
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="card p-4 space-y-4">
          {/* Grocy URL */}
          <div>
            <label htmlFor="grocy-url" className="label text-xs">
              URL Server Grocy
            </label>
            <input
              id="grocy-url"
              type="url"
              value={grocyUrl}
              onChange={(e) => setGrocyUrl(e.target.value)}
              placeholder="http://192.168.1.100:9283"
              className="input w-full"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Es: http://192.168.1.100:9283
            </p>
          </div>

          {/* Grocy API Key */}
          <div>
            <label htmlFor="grocy-api-key" className="label text-xs">
              API Key
            </label>
            <input
              id="grocy-api-key"
              type="password"
              value={grocyApiKey}
              onChange={(e) => setGrocyApiKey(e.target.value)}
              placeholder="La tua API key"
              className="input w-full"
            />
          </div>

          {/* Test Connection Button */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !grocyUrl}
            className="btn btn-secondary w-full text-sm"
          >
            {isTesting ? 'Test in corso...' : 'Testa connessione'}
          </button>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h3 className="text-xs font-medium text-blue-800 mb-2">Come ottenere l'API Key</h3>
          <ol className="text-xs text-blue-700 list-decimal list-inside space-y-0.5">
            <li>Apri Grocy nel browser</li>
            <li>Vai su Impostazioni → Manage API keys</li>
            <li>Clicca su "Add" e copia la chiave</li>
          </ol>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div
            className={`p-3 rounded-lg text-sm ${
              saveMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="btn btn-primary w-full text-sm"
        >
          {isSaving ? 'Salvataggio...' : 'Salva impostazioni'}
        </button>
      </form>
    </div>
  )
}

export default GrocySettings
