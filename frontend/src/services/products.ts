import api from './api'

export interface ProductCatalogItem {
  id: string
  name: string
  brand?: string
  barcode?: string
  unit?: string
  energy_kcal?: number
  proteins_g?: number
  carbs_g?: number
  fats_g?: number
}

export interface ProductLookupResult {
  found: boolean
  barcode: string
  product_name?: string
  brand?: string
  image_url?: string
  quantity?: string
  categories?: string
  nutriscore?: string
  nutrients?: {
    'energy-kcal_100g'?: number
    'proteins_100g'?: number
    'carbohydrates_100g'?: number
    'fat_100g'?: number
    'fiber_100g'?: number
    'sugars_100g'?: number
    'saturated-fat_100g'?: number
    'salt_100g'?: number
  }
  category_id?: string  // Local category from product catalog
  source_code?: string
  source_name?: string
  error?: string
}

export interface ProductSuggestion {
  name: string
  brand: string | null
  barcode: string
  user_notes: string | null
}

export interface ProductSuggestResponse {
  suggestions: ProductSuggestion[]
}

export const productsService = {
  /**
   * Search products in the house catalog (full-text, returns ProductCatalogItem[])
   */
  async search(houseId: string, q: string): Promise<ProductCatalogItem[]> {
    const res = await api.get(`/products/search?house_id=${houseId}&q=${encodeURIComponent(q)}&limit=30`)
    return res.data
  },

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
