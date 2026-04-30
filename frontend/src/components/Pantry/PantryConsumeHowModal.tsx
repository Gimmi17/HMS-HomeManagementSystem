/**
 * PantryConsumeHowModal
 *
 * Modal a step per dichiarare come è stato consumato un prodotto della dispensa.
 *
 * Step 1 — Metodo: "Da ricetta" / "Ingrediente grezzo" / "Solo consumo"
 * Step 2a (ricetta) — Seleziona ricetta + tipo pasto
 * Step 2b (grezzo)  — Solo tipo pasto
 * "Solo consumo" → nessun pasto, solo decremento dispensa
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import recipesService from '@/services/recipes'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { DispensaItem } from '@/types'
import type { Recipe } from '@/types'

type ConsumeMethod = 'recipe' | 'raw' | 'skip'
type MealType = 'colazione' | 'spuntino' | 'pranzo' | 'cena'

interface PantryConsumeHowModalProps {
  item: DispensaItem
  onConfirm: (result: ConsumeHowResult) => void
  onClose: () => void
}

export interface ConsumeHowResult {
  method: ConsumeMethod
  mealType?: MealType
  recipeId?: string
  recipe?: Recipe
}

const MEAL_OPTIONS: { type: MealType; label: string; icon: string }[] = [
  { type: 'colazione', label: 'Colazione', icon: '☀️' },
  { type: 'spuntino', label: 'Spuntino', icon: '🍎' },
  { type: 'pranzo', label: 'Pranzo', icon: '🍝' },
  { type: 'cena', label: 'Cena', icon: '🌙' },
]

function getMealTypeByTime(): MealType {
  const h = new Date().getHours()
  if (h >= 6 && h < 11) return 'colazione'
  if (h >= 11 && h < 12) return 'spuntino'
  if (h >= 12 && h < 15) return 'pranzo'
  if (h >= 15 && h < 19) return 'spuntino'
  return 'cena'
}

export function PantryConsumeHowModal({ item, onConfirm, onClose }: PantryConsumeHowModalProps) {
  const { currentHouse } = useHouse()
  const [step, setStep] = useState<'method' | 'recipe' | 'mealtype'>('method')
  const [method, setMethod] = useState<ConsumeMethod | null>(null)
  const [mealType, setMealType] = useState<MealType>(getMealTypeByTime())
  const [isClosing, setIsClosing] = useState(false)

  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [loadingRecipes, setLoadingRecipes] = useState(false)

  // Load recipes when method=recipe is chosen
  useEffect(() => {
    if (step !== 'recipe' || !currentHouse) return
    setLoadingRecipes(true)
    recipesService.getAll(currentHouse.id)
      .then(res => setRecipes(Array.isArray(res.recipes) ? res.recipes : []))
      .catch(() => setRecipes([]))
      .finally(() => setLoadingRecipes(false))
  }, [step, currentHouse])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(onClose, 200)
  }

  const handleMethodSelect = (m: ConsumeMethod) => {
    setMethod(m)
    if (m === 'skip') {
      onConfirm({ method: 'skip' })
      return
    }
    if (m === 'recipe') setStep('recipe')
    else setStep('mealtype')
  }

  const handleRecipeNext = () => {
    // recipe selected (or not), go to meal type
    setStep('mealtype')
  }

  const handleConfirm = () => {
    onConfirm({
      method: method!,
      mealType,
      recipeId: selectedRecipeId || undefined,
      recipe: selectedRecipe || undefined,
    })
  }

  const recipeOptions = recipes.map(r => ({
    value: r.id,
    label: r.name,
    sublabel: r.total_calories ? `${Math.round(r.total_calories)} kcal` : undefined,
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={`relative w-full max-w-md bg-white rounded-t-2xl pb-safe shadow-xl
          ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              {step !== 'method' && (
                <button
                  onClick={() => setStep(step === 'mealtype' && method === 'recipe' ? 'recipe' : 'method')}
                  className="text-sm text-primary-600 mb-0.5 block"
                >
                  ← Indietro
                </button>
              )}
              <p className="font-semibold text-gray-900 truncate">{item.name}</p>
              <p className="text-xs text-gray-400">
                {item.quantity} {item.unit || 'pz'} disponibili
              </p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {['Come?', method === 'recipe' ? 'Ricetta' : null, 'Pasto']
              .filter(Boolean)
              .map((label, i) => (
                <div key={label} className="flex items-center gap-1 flex-1">
                  <div className={`flex-1 h-0.5 ${i > 0 ? (
                    (step === 'mealtype' && i <= 1) || (step === 'recipe' && i < 1) ? 'bg-primary-400' : 'bg-gray-200'
                  ) : 'hidden'}`} />
                  <span className={`text-xs font-medium px-1 ${
                    (i === 0 && step === 'method') ||
                    (i === 1 && step === 'recipe') ||
                    ((i === 1 || i === 2) && step === 'mealtype')
                      ? 'text-primary-600'
                      : 'text-gray-400'
                  }`}>{label}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Step 1 — Metodo */}
        {step === 'method' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600 mb-1">Come hai consumato questo prodotto?</p>

            <button
              onClick={() => handleMethodSelect('recipe')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
            >
              <span className="text-2xl">📖</span>
              <div>
                <div className="font-semibold text-sm text-gray-900">Da ricetta</div>
                <div className="text-xs text-gray-500">Collegalo a una ricetta esistente</div>
              </div>
            </button>

            <button
              onClick={() => handleMethodSelect('raw')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
            >
              <span className="text-2xl">🥗</span>
              <div>
                <div className="font-semibold text-sm text-gray-900">Ingrediente grezzo / diretto</div>
                <div className="text-xs text-gray-500">Consumato così com'è, senza ricetta</div>
              </div>
            </button>

            <button
              onClick={() => handleMethodSelect('skip')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-2xl">⚡</span>
              <div>
                <div className="font-semibold text-sm text-gray-700">Solo consumo</div>
                <div className="text-xs text-gray-500">Decrementa la dispensa senza tracciare il pasto</div>
              </div>
            </button>
          </div>
        )}

        {/* Step 2a — Ricetta */}
        {step === 'recipe' && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">Seleziona la ricetta usata (opzionale):</p>
            {loadingRecipes ? (
              <div className="text-sm text-gray-400 text-center py-4">Caricamento ricette...</div>
            ) : (
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <SearchableSelect
                    options={recipeOptions}
                    value={selectedRecipeId}
                    onChange={(val) => {
                      setSelectedRecipeId(val)
                      setSelectedRecipe(recipes.find(r => r.id === val) || null)
                    }}
                    placeholder="Cerca ricetta..."
                    emptyLabel="Nessuna ricetta salvata"
                  />
                </div>
                <Link
                  to="/recipes/new"
                  className="flex-shrink-0 w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="Crea nuova ricetta"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </Link>
              </div>
            )}
            {selectedRecipe && (
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 text-sm">
                <span className="font-medium text-primary-800">{selectedRecipe.name}</span>
                {selectedRecipe.total_calories != null && (
                  <span className="text-primary-500 ml-2">{Math.round(selectedRecipe.total_calories)} kcal</span>
                )}
              </div>
            )}
            <button
              onClick={handleRecipeNext}
              className="btn btn-primary w-full"
            >
              {selectedRecipeId ? 'Continua' : 'Continua senza ricetta →'}
            </button>
          </div>
        )}

        {/* Step 2b — Tipo pasto */}
        {step === 'mealtype' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600">Per quale pasto?</p>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setMealType(opt.type)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-colors
                    ${mealType === opt.type
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-100 text-gray-700 hover:border-gray-300'}`}
                >
                  <span>{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>

            {/* Preview ingredienti che verranno scalati dalla dispensa */}
            {selectedRecipe && selectedRecipe.ingredients && (
              <div className='bg-gray-50 rounded-lg p-3 text-sm mt-3'>
                <p className='font-medium text-gray-700 mb-2 text-xs uppercase tracking-wide'>Prodotti che verranno scalati</p>
                <ul className='space-y-1'>
                  {selectedRecipe.ingredients
                    .filter((ing: any) => ing.product_id)
                    .map((ing: any, i: number) => (
                      <li key={i} className='flex justify-between text-xs'>
                        <span className='text-gray-700'>{ing.product_name || ing.food_name}</span>
                        <span className='text-gray-500'>{ing.quantity} {ing.unit}</span>
                      </li>
                    ))
                  }
                  {selectedRecipe.ingredients.every((ing: any) => !ing.product_id) && (
                    <li className='text-xs text-gray-400'>Nessun prodotto dispensa da scalare</li>
                  )}
                </ul>
              </div>
            )}

            <button
              onClick={handleConfirm}
              className="btn btn-primary w-full mt-2"
            >
              Conferma consumo
            </button>
          </div>
        )}

        {/* Safe area padding per iPhone */}
        <div className="h-4" />
      </div>
    </div>
  )
}

export default PantryConsumeHowModal
