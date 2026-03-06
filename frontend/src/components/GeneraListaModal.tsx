import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import dispensaService from '@/services/dispensa'
import shoppingListsService from '@/services/shoppingLists'

interface Suggestion {
  name: string
  quantity: number
  unit: string | null
  category_id: string | null
  grocy_product_id: number | null
  grocy_product_name: string | null
  reason: 'low_stock' | 'out_of_stock'
  area_id: string | null
  area_name: string | null
}

interface Props {
  onClose: () => void
}

export function GeneraListaModal({ onClose }: Props) {
  const { currentHouse } = useHouse()
  const navigate = useNavigate()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!currentHouse) return
      setIsLoading(true)
      try {
        const data = await dispensaService.getSuggestions(currentHouse.id)
        setSuggestions(data.suggestions)
        setSelected(new Set(data.suggestions.map((_, i) => i)))
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 404 || status === 500) {
          setUnavailable(true)
        } else {
          setError('Errore nel caricamento dei suggerimenti')
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentHouse])

  const toggleItem = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleCreate = async () => {
    if (!currentHouse || selected.size === 0) return
    setIsCreating(true)
    try {
      const today = new Date()
      const dd = String(today.getDate()).padStart(2, '0')
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const yyyy = today.getFullYear()
      const listName = `Lista del ${dd}/${mm}/${yyyy}`

      const list = await shoppingListsService.create({ house_id: currentHouse.id, name: listName })
      const listId = list.id

      const selectedItems = suggestions.filter((_, i) => selected.has(i))
      await Promise.all(
        selectedItems.map(item =>
          shoppingListsService.addItem(listId, {
            name: item.name,
            quantity: 1,
            unit: item.unit,
            category_id: item.category_id,
            grocy_product_id: item.grocy_product_id,
            grocy_product_name: item.grocy_product_name,
          })
        )
      )

      navigate('/shopping-lists/' + listId)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === 500) {
        setUnavailable(true)
      } else {
        setError('Errore nella creazione della lista')
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Genera Lista Spesa</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <p className="text-gray-500 text-sm text-center py-8">Caricamento suggerimenti...</p>
          ) : unavailable ? (
            <p className="text-gray-500 text-sm text-center py-8">Funzione non ancora disponibile</p>
          ) : error ? (
            <p className="text-red-500 text-sm text-center py-8">{error}</p>
          ) : suggestions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Dispensa in ordine! 🎉</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((item, i) => (
                <label
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleItem(i)}
                    className="w-4 h-4 accent-primary-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{item.name}</span>
                      {item.reason === 'out_of_stock' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                          Esaurito
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                          Scorta bassa
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.quantity > 0 && (
                        <span>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                      )}
                      {item.area_name && (
                        <span className="ml-2 text-gray-400">· {item.area_name}</span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && !unavailable && !error && suggestions.length > 0 && (
          <div className="p-4 border-t flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">
              {selected.size} di {suggestions.length} selezionati
            </span>
            <button
              onClick={handleCreate}
              disabled={isCreating || selected.size === 0}
              className="btn btn-primary px-5 py-2 text-sm disabled:opacity-50"
            >
              {isCreating ? 'Creando...' : 'Crea Lista'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default GeneraListaModal
