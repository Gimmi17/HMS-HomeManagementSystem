import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import shoppingListsService from '@/services/shoppingLists'
import dispensaService from '@/services/dispensa'
import type { ShoppingListSummary, ShoppingListStatus } from '@/types'

type ListAction = 'view' | 'edit' | 'receipt' | 'verify' | 'delete' | 'cancel' | 'reactivate'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSendingToDispensa, setIsSendingToDispensa] = useState(false)
  const [dispensaToast, setDispensaToast] = useState<string | null>(null)

  const handleListClick = (list: ShoppingListSummary) => {
    navigate(`/shopping-lists/${list.id}`)
  }

  const handleListActions = (e: React.MouseEvent, list: ShoppingListSummary) => {
    e.stopPropagation()
    setSelectedList(list)
    setShowActionModal(true)
  }

  const handleAction = (action: ListAction) => {
    if (!selectedList) return
    if (action === 'delete') {
      setShowDeleteConfirm(true)
      return
    }
    if (action === 'cancel') {
      setShowCancelConfirm(true)
      return
    }
    if (action === 'reactivate') {
      handleReactivate()
      return
    }
    setShowActionModal(false)
    if (action === 'verify') {
      navigate(`/shopping-lists/${selectedList.id}/verify`)
    } else if (action === 'edit') {
      navigate(`/shopping-lists/${selectedList.id}/edit`)
    } else if (action === 'receipt') {
      navigate(`/shopping-lists/${selectedList.id}/receipt`)
    } else {
      navigate(`/shopping-lists/${selectedList.id}`)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedList) return
    setIsDeleting(true)
    try {
      await shoppingListsService.delete(selectedList.id)
      setLists(lists.filter(l => l.id !== selectedList.id))
      setShowDeleteConfirm(false)
      setShowActionModal(false)
      setSelectedList(null)
    } catch (error) {
      console.error('Failed to delete shopping list:', error)
      alert('Errore durante l\'eliminazione della lista')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!selectedList) return
    setIsUpdating(true)
    try {
      await shoppingListsService.update(selectedList.id, { status: 'cancelled' })
      setLists(lists.map(l => l.id === selectedList.id ? { ...l, status: 'cancelled' as ShoppingListStatus } : l))
      setShowCancelConfirm(false)
      setShowActionModal(false)
      setSelectedList(null)
    } catch (error) {
      console.error('Failed to cancel shopping list:', error)
      alert('Errore durante l\'annullamento della lista')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReactivate = async () => {
    if (!selectedList) return
    setIsUpdating(true)
    try {
      await shoppingListsService.update(selectedList.id, { status: 'active' })
      setLists(lists.map(l => l.id === selectedList.id ? { ...l, status: 'active' as ShoppingListStatus } : l))
      setShowActionModal(false)
      setSelectedList(null)
    } catch (error) {
      console.error('Failed to reactivate shopping list:', error)
      alert('Errore durante la riattivazione della lista')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSendToDispensa = async () => {
    if (!selectedList || !currentHouse) return
    setIsSendingToDispensa(true)
    try {
      const result = await dispensaService.sendFromShoppingList(currentHouse.id, selectedList.id)
      setShowActionModal(false)
      setSelectedList(null)
      if (result.count > 0) {
        setDispensaToast(`${result.count} articoli inviati alla Dispensa!`)
      } else {
        setDispensaToast('Nessun articolo da inviare (nessun articolo spuntato o verificato)')
      }
      setTimeout(() => setDispensaToast(null), 4000)
    } catch (error) {
      console.error('Failed to send to dispensa:', error)
      setDispensaToast('Errore nell\'invio alla Dispensa')
      setTimeout(() => setDispensaToast(null), 3000)
    } finally {
      setIsSendingToDispensa(false)
    }
  }

  const closeModal = () => {
    setShowActionModal(false)
    setShowDeleteConfirm(false)
    setShowCancelConfirm(false)
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
      {/* Toast */}
      {dispensaToast && (
        <div className="fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-[70] bg-green-500 text-white text-sm font-medium text-center">
          {dispensaToast}
        </div>
      )}

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

                <button
                  onClick={(e) => handleListActions(e, list)}
                  className="p-2 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
                  title="Azioni"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
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
              {/* View - always shown */}
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

              {/* Edit & Verify - only for non-cancelled lists */}
              {selectedList.status !== 'cancelled' && (
                <>
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
                    onClick={() => handleAction('receipt')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Scontrini d'acquisto</div>
                      <div className="text-xs text-gray-500">Foto scontrini e riconciliazione OCR</div>
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

                  {/* Send to Dispensa - only for completed lists */}
                  {selectedList.status === 'completed' && (
                    <button
                      onClick={handleSendToDispensa}
                      disabled={isSendingToDispensa}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-purple-700">{isSendingToDispensa ? 'Invio in corso...' : 'Invia a Dispensa'}</div>
                        <div className="text-xs text-purple-500">Manda gli articoli verificati alla dispensa</div>
                      </div>
                    </button>
                  )}

                  {/* Cancel - only for non-cancelled lists */}
                  <button
                    onClick={() => handleAction('cancel')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-orange-700">Annulla Lista</div>
                      <div className="text-xs text-orange-500">Metti in pausa la lista</div>
                    </div>
                  </button>
                </>
              )}

              {/* Reactivate - only for cancelled lists */}
              {selectedList.status === 'cancelled' && (
                <>
                  <button
                    onClick={() => handleAction('reactivate')}
                    disabled={isUpdating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-green-700">{isUpdating ? 'Riattivando...' : 'Riattiva Lista'}</div>
                      <div className="text-xs text-green-500">Rimetti la lista in stato attivo</div>
                    </div>
                  </button>

                  {/* Delete - only for cancelled lists */}
                  <button
                    onClick={() => handleAction('delete')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-red-700">Elimina Lista</div>
                      <div className="text-xs text-red-500">Elimina permanentemente la lista</div>
                    </div>
                  </button>
                </>
              )}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">Elimina lista</h3>
                  <p className="text-sm text-gray-500">Questa azione non può essere annullata</p>
                </div>
              </div>
              <p className="text-gray-700 mb-1">
                Vuoi eliminare definitivamente la lista <span className="font-semibold">"{selectedList.name}"</span>?
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {selectedList.item_count} articoli verranno eliminati.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  Indietro
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Elimina'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && selectedList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">Annulla lista</h3>
                  <p className="text-sm text-gray-500">Potrai riattivare la lista in seguito</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                Vuoi annullare la lista <span className="font-semibold">"{selectedList.name}"</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  Indietro
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {isUpdating ? 'Annullando...' : 'Annulla Lista'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShoppingLists
