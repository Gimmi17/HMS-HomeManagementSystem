import { useEffect, useState } from 'react'
import anagraficheService, { ProductBarcodeItem } from '@/services/anagrafiche'

interface EanManagerPanelProps {
  productId: string
  onChanged?: () => void
}

export default function EanManagerPanel({ productId, onChanged }: EanManagerPanelProps) {
  const [barcodes, setBarcodes] = useState<ProductBarcodeItem[]>([])
  const [newBarcode, setNewBarcode] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const loadBarcodes = async () => {
    try {
      const data = await anagraficheService.getProductBarcodes(productId)
      setBarcodes(data)
    } catch (err) {
      console.error('Failed to load barcodes:', err)
    }
  }

  useEffect(() => {
    loadBarcodes()
  }, [productId])

  const handleAdd = async () => {
    if (!newBarcode.trim()) return
    setIsAdding(true)
    try {
      await anagraficheService.addProductBarcode(productId, newBarcode.trim())
      setNewBarcode('')
      await loadBarcodes()
      onChanged?.()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Errore aggiunta barcode')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (barcodeId: string) => {
    if (!confirm('Rimuovere questo barcode?')) return
    try {
      await anagraficheService.deleteProductBarcode(productId, barcodeId)
      await loadBarcodes()
      onChanged?.()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Errore rimozione barcode')
    }
  }

  const handleSetPrimary = async (barcodeId: string) => {
    try {
      await anagraficheService.setProductBarcodePrimary(productId, barcodeId)
      await loadBarcodes()
      onChanged?.()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Errore')
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Barcode</h4>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        {barcodes.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessun barcode</p>
        ) : (
          barcodes.map((pb) => (
            <div key={pb.id} className="flex items-center gap-2">
              <span className="font-mono text-sm flex-1">{pb.barcode}</span>
              {pb.is_primary ? (
                <span className="text-xs text-amber-600 font-medium">&#9733; primario</span>
              ) : (
                <button
                  onClick={() => handleSetPrimary(pb.id)}
                  className="text-xs text-gray-400 hover:text-amber-600"
                  title="Imposta come primario"
                >
                  &#9734;
                </button>
              )}
              <button
                onClick={() => handleDelete(pb.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                title="Rimuovi barcode"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newBarcode}
            onChange={(e) => setNewBarcode(e.target.value)}
            placeholder="Aggiungi barcode..."
            className="input flex-1 text-sm py-1.5"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <button
            onClick={handleAdd}
            disabled={!newBarcode.trim() || isAdding}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isAdding ? '...' : '+'}
          </button>
        </div>
      </div>
    </div>
  )
}
