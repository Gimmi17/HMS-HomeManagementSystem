import { useState } from 'react'

/**
 * TagInput Component
 *
 * Input component for adding and managing multiple tags.
 * Features:
 * - Add tag by pressing Enter
 * - Remove tag by clicking X button
 * - Visual tag chips with remove buttons
 * - Prevent duplicate tags
 * - Trim whitespace from tags
 */

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagInput({ tags, onChange, placeholder = 'Aggiungi tag (premi Enter)' }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  /**
   * Add new tag when Enter is pressed
   * - Trim whitespace
   * - Check for duplicates (case-insensitive)
   * - Clear input after adding
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newTag = inputValue.trim()

      // Validate tag is not empty and not duplicate
      if (newTag && !tags.some(tag => tag.toLowerCase() === newTag.toLowerCase())) {
        onChange([...tags, newTag])
        setInputValue('')
      }
    }
  }

  /**
   * Remove tag at specific index
   */
  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove))
  }

  return (
    <div>
      {/* Input Field */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input"
      />

      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-800 rounded-full text-sm font-medium"
            >
              <span>{tag}</span>
              <button
                onClick={() => removeTag(index)}
                className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"
                type="button"
                aria-label={`Rimuovi tag ${tag}`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper Text */}
      <p className="text-sm text-gray-500 mt-2">
        Premi Enter per aggiungere un tag. Es: vegetariana, veloce, italiano
      </p>
    </div>
  )
}
