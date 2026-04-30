import { useRef, useState } from 'react'

interface SwipeableRowProps {
  children: React.ReactNode
  onSwipeLeft?: () => void      // delete
  onSwipeRight?: () => void     // check/verify
  threshold?: number
  className?: string
}

export default function SwipeableRow({ children, onSwipeLeft, onSwipeRight, threshold = 100, className }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [showHoverActions, setShowHoverActions] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef<'horizontal' | 'vertical' | null>(null)
  const isDragging = useRef(false)
  const MAX_OFFSET = 150

  // ── Touch handlers ──────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    locked.current = null
    setSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const deltaX = startX.current - currentX
    const deltaY = Math.abs(currentY - startY.current)

    if (!locked.current) {
      if (Math.abs(deltaX) < 5 && deltaY < 5) return
      locked.current = deltaY > Math.abs(deltaX) ? 'vertical' : 'horizontal'
    }
    if (locked.current === 'vertical') return

    if (deltaX > 0 && onSwipeLeft) {
      setOffset(Math.min(deltaX, MAX_OFFSET))
    } else if (deltaX < 0 && onSwipeRight) {
      setOffset(Math.max(deltaX, -MAX_OFFSET))
    }
  }

  const handleTouchEnd = () => {
    setSwiping(false)
    if (offset >= threshold && onSwipeLeft) onSwipeLeft()
    else if (offset <= -threshold && onSwipeRight) onSwipeRight()
    setOffset(0)
    locked.current = null
  }

  // ── Mouse handlers (desktop drag) ───────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    startX.current = e.clientX
    isDragging.current = true
    setSwiping(true)
    locked.current = null

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const deltaX = startX.current - ev.clientX
      if (deltaX > 3 && onSwipeLeft) setOffset(Math.min(deltaX, MAX_OFFSET))
      else if (deltaX < -3 && onSwipeRight) setOffset(Math.max(deltaX, -MAX_OFFSET))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      setSwiping(false)
      setOffset(prev => {
        if (prev >= threshold && onSwipeLeft) { onSwipeLeft(); return 0 }
        if (prev <= -threshold && onSwipeRight) { onSwipeRight(); return 0 }
        return 0
      })
      locked.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className={`relative overflow-hidden ${className ?? 'rounded-xl'}`}
      onMouseEnter={() => setShowHoverActions(true)}
      onMouseLeave={() => setShowHoverActions(false)}
    >
      {/* Red background (swipe left = delete) */}
      {onSwipeLeft && (
        <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      )}
      {/* Green background (swipe right = check) */}
      {onSwipeRight && (
        <div className="absolute inset-y-0 left-0 w-24 bg-green-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Draggable content */}
      <div
        className="relative bg-white select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          transform: `translateX(${-offset}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
          cursor: isDragging.current ? 'grabbing' : 'default',
        }}
      >
        {/* Swipe hint arrows (touch) */}
        {onSwipeRight && (
          <div className="absolute left-1 inset-y-0 flex items-center pointer-events-none sm:hidden">
            <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        <div className={`${onSwipeRight ? 'pl-4 sm:pl-0' : ''} ${onSwipeLeft ? 'pr-4 sm:pr-0' : ''}`}>
          {children}
        </div>
        {onSwipeLeft && (
          <div className="absolute right-1 inset-y-0 flex items-center pointer-events-none sm:hidden">
            <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        )}
      </div>

      {/* Desktop hover action buttons (shown on sm+ when not dragging) */}
      {showHoverActions && !swiping && (
        <div className="hidden sm:flex absolute inset-y-0 right-1 items-center gap-1 z-10">
          {onSwipeRight && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwipeRight() }}
              className="p-1.5 bg-green-100 hover:bg-green-500 text-green-600 hover:text-white rounded-lg transition-colors"
              title="Spunta"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          {onSwipeLeft && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwipeLeft() }}
              className="p-1.5 bg-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors"
              title="Elimina"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
