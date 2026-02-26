import { useEffect, useState } from 'react'
import { useHouse } from '@/context/HouseContext'
import shoppingListsService from '@/services/shoppingLists'
import type { ShoppingListItem, ShoppingListSummary } from '@/types'

interface MoveToListModalProps {
  item: ShoppingListItem
  currentListId: string
  onComplete: (targetListName: string) => void
  onCancel: () => void
}

export function MoveToListModal({ item, currentListId, onComplete, onCancel }: MoveToListModalProps) {
  const { currentHouse } = useHouse()
  const [lists, setLists] = useState<ShoppingListSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMoving, setIsMoving] = useState(false)

  useEffect(() => {
    const fetchLists = async () => {
      if (!currentHouse) return
      try {
        const res = await shoppingListsService.getAll(currentHouse.id, { status: 'active' })
        setLists((res.lists || []).filter((l) => l.id !== currentListId))
      } catch (error) {
        console.error('Failed to fetch lists:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLists()
  }, [currentHouse, currentListId])

  const handleMove = async (targetList: ShoppingListSummary) => {
    setIsMoving(true)
    try {
      await shoppingListsService.addItem(targetList.id, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        grocy_product_id: item.grocy_product_id,
        grocy_product_name: item.grocy_product_name,
        category_id: item.category_id,
        urgent: item.urgent,
      })
      await shoppingListsService.deleteItem(currentListId, item.id)
      onComplete(targetList.name)
    } catch (error) {
      console.error('Failed to move item:', error)
      setIsMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-t-xl shadow-xl w-full max-w-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Invia a...</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Sposta <strong>{item.name}</strong> in un'altra lista
          </p>
        </div>

        {/* List */}
        <div className="p-2 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Caricamento liste...</div>
          ) : lists.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">Nessun'altra lista attiva</div>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                onClick={() => handleMove(list)}
                disabled={isMoving}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <span className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium truncate">{list.name}</p>
                  <p className="text-xs text-gray-500">
                    {list.item_count} {list.item_count === 1 ? 'articolo' : 'articoli'}
                    {list.store_name && ` · ${list.store_name}`}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Close */}
        <div className="p-4 border-t">
          <button
            onClick={onCancel}
            disabled={isMoving}
            className="w-full py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

export default MoveToListModal
