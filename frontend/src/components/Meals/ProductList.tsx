/**
 * ProductList Component
 *
 * Displays and manages a list of products added to a free meal.
 * Each product has quantity control and remove button.
 */

import type { ProductEntry } from './ProductSearch'

interface ProductListProps {
  products: ProductEntry[]
  onUpdate: (products: ProductEntry[]) => void
  disabled?: boolean
}

export function ProductList({ products, onUpdate, disabled = false }: ProductListProps) {
  const handleQuantityChange = (index: number, quantity_g: number) => {
    const updated = [...products]
    updated[index] = { ...updated[index], quantity_g }
    onUpdate(updated)
  }

  const handleRemove = (index: number) => {
    onUpdate(products.filter((_, i) => i !== index))
  }

  if (products.length === 0) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-lg">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <p className="text-gray-500">Nessun prodotto aggiunto</p>
        <p className="text-sm text-gray-400 mt-1">Cerca un prodotto tramite codice a barre</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {products.map((product, index) => (
        <div
          key={product.tempId}
          className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* Product info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt=""
                  className="w-8 h-8 object-contain rounded bg-gray-50 border flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate text-sm">
                  {product.name}
                </div>
                <div className="flex items-center gap-1.5">
                  {product.barcode && (
                    <span className="text-[10px] text-gray-400 font-mono">{product.barcode}</span>
                  )}
                  {product.fromApi && (
                    <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">OFF</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity + remove */}
            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={product.quantity_g}
                  onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  className="input w-20 sm:w-24 text-right"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">g</span>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Rimuovi prodotto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="pt-2 border-t border-gray-200">
        <div className="text-sm text-gray-600 flex justify-between">
          <span>Totale prodotti:</span>
          <span className="font-medium text-gray-900">{products.length}</span>
        </div>
        <div className="text-sm text-gray-600 flex justify-between mt-1">
          <span>Peso totale:</span>
          <span className="font-medium text-gray-900">
            {products.reduce((sum, p) => sum + p.quantity_g, 0).toFixed(0)} g
          </span>
        </div>
      </div>
    </div>
  )
}

export default ProductList
