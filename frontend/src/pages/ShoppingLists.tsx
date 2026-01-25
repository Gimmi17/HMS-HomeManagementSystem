import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import shoppingListsService from '@/services/shoppingLists'
import type { ShoppingListSummary, ShoppingListStatus } from '@/types'

type ListAction = 'view' | 'edit' | 'verify'

const STATUS_LABELS: Record<ShoppingListStatus, string> = {
  active: 'Attiva',
  completed: 'Conclusa',
  cancelled: 'Annullata',
}

const STATUS_COLORS: Record<ShoppingListStatus, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

export function ShoppingLists() {
  const { currentHouse } = useHouse()
  const navigate = useNavigate()
  const [lists, setLists] = useState<ShoppingListSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ShoppingListStatus | 'all'>('active')
  const [selectedList, setSelectedList] = useState<ShoppingListSummary | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)

  const handleListClick = (list: ShoppingListSummary) => {
    setSelectedList(list)
    setShowActionModal(true)
  }

  const handleAction = (action: ListAction) => {
    if (!selectedList) return
    setShowActionModal(false)
    if (action === 'verify') {
      navigate(`/shopping-lists/${selectedList.id}/verify`)
    } else if (action === 'edit') {
      navigate(`/shopping-lists/${selectedList.id}/edit`)
    } else {
      navigate(`/shopping-lists/${selectedList.id}`)
    }
  }

  const closeModal = () => {
    setShowActionModal(false)
    setSelectedList(null)
  }

  useEffect(() => {
    const fetchLists = async () => {
      if (!currentHouse) return

      setIsLoading(true)
      try {
        const response = await shoppingListsService.getAll(
          currentHouse.id,
          statusFilter !== 'all' ? { status: statusFilter } : undefined
        )
        setLists(response.lists)
      } catch (error) {
        console.error('Failed to fetch shopping lists:', error)
        setLists([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLists()
  }, [currentHouse, statusFilter])

  if (!currentHouse) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Seleziona una casa per vedere le liste</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lista della Spesa</h1>
        <Link to="/shopping-lists/new" className="btn btn-primary text-sm px-3 py-2">
          + Nuova
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tutte
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
            statusFilter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Attive
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
            statusFilter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Completate
        </button>
        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
            statusFilter === 'cancelled'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Annullate
        </button>
      </div>

      {/* Lists */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Caricamento...</p>
      ) : lists.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">
            {statusFilter !== 'all' ? 'Nessuna lista trovata' : 'Nessuna lista creata'}
          </p>
          {statusFilter === 'all' && (
            <Link to="/shopping-lists/new" className="btn btn-primary mt-4 inline-block text-sm">
              Crea la prima lista
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => handleListClick(list)}
              className="card p-4 block hover:shadow-md transition-shadow w-full text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base truncate">{list.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[list.status]}`}>
                      {STATUS_LABELS[list.status]}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>
                      {list.checked_count}/{list.item_count} articoli
                    </span>
                    <span>
                      {new Date(list.created_at).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                    {list.store_name && (
                      <span className="text-primary-600">
                        {list.store_name}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {list.item_count > 0 && (
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${(list.checked_count / list.item_count) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg truncate">{selectedList.name}</h3>
              <p className="text-sm text-gray-500 mt-1">Cosa vuoi fare?</p>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={() => handleAction('view')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Vedi Lista</div>
                  <div className="text-xs text-gray-500">Visualizza gli articoli</div>
                </div>
              </button>

              <button
                onClick={() => handleAction('edit')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Modifica Lista</div>
                  <div className="text-xs text-gray-500">Aggiungi o modifica articoli</div>
                </div>
              </button>

              <button
                onClick={() => handleAction('verify')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Controllo Carico</div>
                  <div className="text-xs text-gray-500">Verifica la merce con barcode</div>
                </div>
              </button>
            </div>

            <div className="p-4 border-t">
              <button
                onClick={closeModal}
                className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShoppingLists
