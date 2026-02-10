import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import categoriesService from '@/services/categories'
import { useHouse } from '@/context/HouseContext'
import type { Category } from '@/types'

interface CategoryFormData {
  name: string
  description: string
  icon: string
  color: string
  sort_order: number
}

const emptyForm: CategoryFormData = {
  name: '',
  description: '',
  icon: '',
  color: '#6366F1',
  sort_order: 0,
}

const PRESET_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6B7280', // Gray
]

export function Categories() {
  const { currentHouse } = useHouse()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Category | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const loadCategories = async () => {
    if (!currentHouse) return
    setIsLoading(true)
    try {
      const response = await categoriesService.getAll(currentHouse.id)
      setCategories(response.categories)
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [currentHouse])

  const openCreateModal = () => {
    setEditingCategory(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      color: category.color || '#6366F1',
      sort_order: category.sort_order,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentHouse) return
    if (!formData.name.trim()) {
      alert('Il nome della categoria è obbligatorio')
      return
    }

    setIsSaving(true)
    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        icon: formData.icon.trim() || undefined,
        color: formData.color || undefined,
        sort_order: formData.sort_order,
      }

      if (editingCategory) {
        await categoriesService.update(editingCategory.id, data)
      } else {
        await categoriesService.create(currentHouse.id, data)
      }

      closeModal()
      loadCategories()
    } catch (error: unknown) {
      console.error('Failed to save category:', error)
      const apiError = error as { response?: { data?: { detail?: string } } }
      if (apiError.response?.data?.detail) {
        alert(apiError.response.data.detail)
      } else {
        alert('Errore durante il salvataggio')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportTemplates = async () => {
    if (!currentHouse) return
    setIsImporting(true)
    try {
      const result = await categoriesService.importTemplates(currentHouse.id)
      alert(result.message)
      loadCategories()
    } catch (error: unknown) {
      console.error('Failed to import templates:', error)
      const apiError = error as { response?: { data?: { detail?: string } } }
      if (apiError.response?.data?.detail) {
        alert(apiError.response.data.detail)
      } else {
        alert('Errore durante l\'importazione')
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleDelete = async (category: Category) => {
    try {
      await categoriesService.delete(category.id)
      setShowDeleteConfirm(null)
      loadCategories()
    } catch (error: unknown) {
      console.error('Failed to delete category:', error)
      const apiError = error as { response?: { data?: { detail?: string } } }
      if (apiError.response?.data?.detail) {
        alert(apiError.response.data.detail)
      } else {
        alert('Errore durante l\'eliminazione')
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/anagrafiche"
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Gestione Categorie</h1>
        <button
          onClick={openCreateModal}
          className="btn btn-primary text-sm px-3 py-2"
        >
          + Nuova
        </button>
      </div>

      {/* Categories List */}
      {!currentHouse ? (
        <p className="text-gray-500 text-sm">Seleziona una casa per gestire le categorie</p>
      ) : isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : categories.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Nessuna categoria configurata</p>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleImportTemplates}
              disabled={isImporting}
              className="btn btn-secondary text-sm mx-auto"
            >
              {isImporting ? 'Importazione...' : 'Importa categorie predefinite'}
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
        <div className="space-y-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {category.icon && (
                      <span className="text-xl">{category.icon}</span>
                    )}
                    <h3 className="font-semibold text-base">{category.name}</h3>
                    {category.color && (
                      <span
                        className="w-4 h-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: category.color }}
                      />
                    )}
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      #{category.sort_order}
                    </span>
                  </div>

                  {category.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="Modifica"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(category)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Elimina"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-white overflow-y-auto animate-slide-up">
          <form onSubmit={handleSubmit}>
            {/* Header - sticky */}
            <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold">
                {editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content - scrolls naturally */}
            <div className="px-4 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="label text-xs">Nome Categoria *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="es. Food, No Food, Chemicals..."
                  className="input w-full"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="label text-xs">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione opzionale..."
                  className="input w-full"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="label text-xs">Icona (emoji)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="es. 🍎, 🧹, 🐕..."
                  className="input w-full"
                  maxLength={10}
                />
              </div>

              {/* Color */}
              <div>
                <label className="label text-xs">Colore</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        formData.color === color ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="mt-2 w-full h-8 cursor-pointer"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="label text-xs">Ordine di visualizzazione</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="input w-full"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Numeri più bassi vengono mostrati prima
                </p>
              </div>
            </div>

            {/* Buttons - sticky at bottom */}
            <div className="sticky bottom-0 bg-white px-4 py-3 border-t flex gap-2 safe-area-bottom">
              <button
                type="button"
                onClick={closeModal}
                className="btn btn-secondary flex-1 text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary flex-1 text-sm"
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Elimina Categoria</h3>
                <p className="text-sm text-gray-500">
                  {showDeleteConfirm.icon} {showDeleteConfirm.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Sei sicuro di voler eliminare questa categoria? L'operazione non può essere annullata.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn-secondary flex-1 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1 text-sm"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Categories
