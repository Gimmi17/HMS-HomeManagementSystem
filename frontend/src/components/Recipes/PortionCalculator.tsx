/**
 * PortionCalculator Component
 *
 * Interactive slider for calculating recipe quantities and nutrition for different portion sizes.
 * Features:
 * - Slider from 1 to 10 portions
 * - Real-time multiplier calculation
 * - Visual feedback with portion size display
 * - Affects both ingredient quantities and nutritional values
 *
 * Props:
 * - portionMultiplier: Current portion multiplier value
 * - onChange: Callback when multiplier changes
 */

interface PortionCalculatorProps {
  portionMultiplier: number
  onChange: (multiplier: number) => void
}

export function PortionCalculator({
  portionMultiplier,
  onChange,
}: PortionCalculatorProps) {
  /**
   * Handle slider change
   * Converts slider value (1-10) to multiplier
   */
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    onChange(value)
  }

  /**
   * Get portion size label
   */
  const getPortionLabel = (multiplier: number) => {
    if (multiplier === 1) return '1 porzione (originale)'
    if (multiplier < 1) return `${multiplier.toFixed(1)} porzioni`
    return `${multiplier.toFixed(0)} porzioni`
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Calcola per N Porzioni
      </h2>

      <div className="space-y-4">
        {/* Current portion display */}
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Stai visualizzando</div>
          <div className="text-2xl font-bold text-primary-600">
            {getPortionLabel(portionMultiplier)}
          </div>
        </div>

        {/* Slider */}
        <div className="px-2">
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={portionMultiplier}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            aria-label="Numero di porzioni"
          />

          {/* Slider labels - all numbers on desktop, fewer on mobile */}
          <div className="hidden sm:flex justify-between mt-2">
            <span className="text-xs text-gray-500">1</span>
            <span className="text-xs text-gray-500">2</span>
            <span className="text-xs text-gray-500">3</span>
            <span className="text-xs text-gray-500">4</span>
            <span className="text-xs text-gray-500">5</span>
            <span className="text-xs text-gray-500">6</span>
            <span className="text-xs text-gray-500">7</span>
            <span className="text-xs text-gray-500">8</span>
            <span className="text-xs text-gray-500">9</span>
            <span className="text-xs text-gray-500">10</span>
          </div>
          {/* Mobile: simplified labels */}
          <div className="flex sm:hidden justify-between mt-2">
            <span className="text-xs text-gray-500">1</span>
            <span className="text-xs text-gray-500">5</span>
            <span className="text-xs text-gray-500">10</span>
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs text-gray-500 text-center">
          Muovi il cursore per ricalcolare quantità e valori nutrizionali
        </p>
      </div>
    </div>
  )
}
