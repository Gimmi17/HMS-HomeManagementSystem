import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import shoppingListsService from '@/services/shoppingLists'
import productsService from '@/services/products'
import BarcodeScanner from '@/components/BarcodeScanner'
import type { ShoppingList, ShoppingListItem, ShoppingListStatus } from '@/types'

const STATUS_LABELS: Record<ShoppingListStatus, string> = {
  active: 'Attiva',
  completed: 'Conclusa',
  cancelled: 'Annullata',
}

export function ShoppingListDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') // 'view', 'edit', or 'verify'

  const [list, setList] = useState<ShoppingList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scanningItemId, setScanningItemId] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [modeHandled, setModeHandled] = useState(false)


  // Derived state: are we in verification mode?
  const isVerificationMode = list?.verification_status === 'in_progress'

  // Initial load
  useEffect(() => {
    const fetchList = async () => {
      if (!id) return

      setIsLoading(true)
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
      } catch (error) {
        console.error('Failed to fetch list:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchList()
  }, [id])

  // Handle mode parameter from URL
  useEffect(() => {
    if (!list || modeHandled || isLoading) return

    const handleMode = async () => {
      if (mode === 'edit') {
        // Navigate to edit page
        navigate(`/shopping-lists/${list.id}/edit`, { replace: true })
        return
      }

      if (mode === 'verify') {
        // Auto-start verification if not started yet
        if (list.verification_status === 'not_started') {
          try {
            const updated = await shoppingListsService.update(list.id, { verification_status: 'in_progress' })
            setList(updated)
          } catch (error) {
            console.error('Failed to start verification:', error)
          }
        } else if (list.verification_status === 'paused') {
          // Resume if paused
          try {
            const updated = await shoppingListsService.update(list.id, { verification_status: 'in_progress' })
            setList(updated)
          } catch (error) {
            console.error('Failed to resume verification:', error)
          }
        }
      }

      setModeHandled(true)
    }

    handleMode()
  }, [list, mode, modeHandled, isLoading, navigate])

  // Live polling - refresh every 3 seconds to sync across devices
  useEffect(() => {
    if (!id || isLoading || showScanner) return

    const pollInterval = setInterval(async () => {
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [id, isLoading, showScanner])

  const toggleItemCheck = async (item: ShoppingListItem) => {
    if (!list) return

    try {
      const updatedItem = await shoppingListsService.toggleItemCheck(list.id, item.id)
      setList((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) => (i.id === item.id ? updatedItem : i)),
            }
          : null
      )
    } catch (error) {
      console.error('Failed to toggle item:', error)
    }
  }

  const handleStatusChange = async (newStatus: ShoppingListStatus) => {
    if (!list) return

    try {
      const updated = await shoppingListsService.update(list.id, { status: newStatus })
      setList(updated)
      setShowActionsMenu(false)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleDelete = async () => {
    if (!list) return

    if (!confirm('Sei sicuro di voler eliminare questa lista?')) return

    try {
      await shoppingListsService.delete(list.id)
      navigate('/shopping-lists')
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  const startVerification = async () => {
    if (!list) return
    try {
      const updated = await shoppingListsService.update(list.id, { verification_status: 'in_progress' })
      setList(updated)
      setShowActionsMenu(false)
    } catch (error) {
      console.error('Failed to start verification:', error)
    }
  }

  const pauseVerification = async () => {
    if (!list) return
    try {
      const updated = await shoppingListsService.update(list.id, { verification_status: 'paused' })
      setList(updated)
    } catch (error) {
      console.error('Failed to pause verification:', error)
    }
  }

  const resumeVerification = async () => {
    if (!list) return
    try {
      const updated = await shoppingListsService.update(list.id, { verification_status: 'in_progress' })
      setList(updated)
      setShowActionsMenu(false)
    } catch (error) {
      console.error('Failed to resume verification:', error)
    }
  }

  const completeVerification = async () => {
    if (!list) return
    try {
      const updated = await shoppingListsService.update(list.id, { verification_status: 'completed' })
      setList(updated)
    } catch (error) {
      console.error('Failed to complete verification:', error)
    }
  }

  const openScannerForItem = (itemId: string) => {
    setScanningItemId(itemId)
    setShowScanner(true)
    setScanResult(null)
  }

  const handleMarkNotPurchased = async (itemId: string) => {
    if (!list) return

    try {
      await shoppingListsService.markNotPurchased(list.id, itemId)

      // Refresh list
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)

      setScanResult({
        success: true,
        message: 'Articolo segnato come non acquistato',
      })

      // Check if all items are verified
      const allVerified = updatedList.items.every((item) => item.verified_at)
      if (allVerified) {
        await completeVerification()
        setScanResult({
          success: true,
          message: 'Controllo carico completato!',
        })
      }
    } catch (error) {
      console.error('Failed to mark as not purchased:', error)
      setScanResult({
        success: false,
        message: 'Errore. Riprova.',
      })
    }

    // Clear result after 3 seconds
    setTimeout(() => setScanResult(null), 3000)
  }

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false)

    if (!list || !scanningItemId) return

    try {
      // Look up barcode in Open Food Facts
      const result = await productsService.lookupBarcode(barcode)

      // Verify item with barcode
      await shoppingListsService.verifyItem(list.id, scanningItemId, barcode)

      // Refresh list
      const updatedList = await shoppingListsService.getById(list.id)
      setList(updatedList)

      if (result.found) {
        const productInfo = result.brand
          ? `${result.product_name} (${result.brand})`
          : result.product_name
        setScanResult({
          success: true,
          message: `Verificato: ${productInfo}`,
        })
      } else {
        setScanResult({
          success: true,
          message: 'Articolo verificato (barcode registrato)',
        })
      }

      // Check if all items are verified
      const allVerified = updatedList.items.every((item) => item.verified_at)
      if (allVerified) {
        await completeVerification()
        setScanResult({
          success: true,
          message: 'Controllo carico completato!',
        })
      }
    } catch (error) {
      console.error('Failed to process barcode:', error)
      setScanResult({
        success: false,
        message: 'Errore durante la scansione. Riprova.',
      })
    }

    setScanningItemId(null)

    // Clear result after 3 seconds
    setTimeout(() => setScanResult(null), 3000)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Caricamento...</p>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Lista non trovata</p>
        <Link to="/shopping-lists" className="text-primary-600 text-sm mt-2 inline-block">
          Torna alle liste
        </Link>
      </div>
    )
  }

  const checkedCount = list.items.filter((i) => i.checked).length
  const verifiedCount = list.items.filter((i) => i.verified_at).length
  const notPurchasedCount = list.items.filter((i) => i.not_purchased).length
  const totalCount = list.items.length

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
              <h1 className="text-lg font-bold text-gray-900">{list.name}</h1>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{STATUS_LABELS[list.status]}</span>
              {list.store_name && (
                <>
                  <span>-</span>
                  <span className="text-primary-600">{list.store_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showActionsMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {list.status === 'active' && (
                <>
                  {list.verification_status === 'not_started' && (
                    <button
                      onClick={startVerification}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Inizia Controllo Carico
                    </button>
                  )}
                  {list.verification_status === 'paused' && (
                    <button
                      onClick={resumeVerification}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Riprendi Controllo ({verifiedCount}/{totalCount})
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange('completed')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-green-600"
                  >
                    Completa lista
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-600"
                  >
                    Annulla lista
                  </button>
                </>
              )}
              <Link
                to={`/shopping-lists/${list.id}/receipt`}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scontrini d'acquisto
              </Link>
              <Link
                to={`/shopping-lists/${list.id}/edit`}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 block"
              >
                Modifica
              </Link>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600"
              >
                Elimina
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Verification Mode Banner */}
      {isVerificationMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Controllo Carico in corso</p>
              <p className="text-xs text-blue-600">
                Verificati: {verifiedCount}/{totalCount} - Tocca un articolo per scansionare
              </p>
            </div>
            <button
              onClick={pauseVerification}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Pausa
            </button>
          </div>
        </div>
      )}

      {/* Paused Verification Banner */}
      {list.verification_status === 'paused' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">Controllo Carico in pausa</p>
              <p className="text-xs text-yellow-600">
                Verificati: {verifiedCount}/{totalCount}
              </p>
            </div>
            <button
              onClick={resumeVerification}
              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700"
            >
              Riprendi
            </button>
          </div>
        </div>
      )}

      {/* Completed Verification Banner */}
      {list.verification_status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800">Controllo Carico completato</p>
          <p className="text-xs text-green-600">Tutti gli articoli sono stati verificati</p>
        </div>
      )}

      {/* Scan Result Toast */}
      {scanResult && (
        <div
          className={`fixed top-4 left-4 right-4 p-3 rounded-lg shadow-lg z-40 ${
            scanResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {scanResult.message}
        </div>
      )}

      {/* Progress */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Spesa</span>
          <span className="text-sm font-medium">{checkedCount}/{totalCount}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        {(list.verification_status !== 'not_started') && (
          <>
            <div className="flex items-center justify-between mb-2 mt-3">
              <span className="text-sm text-gray-600">Verifica</span>
              <span className="text-sm font-medium">
                {verifiedCount}/{totalCount}
                {notPurchasedCount > 0 && (
                  <span className="text-red-500 ml-1">({notPurchasedCount} non acquistati)</span>
                )}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {list.items.map((item) => (
          <div
            key={item.id}
            className={`card p-3 transition-colors ${
              item.checked ? 'bg-gray-50' : ''
            } ${isVerificationMode && !item.verified_at ? 'border-blue-300 border-2' : ''} ${
              item.not_purchased ? 'bg-red-50' : ''
            }`}
          >
            <div
              className={`flex items-center gap-3 ${!isVerificationMode ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (!isVerificationMode) {
                  toggleItemCheck(item)
                }
              }}
            >
              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  item.not_purchased
                    ? 'bg-red-500 border-red-500'
                    : item.checked
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300'
                }`}
              >
                {item.not_purchased ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : item.checked ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </div>

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${item.checked || item.not_purchased ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span>{item.quantity} {item.unit}</span>
                  {item.grocy_product_name && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                      Grocy
                    </span>
                  )}
                  {item.not_purchased && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                      Non Acquistato
                    </span>
                  )}
                  {item.verified_at && !item.not_purchased && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Verificato
                    </span>
                  )}
                </div>
              </div>

              {/* Verified/Not Purchased icon (when not in verification mode) */}
              {!isVerificationMode && item.verified_at && !item.not_purchased && (
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            {/* Action buttons in verification mode */}
            {isVerificationMode && !item.verified_at && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => openScannerForItem(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Scansiona
                </button>
                <button
                  onClick={() => handleMarkNotPurchased(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Non Acquistato
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => {
            setShowScanner(false)
            setScanningItemId(null)
          }}
        />
      )}

      {/* Click outside to close menu */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActionsMenu(false)}
        />
      )}
    </div>
  )
}

export default ShoppingListDetail
