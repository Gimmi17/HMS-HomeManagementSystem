// User types
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: 'admin' | 'basic'
  preferences: UserPreferences
  created_at: string
}

export interface UserPreferences {
  dietary?: string[]
  allergies?: string[]
  goals?: {
    calories?: number
    proteins_g?: number
    carbs_g?: number
    fats_g?: number
  }
}

// House types
export interface House {
  id: string
  name: string
  description?: string
  location?: string
  owner_id: string
  members?: HouseMember[]
  settings?: Record<string, unknown>
  created_at: string
}

export interface HouseMember {
  user_id: string
  full_name: string
  email: string
  role: 'OWNER' | 'MEMBER' | 'GUEST'
  joined_at: string
}

export interface HouseInvite {
  code: string
  expires_at: string
}

// Food types (from nutrition DB)
export interface Food {
  id: string
  house_id?: string  // null = global template
  name: string
  category: string
  calories?: number
  proteins_g: number
  fats_g: number
  carbs_g: number
  fibers_g: number
  omega3_ala_g?: number
  omega6_g?: number
  calcium_mg?: number
  iron_mg?: number
  magnesium_mg?: number
  potassium_mg?: number
  zinc_mg?: number
  vitamin_a_mcg?: number
  vitamin_c_mg?: number
  vitamin_d_mcg?: number
  vitamin_e_mg?: number
  vitamin_k_mcg?: number
  vitamin_b6_mg?: number
  folate_b9_mcg?: number
  vitamin_b12_mcg?: number
}

// Recipe types
export interface RecipeIngredient {
  food_id?: string  // Optional: null if ingredient not in database
  food_name: string
  quantity: number
  unit: string
  quantity_g: number
  needs_configuration?: boolean  // True if ingredient needs to be linked to a food
}

export interface Recipe {
  id: string
  house_id: string
  created_by: string
  name: string
  description?: string
  procedure?: string
  ingredients: RecipeIngredient[]
  preparation_time_min?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  tags: string[]
  total_calories?: number
  total_proteins_g?: number
  total_fats_g?: number
  total_carbs_g?: number
  created_at: string
  updated_at: string
}

export interface RecipeCreate {
  name: string
  description?: string
  procedure?: string
  ingredients: RecipeIngredient[]
  preparation_time_min?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
  portions?: number
}

// Meal types
export interface Meal {
  id: string
  user_id: string
  house_id: string
  recipe_id?: string
  recipe_name?: string
  meal_type: 'colazione' | 'spuntino' | 'pranzo' | 'cena'
  ingredients?: RecipeIngredient[]
  quantity_grams?: number
  calories?: number
  proteins_g?: number
  fats_g?: number
  carbs_g?: number
  consumed_at: string
  notes?: string
  created_at: string
}

export interface MealCreate {
  recipe_id?: string
  ingredients?: RecipeIngredient[]
  meal_type: 'colazione' | 'spuntino' | 'pranzo' | 'cena'
  quantity_grams?: number
  consumed_at: string
  notes?: string
}

// Health types
export interface Weight {
  id: string
  user_id: string
  weight_kg: number
  measured_at: string
  notes?: string
}

export interface HealthRecord {
  id: string
  user_id: string
  type: string
  description: string
  severity?: 'mild' | 'moderate' | 'severe'
  recorded_at: string
}

// Grocy types
export interface GrocyProduct {
  id: string
  name: string
  ean?: string
  brand?: string
  weight_g?: number
  cost?: number
}

export interface GrocyStockItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  best_before_date?: string
}

// Grocy Write Operation Types
export interface GrocyAddStockParams {
  amount: number
  best_before_date?: string
  price?: number
  location_id?: number
  note?: string
}

export interface GrocyConsumeStockParams {
  amount: number
  spoiled?: boolean
  location_id?: number
}

export interface GrocyOpenProductParams {
  amount?: number
}

export interface GrocyTransferStockParams {
  amount: number
  location_id_from: number
  location_id_to: number
}

export interface GrocyInventoryCorrectionParams {
  new_amount: number
  best_before_date?: string
  location_id?: number
}

export interface GrocyBulkAddItem {
  product_id: number
  amount: number
  best_before_date?: string
  price?: number
  location_id?: number
  note?: string
}

export interface GrocyWriteOperationResponse {
  success: boolean
  message: string
  error?: string
}

export interface GrocyBulkAddResult {
  product_id: number
  success: boolean
  message: string
}

export interface GrocyBulkAddStockResponse {
  total: number
  successful: number
  failed: number
  results: GrocyBulkAddResult[]
}

export interface GrocyLocation {
  id: number
  name: string
  description?: string
  is_freezer: boolean
}

export type GrocyStockActionType = 'consume' | 'open' | 'transfer' | 'inventory'

// Auth types
export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginRequest {
  identifier: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
}

// Password Recovery types
export interface RecoverySetupRequest {
  recovery_pin: string
  recovery_pin_confirm: string
}

export interface RecoveryUpdateRequest {
  current_password: string
  recovery_pin: string
  recovery_pin_confirm: string
}

export interface RecoveryCheckResponse {
  has_recovery: boolean
}

export interface RecoveryStatusResponse {
  has_recovery_setup: boolean
}

export interface PasswordResetRequest {
  email: string
  recovery_pin: string
  new_password: string
  new_password_confirm: string
}

export interface FirstTimeResetRequest {
  email: string
  recovery_pin: string
  recovery_pin_confirm: string
  new_password: string
  new_password_confirm: string
}

// Store types
export type StoreSize = 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface Store {
  id: string
  house_id?: string  // null = global template
  chain?: string
  name: string
  address?: string
  country?: string
  size?: StoreSize
  display_name: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface StoreCreate {
  chain?: string
  name: string
  address?: string
  country?: string
  size?: StoreSize
}

export interface StoreUpdate {
  chain?: string
  name?: string
  address?: string
  country?: string
  size?: StoreSize
}

// Shopping List types
export type ShoppingListStatus = 'active' | 'completed' | 'cancelled'
export type VerificationStatus = 'not_started' | 'in_progress' | 'paused' | 'completed'

export interface ShoppingListItem {
  id: string
  position: number
  name: string
  grocy_product_id?: number
  grocy_product_name?: string
  quantity: number
  unit?: string
  checked: boolean
  scanned_barcode?: string
  verified_at?: string
  verified_quantity?: number
  verified_unit?: string
  checked_at?: string
  not_purchased: boolean
  not_purchased_at?: string
  store_picking_position?: number  // null = mai acquistato in questo negozio
  urgent: boolean
  expiry_date?: string  // formato YYYY-MM-DD dal backend
  category_id?: string
  catalog_barcode?: string  // EAN noto da acquisti precedenti
  product_notes?: string  // Commento utente dal catalogo prodotti
  created_at: string
  updated_at: string
}

export interface ShoppingList {
  id: string
  house_id: string
  store_id?: string
  store_name?: string
  created_by?: string
  name: string
  status: ShoppingListStatus
  verification_status: VerificationStatus
  items: ShoppingListItem[]
  created_at: string
  updated_at: string
}

export interface ShoppingListSummary {
  id: string
  house_id: string
  store_id?: string
  store_name?: string
  name: string
  status: ShoppingListStatus
  verification_status: VerificationStatus
  item_count: number
  checked_count: number
  verified_count: number
  not_purchased_count: number
  created_at: string
  updated_at: string
}

export interface ShoppingListCreate {
  house_id: string
  store_id?: string
  name?: string
  items?: {
    name: string
    grocy_product_id?: number
    grocy_product_name?: string
    quantity?: number
    unit?: string
    position?: number
    category_id?: string
    urgent?: boolean
  }[]
}

export interface ShoppingListItemCreate {
  name: string
  grocy_product_id?: number
  grocy_product_name?: string
  quantity?: number
  unit?: string
  position?: number
  category_id?: string
  urgent?: boolean
}

// BarcodeBuddy types
export interface BarcodeScanResult {
  success: boolean
  message: string
  product_name?: string
  product_id?: number
  action: 'found' | 'added' | 'unknown' | 'error'
}

export interface GrocyProductSimple {
  id: number
  name: string
  description?: string
  barcode?: string
}

// Receipt types
export type ReceiptStatus = 'uploaded' | 'processing' | 'processed' | 'reconciled' | 'error'
export type ReceiptItemMatchStatus = 'unmatched' | 'matched' | 'extra' | 'ignored'

export interface ReceiptItem {
  id: string
  receipt_id: string
  position: number
  raw_text: string
  parsed_name?: string
  parsed_quantity?: number
  parsed_unit_price?: number
  parsed_total_price?: number
  match_status: ReceiptItemMatchStatus
  shopping_list_item_id?: string
  user_corrected_name?: string
  user_confirmed: boolean
  match_confidence?: number
  created_at: string
  updated_at: string
}

// Category types
export interface Category {
  id: string
  house_id?: string  // null = global template
  name: string
  description?: string
  icon?: string
  color?: string  // Hex color code (e.g., #FF5733)
  sort_order: number
  default_environment_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ReceiptImage {
  id: string
  receipt_id: string
  position: number
  image_path: string
  raw_ocr_text?: string
  ocr_confidence?: number
  created_at: string
}

export interface Receipt {
  id: string
  shopping_list_id: string
  uploaded_by?: string
  status: ReceiptStatus
  raw_ocr_text?: string
  ocr_confidence?: number
  store_name_detected?: string
  total_amount_detected?: number
  processed_at?: string
  error_message?: string
  images: ReceiptImage[]
  items: ReceiptItem[]
  created_at: string
  updated_at: string
}

export interface CategoryCreate {
  name: string
  description?: string
  icon?: string
  color?: string
  sort_order?: number
  default_environment_id?: string
}

export interface CategoryUpdate {
  name?: string
  description?: string
  icon?: string
  color?: string
  sort_order?: number
  default_environment_id?: string
}

// Environment types
export type EnvironmentType = 'food_storage' | 'equipment' | 'general'

export interface Environment {
  id: string
  house_id: string
  name: string
  icon: string | null
  env_type: EnvironmentType
  description: string | null
  is_default: boolean
  position: number
  item_count: number
  created_at: string
  updated_at: string
}

export interface EnvironmentCreate {
  name: string
  icon?: string
  env_type?: EnvironmentType
  description?: string
  position?: number
}

export interface EnvironmentUpdate {
  name?: string
  icon?: string
  env_type?: EnvironmentType
  description?: string
  position?: number
}

export interface ExpenseByCategory {
  category_id: string | null
  category_name: string
  total: number
}

export interface ExpenseByMonth {
  month: string
  total: number
}

export interface EnvironmentExpenseStats {
  total_spent: number
  by_category: ExpenseByCategory[]
  by_month: ExpenseByMonth[]
}

// Dispensa types
export interface DispensaItem {
  id: string
  house_id: string
  name: string
  quantity: number
  unit: string | null
  category_id: string | null
  expiry_date: string | null
  barcode: string | null
  grocy_product_id: number | null
  grocy_product_name: string | null
  source_list_id: string | null
  source_item_id: string | null
  added_by: string | null
  environment_id: string | null
  purchase_price: number | null
  is_consumed: boolean
  consumed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReceiptSummary {
  id: string
  shopping_list_id: string
  status: ReceiptStatus
  store_name_detected?: string
  total_amount_detected?: number
  image_count: number
  item_count: number
  matched_count: number
  first_image_path?: string
  created_at: string
}

export interface ReconciliationResult {
  receipt_item_id: string
  shopping_list_item_id?: string
  match_status: ReceiptItemMatchStatus
  confidence: number
  matched_name?: string
}

export interface ReconciliationSummary {
  total_receipt_items: number
  total_shopping_items: number
  matched_count: number
  suggested_count: number
  extra_count: number
  missing_count: number
  match_rate: number
}

export interface ReconciliationResponse {
  receipt_id: string
  results: ReconciliationResult[]
  summary: ReconciliationSummary
  missing_items: {
    id: string
    name: string
    quantity: number
    unit?: string
  }[]
}

export interface DispensaStats {
  total: number
  expiring_soon: number
  expired: number
}

// API response types
export interface ApiError {
  detail: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}
