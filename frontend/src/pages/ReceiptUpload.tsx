import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import receiptsService from '@/services/receipts'
import shoppingListsService from '@/services/shoppingLists'
import type { Receipt, ReceiptItem, ReconciliationResponse, ShoppingList, ReceiptItemMatchStatus } from '@/types'

type ProcessingStep = 'idle' | 'uploading' | 'processing' | 'reconciling' | 'done' | 'error'

const MATCH_STATUS_COLORS: Record<ReceiptItemMatchStatus, { bg: string; text: string; label: string }> = {
  matched: { bg: 'bg-green-100', text: 'text-green-700', label: 'Corrispondente' },
  unmatched: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Da verificare' },
  extra: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Extra' },
  ignored: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Ignorato' },
}

export function ReceiptUpload() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [step, setStep] = useState<ProcessingStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)

  // Load shopping list
  useEffect(() => {
    if (!listId) return

    const fetchList = async () => {
      try {
        const data = await shoppingListsService.getById(listId)
        setShoppingList(data)
      } catch {
        setError('Lista della spesa non trovata')
      }
    }

    fetchList()
  }, [listId])

  const handleFileSelect = async (file: File) => {
    if (!listId) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato non supportato. Usa JPG, PNG o WEBP.')
      return
    }

    // Create preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setError(null)

    try {
      // Step 1: Upload
      setStep('uploading')
      const uploaded = await receiptsService.upload(listId, file)
      setReceipt(uploaded)

      // Step 2: Process OCR
      setStep('processing')
      const processed = await receiptsService.process(uploaded.id)
      setReceipt(processed)

      // Step 3: Reconcile
      setStep('reconciling')
      const reconciled = await receiptsService.reconcile(processed.id)
      setReconciliation(reconciled)

      // Refresh receipt to get updated items
      const finalReceipt = await receiptsService.getById(processed.id)
      setReceipt(finalReceipt)

      setStep('done')
    } catch (err) {
      console.error('Processing failed:', err)
      setError('Errore durante l\'elaborazione. Riprova.')
      setStep('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const toggleExtraSelection = (itemId: string) => {
    setSelectedExtras((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleAddExtras = async () => {
    if (!receipt || selectedExtras.size === 0) return

    try {
      await receiptsService.addExtraToList(receipt.id, Array.from(selectedExtras))

      // Refresh receipt
      const updated = await receiptsService.getById(receipt.id)
      setReceipt(updated)
      setSelectedExtras(new Set())
    } catch (err) {
      console.error('Failed to add extras:', err)
      setError('Errore nell\'aggiunta degli articoli.')
    }
  }

  const handleReset = () => {
    setReceipt(null)
    setReconciliation(null)
    setPreviewUrl(null)
    setStep('idle')
    setError(null)
    setSelectedExtras(new Set())
  }

  // Group receipt items by match status
  const groupedItems = receipt?.items.reduce(
    (acc, item) => {
      acc[item.match_status].push(item)
      return acc
    },
    { matched: [], unmatched: [], extra: [], ignored: [] } as Record<ReceiptItemMatchStatus, ReceiptItem[]>
  )

  const renderStepIndicator = () => {
    const steps = [
      { key: 'uploading', label: 'Caricamento' },
      { key: 'processing', label: 'OCR' },
      { key: 'reconciling', label: 'Riconciliazione' },
    ]

    const currentIdx = steps.findIndex((s) => s.key === step)

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                idx < currentIdx
                  ? 'bg-green-500 text-white'
                  : idx === currentIdx
                  ? 'bg-primary-500 text-white animate-pulse'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {idx < currentIdx ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span className={`ml-2 text-sm ${idx === currentIdx ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
              {s.label}
            </span>
            {idx < steps.length - 1 && <div className="w-8 h-0.5 mx-2 bg-gray-200" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={listId ? `/shopping-lists/${listId}` : '/shopping-lists'}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Carica Scontrino</h1>
          {shoppingList && <p className="text-sm text-gray-500">{shoppingList.name}</p>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Upload Zone */}
      {step === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleInputChange}
            className="hidden"
          />

          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>

          <p className="text-gray-600 mb-4">Trascina una foto dello scontrino qui</p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            Scatta Foto o Scegli File
          </button>

          <p className="text-xs text-gray-500 mt-4">Formati supportati: JPG, PNG, WEBP</p>
        </div>
      )}

      {/* Processing */}
      {['uploading', 'processing', 'reconciling'].includes(step) && (
        <div className="card p-6">
          {renderStepIndicator()}

          {previewUrl && (
            <div className="mb-4">
              <img src={previewUrl} alt="Receipt preview" className="max-h-64 mx-auto rounded-lg shadow" />
            </div>
          )}

          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-3" />
            <p className="text-gray-600">
              {step === 'uploading' && 'Caricamento immagine...'}
              {step === 'processing' && 'Elaborazione OCR...'}
              {step === 'reconciling' && 'Riconciliazione con lista...'}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {step === 'done' && receipt && reconciliation && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Riepilogo</h2>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-green-700 font-medium">{reconciliation.summary.matched_count}</p>
                <p className="text-green-600 text-xs">Corrispondenti</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-yellow-700 font-medium">{reconciliation.summary.suggested_count}</p>
                <p className="text-yellow-600 text-xs">Da verificare</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-blue-700 font-medium">{reconciliation.summary.extra_count}</p>
                <p className="text-blue-600 text-xs">Extra</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-red-700 font-medium">{reconciliation.summary.missing_count}</p>
                <p className="text-red-600 text-xs">Mancanti</p>
              </div>
            </div>

            {receipt.store_name_detected && (
              <p className="text-sm text-gray-600 mt-3">
                Negozio: <span className="font-medium">{receipt.store_name_detected}</span>
              </p>
            )}
            {receipt.total_amount_detected && (
              <p className="text-sm text-gray-600">
                Totale: <span className="font-medium">{receipt.total_amount_detected.toFixed(2)}</span>
              </p>
            )}
          </div>

          {/* Matched Items */}
          {groupedItems && groupedItems.matched.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Corrispondenti ({groupedItems.matched.length})
              </h3>
              <div className="space-y-2">
                {groupedItems.matched.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.parsed_name || item.raw_text}</p>
                      {item.parsed_total_price && (
                        <p className="text-sm text-gray-500">{item.parsed_total_price.toFixed(2)}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${MATCH_STATUS_COLORS.matched.bg} ${MATCH_STATUS_COLORS.matched.text}`}>
                      {Math.round(item.match_confidence || 0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Items (unmatched with confidence) */}
          {groupedItems && groupedItems.unmatched.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Da Verificare ({groupedItems.unmatched.length})
              </h3>
              <div className="space-y-2">
                {groupedItems.unmatched.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.parsed_name || item.raw_text}</p>
                      {item.parsed_total_price && (
                        <p className="text-sm text-gray-500">{item.parsed_total_price.toFixed(2)}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${MATCH_STATUS_COLORS.unmatched.bg} ${MATCH_STATUS_COLORS.unmatched.text}`}>
                      {item.match_confidence ? `${Math.round(item.match_confidence)}%` : 'Verifica'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra Items */}
          {groupedItems && groupedItems.extra.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Extra - Non in Lista ({groupedItems.extra.length})
              </h3>
              <div className="space-y-2">
                {groupedItems.extra.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleExtraSelection(item.id)}
                    className={`flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
                      selectedExtras.has(item.id) ? 'bg-blue-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedExtras.has(item.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                      }`}
                    >
                      {selectedExtras.has(item.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.parsed_name || item.raw_text}</p>
                      {item.parsed_total_price && (
                        <p className="text-sm text-gray-500">{item.parsed_total_price.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedExtras.size > 0 && (
                <button
                  onClick={handleAddExtras}
                  className="w-full mt-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  Aggiungi {selectedExtras.size} articoli alla lista
                </button>
              )}
            </div>
          )}

          {/* Missing Items */}
          {reconciliation.missing_items.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Mancanti dallo Scontrino ({reconciliation.missing_items.length})
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                Questi articoli erano nella lista ma non sono stati trovati nello scontrino.
              </p>
              <div className="space-y-2">
                {reconciliation.missing_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} {item.unit || 'pz'}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Mancante</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Carica Altro
            </button>
            <Link
              to={`/shopping-lists/${listId}`}
              className="flex-1 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors text-center"
            >
              Torna alla Lista
            </Link>
          </div>
        </div>
      )}

      {/* Error State */}
      {step === 'error' && (
        <div className="card p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="font-semibold text-gray-900 mb-2">Errore</h3>
          <p className="text-gray-600 mb-4">{error || 'Si e\' verificato un errore durante l\'elaborazione.'}</p>
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            Riprova
          </button>
        </div>
      )}
    </div>
  )
}

export default ReceiptUpload
