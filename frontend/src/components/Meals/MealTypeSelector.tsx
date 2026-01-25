/**
 * MealTypeSelector Component - Mobile-first
 */

interface MealTypeSelectorProps {
  value: 'colazione' | 'spuntino' | 'pranzo' | 'cena'
  onChange: (value: 'colazione' | 'spuntino' | 'pranzo' | 'cena') => void
}

const MEAL_TYPES = [
  { value: 'colazione' as const, label: 'Colazione', icon: '🌅' },
  { value: 'spuntino' as const, label: 'Spuntino', icon: '🍎' },
  { value: 'pranzo' as const, label: 'Pranzo', icon: '🍽️' },
  { value: 'cena' as const, label: 'Cena', icon: '🌙' },
]

export function MealTypeSelector({ value, onChange }: MealTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="label text-xs">Tipo pasto</label>
      <div className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={`
              p-2 sm:p-3 rounded-lg border-2 transition-all
              flex flex-col items-center justify-center gap-1
              ${
                value === type.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
              }
            `}
          >
            <span className="text-xl sm:text-2xl">{type.icon}</span>
            <span className="font-medium text-[10px] sm:text-xs">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default MealTypeSelector
