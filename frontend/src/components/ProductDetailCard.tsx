import { useEffect, useState } from 'react'
import anagraficheService, { ProductListItem } from '@/services/anagrafiche'
import EanManagerPanel from '@/components/EanManagerPanel'

interface ProductDetailCardProps {
  barcode: string | null
  productName: string
  onClose: () => void
  onProductUpdated?: () => void
}

const getNutriscoreColor = (score: string | null) => {
  if (!score) return 'bg-gray-100 text-gray-600'
  switch (score.toUpperCase()) {
    case 'A': return 'bg-green-100 text-green-700'
    case 'B': return 'bg-lime-100 text-lime-700'
    case 'C': return 'bg-yellow-100 text-yellow-700'
    case 'D': return 'bg-orange-100 text-orange-700'
    case 'E': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

const formatValue = (value: number | null | undefined, unit: string = '') => {
  if (value == null) return '-'
  return `${value}${unit}`
}

export default function ProductDetailCard({ barcode, productName, onClose, onProductUpdated }: ProductDetailCardProps) {
  const [product, setProduct] = useState<ProductListItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', brand: '', quantity_text: '' })

  useEffect(() => {
    if (!barcode) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    const lookup = async () => {
      setIsLoading(true)
      try {
        const resp = await anagraficheService.getProducts({ search: barcode, limit: 5 })
        if (cancelled) return
        const match = resp.products.find(p => p.barcode === barcode)
        setProduct(match || null)
      } catch (err) {
        console.error('Product lookup failed:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    lookup()
    return () => { cancelled = true }
  }, [barcode])

  const enterEditMode = () => {
    setEditForm({
      name: product?.name || productName || '',
      brand: product?.brand || '',
      quantity_text: product?.quantity_text || '',
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!editForm.name.trim()) return
    setIsSaving(true)
    try {
      let savedProduct: ProductListItem
      if (product) {
        // Update existing product
        savedProduct = await anagraficheService.updateProduct(product.id, {
          name: editForm.name.trim(),
          brand: editForm.brand.trim() || undefined,
          quantity_text: editForm.quantity_text.trim() || undefined,
        })
      } else {
        // Create new product
        savedProduct = await anagraficheService.createProduct({
          barcode: barcode || undefined,
          name: editForm.name.trim(),
          brand: editForm.brand.trim() || undefined,
          quantity_text: editForm.quantity_text.trim() || undefined,
        })
      }

      // Brand linking (non-blocking)
      const brandName = editForm.brand.trim()
      if (brandName) {
        try {
          const brandResp = await anagraficheService.getBrands({ search: brandName })
          let brandId: string | undefined
          const exactMatch = brandResp.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase())
          if (exactMatch) {
            brandId = exactMatch.id
          } else {
            const newBrand = await anagraficheService.createBrand({ name: brandName })
            brandId = newBrand.id
          }
          if (brandId) {
            await anagraficheService.setProductBrand(savedProduct.id, brandId)
          }
        } catch (err) {
          console.error('Brand linking failed (non-blocking):', err)
        }
      }

      setProduct(savedProduct)
      setIsEditing(false)
      onProductUpdated?.()
    } catch (err) {
      console.error('Save failed:', err)
      alert('Errore durante il salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
        <div
          className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-start gap-3 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-gray-900">
                {product?.name || productName}
              </h3>
              {barcode && (
                <p className="text-sm text-gray-500 font-mono">{barcode}</p>
              )}
            </div>
            {!isEditing && product && (
              <button
                onClick={enterEditMode}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Modifica"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : isEditing ? (
              /* Edit mode */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nome *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input w-full mt-1"
                    placeholder="Nome prodotto"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Marca</label>
                  <input
                    type="text"
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="input w-full mt-1"
                    placeholder="Marca"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quantita'</label>
                  <input
                    type="text"
                    value={editForm.quantity_text}
                    onChange={(e) => setEditForm({ ...editForm, quantity_text: e.target.value })}
                    className="input w-full mt-1"
                    placeholder="es. 500g, 1L, 6 pezzi"
                  />
                </div>
              </div>
            ) : !product ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Nessun prodotto in catalogo</p>
                <p className="font-medium text-gray-700 mt-2">{productName}</p>
                {barcode && (
                  <button
                    onClick={enterEditMode}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Crea scheda prodotto
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Product Image */}
                {product.image_url && (
                  <div className="flex justify-center">
                    {!imageLoaded && (
                      <div className="w-32 h-40 rounded-lg bg-gray-100 animate-pulse flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <img
                      src={product.image_small_url || product.image_url}
                      alt={product.name || 'Prodotto'}
                      className={`max-h-48 rounded-lg object-contain cursor-pointer hover:opacity-80 transition-opacity ${!imageLoaded ? 'hidden' : ''}`}
                      onLoad={() => setImageLoaded(true)}
                      onClick={() => setFullscreenImage(product.image_url)}
                    />
                  </div>
                )}

                {/* Info base */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informazioni</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Marca</span>
                      <span className="font-medium">{product.brand || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantita'</span>
                      <span className="font-medium">{product.quantity_text || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Categoria</span>
                      <span className="font-medium text-right max-w-[60%]">{product.categories || '-'}</span>
                    </div>
                    {product.user_notes && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Note</span>
                        <span className="font-medium text-blue-600 italic text-right max-w-[60%]">{product.user_notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scores */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Punteggi</h4>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Nutri-Score</p>
                      {product.nutriscore ? (
                        <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold ${getNutriscoreColor(product.nutriscore)}`}>
                          {product.nutriscore.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Eco-Score</p>
                      {product.ecoscore ? (
                        <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold ${getNutriscoreColor(product.ecoscore)}`}>
                          {product.ecoscore.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">NOVA</p>
                      {product.nova_group ? (
                        <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold bg-gray-200 text-gray-700">
                          {product.nova_group}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nutritional values */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valori Nutrizionali (per 100g)</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="font-medium text-gray-700">Energia</span>
                      <span className="font-semibold">{formatValue(product.energy_kcal, ' kcal')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Proteine</span>
                      <span className="font-medium">{formatValue(product.proteins_g, 'g')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Carboidrati</span>
                      <span className="font-medium">{formatValue(product.carbs_g, 'g')}</span>
                    </div>
                    <div className="flex justify-between py-1 pl-4">
                      <span className="text-gray-400">di cui Zuccheri</span>
                      <span className="font-medium text-gray-600">{formatValue(product.sugars_g, 'g')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Grassi</span>
                      <span className="font-medium">{formatValue(product.fats_g, 'g')}</span>
                    </div>
                    <div className="flex justify-between py-1 pl-4">
                      <span className="text-gray-400">di cui Saturi</span>
                      <span className="font-medium text-gray-600">{formatValue(product.saturated_fats_g, 'g')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Fibre</span>
                      <span className="font-medium">{formatValue(product.fiber_g, 'g')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Sale</span>
                      <span className="font-medium">{formatValue(product.salt_g, 'g')}</span>
                    </div>
                  </div>
                </div>

                {/* EAN Manager */}
                <EanManagerPanel productId={product.id} />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex-shrink-0">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-3 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editForm.name.trim()}
                  className="flex-1 py-2.5 px-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            ) : (
              <button
                onClick={onClose}
                className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Chiudi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen image overlay */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Prodotto" className="max-w-full max-h-full object-contain p-4" />
        </div>
      )}
    </>
  )
}
