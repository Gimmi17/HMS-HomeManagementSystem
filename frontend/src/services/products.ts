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
  error?: string
}

export const productsService = {
  /**
   * Look up a product by barcode using Open Food Facts
   */
  async lookupBarcode(barcode: string): Promise<ProductLookupResult> {
    const response = await api.get(`/products/lookup/${barcode}`)
    return response.data
  },
}

export default productsService
