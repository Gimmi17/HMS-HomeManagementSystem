import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import shoppingListsService from '@/services/shoppingLists'
import { grocyHouseService } from '@/services/grocy'
import dispensaService from '@/services/dispensa'
import type { PreviewItem, PreviewEnvironment } from '@/services/dispensa'
import SwipeableRow from '@/components/SwipeableRow'
import { getItemState, STATE_COLORS } from '@/components/VerificationModal'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import type { ShoppingListItem, GrocyBulkAddItem, GrocyBulkAddStockResponse } from '@/types'
import type { ShoppingListState } from './useShoppingListState'

interface VerifyModeProps {
  state: ShoppingListState
}

type EnvironmentFlowStep = 'idle' | 'loading' | 'assign' | 'sending'

export default function VerifyMode({ state }: VerifyModeProps) {
  const { list, setList, showToast, refreshList } = state
  const navigate = useNavigate()
  const { currentHouse } = useHouse()

  const [deleteConfirm, setDeleteConfirm] = useState<ShoppingListItem | null>(null)
  const [showGrocySyncModal, setShowGrocySyncModal] = useState(false)
  const [grocySyncResult, setGrocySyncResult] = useState<GrocyBulkAddStockResponse | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [collapsedVerified, setCollapsedVerified] = useState(false)

  // Environment assignment flow state
  const [envFlowStep, setEnvFlowStep] = useState<EnvironmentFlowStep>('idle')
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [previewEnvironments, setPreviewEnvironments] = useState<PreviewEnvironment[]>([])
  const [itemEnvironments, setItemEnvironments] = useState<Record<string, string>>({})
  const [isSendingToDispensa, setIsSendingToDispensa] = useState(false)

  if (!list) return null

  // Auto-start verification if not started
  if (list.verification_status === 'not_started' || list.verification_status === 'paused') {
    shoppingListsService.update(list.id, { verification_status: 'in_progress' }).then(updated => setList(updated)).catch(console.error)
  }

  const pendingItems = list.items.filter((i) => !i.verified_at && !i.not_purchased)
  const verifiedItems = list.items.filter((i) => i.verified_at || i.not_purchased)
  const verifiedCount = list.items.filter((i) => i.verified_at).length
  const notPurchasedCount = list.items.filter((i) => i.not_purchased).length
  const totalCount = list.items.length

  const handleSwipeRight = (item: ShoppingListItem) => {
    const itemState = getItemState(item)
    if (itemState === 'pending') {
      state.setEditingItem(item)
    } else if (itemState === 'not_purchased') {
      handleUndoNotPurchased(item)
    }
  }

  const handleUndoNotPurchased = async (item: ShoppingListItem) => {
    if (!list) return
    try {
      await shoppingListsService.undoNotPurchased(list.id, item.id)
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)
      showToast(true, 'Articolo ripristinato')
    } catch (error) {
      console.error('Failed to undo not purchased:', error)
      showToast(false, 'Errore durante il ripristino')
    }
  }

  const handleDeleteItem = async (item: ShoppingListItem) => {
    if (!list) return
    try {
      await shoppingListsService.deleteItem(list.id, item.id)
      await refreshList()
      showToast(true, 'Articolo eliminato')
    } catch (error) {
      console.error('Failed to delete item:', error)
      showToast(false, 'Errore durante l\'eliminazione')
    }
    setDeleteConfirm(null)
  }

  const handlePause = async () => {
    if (!list) return
    try {
      await shoppingListsService.update(list.id, { verification_status: 'paused' })
      navigate('/shopping-lists')
    } catch (error) {
      console.error('Failed to pause:', error)
    }
  }

  // --- NEW COMPLETION FLOW ---

  const handleCompleteVerification = async () => {
    if (!list) return
    const pendingCount = list.items.filter(i => !i.verified_at).length
    const message = pendingCount > 0
      ? `Ci sono ancora ${pendingCount} articoli non verificati. Completare comunque?`
      : 'Confermi di voler completare il controllo carico?'
    if (!confirm(message)) return

    try {
      await shoppingListsService.update(list.id, { verification_status: 'completed', status: 'completed' })
      proceedAfterCompletion()
    } catch (error) {
      console.error('Failed to complete verification:', error)
      showToast(false, 'Errore durante il completamento')
    }
  }

  const proceedAfterCompletion = () => {
    if (!list) return
    const itemsToSync = list.items.filter(item => item.grocy_product_id && item.verified_at && !item.not_purchased)
    if (itemsToSync.length > 0 && currentHouse) {
      setShowGrocySyncModal(true)
    } else {
      startEnvironmentFlow()
    }
  }

  // --- GROCY SYNC ---

  const getItemsToSync = (): GrocyBulkAddItem[] => {
    if (!list) return []
    return list.items
      .filter(item => item.grocy_product_id && item.verified_at && !item.not_purchased)
      .map(item => ({ product_id: item.grocy_product_id!, amount: item.verified_quantity ?? item.quantity }))
  }

  const handleGrocySync = async () => {
    if (!currentHouse || !list) return
    const itemsToSync = getItemsToSync()
    if (itemsToSync.length === 0) { setShowGrocySyncModal(false); startEnvironmentFlow(); return }

    setIsSyncing(true)
    try {
      const result = await grocyHouseService.bulkAddStock(currentHouse.id, itemsToSync)
      setGrocySyncResult(result)
    } catch (error) {
      console.error('Failed to sync with Grocy:', error)
      showToast(false, 'Errore durante la sincronizzazione con Grocy')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSkipGrocySync = () => {
    setShowGrocySyncModal(false)
    startEnvironmentFlow()
  }

  const handleGrocySyncComplete = () => {
    setShowGrocySyncModal(false)
    setGrocySyncResult(null)
    showToast(true, 'Sincronizzazione Grocy completata!')
    startEnvironmentFlow()
  }

  // --- ENVIRONMENT ASSIGNMENT FLOW ---

  const startEnvironmentFlow = async () => {
    if (!list) return
    const houseId = currentHouse?.id || localStorage.getItem('current_house_id') || ''
    if (!houseId) { navigate('/shopping-lists'); return }

    setEnvFlowStep('loading')
    try {
      const preview = await dispensaService.previewFromShoppingList(houseId, list.id)
      setPreviewItems(preview.items)
      setPreviewEnvironments(preview.environments)

      // Build initial environment map from resolved items
      const envMap: Record<string, string> = {}
      for (const item of preview.items) {
        if (item.environment_id) {
          envMap[item.item_id] = item.environment_id
        }
      }
      setItemEnvironments(envMap)
      setEnvFlowStep('assign')
    } catch (error) {
      console.error('Failed to preview:', error)
      showToast(false, 'Errore nel caricamento anteprima')
      setEnvFlowStep('idle')
    }
  }

  const handleEnvironmentChange = (itemId: string, envId: string) => {
    setItemEnvironments(prev => ({ ...prev, [itemId]: envId }))
  }

  const handleConfirmDispensa = async () => {
    if (!list) return
    const houseId = currentHouse?.id || localStorage.getItem('current_house_id') || ''
    if (!houseId) { navigate('/shopping-lists'); return }

    setIsSendingToDispensa(true)
    setEnvFlowStep('sending')
    try {
      const result = await dispensaService.sendFromShoppingList(houseId, list.id, itemEnvironments)
      showToast(true, `${result.count} articoli inviati alla Dispensa!`)
      setTimeout(() => navigate('/shopping-lists'), 1500)
    } catch (error) {
      console.error('Failed to send to dispensa:', error)
      showToast(false, 'Errore nell\'invio alla Dispensa')
      setTimeout(() => navigate('/shopping-lists'), 1500)
    } finally {
      setIsSendingToDispensa(false)
    }
  }

  const handleSkipDispensa = () => {
    setEnvFlowStep('idle')
    navigate('/shopping-lists')
  }

  const handleEditItem = (item: ShoppingListItem) => {
    state.setActionMenuItem(item)
  }

  // --- ENVIRONMENT UI HELPERS ---

  const unassignedItems = previewItems.filter(i => !itemEnvironments[i.item_id])
  const assignedItems = previewItems.filter(i => !!itemEnvironments[i.item_id])
  const allAssigned = unassignedItems.length === 0
  const isSingleEnv = previewEnvironments.length === 1
  const envById = Object.fromEntries(previewEnvironments.map(e => [e.id, e]))

  // Group assigned items by environment
  const groupedByEnv: Record<string, PreviewItem[]> = {}
  for (const item of assignedItems) {
    const envId = itemEnvironments[item.item_id]
    if (!groupedByEnv[envId]) groupedByEnv[envId] = []
    groupedByEnv[envId].push(item)
  }

  return (
    <>
      {/* Header actions */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={handlePause} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Pausa</button>
        <button onClick={handleCompleteVerification} className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600">Completa</button>
      </div>

      {/* Progress */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Progresso</span>
          <span className="text-sm font-medium">
            {verifiedCount}/{totalCount}
            {notPurchasedCount > 0 && <span className="text-red-500 ml-1">({notPurchasedCount} non acquistati)</span>}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Da verificare */}
      {pendingItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-700">Da verificare</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">{pendingItems.length}</span>
          </div>
          <div className="space-y-2">
            {pendingItems.map((item) => {
              const itemState = getItemState(item)
              const colors = STATE_COLORS[itemState]
              return (
                <SwipeableRow
                  key={item.id}
                  onSwipeLeft={() => setDeleteConfirm(item)}
                  onSwipeRight={() => handleSwipeRight(item)}
                >
                  <div
                    onClick={() => handleEditItem(item)}
                    className={`card p-3 border-2 transition-colors cursor-pointer ${colors.bg} ${colors.border}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${colors.icon}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{item.grocy_product_name || item.name}</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {item.quantity} {item.unit}
                          {item.catalog_barcode && <span className="ml-2 text-gray-400">EAN: {item.catalog_barcode}</span>}
                        </div>
                        {item.product_notes && <p className="text-xs text-blue-600 italic truncate">{item.product_notes}</p>}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              )
            })}
          </div>
        </div>
      )}

      {/* Verificati */}
      {verifiedItems.length > 0 && (
        <div>
          <button onClick={() => setCollapsedVerified(!collapsedVerified)} className="flex items-center gap-2 mb-2 w-full">
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsedVerified ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Verificati</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{verifiedItems.length}</span>
          </button>
          {!collapsedVerified && (
            <div className="space-y-2">
              {verifiedItems.map((item) => {
                const itemState = getItemState(item)
                const colors = STATE_COLORS[itemState]
                return (
                  <SwipeableRow
                    key={item.id}
                    onSwipeLeft={() => setDeleteConfirm(item)}
                    onSwipeRight={itemState === 'not_purchased' ? () => handleUndoNotPurchased(item) : undefined}
                  >
                    <div
                      onClick={() => handleEditItem(item)}
                      className={`card p-3 border-2 transition-colors cursor-pointer ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${colors.icon}`}>
                          {itemState === 'not_purchased' ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{item.grocy_product_name || item.name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {item.verified_quantity ?? item.quantity} {item.verified_unit || item.unit}
                            {item.scanned_barcode && <span className="ml-2 text-gray-400">EAN: {item.scanned_barcode}</span>}
                          </div>
                          {item.expiry_date && (
                            <div className="text-xs text-orange-600 mt-0.5">
                              Scad: {item.expiry_date.split('-').reverse().join('/')}
                            </div>
                          )}
                          {item.product_notes && <p className="text-xs text-blue-600 italic truncate">{item.product_notes}</p>}
                        </div>
                      </div>
                    </div>
                  </SwipeableRow>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          itemName={deleteConfirm.grocy_product_name || deleteConfirm.name}
          onConfirm={() => handleDeleteItem(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Grocy Sync Modal */}
      {showGrocySyncModal && list && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Sincronizza con Grocy</h3>
              <p className="text-sm text-gray-500 mt-1">Aggiungere i prodotti verificati alla dispensa?</p>
            </div>
            <div className="p-4">
              {!grocySyncResult ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-60 overflow-y-auto">
                    <p className="text-sm font-medium text-gray-700 mb-2">{getItemsToSync().length} prodotti da aggiungere:</p>
                    <ul className="space-y-1">
                      {list.items.filter(item => item.grocy_product_id && item.verified_at && !item.not_purchased).map(item => (
                        <li key={item.id} className="text-sm text-gray-600 flex justify-between">
                          <span>{item.grocy_product_name || item.name}</span>
                          <span className="text-gray-400">{item.verified_quantity ?? item.quantity} {item.verified_unit || item.unit || 'pz'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleSkipGrocySync} disabled={isSyncing} className="flex-1 py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100 disabled:opacity-50">Salta</button>
                    <button onClick={handleGrocySync} disabled={isSyncing} className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isSyncing ? (
                        <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Sincronizzazione...</>
                      ) : (
                        <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Sincronizza</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${grocySyncResult.failed === 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                        {grocySyncResult.failed === 0 ? (
                          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{grocySyncResult.failed === 0 ? 'Sincronizzazione completata!' : 'Sincronizzazione parziale'}</p>
                        <p className="text-sm text-gray-500">{grocySyncResult.successful}/{grocySyncResult.total} prodotti aggiunti</p>
                      </div>
                    </div>
                    {grocySyncResult.failed > 0 && (
                      <div className="bg-red-50 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-red-700 mb-2">Errori:</p>
                        <ul className="space-y-1">
                          {grocySyncResult.results.filter(r => !r.success).map(r => (
                            <li key={r.product_id} className="text-sm text-red-600">Prodotto #{r.product_id}: {r.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button onClick={handleGrocySyncComplete} className="w-full py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">Continua</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Environment Assignment Flow */}
      {envFlowStep !== 'idle' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">

            {/* Loading state */}
            {envFlowStep === 'loading' && (
              <div className="p-8 flex flex-col items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-primary-600 mb-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-gray-500">Preparazione invio alla Dispensa...</p>
              </div>
            )}

            {/* Case A: Single environment */}
            {envFlowStep === 'assign' && isSingleEnv && previewEnvironments.length > 0 && (
              <>
                <div className="p-6 text-center">
                  <div className="text-4xl mb-3">{previewEnvironments[0].icon || '📦'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">Invio alla Dispensa</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {previewItems.length === 1 ? '1 articolo' : `${previewItems.length} articoli`} {previewItems.length === 1 ? 'sara inviato' : 'saranno inviati'} a <strong>{previewEnvironments[0].name}</strong>
                  </p>
                </div>
                <div className="p-4 border-t space-y-2">
                  <button
                    onClick={handleConfirmDispensa}
                    disabled={isSendingToDispensa}
                    className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    Conferma
                  </button>
                  <button onClick={handleSkipDispensa} className="w-full py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100">
                    No, grazie
                  </button>
                </div>
              </>
            )}

            {/* Case A-bis: No environments configured */}
            {envFlowStep === 'assign' && previewEnvironments.length === 0 && (
              <>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Controllo carico completato!</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Vuoi mandare {previewItems.length === 1 ? "l'articolo verificato" : `i ${previewItems.length} articoli verificati`} alla Dispensa?
                  </p>
                </div>
                <div className="p-4 border-t space-y-2">
                  <button
                    onClick={handleConfirmDispensa}
                    disabled={isSendingToDispensa}
                    className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    Si, manda a Dispensa
                  </button>
                  <button onClick={handleSkipDispensa} className="w-full py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100">
                    No, grazie
                  </button>
                </div>
              </>
            )}

            {/* Case B: Multiple environments, all resolved */}
            {envFlowStep === 'assign' && !isSingleEnv && previewEnvironments.length > 0 && allAssigned && (
              <>
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-lg">Invio alla Dispensa</h3>
                  <p className="text-sm text-gray-500 mt-1">Tutti gli articoli hanno una zona assegnata</p>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                  {Object.entries(groupedByEnv).map(([envId, items]) => {
                    const env = envById[envId]
                    if (!env) return null
                    return (
                      <div key={envId} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{env.icon || '📦'}</span>
                          <span className="font-medium text-sm">{env.name}</span>
                          <span className="text-xs text-gray-400 ml-auto">{items.length} {items.length === 1 ? 'articolo' : 'articoli'}</span>
                        </div>
                        <ul className="space-y-1">
                          {items.map(item => (
                            <li key={item.item_id} className="text-sm text-gray-600 flex justify-between">
                              <span className="truncate">{item.name}</span>
                              <span className="text-gray-400 flex-shrink-0 ml-2">{item.quantity} {item.unit || 'pz'}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
                <div className="p-4 border-t space-y-2">
                  <button
                    onClick={handleConfirmDispensa}
                    disabled={isSendingToDispensa}
                    className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    Conferma
                  </button>
                  <button onClick={handleSkipDispensa} className="w-full py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100">
                    No, grazie
                  </button>
                </div>
              </>
            )}

            {/* Case C: Multiple environments, some unassigned */}
            {envFlowStep === 'assign' && !isSingleEnv && previewEnvironments.length > 0 && !allAssigned && (
              <>
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-lg">Assegna zona</h3>
                  <p className="text-sm text-gray-500 mt-1">Scegli dove riporre ogni articolo</p>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                  {/* Unassigned items - need user choice */}
                  <div>
                    <p className="text-sm font-medium text-orange-700 mb-2">
                      Da assegnare ({unassignedItems.length})
                    </p>
                    <div className="space-y-2">
                      {unassignedItems.map(item => (
                        <div key={item.item_id} className="bg-orange-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{item.quantity} {item.unit || 'pz'}</span>
                          </div>
                          <select
                            value={itemEnvironments[item.item_id] || ''}
                            onChange={e => handleEnvironmentChange(item.item_id, e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">-- Scegli zona --</option>
                            {previewEnvironments.map(env => (
                              <option key={env.id} value={env.id}>
                                {env.icon ? `${env.icon} ` : ''}{env.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Already assigned items - collapsed summary */}
                  {assignedItems.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-green-700">
                        {assignedItems.length} {assignedItems.length === 1 ? 'articolo gia assegnato' : 'articoli gia assegnati'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(groupedByEnv).map(([envId, items]) => {
                          const env = envById[envId]
                          if (!env) return null
                          return (
                            <span key={envId} className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              {env.icon || '📦'} {env.name} ({items.length})
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t space-y-2">
                  <button
                    onClick={handleConfirmDispensa}
                    disabled={!allAssigned || isSendingToDispensa}
                    className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isSendingToDispensa ? 'Invio in corso...' : 'Conferma'}
                  </button>
                  <button onClick={handleSkipDispensa} className="w-full py-3 rounded-lg text-gray-600 font-medium hover:bg-gray-100">
                    No, grazie
                  </button>
                </div>
              </>
            )}

            {/* Sending state */}
            {envFlowStep === 'sending' && (
              <div className="p-8 flex flex-col items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-primary-600 mb-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-gray-500">Invio articoli alla Dispensa...</p>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
