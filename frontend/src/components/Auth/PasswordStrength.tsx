interface PasswordStrengthProps {
  password: string
}

function calculateStrength(password: string): { score: number; label: string; color: string } {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) {
    return { score: 1, label: 'Debole', color: 'bg-red-500' }
  } else if (score <= 3) {
    return { score: 2, label: 'Media', color: 'bg-yellow-500' }
  } else {
    return { score: 3, label: 'Forte', color: 'bg-green-500' }
  }
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null

  const { score, label, color } = calculateStrength(password)

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              score >= level ? color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className={`font-medium ${
          score === 1 ? 'text-red-600' : score === 2 ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {label}
        </span>
        <span className="text-gray-400">
          {password.length >= 8 ? 'Min. 8 caratteri' : `${password.length}/8 caratteri`}
        </span>
      </div>
    </div>
  )
}

export default PasswordStrength
