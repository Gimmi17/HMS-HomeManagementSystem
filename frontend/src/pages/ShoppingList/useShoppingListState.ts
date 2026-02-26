import { useEffect, useState, useRef, useCallback } from 'react'
import shoppingListsService from '@/services/shoppingLists'
import productsService from '@/services/products'

import categoriesService from '@/services/categories'
import type { ShoppingList, ShoppingListItem, Category } from '@/types'
import type { ScanLogEntry } from '@/components/ContinuousBarcodeScanner'

export type UnifiedMode = 'view' | 'edit' | 'verify'

export interface ShoppingListState {
  // Core data
  list: ShoppingList | null
  setList: React.Dispatch<React.SetStateAction<ShoppingList | null>>
  isLoading: boolean
  categories: Category[]

  // Toast
  toast: { success: boolean; message: string } | null
  showToast: (success: boolean, message: string) => void

  // Scanner
  showScanner: boolean
  setShowScanner: React.Dispatch<React.SetStateAction<boolean>>
  scanLog: ScanLogEntry[]
  setScanLog: React.Dispatch<React.SetStateAction<ScanLogEntry[]>>
  scanLogRef: React.MutableRefObject<ScanLogEntry[]>
  isScanProcessing: boolean
  setIsScanProcessing: React.Dispatch<React.SetStateAction<boolean>>
  handleBarcodeDetected: (barcode: string) => Promise<void>
  handleScannerClose: () => Promise<void>

  // Shared modals
  editingItem: ShoppingListItem | null
  setEditingItem: React.Dispatch<React.SetStateAction<ShoppingListItem | null>>
  actionMenuItem: ShoppingListItem | null
  setActionMenuItem: React.Dispatch<React.SetStateAction<ShoppingListItem | null>>
  noteEditItem: ShoppingListItem | null
  setNoteEditItem: React.Dispatch<React.SetStateAction<ShoppingListItem | null>>

  // Utility
  refreshList: () => Promise<void>
  id: string

  // Mode
  mode: UnifiedMode
}

export function useShoppingListState(id: string, mode: UnifiedMode): ShoppingListState {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  // Toast
  const [toast, setToast] = useState<{ success: boolean; message: string } | null>(null)

  const showToast = useCallback((success: boolean, message: string) => {
    setToast({ success, message })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Scanner
  const [showScanner, setShowScanner] = useState(false)
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([])
  const scanLogRef = useRef<ScanLogEntry[]>([])
  const [isScanProcessing, setIsScanProcessing] = useState(false)

  // Shared modals
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [actionMenuItem, setActionMenuItem] = useState<ShoppingListItem | null>(null)
  const [noteEditItem, setNoteEditItem] = useState<ShoppingListItem | null>(null)

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

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      const houseId = localStorage.getItem('current_house_id') || ''
      if (!houseId) return
      try {
        const response = await categoriesService.getAll(houseId)
        setCategories(response.categories)
      } catch (error) {
        console.error('Failed to load categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Polling - 3s, paused when scanner/modals open or mode=edit
  useEffect(() => {
    if (!id || isLoading || showScanner || mode === 'edit') return
    if (editingItem || actionMenuItem || noteEditItem) return

    const pollInterval = setInterval(async () => {
      try {
        const data = await shoppingListsService.getById(id)
        setList(data)
      } catch {
        // Silently ignore polling errors
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [id, isLoading, showScanner, mode, editingItem, actionMenuItem, noteEditItem])

  // Refresh utility
  const refreshList = useCallback(async () => {
    if (!id) return
    try {
      const data = await shoppingListsService.getById(id)
      setList(data)
    } catch (error) {
      console.error('Failed to refresh list:', error)
    }
  }, [id])

  // Scanner handlers - behavior depends on mode
  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    if (!list || !id) return

    if (mode === 'view') {
      // View mode: match against unchecked items
      const matchedItem = list.items.find(
        item => item.catalog_barcode === barcode && !item.not_purchased
      )

      if (matchedItem) {
        const existingIdx = scanLogRef.current.findIndex(e => e.barcode === barcode)
        let newQuantity = 1
        if (existingIdx >= 0) {
          newQuantity = scanLogRef.current[existingIdx].quantity + 1
          scanLogRef.current[existingIdx] = {
            ...scanLogRef.current[existingIdx],
            quantity: newQuantity,
            timestamp: Date.now(),
          }
        } else {
          scanLogRef.current = [
            ...scanLogRef.current,
            {
              barcode,
              productName: matchedItem.name,
              matched: true,
              quantity: 1,
              timestamp: Date.now(),
            },
          ]
        }
        setScanLog([...scanLogRef.current])

        try {
          await shoppingListsService.verifyItemWithQuantity(
            id, matchedItem.id, barcode, newQuantity,
            matchedItem.unit || 'pz', matchedItem.name
          )
          const updated = await shoppingListsService.getById(id)
          setList(updated)
        } catch (err) {
          console.error('Verify failed:', err)
        }
      } else {
        addExtraScanEntry(barcode)
      }
    } else if (mode === 'verify') {
      // Verify mode: match against pending (unverified, not not_purchased) items
      const matchedItem = list.items.find(
        item => item.catalog_barcode === barcode && !item.verified_at && !item.not_purchased
      )

      if (matchedItem) {
        const existingIdx = scanLogRef.current.findIndex(e => e.barcode === barcode && e.matched)
        let newQuantity = matchedItem.quantity || 1
        if (existingIdx >= 0) {
          newQuantity = scanLogRef.current[existingIdx].quantity + 1
          scanLogRef.current[existingIdx] = {
            ...scanLogRef.current[existingIdx],
            quantity: newQuantity,
            timestamp: Date.now(),
          }
        } else {
          scanLogRef.current = [
            ...scanLogRef.current,
            {
              barcode,
              productName: matchedItem.name,
              matched: true,
              quantity: newQuantity,
              timestamp: Date.now(),
            },
          ]
        }
        setScanLog([...scanLogRef.current])

        try {
          await shoppingListsService.verifyItemWithQuantity(
            id, matchedItem.id, barcode, newQuantity,
            matchedItem.unit || 'pz', matchedItem.name
          )
          const updated = await shoppingListsService.getById(id)
          setList(updated)
        } catch (err) {
          console.error('Verify failed:', err)
        }
      } else {
        addExtraScanEntry(barcode)
      }
    }
  }, [list, id, mode])

  // Helper for extra scan entries
  const addExtraScanEntry = useCallback(async (barcode: string) => {
    const existingIdx = scanLogRef.current.findIndex(e => e.barcode === barcode && !e.matched)

    if (existingIdx >= 0) {
      scanLogRef.current[existingIdx] = {
        ...scanLogRef.current[existingIdx],
        quantity: scanLogRef.current[existingIdx].quantity + 1,
        timestamp: Date.now(),
      }
      setScanLog([...scanLogRef.current])
    } else {
      const entry: ScanLogEntry = {
        barcode,
        matched: false,
        quantity: 1,
        timestamp: Date.now(),
      }
      scanLogRef.current = [...scanLogRef.current, entry]
      setScanLog([...scanLogRef.current])

      try {
        const lookup = await productsService.lookupBarcode(barcode)
        if (lookup.found && lookup.product_name) {
          const name = lookup.brand ? `${lookup.product_name} (${lookup.brand})` : lookup.product_name
          const idx = scanLogRef.current.findIndex(e => e.barcode === barcode && !e.matched)
          if (idx >= 0) {
            scanLogRef.current[idx] = { ...scanLogRef.current[idx], productName: name }
            setScanLog([...scanLogRef.current])
          }
        }
      } catch {
        // Lookup failed
      }
    }
  }, [])

  const handleScannerClose = useCallback(async () => {
    setShowScanner(false)
    if (!id) return

    const extraEntries = scanLogRef.current.filter(e => !e.matched)
    const verifiedCount = scanLogRef.current.filter(e => e.matched).length

    if (extraEntries.length > 0) {
      setIsScanProcessing(true)
    }

    let extraCount = 0

    for (const entry of extraEntries) {
      try {
        await shoppingListsService.addExtraItem(
          id, entry.barcode, entry.quantity, 'pz', entry.productName
        )
        extraCount++
      } catch (err) {
        console.error('Failed to add extra item:', err)
      }
    }

    try {
      const updated = await shoppingListsService.getById(id)
      setList(updated)
    } catch {
      // ignore
    }

    setIsScanProcessing(false)

    if (verifiedCount > 0 || extraCount > 0) {
      const parts: string[] = []
      if (verifiedCount > 0) parts.push(`${verifiedCount} verificati`)
      if (extraCount > 0) parts.push(`${extraCount} extra`)
      showToast(true, `Scansione: ${parts.join(', ')}`)
    }

    setScanLog([])
    scanLogRef.current = []
  }, [id, showToast])

  return {
    list,
    setList,
    isLoading,
    categories,
    toast,
    showToast,
    showScanner,
    setShowScanner,
    scanLog,
    setScanLog,
    scanLogRef,
    isScanProcessing,
    setIsScanProcessing,
    handleBarcodeDetected,
    handleScannerClose,
    editingItem,
    setEditingItem,
    actionMenuItem,
    setActionMenuItem,
    noteEditItem,
    setNoteEditItem,
    refreshList,
    id,
    mode,
  }
}
