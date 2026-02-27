import type { DispensaItem } from '@/types'

type MealType = 'colazione' | 'spuntino' | 'pranzo' | 'cena'

interface MealTypeModalProps {
  item: DispensaItem
  onSelect: (mealType: MealType) => void
  onSkip: () => void
  onClose: () => void
}

const MEAL_OPTIONS: { type: MealType; label: string; icon: string; color: string }[] = [
  { type: 'colazione', label: 'Colazione', icon: '☀️', color: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { type: 'spuntino', label: 'Spuntino', icon: '🍎', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  { type: 'pranzo', label: 'Pranzo', icon: '🍝', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { type: 'cena', label: 'Cena', icon: '🌙', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
]

export function MealTypeModal({ item, onSelect, onSkip, onClose }: MealTypeModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-md p-4 pb-8 space-y-3 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-500 mt-1">Per quale pasto?</p>
        </div>

        {MEAL_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className={`w-full py-3 rounded-lg font-medium border transition-colors flex items-center justify-center gap-2 ${opt.color} hover:opacity-80`}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}

        <button
          onClick={onSkip}
          className="w-full py-3 rounded-lg bg-gray-50 text-gray-600 font-medium border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          Consuma senza pasto
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-lg text-gray-500 font-medium hover:bg-gray-50 transition-colors"
        >
          Annulla
        </button>
      </div>
    </div>
  )
}
