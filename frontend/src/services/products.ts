import api from './api'

export interface ProductLookupResult {
  found: boolean
  barcode: string
  product_name?: string
  brand?: string
  image_url?: string
  quantity?: string
  categories?: string
  nutriscore?: string
  category_id?: string  // Local category from product catalog
  source_code?: string
  source_name?: string
  error?: string
}

export interface ProductSuggestion {
  name: string
  brand: string | null
  barcode: string
}

export interface ProductSuggestResponse {
  suggestions: ProductSuggestion[]
}

export const productsService = {
  /**
   * Look up a product by barcode using Open Food Facts
   */
  async lookupBarcode(barcode: string): Promise<ProductLookupResult> {
    const response = await api.get(`/products/lookup/${barcode}`)
    return response.data
  },

  /**
   * Suggest products from the local catalog (autocomplete).
   * Word-boundary prefix match, case insensitive, min 3 chars.
   */
  async suggestProducts(houseId: string, query: string, limit = 10): Promise<ProductSuggestResponse> {
    const response = await api.get('/product-catalog/suggest', {
      params: { house_id: houseId, q: query, limit },
    })
    return response.data
  },
}

export default productsService
