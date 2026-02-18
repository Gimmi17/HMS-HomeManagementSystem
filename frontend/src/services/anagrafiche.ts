import api from './api'

// ============================================================
// USERS
// ============================================================

export interface UserListItem {
  id: string
  email: string
  full_name: string | null
  role: string
  has_recovery_setup: boolean
  created_at: string
  updated_at: string
}

export interface UserCreateRequest {
  email: string
  password: string
  full_name?: string
  role?: string
}

export interface UserUpdateRequest {
  email?: string
  full_name?: string
  role?: string
  password?: string
}

// ============================================================
// HOUSES
// ============================================================

export interface HouseListItem {
  id: string
  name: string
  description: string | null
  location: string | null
  owner_id: string
  owner_name: string | null
  member_count: number
  created_at: string
}

export interface HouseCreateRequest {
  name: string
  description?: string
  location?: string
  owner_id: string
}

export interface HouseUpdateRequest {
  name?: string
  description?: string
  location?: string
  owner_id?: string
}

// ============================================================
// FOODS
// ============================================================

export interface FoodListItem {
  id: string
  name: string
  category: string | null
  proteins_g: number | null
  fats_g: number | null
  carbs_g: number | null
  fibers_g: number | null
}

export interface FoodDetailItem {
  id: string
  name: string
  category: string | null
  // Macronutrients
  proteins_g: number | null
  fats_g: number | null
  carbs_g: number | null
  fibers_g: number | null
  // Essential fatty acids
  omega3_ala_g: number | null
  omega6_g: number | null
  // Minerals
  calcium_g: number | null
  iron_g: number | null
  magnesium_g: number | null
  potassium_g: number | null
  zinc_g: number | null
  // Vitamins
  vitamin_a_g: number | null
  vitamin_c_g: number | null
  vitamin_d_g: number | null
  vitamin_e_g: number | null
  vitamin_k_g: number | null
  vitamin_b6_g: number | null
  folate_b9_g: number | null
  vitamin_b12_g: number | null
}

export interface FoodCreateRequest {
  name: string
  category?: string
  proteins_g?: number
  fats_g?: number
  carbs_g?: number
  fibers_g?: number
  omega3_ala_g?: number
  omega6_g?: number
  calcium_g?: number
  iron_g?: number
  magnesium_g?: number
  potassium_g?: number
  zinc_g?: number
  vitamin_a_g?: number
  vitamin_c_g?: number
  vitamin_d_g?: number
  vitamin_e_g?: number
  vitamin_k_g?: number
  vitamin_b6_g?: number
  folate_b9_g?: number
  vitamin_b12_g?: number
}

export interface FoodUpdateRequest {
  name?: string
  category?: string
  proteins_g?: number
  fats_g?: number
  carbs_g?: number
  fibers_g?: number
  omega3_ala_g?: number
  omega6_g?: number
  calcium_g?: number
  iron_g?: number
  magnesium_g?: number
  potassium_g?: number
  zinc_g?: number
  vitamin_a_g?: number
  vitamin_c_g?: number
  vitamin_d_g?: number
  vitamin_e_g?: number
  vitamin_k_g?: number
  vitamin_b6_g?: number
  folate_b9_g?: number
  vitamin_b12_g?: number
}

// ============================================================
// PRODUCTS
// ============================================================

export interface ProductListItem {
  id: string
  barcode: string
  name: string | null
  brand: string | null
  quantity_text: string | null
  categories: string | null
  // Nutritional values per 100g
  energy_kcal: number | null
  proteins_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fats_g: number | null
  saturated_fats_g: number | null
  fiber_g: number | null
  salt_g: number | null
  // Scores
  nutriscore: string | null
  ecoscore: string | null
  nova_group: string | null
  // Images
  image_url: string | null
  image_small_url: string | null
  // House ownership
  house_id: string | null
  house_name: string | null
  // User notes
  user_notes: string | null
  // Meta
  source: string
  created_at: string
}

export interface ProductCreateRequest {
  barcode: string
  name?: string
  brand?: string
  quantity_text?: string
  energy_kcal?: number
  proteins_g?: number
  carbs_g?: number
  fats_g?: number
  nutriscore?: string
}

export interface ProductUpdateRequest {
  barcode?: string
  name?: string
  brand?: string
  quantity_text?: string
  energy_kcal?: number
  proteins_g?: number
  carbs_g?: number
  fats_g?: number
  nutriscore?: string
}

export interface UnnamedProductWithDescriptions {
  id: string
  barcode: string
  descriptions: string[]
}

export interface UnnamedProductsResponse {
  products: UnnamedProductWithDescriptions[]
  total: number
}

// ============================================================
// PRODUCT CATEGORY TAGS
// ============================================================

export interface ProductCategoryTag {
  id: string
  tag_id: string
  name: string | null
  lang: string | null
  product_count: number
}

// ============================================================
// PRODUCT REPORTS
// ============================================================

export interface ProductReport {
  id: string
  product_id: string
  product_name: string | null
  product_barcode: string
  product_brand: string | null
  reporter_name: string | null
  status: 'open' | 'resolved' | 'dismissed'
  reason: string | null
  resolution_notes: string | null
  created_at: string
  resolved_at: string | null
}

// ============================================================
// BARCODE LOOKUP SOURCES
// ============================================================

export interface BarcodeLookupSource {
  id: string
  name: string
  code: string
  base_url: string
  api_path: string
  is_hardcoded: boolean
  sort_order: number
  cancelled: boolean
  description: string | null
}

export interface BarcodeLookupSourceCreate {
  name: string
  code: string
  base_url: string
  api_path?: string
  sort_order: number
  description?: string
}

export interface BarcodeLookupSourceUpdate {
  name?: string
  base_url?: string
  api_path?: string
  sort_order?: number
  description?: string
}

// ============================================================
// SERVICE
// ============================================================

export const anagraficheService = {
  // Users
  async getUsers(search?: string): Promise<{ users: UserListItem[]; total: number }> {
    const params = search ? { search } : {}
    const response = await api.get('/anagrafiche/users', { params })
    return response.data
  },

  async createUser(data: UserCreateRequest): Promise<UserListItem> {
    const response = await api.post('/anagrafiche/users', data)
    return response.data
  },

  async updateUser(userId: string, data: UserUpdateRequest): Promise<UserListItem> {
    const response = await api.put(`/anagrafiche/users/${userId}`, data)
    return response.data
  },

  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/anagrafiche/users/${userId}`)
  },

  // Houses
  async getHouses(search?: string): Promise<{ houses: HouseListItem[]; total: number }> {
    const params = search ? { search } : {}
    const response = await api.get('/anagrafiche/houses', { params })
    return response.data
  },

  async createHouse(data: HouseCreateRequest): Promise<HouseListItem> {
    const response = await api.post('/anagrafiche/houses', data)
    return response.data
  },

  async updateHouse(houseId: string, data: HouseUpdateRequest): Promise<HouseListItem> {
    const response = await api.put(`/anagrafiche/houses/${houseId}`, data)
    return response.data
  },

  async deleteHouse(houseId: string): Promise<void> {
    await api.delete(`/anagrafiche/houses/${houseId}`)
  },

  // Foods
  async getFoods(params?: { search?: string; category?: string; limit?: number; offset?: number }): Promise<{ foods: FoodListItem[]; total: number }> {
    const response = await api.get('/anagrafiche/foods', { params })
    return response.data
  },

  async getFood(foodId: string): Promise<FoodDetailItem> {
    const response = await api.get(`/anagrafiche/foods/${foodId}`)
    return response.data
  },

  async createFood(data: FoodCreateRequest): Promise<FoodDetailItem> {
    const response = await api.post('/anagrafiche/foods', data)
    return response.data
  },

  async updateFood(foodId: string, data: FoodUpdateRequest): Promise<FoodDetailItem> {
    const response = await api.put(`/anagrafiche/foods/${foodId}`, data)
    return response.data
  },

  async deleteFood(foodId: string): Promise<void> {
    await api.delete(`/anagrafiche/foods/${foodId}`)
  },

  // Products
  async getProducts(params?: { search?: string; category_tag_id?: string; certified?: boolean; limit?: number; offset?: number }): Promise<{ products: ProductListItem[]; total: number }> {
    const response = await api.get('/anagrafiche/products', { params })
    return response.data
  },

  async createProduct(data: ProductCreateRequest): Promise<ProductListItem> {
    const response = await api.post('/anagrafiche/products', data)
    return response.data
  },

  async updateProduct(productId: string, data: ProductUpdateRequest): Promise<ProductListItem> {
    const response = await api.put(`/anagrafiche/products/${productId}`, data)
    return response.data
  },

  async deleteProduct(productId: string): Promise<void> {
    await api.delete(`/anagrafiche/products/${productId}`)
  },

  async getUnnamedProductsWithDescriptions(): Promise<UnnamedProductsResponse> {
    const response = await api.get('/anagrafiche/products/unnamed-with-descriptions')
    return response.data
  },

  async setProductName(productId: string, name: string): Promise<ProductListItem> {
    const response = await api.put(`/anagrafiche/products/${productId}/set-name`, { name })
    return response.data
  },

  async updateProductHouse(productId: string, houseId: string | null): Promise<ProductListItem> {
    const response = await api.patch(`/anagrafiche/products/${productId}/house`, { house_id: houseId })
    return response.data
  },

  async refetchProduct(productId: string, barcode?: string): Promise<ProductListItem> {
    const response = await api.post(`/anagrafiche/products/${productId}/refetch`, barcode ? { barcode } : {})
    return response.data
  },

  async updateProductNotes(productId: string, userNotes: string | null): Promise<ProductListItem> {
    const response = await api.patch(`/anagrafiche/products/${productId}/notes`, { user_notes: userNotes })
    return response.data
  },

  async updateProductNotesByBarcode(barcode: string, userNotes: string | null): Promise<void> {
    await api.patch(`/anagrafiche/products/by-barcode/${barcode}/notes`, { user_notes: userNotes })
  },

  // Product Categories
  async getProductCategories(params?: { search?: string; lang?: string; min_products?: number; limit?: number; offset?: number }): Promise<{ categories: ProductCategoryTag[]; total: number }> {
    const response = await api.get('/anagrafiche/product-categories', { params })
    return response.data
  },

  async getProductCategory(categoryId: string): Promise<ProductCategoryTag> {
    const response = await api.get(`/anagrafiche/product-categories/${categoryId}`)
    return response.data
  },

  // Barcode Sources
  async getBarcodeSources(): Promise<{ sources: BarcodeLookupSource[]; total: number }> {
    const response = await api.get('/anagrafiche/barcode-sources')
    return response.data
  },

  async createBarcodeSource(data: BarcodeLookupSourceCreate): Promise<BarcodeLookupSource> {
    const response = await api.post('/anagrafiche/barcode-sources', data)
    return response.data
  },

  async updateBarcodeSource(id: string, data: BarcodeLookupSourceUpdate): Promise<BarcodeLookupSource> {
    const response = await api.put(`/anagrafiche/barcode-sources/${id}`, data)
    return response.data
  },

  async cancelBarcodeSource(id: string): Promise<BarcodeLookupSource> {
    const response = await api.put(`/anagrafiche/barcode-sources/${id}/cancel`)
    return response.data
  },

  async restoreBarcodeSource(id: string): Promise<BarcodeLookupSource> {
    const response = await api.put(`/anagrafiche/barcode-sources/${id}/restore`)
    return response.data
  },

  async deleteBarcodeSource(id: string): Promise<void> {
    await api.delete(`/anagrafiche/barcode-sources/${id}`)
  },

  async reorderBarcodeSources(sourceIds: string[]): Promise<void> {
    await api.put('/anagrafiche/barcode-sources/reorder', { source_ids: sourceIds })
  },

  // Product Reports
  async reportProduct(productId: string, reason?: string): Promise<void> {
    await api.post(`/anagrafiche/products/${productId}/report`, reason ? { reason } : {})
  },

  async getProductReports(status?: string): Promise<{ reports: ProductReport[]; total: number }> {
    const params = status ? { status } : {}
    const response = await api.get('/anagrafiche/product-reports', { params })
    return response.data
  },

  async resolveReport(reportId: string, notes?: string): Promise<ProductReport> {
    const response = await api.put(`/anagrafiche/product-reports/${reportId}/resolve`, notes ? { resolution_notes: notes } : {})
    return response.data
  },

  async dismissReport(reportId: string): Promise<ProductReport> {
    const response = await api.put(`/anagrafiche/product-reports/${reportId}/dismiss`)
    return response.data
  },

  // Migration
  async getOrphanStats(): Promise<{
    categories: number
    stores: number
    foods: number
    products: number
    total: number
  }> {
    const response = await api.get('/anagrafiche/migration/orphan-stats')
    return response.data
  },

  async linkOrphanDataToHouse(houseId: string): Promise<{
    categories_linked: number
    stores_linked: number
    foods_linked: number
    products_linked: number
    total_linked: number
    house_name: string
  }> {
    const response = await api.post(`/anagrafiche/migration/link-to-house/${houseId}`)
    return response.data
  },
}

export default anagraficheService
