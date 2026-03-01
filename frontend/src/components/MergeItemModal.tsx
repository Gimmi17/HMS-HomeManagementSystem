import { useState } from 'react'
import shoppingListsService from '@/services/shoppingLists'
import type { ShoppingListItem } from '@/types'

interface MergeItemModalProps {
  item: ShoppingListItem
  allItems: ShoppingListItem[]
  listId: string
  onComplete: () => void
  onClose: () => void
}

export function MergeItemModal({ item, allItems, listId, onComplete, onClose }: MergeItemModalProps) {
  const [isMerging, setIsMerging] = useState(false)

  const otherItems = allItems.filter((i) => i.id !== item.id)

  const handleMerge = async (target: ShoppingListItem) => {
    setIsMerging(true)
    try {
      const sourceHasBarcode = !!(item.scanned_barcode || item.catalog_barcode)
      const targetHasBarcode = !!(target.scanned_barcode || target.catalog_barcode)

      let keep: ShoppingListItem, discard: ShoppingListItem
      if (targetHasBarcode && !sourceHasBarcode) {
        keep = target; discard = item
      } else if (sourceHasBarcode && !targetHasBarcode) {
        keep = item; discard = target
      } else {
        keep = item; discard = target
      }

      // Determine final name
      let finalName = keep.name
      const keepBarcode = keep.scanned_barcode || keep.catalog_barcode || ''
      // If keep's name contains the barcode (e.g. "Prodotto: 8001234"), use discard's name
      if (keepBarcode && keep.name.includes(keepBarcode)) {
        finalName = discard.grocy_product_name || discard.name
      }
      // If keep has a generic name like "Prodotto: ..."
      if (keep.name.startsWith('Prodotto: ')) {
        finalName = discard.grocy_product_name || discard.name
      }

      const finalQuantity = keep.quantity + discard.quantity

      await shoppingListsService.updateItem(listId, keep.id, {
        name: finalName,
        quantity: finalQuantity,
      })
      await shoppingListsService.deleteItem(listId, discard.id)
      onComplete()
    } catch (error) {
      console.error('Failed to merge items:', error)
      setIsMerging(false)
    }
  }

  const displayName = (i: ShoppingListItem) => i.grocy_product_name || i.name
  const hasBarcode = (i: ShoppingListItem) => !!(i.scanned_barcode || i.catalog_barcode)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl shadow-xl w-full max-w-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Unisci con...</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Unisci <strong>{displayName(item)}</strong> con un altro articolo
          </p>
        </div>

        {/* List */}
        <div className="p-2 max-h-72 overflow-y-auto">
          {otherItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">Nessun altro articolo nella lista</div>
          ) : (
            otherItems.map((other) => (
              <button
                key={other.id}
                onClick={() => handleMerge(other)}
                disabled={isMerging}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <span className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </span>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium truncate">{displayName(other)}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{other.quantity} {other.unit || 'pz'}</span>
                    {hasBarcode(other) && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">EAN</span>
                    )}
                    {other.checked && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Spuntato</span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Close */}
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            disabled={isMerging}
            className="w-full py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

export default MergeItemModal
