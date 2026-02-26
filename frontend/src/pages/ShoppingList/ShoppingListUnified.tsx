import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useShoppingListState, type UnifiedMode } from './useShoppingListState'
import ViewMode from './ViewMode'
import EditMode from './EditMode'
import VerifyMode from './VerifyMode'
import ItemDetailModal, { type ItemDetailModalData } from '@/components/ItemDetailModal'
import ItemActionMenu from '@/components/ItemActionMenu'
import ProductNoteModal from '@/components/ProductNoteModal'
import ContinuousBarcodeScanner from '@/components/ContinuousBarcodeScanner'
import shoppingListsService from '@/services/shoppingLists'

const STATUS_LABELS: Record<string, string> = {
  active: 'Attiva',
  completed: 'Conclusa',
  cancelled: 'Annullata',
}

const MODE_TABS: { key: UnifiedMode; label: string }[] = [
  { key: 'view', label: 'Spesa' },
  { key: 'verify', label: 'Controllo carico' },
]

export default function ShoppingListUnified() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = (searchParams.get('mode') || 'view') as UnifiedMode

  const state = useShoppingListState(id!, mode)

  const setMode = (newMode: UnifiedMode) => {
    if (newMode === 'view') {
      setSearchParams({})
    } else {
      setSearchParams({ mode: newMode })
    }
  }

  // Handle certify from ItemDetailModal (used in verify mode for pending items)
  const handleCertifySave = async (data: ItemDetailModalData) => {
    if (!state.list || !state.editingItem) return
    const item = state.editingItem
    state.setEditingItem(null)

    try {
      await shoppingListsService.verifyItemWithQuantity(
        state.list.id, item.id,
        data.barcode || '', data.quantity, data.unit,
        data.productName
      )

      const updateData: { expiry_date?: string; category_id?: string } = {}
      if (data.expiryDate) updateData.expiry_date = data.expiryDate
      if (data.categoryId) updateData.category_id = data.categoryId
      if (Object.keys(updateData).length > 0) {
        await shoppingListsService.updateItem(state.list.id, item.id, updateData)
      }

      const updatedList = await shoppingListsService.getById(state.list.id)
      state.setList(updatedList)
      state.showToast(true, data.productName ? `Verificato: ${data.productName}` : 'Articolo verificato')

      if (updatedList.items.every(i => i.verified_at)) {
        await shoppingListsService.update(state.list.id, { verification_status: 'completed' })
        state.showToast(true, 'Controllo carico completato!')
      }
    } catch (error) {
      console.error('Failed to verify item:', error)
      state.showToast(false, 'Errore durante la verifica. Riprova.')
    }
  }

  // Handle mark not purchased from ItemDetailModal (certify mode)
  const handleMarkNotPurchased = async () => {
    if (!state.list || !state.editingItem) return
    const item = state.editingItem
    state.setEditingItem(null)

    try {
      await shoppingListsService.markNotPurchased(state.list.id, item.id)
      const updatedList = await shoppingListsService.getById(state.list.id)
      state.setList(updatedList)
      state.showToast(true, 'Articolo segnato come non acquistato')

      if (updatedList.items.every(i => i.verified_at)) {
        await shoppingListsService.update(state.list.id, { verification_status: 'completed' })
        state.showToast(true, 'Controllo carico completato!')
      }
    } catch (error) {
      console.error('Failed to mark as not purchased:', error)
      state.showToast(false, 'Errore. Riprova.')
    }
  }

  // Handle save from ItemDetailModal (used in view mode)
  const handleModalSave = async (data: ItemDetailModalData) => {
    if (!state.list || !state.editingItem) return

    try {
      const updateData: Partial<import('@/types').ShoppingListItem> = {
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
      }

      if (data.expiryDate) updateData.expiry_date = data.expiryDate
      if (data.categoryId) updateData.category_id = data.categoryId
      if (data.barcode) updateData.scanned_barcode = data.barcode

      await shoppingListsService.updateItem(state.list.id, state.editingItem.id, updateData)

      if (!state.editingItem.checked) {
        await shoppingListsService.toggleItemCheck(state.list.id, state.editingItem.id)
      }

      await state.refreshList()
      state.setEditingItem(null)
      state.showToast(true, 'Articolo salvato e spuntato')
    } catch (error) {
      console.error('Failed to save item:', error)
      state.showToast(false, 'Errore nel salvataggio')
    }
  }

  // Handle save from ItemDetailModal (used in verify mode - edit verified item)
  const handleVerifyEditSave = async (data: ItemDetailModalData) => {
    if (!state.list || !state.editingItem) return

    try {
      const updateData: Partial<import('@/types').ShoppingListItem> = {
        name: data.name,
        verified_quantity: data.quantity,
        verified_unit: data.unit,
      }

      if (state.editingItem.grocy_product_name) {
        updateData.grocy_product_name = data.name
      }
      if (data.expiryDate) updateData.expiry_date = data.expiryDate
      if (data.categoryId) updateData.category_id = data.categoryId
      if (data.barcode) updateData.scanned_barcode = data.barcode

      await shoppingListsService.updateItem(state.list.id, state.editingItem.id, updateData)
      await state.refreshList()
      state.setEditingItem(null)
      state.showToast(true, 'Prodotto aggiornato')
    } catch (error) {
      console.error('Failed to update item:', error)
      state.showToast(false, 'Errore durante il salvataggio')
    }
  }

  // Handle note save
  const handleNoteSave = async (note: string) => {
    if (!state.list || !state.noteEditItem) return

    await state.refreshList()
    state.setNoteEditItem(null)
    state.showToast(true, note ? 'Nota salvata' : 'Nota rimossa')
  }

  if (state.isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Caricamento...</p>
      </div>
    )
  }

  if (!state.list) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Lista non trovata</p>
        <Link to="/shopping-lists" className="text-primary-600 text-sm mt-2 inline-block">
          Torna alle liste
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/shopping-lists"
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{state.list.name}</h1>
              {mode !== 'edit' && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{STATUS_LABELS[state.list.status] || state.list.status}</span>
              {state.list.store_name && (
                <>
                  <span>-</span>
                  <span className="text-primary-600">{state.list.store_name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selector - segmented control */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              mode === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {state.toast && (
        <div
          className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-40 ${
            state.toast.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {state.toast.message}
        </div>
      )}

      {/* Mode content */}
      {mode === 'view' && <ViewMode state={state} onEdit={() => setMode('edit')} />}
      {mode === 'edit' && <EditMode state={state} onDone={() => setMode('view')} />}
      {mode === 'verify' && <VerifyMode state={state} />}

      {/* Scanner FAB (view + verify) */}
      {mode !== 'edit' && state.list.status === 'active' && (
        <button
          onClick={() => {
            state.setScanLog([])
            state.scanLogRef.current = []
            state.setShowScanner(true)
          }}
          className="fixed bottom-20 right-4 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-primary-700 active:scale-95 transition-transform"
          title="Scansione continua"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013.75 5.625v-.75zM3.75 9.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM9.75 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 019.75 5.625v-.75zM9.75 9.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM15.75 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM15.75 9.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM3.75 13.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM9.75 13.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM15.75 13.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.75zM3.75 18.375c0-.621.504-1.125 1.125-1.125h15.75c.621 0 1.125.504 1.125 1.125v.75c0 .621-.504 1.125-1.125 1.125H4.875a1.125 1.125 0 01-1.125-1.125v-.75z" />
          </svg>
        </button>
      )}

      {/* Scanner Overlay */}
      {state.showScanner && (
        <ContinuousBarcodeScanner
          onBarcodeDetected={state.handleBarcodeDetected}
          onClose={state.handleScannerClose}
          scanLog={state.scanLog}
        />
      )}

      {/* Processing overlay after scanner close */}
      {state.isScanProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl px-8 py-6 flex flex-col items-center gap-3">
            <svg className="w-10 h-10 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Salvataggio articoli extra...</p>
          </div>
        </div>
      )}

      {/* Shared Modals */}
      {state.actionMenuItem && (
        <ItemActionMenu
          item={state.actionMenuItem}
          onEdit={() => {
            state.setEditingItem(state.actionMenuItem)
            state.setActionMenuItem(null)
          }}
          onEditNote={() => {
            state.setNoteEditItem(state.actionMenuItem)
            state.setActionMenuItem(null)
          }}
          onClose={() => state.setActionMenuItem(null)}
        />
      )}

      {state.editingItem && (() => {
        const isCertifying = mode === 'verify' && !state.editingItem.verified_at && !state.editingItem.not_purchased
        return (
          <ItemDetailModal
            item={state.editingItem}
            categories={state.categories}
            mode={isCertifying ? 'certify' : mode === 'verify' ? 'verify' : 'view'}
            onSave={isCertifying ? handleCertifySave : mode === 'verify' ? handleVerifyEditSave : handleModalSave}
            onCancel={() => state.setEditingItem(null)}
            onMarkNotPurchased={isCertifying ? handleMarkNotPurchased : undefined}
          />
        )
      })()}

      {state.noteEditItem && (
        <ProductNoteModal
          item={state.noteEditItem}
          onSave={handleNoteSave}
          onCancel={() => state.setNoteEditItem(null)}
        />
      )}
    </div>
  )
}
