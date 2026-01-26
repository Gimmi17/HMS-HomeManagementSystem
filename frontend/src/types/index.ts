// User types
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
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

// Auth types
export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
}

// Store types
export type StoreSize = 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface Store {
  id: string
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
  not_purchased: boolean
  not_purchased_at?: string
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
  }[]
}

export interface ShoppingListItemCreate {
  name: string
  grocy_product_id?: number
  grocy_product_name?: string
  quantity?: number
  unit?: string
  position?: number
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

export interface Receipt {
  id: string
  shopping_list_id: string
  uploaded_by?: string
  image_path: string
  status: ReceiptStatus
  raw_ocr_text?: string
  ocr_confidence?: number
  store_name_detected?: string
  total_amount_detected?: number
  processed_at?: string
  error_message?: string
  items: ReceiptItem[]
  created_at: string
  updated_at: string
}

export interface ReceiptSummary {
  id: string
  shopping_list_id: string
  status: ReceiptStatus
  store_name_detected?: string
  total_amount_detected?: number
  item_count: number
  matched_count: number
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
