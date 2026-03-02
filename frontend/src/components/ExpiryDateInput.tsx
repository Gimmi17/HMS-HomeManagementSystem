import { useState } from 'react'

/** Convert YYYY-MM-DD to DD/MM/YYYY for display */
export function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

/** Parse user input (DDMMYY, DDMMYYYY, DD/MM/YY, DD/MM/YYYY etc.) to YYYY-MM-DD */
export function parseExpiryDate(input: string): string | null {
  if (!input.trim()) return null

  // Compact format: DDMMYY or DDMMYYYY
  const compactMatch = input.match(/^(\d{2})(\d{2})(\d{2,4})$/)
  if (compactMatch) {
    const day = compactMatch[1]
    const month = compactMatch[2]
    const year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3]
    const d = parseInt(day, 10)
    const m = parseInt(month, 10)
    const y = parseInt(year, 10)
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020 || y > 2100) return null
    return `${year}-${month}-${day}`
  }

  // Format with separators: DD/MM/YY or DD/MM/YYYY
  const separatorMatch = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (separatorMatch) {
    const day = separatorMatch[1].padStart(2, '0')
    const month = separatorMatch[2].padStart(2, '0')
    const year = separatorMatch[3].length === 2 ? `20${separatorMatch[3]}` : separatorMatch[3]
    const d = parseInt(day, 10)
    const m = parseInt(month, 10)
    const y = parseInt(year, 10)
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020 || y > 2100) return null
    return `${year}-${month}-${day}`
  }

  return null
}

interface ExpiryDateInputProps {
  value: string          // display value (DD/MM/YYYY or raw input)
  onChange: (displayValue: string) => void
  error?: string
  onErrorChange?: (error: string) => void
  className?: string
  label?: string
}

export default function ExpiryDateInput({
  value,
  onChange,
  error,
  onErrorChange,
  className = '',
  label,
}: ExpiryDateInputProps) {
  const [localError, setLocalError] = useState('')
  const displayError = error ?? localError
  const setError = onErrorChange ?? setLocalError

  return (
    <div className={className}>
      {label && <label className="text-xs font-medium text-gray-500">{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => { onChange(e.target.value); setError('') }}
        placeholder="DDMMYY (es: 011226)"
        className={`input w-full ${label ? 'mt-0.5' : ''} ${displayError ? 'border-red-500' : ''}`}
      />
      {displayError && <p className="text-red-500 text-xs mt-1">{displayError}</p>}
    </div>
  )
}
