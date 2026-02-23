import { useState } from 'react'
import anagraficheService from '@/services/anagrafiche'
import type { FoodDetailItem, FoodCreateRequest } from '@/services/anagrafiche'

const nutritionFields = {
  macros: [
    { key: 'proteins_g', label: 'Proteine', unit: 'g' },
    { key: 'fats_g', label: 'Grassi', unit: 'g' },
    { key: 'carbs_g', label: 'Carboidrati', unit: 'g' },
    { key: 'fibers_g', label: 'Fibre', unit: 'g' },
  ],
  minerals: [
    { key: 'calcium_g', label: 'Calcio', unit: 'g' },
    { key: 'iron_g', label: 'Ferro', unit: 'g' },
    { key: 'magnesium_g', label: 'Magnesio', unit: 'g' },
    { key: 'potassium_g', label: 'Potassio', unit: 'g' },
    { key: 'zinc_g', label: 'Zinco', unit: 'g' },
  ],
  vitamins: [
    { key: 'vitamin_a_g', label: 'Vitamina A', unit: 'g' },
    { key: 'vitamin_c_g', label: 'Vitamina C', unit: 'g' },
    { key: 'vitamin_d_g', label: 'Vitamina D', unit: 'g' },
    { key: 'vitamin_e_g', label: 'Vitamina E', unit: 'g' },
    { key: 'vitamin_k_g', label: 'Vitamina K', unit: 'g' },
    { key: 'vitamin_b6_g', label: 'Vitamina B6', unit: 'g' },
    { key: 'folate_b9_g', label: 'Folati (B9)', unit: 'g' },
    { key: 'vitamin_b12_g', label: 'Vitamina B12', unit: 'g' },
  ],
}

interface CreateFoodMiniModalProps {
  initialName?: string
  onCreated: (food: FoodDetailItem) => void
  onClose: () => void
}

export default function CreateFoodMiniModal({ initialName, onCreated, onClose }: CreateFoodMiniModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({
    name: initialName || '',
    category: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    macros: true,
    minerals: false,
    vitamins: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const parseNumber = (val: string): number | undefined => {
    if (!val.trim()) return undefined
    const parsed = parseFloat(val.replace(',', '.'))
    return isNaN(parsed) ? undefined : parsed
  }

  const handleSave = async () => {
    if (!formData.name?.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const data: FoodCreateRequest = {
        name: formData.name.trim(),
        category: formData.category?.trim() || undefined,
        proteins_g: parseNumber(formData.proteins_g),
        fats_g: parseNumber(formData.fats_g),
        carbs_g: parseNumber(formData.carbs_g),
        fibers_g: parseNumber(formData.fibers_g),
        calcium_g: parseNumber(formData.calcium_g),
        iron_g: parseNumber(formData.iron_g),
        magnesium_g: parseNumber(formData.magnesium_g),
        potassium_g: parseNumber(formData.potassium_g),
        zinc_g: parseNumber(formData.zinc_g),
        vitamin_a_g: parseNumber(formData.vitamin_a_g),
        vitamin_c_g: parseNumber(formData.vitamin_c_g),
        vitamin_d_g: parseNumber(formData.vitamin_d_g),
        vitamin_e_g: parseNumber(formData.vitamin_e_g),
        vitamin_k_g: parseNumber(formData.vitamin_k_g),
        vitamin_b6_g: parseNumber(formData.vitamin_b6_g),
        folate_b9_g: parseNumber(formData.folate_b9_g),
        vitamin_b12_g: parseNumber(formData.vitamin_b12_g),
      }
      const created = await anagraficheService.createFood(data)
      onCreated(created)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore nella creazione')
    } finally {
      setIsSaving(false)
    }
  }

  const renderSection = (
    title: string,
    fields: { key: string; label: string; unit: string }[],
    sectionKey: string
  ) => {
    const isExpanded = expandedSections[sectionKey]
    return (
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-3 py-2 bg-gray-50 flex items-center justify-between text-left"
        >
          <span className="font-medium text-sm text-gray-700">{title}</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <div className="p-3 grid grid-cols-2 gap-3">
            {fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {field.label} ({field.unit})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData[field.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className="input w-full text-sm"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-lg">Crea Nuovo Alimento</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="es: Carne, Verdura, Frutta..."
              className="input w-full"
            />
          </div>

          <p className="text-xs text-gray-500 font-medium pt-1">Valori nutrizionali per 100g:</p>

          <div className="space-y-2">
            {renderSection('Macronutrienti', nutritionFields.macros, 'macros')}
            {renderSection('Minerali', nutritionFields.minerals, 'minerals')}
            {renderSection('Vitamine', nutritionFields.vitamins, 'vitamins')}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name?.trim() || isSaving}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {isSaving ? 'Creazione...' : 'Crea'}
          </button>
        </div>
      </div>
    </div>
  )
}
