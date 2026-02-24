/**
 * MealForm Page - Mobile-first design
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import mealsService from '@/services/meals'
import recipesService from '@/services/recipes'
import foodsService from '@/services/foods'
import dispensaService from '@/services/dispensa'
import type { Recipe, RecipeIngredient, Food, MealCreate, RecipeCreate } from '@/types'
import type { ProductEntry } from '@/components/Meals/ProductSearch'
import type { ProductSaveData } from '@/components/Meals/SaveAsProductModal'
import {
  MealTypeSelector,
  PortionInput,
  SaveAsRecipeToggle,
  SaveAsProductModal,
  IngredientSearch,
  IngredientList,
  NutritionSummary,
  ProductSearch,
  ProductList,
} from '@/components/Meals'

type MealMode = 'from_recipe' | 'free_meal'
type MealType = 'colazione' | 'spuntino' | 'pranzo' | 'cena'

/** Chevron icon for accordion headers */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/**
 * Determines the meal type based on current time
 */
function getMealTypeByTime(): MealType {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours * 60 + minutes

  if (time >= 6 * 60 && time < 10 * 60 + 30) {
    return 'colazione'
  } else if (time >= 10 * 60 + 30 && time < 12 * 60) {
    return 'spuntino'
  } else if (time >= 12 * 60 && time < 15 * 60) {
    return 'pranzo'
  } else if (time >= 15 * 60 && time < 18 * 60 + 30) {
    return 'spuntino'
  } else if (time >= 18 * 60 + 30 && time < 22 * 60) {
    return 'cena'
  } else {
    return 'spuntino'
  }
}

export function MealForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentHouse } = useHouse()

  // Form state
  const [mode, setMode] = useState<MealMode>('from_recipe')
  const [mealType, setMealType] = useState<MealType>(() => {
    const mtParam = searchParams.get('meal_type')
    if (mtParam && ['colazione', 'spuntino', 'pranzo', 'cena'].includes(mtParam)) {
      return mtParam as MealType
    }
    return getMealTypeByTime()
  })
  const [consumedAt, setConsumedAt] = useState(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // If the date already contains time (e.g. 2026-02-24T13:00), use as-is
      if (dateParam.includes('T')) {
        return dateParam
      }
      // Otherwise append current time
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      return `${dateParam}T${hours}:${minutes}`
    }
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  })
  const [notes, setNotes] = useState('')

  // Recipe mode state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(
    searchParams.get('recipe_id')
  )
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [portionMultiplier, setPortionMultiplier] = useState(1)
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false)

  // Free meal mode state
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [products, setProducts] = useState<ProductEntry[]>([])
  const [saveAsRecipe, setSaveAsRecipe] = useState(false)
  const [newRecipeName, setNewRecipeName] = useState('')
  const [saveAsProduct, setSaveAsProduct] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [productData, setProductData] = useState<ProductSaveData | null>(null)

  // Accordion state
  const [ingredientsOpen, setIngredientsOpen] = useState(true)
  const [productsOpen, setProductsOpen] = useState(true)

  // Foods cache
  const [foodsMap, setFoodsMap] = useState<Map<string, Food>>(new Map())

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load recipe from searchParams on mount
  useEffect(() => {
    const recipeIdParam = searchParams.get('recipe_id')
    if (recipeIdParam && currentHouse) {
      setIsLoadingRecipe(true)
      recipesService.getById(recipeIdParam, currentHouse.id)
        .then((recipe) => {
          setSelectedRecipeId(recipe.id)
          setSelectedRecipe(recipe)
        })
        .catch((err) => {
          console.error('Failed to load recipe:', err)
          setSelectedRecipeId(null)
        })
        .finally(() => setIsLoadingRecipe(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadFoodData = async () => {
      const foodIds = ingredients
        .map((ing) => ing.food_id)
        .filter((id): id is string => id !== undefined && !foodsMap.has(id))

      if (foodIds.length === 0) return

      try {
        const promises = foodIds.map((id) => foodsService.getById(id))
        const foods = await Promise.all(promises)

        setFoodsMap((prev) => {
          const newMap = new Map(prev)
          foods.forEach((food) => newMap.set(food.id, food))
          return newMap
        })
      } catch (err) {
        console.error('Failed to load food data:', err)
      }
    }

    loadFoodData()
  }, [ingredients, foodsMap])

  const handleModeChange = (newMode: MealMode) => {
    setMode(newMode)
    setError(null)

    if (newMode === 'from_recipe') {
      setIngredients([])
      setProducts([])
      setSaveAsRecipe(false)
      setNewRecipeName('')
      setSaveAsProduct(false)
      setProductData(null)
    } else {
      setSelectedRecipeId(null)
      setSelectedRecipe(null)
      setPortionMultiplier(1)
    }
  }

  const handleIngredientSelect = (food: Food) => {
    const exists = ingredients.some((ing) => ing.food_id === food.id)
    if (exists) {
      setError('Ingrediente già aggiunto')
      setTimeout(() => setError(null), 3000)
      return
    }

    const newIngredient: RecipeIngredient = {
      food_id: food.id,
      food_name: food.name,
      quantity: 100,
      unit: 'g',
      quantity_g: 100,
    }

    setIngredients((prev) => [...prev, newIngredient])
  }

  const handleProductAdd = (product: ProductEntry) => {
    setProducts((prev) => [...prev, product])
  }

  const calculateNutrition = () => {
    if (mode === 'from_recipe' && selectedRecipe) {
      return {
        calories: (selectedRecipe.total_calories || 0) * portionMultiplier,
        proteins_g: (selectedRecipe.total_proteins_g || 0) * portionMultiplier,
        carbs_g: (selectedRecipe.total_carbs_g || 0) * portionMultiplier,
        fats_g: (selectedRecipe.total_fats_g || 0) * portionMultiplier,
      }
    }

    let calories = 0, proteins_g = 0, carbs_g = 0, fats_g = 0

    for (const ingredient of ingredients) {
      if (!ingredient.food_id) continue
      const food = foodsMap.get(ingredient.food_id)
      if (!food) continue

      const ratio = ingredient.quantity_g / 100
      calories += (food.calories || 0) * ratio
      proteins_g += food.proteins_g * ratio
      carbs_g += food.carbs_g * ratio
      fats_g += food.fats_g * ratio
    }

    // Include products with API nutrients
    for (const product of products) {
      if (!product.nutrients) continue
      const ratio = product.quantity_g / 100
      calories += (product.nutrients['energy-kcal_100g'] || 0) * ratio
      proteins_g += (product.nutrients['proteins_100g'] || 0) * ratio
      carbs_g += (product.nutrients['carbohydrates_100g'] || 0) * ratio
      fats_g += (product.nutrients['fat_100g'] || 0) * ratio
    }

    return { calories, proteins_g, carbs_g, fats_g }
  }

  const validateForm = (): string | null => {
    if (!currentHouse) return 'Nessuna casa selezionata'

    if (mode === 'from_recipe') {
      if (!selectedRecipeId) return 'Seleziona una ricetta'
      if (portionMultiplier <= 0) return 'La porzione deve essere maggiore di 0'
    } else {
      if (ingredients.length === 0 && products.length === 0) return 'Aggiungi almeno un ingrediente o prodotto'
      if (saveAsRecipe && !newRecipeName.trim()) return 'Inserisci un nome per la ricetta'
      if (saveAsProduct && !productData) return 'Completa i dati del prodotto'
    }

    if (!consumedAt) return 'Seleziona data e ora del pasto'

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let recipeId = selectedRecipeId

      if (mode === 'free_meal' && saveAsRecipe) {
        const recipeData: RecipeCreate = {
          name: newRecipeName.trim(),
          ingredients,
        }
        const newRecipe = await recipesService.create(currentHouse!.id, recipeData)
        recipeId = newRecipe.id
      }

      // Create Food entries for products and convert to ingredients
      const productIngredients: RecipeIngredient[] = []
      for (const product of products) {
        const foodData: Partial<Food> = {
          name: product.name,
          category: 'Altro',
        }
        if (product.fromApi && product.nutrients) {
          foodData.calories = product.nutrients['energy-kcal_100g'] || 0
          foodData.proteins_g = product.nutrients['proteins_100g'] || 0
          foodData.carbs_g = product.nutrients['carbohydrates_100g'] || 0
          foodData.fats_g = product.nutrients['fat_100g'] || 0
          foodData.fibers_g = product.nutrients['fiber_100g'] || 0
        }
        const createdFood = await foodsService.create(currentHouse!.id, foodData)
        productIngredients.push({
          food_id: createdFood.id,
          food_name: product.name,
          quantity: product.quantity_g,
          unit: 'g',
          quantity_g: product.quantity_g,
        })
      }

      const allIngredients = [...ingredients, ...productIngredients]

      const mealData: MealCreate = {
        recipe_id: recipeId || undefined,
        ingredients: mode === 'free_meal' ? allIngredients : undefined,
        meal_type: mealType,
        quantity_grams: mode === 'free_meal'
          ? allIngredients.reduce((sum, ing) => sum + ing.quantity_g, 0)
          : undefined,
        consumed_at: new Date(consumedAt).toISOString(),
        notes: notes.trim() || undefined,
      }

      await mealsService.create(currentHouse!.id, mealData)

      // Save to dispensa if toggle is on
      if (mode === 'free_meal' && saveAsProduct && productData) {
        try {
          const nutrition = calculateNutrition()
          const saveFoodData: Partial<Food> = {
            name: productData.name,
            category: 'Altro',
          }

          if (productData.fromApi && productData.nutrients) {
            saveFoodData.calories = productData.nutrients['energy-kcal_100g'] || 0
            saveFoodData.proteins_g = productData.nutrients['proteins_100g'] || 0
            saveFoodData.carbs_g = productData.nutrients['carbohydrates_100g'] || 0
            saveFoodData.fats_g = productData.nutrients['fat_100g'] || 0
            saveFoodData.fibers_g = productData.nutrients['fiber_100g'] || 0
          } else {
            saveFoodData.calories = nutrition.calories
            saveFoodData.proteins_g = nutrition.proteins_g
            saveFoodData.carbs_g = nutrition.carbs_g
            saveFoodData.fats_g = nutrition.fats_g
          }

          await foodsService.create(currentHouse!.id, saveFoodData)

          const dispensaItem = await dispensaService.createItem(currentHouse!.id, {
            name: productData.name,
            quantity: 1,
            unit: 'pz',
            expiry_date: productData.expiryDate || undefined,
            barcode: productData.barcode,
            environment_id: productData.environmentId,
          })

          await dispensaService.consumeItem(currentHouse!.id, dispensaItem.id)
        } catch (productErr) {
          console.error('Failed to save product to dispensa:', productErr)
        }
      }

      navigate('/meals')
    } catch (err: any) {
      console.error('Failed to create meal:', err)
      setError(err.response?.data?.detail || 'Errore durante la creazione del pasto')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!currentHouse) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            Seleziona o crea una casa prima di registrare un pasto
          </p>
        </div>
      </div>
    )
  }

  const nutrition = calculateNutrition()

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Registra Pasto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode selector - horizontal toggle on mobile */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('from_recipe')}
            className={`
              p-3 rounded-lg border-2 transition-all text-center
              ${mode === 'from_recipe'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600'}
            `}
          >
            <div className="text-xl mb-1">📖</div>
            <div className="text-xs font-medium">Da Ricetta</div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('free_meal')}
            className={`
              p-3 rounded-lg border-2 transition-all text-center
              ${mode === 'free_meal'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600'}
            `}
          >
            <div className="text-xl mb-1">🍽️</div>
            <div className="text-xs font-medium">Pasto Libero</div>
          </button>
        </div>

        {/* Meal type selector */}
        <div className="card p-3">
          <MealTypeSelector value={mealType} onChange={setMealType} />
        </div>

        {/* Mode-specific content */}
        {mode === 'from_recipe' ? (
          <div className="card p-3 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Ricetta</h2>

            {isLoadingRecipe ? (
              <p className="text-sm text-gray-500">Caricamento ricetta...</p>
            ) : selectedRecipe ? (
              <>
                {/* Selected recipe compact card */}
                <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">
                      {selectedRecipe.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {Math.round(selectedRecipe.total_calories || 0)} kcal
                      {' · '}P:{Math.round(selectedRecipe.total_proteins_g || 0)}
                      {' '}C:{Math.round(selectedRecipe.total_carbs_g || 0)}
                      {' '}G:{Math.round(selectedRecipe.total_fats_g || 0)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams()
                      params.set('inquiry', 'meal')
                      params.set('date', consumedAt)
                      params.set('meal_type', mealType)
                      navigate(`/recipes?${params.toString()}`)
                    }}
                    className="text-xs text-primary-600 font-medium hover:text-primary-800 flex-shrink-0"
                  >
                    Cambia
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecipeId(null)
                      setSelectedRecipe(null)
                    }}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <PortionInput
                  value={portionMultiplier}
                  onChange={setPortionMultiplier}
                  recipe={selectedRecipe}
                />
              </>
            ) : (
              /* No recipe selected - show buttons */
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('inquiry', 'meal')
                    params.set('date', consumedAt)
                    params.set('meal_type', mealType)
                    navigate(`/recipes?${params.toString()}`)
                  }}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  Scegli ricetta
                </button>
                <Link
                  to="/recipes/new"
                  className="flex items-center justify-center w-10 h-10 bg-green-500 text-white rounded-lg hover:bg-green-600 flex-shrink-0"
                  title="Nuova ricetta"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Ingredienti accordion */}
            <div className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setIngredientsOpen(!ingredientsOpen)}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">Ingredienti</h2>
                  {ingredients.length > 0 && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                      {ingredients.length}
                    </span>
                  )}
                </div>
                <ChevronIcon open={ingredientsOpen} />
              </button>
              {ingredientsOpen && (
                <div className="p-3 pt-0 space-y-3 border-t border-gray-100">
                  <IngredientSearch onSelect={handleIngredientSelect} />
                  <IngredientList ingredients={ingredients} onUpdate={setIngredients} />
                  <NutritionSummary ingredients={ingredients} foods={foodsMap} />
                </div>
              )}
            </div>

            {/* Prodotti accordion */}
            <div className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setProductsOpen(!productsOpen)}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">Prodotti</h2>
                  {products.length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {products.length}
                    </span>
                  )}
                </div>
                <ChevronIcon open={productsOpen} />
              </button>
              {productsOpen && (
                <div className="p-3 pt-0 space-y-3 border-t border-gray-100">
                  <ProductSearch onAdd={handleProductAdd} />
                  <ProductList products={products} onUpdate={setProducts} />
                </div>
              )}
            </div>

            <div className="card p-3">
              <SaveAsRecipeToggle
                checked={saveAsRecipe}
                recipeName={newRecipeName}
                onCheckedChange={setSaveAsRecipe}
                onRecipeNameChange={setNewRecipeName}
              />
            </div>

            <div className="card p-3">
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsProduct}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setSaveAsProduct(checked)
                      if (checked) {
                        setShowProductModal(true)
                      } else {
                        setProductData(null)
                      }
                    }}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Salva anche come prodotto</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Registra nella dispensa come prodotto consumato
                    </div>
                  </div>
                </label>

                {/* Mini summary when product data is set */}
                {saveAsProduct && productData && (
                  <div className="pl-7 flex items-center gap-2 text-sm text-gray-700 bg-white rounded-lg p-2 border border-gray-100">
                    <span className="font-medium truncate">{productData.name}</span>
                    {productData.expiryDate && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        Scad. {productData.expiryDate}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="ml-auto text-xs text-primary-600 hover:text-primary-800 flex-shrink-0"
                    >
                      Modifica
                    </button>
                  </div>
                )}

                {saveAsProduct && !productData && (
                  <div className="pl-7">
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="text-sm text-primary-600 hover:text-primary-800 underline"
                    >
                      Compila i dati del prodotto
                    </button>
                  </div>
                )}
              </div>
            </div>

            <SaveAsProductModal
              open={showProductModal}
              onClose={() => {
                setShowProductModal(false)
                if (!productData) setSaveAsProduct(false)
              }}
              onConfirm={(data) => {
                setProductData(data)
                setShowProductModal(false)
              }}
              calculatedNutrition={calculateNutrition()}
            />
          </>
        )}

        {/* Date/time */}
        <div className="card p-3 space-y-3 overflow-hidden">
          <div>
            <label htmlFor="consumed-at" className="label text-xs">
              Data e ora
            </label>
            <input
              id="consumed-at"
              type="datetime-local"
              value={consumedAt}
              onChange={(e) => setConsumedAt(e.target.value)}
              required
              className="input w-full [&]:min-w-0 [&]:max-w-full"
            />
          </div>

          <div>
            <label htmlFor="notes" className="label text-xs">
              Note (opzionale)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Aggiungi note..."
              className="input w-full resize-none"
            />
          </div>
        </div>

        {/* Nutrition summary */}
        {(selectedRecipe || ingredients.length > 0 || products.length > 0) && (
          <div className="card p-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Totale</h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-lg font-bold text-gray-900">{Math.round(nutrition.calories)}</div>
                <div className="text-[10px] text-gray-500">kcal</div>
              </div>
              <div className="bg-blue-50 rounded p-2">
                <div className="text-lg font-bold text-blue-600">{nutrition.proteins_g.toFixed(0)}</div>
                <div className="text-[10px] text-blue-500">Proteine</div>
              </div>
              <div className="bg-yellow-50 rounded p-2">
                <div className="text-lg font-bold text-yellow-600">{nutrition.carbs_g.toFixed(0)}</div>
                <div className="text-[10px] text-yellow-500">Carbo</div>
              </div>
              <div className="bg-red-50 rounded p-2">
                <div className="text-lg font-bold text-red-600">{nutrition.fats_g.toFixed(0)}</div>
                <div className="text-[10px] text-red-500">Grassi</div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Actions - sticky on mobile */}
        <div className="flex gap-2 sticky bottom-16 sm:bottom-0 bg-gray-50 -mx-4 px-4 py-3 border-t sm:border-0 sm:bg-transparent sm:static sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/meals')}
            disabled={isSubmitting}
            className="btn btn-secondary flex-1 sm:flex-none text-sm"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary flex-1 sm:flex-none text-sm"
          >
            {isSubmitting ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MealForm
