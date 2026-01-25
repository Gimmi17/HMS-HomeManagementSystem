/**
 * ProcedureSection Component
 *
 * Displays the cooking procedure/instructions for a recipe.
 * Features:
 * - Formatted text display
 * - Preserves line breaks and formatting from backend
 * - Shows message when no procedure is available
 * - Clean, readable typography
 *
 * Props:
 * - procedure: The cooking instructions text (optional)
 */

interface ProcedureSectionProps {
  procedure?: string
}

export function ProcedureSection({ procedure }: ProcedureSectionProps) {
  // Don't render if no procedure provided
  if (!procedure || procedure.trim().length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Procedimento</h2>
        <p className="text-gray-500 italic">
          Nessun procedimento disponibile per questa ricetta.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Procedimento</h2>

      {/* Procedure text with preserved whitespace and line breaks */}
      <div className="prose prose-gray max-w-none">
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {procedure}
        </div>
      </div>
    </div>
  )
}
