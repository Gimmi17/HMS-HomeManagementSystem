import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { TouchCrop, type CropArea } from '@/components/TouchCrop'
import receiptsService from '@/services/receipts'
import shoppingListsService from '@/services/shoppingLists'
import type { Receipt, ReceiptItem, ReconciliationResponse, ShoppingList } from '@/types'
import type { ReceiptItemMatchStatus } from '@/types'

type ProcessingStep = 'idle' | 'editing' | 'saving' | 'processing' | 'review' | 'reconciling' | 'done' | 'error'

interface EditableItem {
  id: string
  text: string
  price: string
  isNew?: boolean
}

export function ReceiptUpload() {
  const { listId } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropImageRef = useRef<HTMLImageElement>(null)

  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null)
  const [step, setStep] = useState<ProcessingStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())

  // Editing state - which image is being edited
  const [editingImage, setEditingImage] = useState<{ url: string } | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null) // null = new image, number = re-editing existing
  const [cropArea, setCropArea] = useState<CropArea | null>(null)
  const [contrast, setContrast] = useState(120)
  const [brightness, setBrightness] = useState(100)
  const [imageLoaded, setImageLoaded] = useState(false)

  // OCR review state
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Load shopping list
  useEffect(() => {
    if (!listId) return
    shoppingListsService.getById(listId)
      .then(setShoppingList)
      .catch(() => setError('Lista della spesa non trovata'))
  }, [listId])

  // Load existing receipt for this list (prefer UPLOADED, fallback to most recent)
  useEffect(() => {
    if (!listId) return
    receiptsService.getByListId(listId)
      .then((data) => {
        const target = data.receipts.find((r) => r.status === 'uploaded') || data.receipts[0]
        if (target) {
          receiptsService.getById(target.id).then(setReceipt)
        }
      })
      .catch(() => {})
  }, [listId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFile = files.find((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))

    if (!validFile) {
      setStep('idle')
      return
    }

    // Open editing view for this new image
    setEditingImage({
      url: URL.createObjectURL(validFile),
    })
    setEditingIndex(null) // New image, not re-editing
    setCropArea(null)
    setContrast(120)
    setBrightness(100)
    setImageLoaded(false)
    setStep('editing')
    setError(null)

    e.target.value = ''
  }

  // Re-edit an existing server image
  const handleReEditImage = (index: number) => {
    if (!receipt) return
    const sortedImages = [...receipt.images].sort((a, b) => a.position - b.position)
    const img = sortedImages[index]
    if (!img) return

    setEditingImage({
      url: receiptsService.getImageUrl(img.image_path),
    })
    setEditingIndex(index)
    setCropArea(null)
    setContrast(100) // Neutral since image already has filters applied
    setBrightness(100)
    setImageLoaded(false)
    setStep('editing')
    setError(null)
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleSaveEdit = async () => {
    const currentImage = cropImageRef.current
    if (!editingImage || !currentImage) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Show saving indicator
    setStep('saving')

    // Determine crop area (use full image if no crop selected)
    const finalCrop = cropArea && cropArea.width > 0 && cropArea.height > 0
      ? cropArea
      : { x: 0, y: 0, width: currentImage.width, height: currentImage.height }

    // Scale from displayed size to natural size
    const scaleX = currentImage.naturalWidth / currentImage.width
    const scaleY = currentImage.naturalHeight / currentImage.height

    const sourceX = finalCrop.x * scaleX
    const sourceY = finalCrop.y * scaleY
    const sourceWidth = finalCrop.width * scaleX
    const sourceHeight = finalCrop.height * scaleY

    canvas.width = sourceWidth
    canvas.height = sourceHeight

    // Apply filters
    ctx.filter = `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`
    ctx.drawImage(
      currentImage,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, sourceWidth, sourceHeight
    )

    // Get processed blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      setError('Errore nel salvataggio della foto')
      setStep('editing')
      return
    }

    const processedFile = new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' })

    // Cleanup blob URL if it was a new image (not server re-edit)
    if (editingIndex === null && editingImage.url.startsWith('blob:')) {
      URL.revokeObjectURL(editingImage.url)
    }

    try {
      let updatedReceipt: Receipt

      if (editingIndex !== null && receipt) {
        // Re-editing: delete old server image, add new
        const sortedImages = [...receipt.images].sort((a, b) => a.position - b.position)
        const oldImage = sortedImages[editingIndex]
        if (oldImage) {
          await receiptsService.deleteImage(oldImage.id)
        }
        updatedReceipt = await receiptsService.addImages(receipt.id, [processedFile])
      } else if (receipt) {
        // Adding new image to existing receipt
        updatedReceipt = await receiptsService.addImages(receipt.id, [processedFile])
      } else {
        // First image: create receipt
        updatedReceipt = await receiptsService.upload(listId!, [processedFile])
      }

      setReceipt(updatedReceipt)
    } catch (err) {
      console.error('Upload failed:', err)
      setError('Errore nel salvataggio della foto')
      setStep('editing')
      return
    }

    setEditingImage(null)
    setEditingIndex(null)
    setStep('idle')
  }

  const handleCancelEdit = () => {
    // Only revoke URL if it's a new image blob (not server URL)
    if (editingImage && editingIndex === null && editingImage.url.startsWith('blob:')) {
      URL.revokeObjectURL(editingImage.url)
    }
    setEditingImage(null)
    setEditingIndex(null)
    setStep('idle')
  }

  const handleRemoveImage = async (imageId: string) => {
    if (!receipt) return
    try {
      await receiptsService.deleteImage(imageId)
      const updated = await receiptsService.getById(receipt.id)
      setReceipt(updated)
    } catch {
      setError("Errore nella rimozione dell'immagine")
    }
  }

  const handleProcess = async () => {
    if (!receipt) return

    setError(null)

    try {
      setStep('processing')
      const processed = await receiptsService.process(receipt.id)
      setReceipt(processed)

      // Convert to editable items
      setEditableItems(
        processed.items.map((item) => ({
          id: item.id,
          text: item.parsed_name || item.raw_text,
          price: item.parsed_total_price ? item.parsed_total_price.toFixed(2) : '',
        }))
      )

      setStep('review')
    } catch (err) {
      console.error('Processing failed:', err)
      setError("Errore durante l'elaborazione. Riprova.")
      setStep('error')
    }
  }

  const handleConfirmItems = async () => {
    if (!receipt) return

    try {
      for (const item of editableItems) {
        if (!item.isNew) {
          await receiptsService.updateItem(item.id, { user_corrected_name: item.text })
        }
      }

      setStep('reconciling')
      const reconciled = await receiptsService.reconcile(receipt.id)
      setReconciliation(reconciled)

      const finalReceipt = await receiptsService.getById(receipt.id)
      setReceipt(finalReceipt)

      setStep('done')
    } catch (err) {
      console.error('Reconciliation failed:', err)
      setError('Errore durante la riconciliazione.')
      setStep('error')
    }
  }

  const handleEditItem = (id: string, field: 'text' | 'price', value: string) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const handleDeleteItem = (id: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleAddItem = () => {
    const newItem: EditableItem = {
      id: `new-${Date.now()}`,
      text: '',
      price: '',
      isNew: true,
    }
    setEditableItems((prev) => [...prev, newItem])
    setEditingItemId(newItem.id)
  }

  const handleAddExtras = async () => {
    if (!receipt || selectedExtras.size === 0) return

    try {
      await receiptsService.addExtraToList(receipt.id, Array.from(selectedExtras))
      const updated = await receiptsService.getById(receipt.id)
      setReceipt(updated)
      setSelectedExtras(new Set())
    } catch {
      setError("Errore nell'aggiunta degli articoli.")
    }
  }

  const handleReset = () => {
    setReceipt(null)
    setReconciliation(null)
    setEditableItems([])
    setStep('idle')
    setError(null)
    setSelectedExtras(new Set())
  }

  const sortedImages = receipt?.images
    ? [...receipt.images].sort((a, b) => a.position - b.position)
    : []

  const groupedItems = receipt?.items.reduce(
    (acc, item) => {
      acc[item.match_status].push(item)
      return acc
    },
    { matched: [], unmatched: [], extra: [], ignored: [] } as Record<ReceiptItemMatchStatus, ReceiptItem[]>
  )

  // Hidden canvas for image processing
  const hiddenCanvas = <canvas ref={canvasRef} style={{ display: 'none' }} />

  return (
    <div className="space-y-4 pb-20">
      {hiddenCanvas}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/shopping-lists"
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Scontrini d'acquisto</h1>
          {shoppingList && <p className="text-sm text-gray-500">{shoppingList.name}</p>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* EDITING VIEW */}
      {step === 'editing' && editingImage && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Modifica Foto</h2>

            {/* Crop Area */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ maxHeight: '50vh' }}>
              <TouchCrop
                src={editingImage.url}
                onCropChange={(crop) => setCropArea(crop)}
                onImageLoad={handleImageLoad}
                imageRef={cropImageRef}
                style={{ maxHeight: '50vh' }}
                imageStyle={{
                  maxHeight: '50vh',
                  width: '100%',
                  objectFit: 'contain',
                  filter: `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`,
                }}
              />
            </div>

            {/* Enhancement Controls */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Contrasto</span>
                  <span>{contrast}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Luminosità</span>
                  <span>{brightness}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCancelEdit}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!imageLoaded}
                className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-300"
              >
                SALVA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IDLE VIEW - Photo list */}
      {step === 'idle' && (
        <>
          {/* Add photo button - only for UPLOADED or new receipts */}
          {(!receipt || receipt.status === 'uploaded') && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-primary-300 bg-primary-50 rounded-xl text-primary-600 font-medium hover:bg-primary-100 flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {sortedImages.length === 0 ? 'Scatta o Seleziona Foto' : 'Aggiungi Altra Foto'}
            </button>
          )}

          {/* Images list from server */}
          {sortedImages.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Foto Salvate ({sortedImages.length})</h3>

              <div className="grid grid-cols-3 gap-3">
                {sortedImages.map((img, idx) => (
                  <div key={img.id} className="relative">
                    <img
                      src={receiptsService.getImageUrl(img.image_path)}
                      alt={`Foto ${idx + 1}`}
                      className="w-full aspect-square object-cover rounded-lg cursor-pointer active:opacity-80"
                      onClick={() => receipt?.status === 'uploaded' && handleReEditImage(idx)}
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                        const placeholder = target.nextElementSibling as HTMLElement
                        if (placeholder) placeholder.style.display = 'flex'
                      }}
                    />
                    <div
                      className="w-full aspect-square bg-gray-100 rounded-lg items-center justify-center text-gray-400"
                      style={{ display: 'none' }}
                    >
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="absolute top-1 left-1 w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold pointer-events-none">
                      {idx + 1}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage(img.id)
                      }}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {receipt?.status === 'uploaded' && (
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center pointer-events-none">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {receipt?.status === 'uploaded' && (
                <button
                  onClick={handleProcess}
                  className="w-full mt-4 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600"
                >
                  Elabora Scontrino
                </button>
              )}

              {receipt && receipt.status !== 'uploaded' && (
                <div className="mt-3 text-center text-xs text-gray-500">
                  Stato: {receipt.status === 'processed' ? 'Elaborato' :
                    receipt.status === 'reconciled' ? 'Riconciliato' :
                    receipt.status === 'error' ? 'Errore' : receipt.status}
                </div>
              )}
            </div>
          )}

          {sortedImages.length === 0 && !receipt && (
            <p className="text-center text-gray-500 text-sm">
              Scatta una foto dello scontrino per iniziare
            </p>
          )}
        </>
      )}

      {/* SAVING IMAGE */}
      {step === 'saving' && (
        <div className="card p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent mb-4" />
          <p className="text-gray-600">Salvataggio foto...</p>
        </div>
      )}

      {/* PROCESSING */}
      {step === 'processing' && (
        <div className="card p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent mb-4" />
          <p className="text-gray-600">Elaborazione OCR...</p>
        </div>
      )}

      {/* REVIEW OCR RESULTS */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Verifica Articoli</h2>
              <span className="text-sm text-gray-500">{editableItems.length} articoli</span>
            </div>

            <div className="space-y-2">
              {editableItems.map((item, idx) => (
                <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {editingItemId === item.id ? (
                    <div className="p-3 bg-primary-50">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => handleEditItem(item.id, 'text', e.target.value)}
                          placeholder="Nome articolo"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={item.price}
                          onChange={(e) => handleEditItem(item.id, 'price', e.target.value)}
                          placeholder="Prezzo"
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"
                        />
                      </div>
                      <button
                        onClick={() => setEditingItemId(null)}
                        className="w-full py-1 text-sm bg-primary-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center p-3 bg-white">
                      <span className="w-6 h-6 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${item.text ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                          {item.text || 'Vuoto'}
                        </p>
                      </div>
                      {item.price && <span className="text-sm text-gray-600 mx-2">{item.price}</span>}
                      <button onClick={() => setEditingItemId(item.id)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleAddItem}
              className="w-full mt-3 py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-primary-400 hover:text-primary-600"
            >
              + Aggiungi Articolo
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium">
              Annulla
            </button>
            <button
              onClick={handleConfirmItems}
              disabled={editableItems.filter((i) => i.text.trim()).length === 0}
              className="flex-1 py-3 bg-primary-500 text-white rounded-lg font-medium disabled:bg-gray-300"
            >
              Conferma
            </button>
          </div>
        </div>
      )}

      {/* RECONCILING */}
      {step === 'reconciling' && (
        <div className="card p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent mb-4" />
          <p className="text-gray-600">Riconciliazione con lista...</p>
        </div>
      )}

      {/* DONE - Results */}
      {step === 'done' && receipt && reconciliation && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Riepilogo</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-green-700 font-medium">{reconciliation.summary.matched_count}</p>
                <p className="text-green-600 text-xs">Trovati</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-blue-700 font-medium">{reconciliation.summary.extra_count}</p>
                <p className="text-blue-600 text-xs">Extra</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-yellow-700 font-medium">{reconciliation.summary.suggested_count}</p>
                <p className="text-yellow-600 text-xs">Da verificare</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-red-700 font-medium">{reconciliation.summary.missing_count}</p>
                <p className="text-red-600 text-xs">Mancanti</p>
              </div>
            </div>
          </div>

          {/* Matched */}
          {groupedItems && groupedItems.matched.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-green-700 mb-3">Trovati ({groupedItems.matched.length})</h3>
              <div className="space-y-2">
                {groupedItems.matched.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-900">{item.user_corrected_name || item.parsed_name || item.raw_text}</span>
                    {item.parsed_total_price && <span className="text-gray-500">{item.parsed_total_price.toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra */}
          {groupedItems && groupedItems.extra.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-blue-700 mb-3">Extra ({groupedItems.extra.length})</h3>
              <div className="space-y-2">
                {groupedItems.extra.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedExtras((prev) => {
                        const next = new Set(prev)
                        if (next.has(item.id)) next.delete(item.id)
                        else next.add(item.id)
                        return next
                      })
                    }}
                    className={`flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer ${
                      selectedExtras.has(item.id) ? 'bg-blue-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedExtras.has(item.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedExtras.has(item.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1">{item.user_corrected_name || item.parsed_name || item.raw_text}</span>
                  </div>
                ))}
              </div>

              {selectedExtras.size > 0 && (
                <button onClick={handleAddExtras} className="w-full mt-4 py-2 bg-blue-500 text-white rounded-lg font-medium">
                  Aggiungi {selectedExtras.size} alla lista
                </button>
              )}
            </div>
          )}

          {/* Missing */}
          {reconciliation.missing_items.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-red-700 mb-3">Mancanti ({reconciliation.missing_items.length})</h3>
              <div className="space-y-2">
                {reconciliation.missing_items.map((item) => (
                  <div key={item.id} className="py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-900">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium">
              Carica Altro
            </button>
            <Link to={`/shopping-lists/${listId}`} className="flex-1 py-3 bg-primary-500 text-white rounded-lg font-medium text-center">
              Torna alla Lista
            </Link>
          </div>
        </div>
      )}

      {/* ERROR */}
      {step === 'error' && (
        <div className="card p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-semibold text-gray-900 mb-2">Errore</h3>
          <p className="text-gray-600 mb-4">{error || "Errore durante l'elaborazione."}</p>
          <button onClick={handleReset} className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium">
            Riprova
          </button>
        </div>
      )}
    </div>
  )
}

export default ReceiptUpload
