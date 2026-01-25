/**
 * SaveAsRecipeToggle Component
 *
 * Checkbox with optional recipe name input
 * Used in free meal mode to optionally save the meal as a reusable recipe
 */

interface SaveAsRecipeToggleProps {
  checked: boolean
  recipeName: string
  onCheckedChange: (checked: boolean) => void
  onRecipeNameChange: (name: string) => void
  disabled?: boolean
}

export function SaveAsRecipeToggle({
  checked,
  recipeName,
  onCheckedChange,
  onRecipeNameChange,
  disabled = false,
}: SaveAsRecipeToggleProps) {
  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          disabled={disabled}
          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="font-medium text-gray-900">Salva anche come ricetta</div>
          <div className="text-sm text-gray-600 mt-1">
            Salva questo pasto come ricetta riutilizzabile per il futuro
          </div>
        </div>
      </label>

      {/* Recipe name input (shown only when checkbox is checked) */}
      {checked && (
        <div className="pl-7 space-y-2">
          <label htmlFor="recipe-name" className="label">
            Nome ricetta *
          </label>
          <input
            id="recipe-name"
            type="text"
            value={recipeName}
            onChange={(e) => onRecipeNameChange(e.target.value)}
            disabled={disabled}
            placeholder="Es: Pasta al pomodoro"
            className="input w-full"
            required={checked}
          />
          <p className="text-xs text-gray-500">
            Questa ricetta sarà disponibile per tutti i membri della casa
          </p>
        </div>
      )}
    </div>
  )
}

export default SaveAsRecipeToggle
