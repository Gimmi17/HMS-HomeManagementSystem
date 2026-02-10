import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import foodsService from '@/services/foods'
import { useHouse } from '@/context/HouseContext'
import type { FoodListItem, FoodDetailItem, FoodCreateRequest, FoodUpdateRequest } from '@/services/anagrafiche'

// Helper to format nutritional values for display
const formatValue = (value: number | null, unit: string = 'g', precision: number = 2): string => {
  if (value === null || value === undefined) return '-'
  // Convert very small values to mg for better readability
  if (unit === 'g' && value > 0 && value < 0.001) {
    return `${(value * 1000000).toFixed(1)} mcg`
  }
  if (unit === 'g' && value > 0 && value < 1) {
    return `${(value * 1000).toFixed(1)} mg`
  }
  return `${value.toFixed(precision)} ${unit}`
}

// Nutritional field configuration
const nutritionFields = {
  macros: [
    { key: 'proteins_g', label: 'Proteine', unit: 'g' },
    { key: 'fats_g', label: 'Grassi', unit: 'g' },
    { key: 'carbs_g', label: 'Carboidrati', unit: 'g' },
    { key: 'fibers_g', label: 'Fibre', unit: 'g' },
  ],
  fattyAcids: [
    { key: 'omega3_ala_g', label: 'Omega-3 (ALA)', unit: 'g' },
    { key: 'omega6_g', label: 'Omega-6', unit: 'g' },
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

type NutritionKey = keyof Omit<FoodDetailItem, 'id' | 'name' | 'category'>

export function AnagraficheFoods() {
  const navigate = useNavigate()
  const { currentHouse } = useHouse()
  const [foods, setFoods] = useState<FoodListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodDetailItem | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingFood, setEditingFood] = useState<FoodDetailItem | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    macros: true,
    fattyAcids: false,
    minerals: false,
    vitamins: false,
  })

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchFoods = async () => {
    if (!currentHouse) return
    try {
      const response = await foodsService.search(
        currentHouse.id,
        searchQuery || undefined,
        undefined,
        100
      )
      setFoods(response.foods as FoodListItem[])
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to fetch foods:', err)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFoods()
  }, [searchQuery, currentHouse])

  const handleSelectFood = async (food: FoodListItem) => {
    setShowDetailModal(true)
    setIsLoadingDetail(true)
    setSelectedFood(null)
    try {
      const detail = await foodsService.getById(food.id)
      setSelectedFood(detail as FoodDetailItem)
    } catch (err) {
      console.error('Failed to fetch food detail:', err)
      showToast('Errore nel caricamento dettagli', 'error')
      setShowDetailModal(false)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleImportTemplates = async () => {
    if (!currentHouse) return
    setIsImporting(true)
    try {
      const result = await foodsService.importTemplates(currentHouse.id)
      showToast(result.message, 'success')
      fetchFoods()
    } catch (err: any) {
      console.error('Failed to import templates:', err)
      showToast(err.response?.data?.detail || 'Errore durante l\'importazione', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const initFormData = (food?: FoodDetailItem) => {
    const data: Record<string, string> = {
      name: food?.name || '',
      category: food?.category || '',
    }
    // Add all nutrition fields
    const allFields = [
      ...nutritionFields.macros,
      ...nutritionFields.fattyAcids,
      ...nutritionFields.minerals,
      ...nutritionFields.vitamins,
    ]
    allFields.forEach(f => {
      const value = food?.[f.key as NutritionKey]
      data[f.key] = value !== null && value !== undefined ? value.toString() : ''
    })
    return data
  }

  const openCreateModal = () => {
    setEditingFood(null)
    setFormData(initFormData())
    setExpandedSections({ macros: true, fattyAcids: false, minerals: false, vitamins: false })
    setShowDetailModal(false)
    setShowEditModal(true)
  }

  const openEditModal = async (food: FoodListItem | FoodDetailItem) => {
    // If we have detail, use it, otherwise fetch
    let detail: FoodDetailItem
    if ('omega3_ala_g' in food) {
      detail = food as FoodDetailItem
    } else {
      try {
        detail = await foodsService.getById(food.id) as FoodDetailItem
      } catch {
        showToast('Errore nel caricamento', 'error')
        return
      }
    }
    setEditingFood(detail)
    setFormData(initFormData(detail))
    setExpandedSections({ macros: true, fattyAcids: true, minerals: true, vitamins: true })
    setShowDetailModal(false)
    setShowEditModal(true)
  }

  const parseNumber = (val: string): number | undefined => {
    if (!val.trim()) return undefined
    const parsed = parseFloat(val.replace(',', '.'))
    return isNaN(parsed) ? undefined : parsed
  }

  const handleSave = async () => {
    if (!formData.name || !currentHouse) return
    setIsSaving(true)
    try {
      const data: FoodCreateRequest = {
        name: formData.name,
        category: formData.category || undefined,
        proteins_g: parseNumber(formData.proteins_g),
        fats_g: parseNumber(formData.fats_g),
        carbs_g: parseNumber(formData.carbs_g),
        fibers_g: parseNumber(formData.fibers_g),
        omega3_ala_g: parseNumber(formData.omega3_ala_g),
        omega6_g: parseNumber(formData.omega6_g),
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

      if (editingFood) {
        const result = await foodsService.update(editingFood.id, data as FoodUpdateRequest)
        showToast('Alimento aggiornato', 'success')
        // Update selected food if viewing detail
        if (selectedFood?.id === editingFood.id) {
          setSelectedFood(result as FoodDetailItem)
        }
      } else {
        await foodsService.create(currentHouse.id, data)
        showToast('Alimento creato', 'success')
      }
      setShowEditModal(false)
      fetchFoods()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (food: FoodListItem | FoodDetailItem) => {
    if (!confirm(`Eliminare l'alimento "${food.name}"?`)) return
    try {
      await foodsService.delete(food.id)
      showToast('Alimento eliminato', 'success')
      if (selectedFood?.id === food.id) {
        setSelectedFood(null)
        setShowDetailModal(false)
      }
      fetchFoods()
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Errore', 'error')
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const renderNutritionSection = (
    title: string,
    fields: { key: string; label: string; unit: string }[],
    sectionKey: string,
    isForm: boolean = false
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
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <div className={`p-3 ${isForm ? 'grid grid-cols-2 gap-3' : 'space-y-1'}`}>
            {fields.map(field => {
              if (isForm) {
                return (
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
                )
              }
              const value = selectedFood?.[field.key as NutritionKey]
              return (
                <div key={field.key} className="flex justify-between text-sm">
                  <span className="text-gray-600">{field.label}</span>
                  <span className="font-medium text-gray-900">{formatValue(value as number | null)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/anagrafiche')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Gestione Alimenti</h1>
          <p className="text-sm text-gray-500">{total} alimenti</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          + Nuovo
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca per nome..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input w-full"
      />

      {/* List */}
      {!currentHouse ? (
        <p className="text-gray-500 text-center py-8">Seleziona una casa per gestire gli alimenti</p>
      ) : isLoading ? (
        <p className="text-gray-500 text-center py-8">Caricamento...</p>
      ) : foods.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Nessun alimento trovato</p>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleImportTemplates}
              disabled={isImporting}
              className="btn btn-secondary text-sm mx-auto"
            >
              {isImporting ? 'Importazione...' : 'Importa database nutrizionale'}
            </button>
            <span className="text-xs text-gray-400">oppure</span>
            <button
              onClick={openCreateModal}
              className="btn btn-primary text-sm mx-auto"
            >
              Aggiungi manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {foods.map((food) => (
            <div
              key={food.id}
              onClick={() => handleSelectFood(food)}
              className="card p-4 cursor-pointer transition-all hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">
                  {food.category === 'Carne' ? '🥩' :
                   food.category === 'Pesce' ? '🐟' :
                   food.category === 'Verdura' ? '🥬' :
                   food.category === 'Frutta' ? '🍎' :
                   food.category === 'Cereali' ? '🌾' :
                   food.category === 'Latticini' ? '🧀' :
                   '🥗'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{food.name}</p>
                  <p className="text-sm text-gray-500">
                    {food.category || 'Senza categoria'} -
                    P: {food.proteins_g ?? '-'}g |
                    G: {food.fats_g ?? '-'}g |
                    C: {food.carbs_g ?? '-'}g
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {isLoadingDetail ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">Caricamento dettagli...</p>
              </div>
            ) : selectedFood ? (
              <>
                <div className="p-4 border-b sticky top-0 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedFood.name}</h3>
                      <p className="text-sm text-gray-500">{selectedFood.category || 'Senza categoria'}</p>
                    </div>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-xs text-gray-500 font-medium">Valori nutrizionali per 100g:</p>

                  {/* Nutrition Sections */}
                  <div className="space-y-2">
                    {renderNutritionSection('Macronutrienti', nutritionFields.macros, 'macros')}
                    {renderNutritionSection('Acidi Grassi Essenziali', nutritionFields.fattyAcids, 'fattyAcids')}
                    {renderNutritionSection('Minerali', nutritionFields.minerals, 'minerals')}
                    {renderNutritionSection('Vitamine', nutritionFields.vitamins, 'vitamins')}
                  </div>
                </div>
                <div className="p-4 border-t flex gap-3 sticky bottom-0 bg-white">
                  <button
                    onClick={() => openEditModal(selectedFood)}
                    className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(selectedFood)}
                    className="px-4 py-2.5 rounded-lg text-red-600 font-medium hover:bg-red-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Elimina
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b sticky top-0 bg-white">
              <h3 className="font-semibold text-lg">
                {editingFood ? 'Modifica Alimento' : 'Nuovo Alimento'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Basic Info */}
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

              <p className="text-xs text-gray-500 font-medium pt-2">Valori nutrizionali per 100g:</p>

              {/* Nutrition Sections */}
              <div className="space-y-2">
                {renderNutritionSection('Macronutrienti', nutritionFields.macros, 'macros', true)}
                {renderNutritionSection('Acidi Grassi Essenziali', nutritionFields.fattyAcids, 'fattyAcids', true)}
                {renderNutritionSection('Minerali', nutritionFields.minerals, 'minerals', true)}
                {renderNutritionSection('Vitamine', nutritionFields.vitamins, 'vitamins', true)}
              </div>
            </div>
            <div className="p-4 border-t flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || isSaving}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnagraficheFoods
