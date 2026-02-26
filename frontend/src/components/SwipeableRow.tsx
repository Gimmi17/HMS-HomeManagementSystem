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
  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef<'horizontal' | 'vertical' | null>(null)
  const MAX_OFFSET = 150

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

    // Lock direction on first significant movement
    if (!locked.current) {
      if (Math.abs(deltaX) < 5 && deltaY < 5) return
      locked.current = deltaY > Math.abs(deltaX) ? 'vertical' : 'horizontal'
    }

    if (locked.current === 'vertical') return

    // deltaX > 0 = finger moved left = swipe left (delete)
    // deltaX < 0 = finger moved right = swipe right (check)
    if (deltaX > 0 && onSwipeLeft) {
      setOffset(Math.min(deltaX, MAX_OFFSET))
    } else if (deltaX < 0 && onSwipeRight) {
      setOffset(Math.max(deltaX, -MAX_OFFSET))
    }
  }

  const handleTouchEnd = () => {
    setSwiping(false)
    if (offset >= threshold && onSwipeLeft) {
      onSwipeLeft()
    } else if (offset <= -threshold && onSwipeRight) {
      onSwipeRight()
    }
    setOffset(0)
    locked.current = null
  }

  return (
    <div className={`relative overflow-hidden ${className ?? 'rounded-xl'}`}>
      {/* Red background revealed by swipe left (delete) */}
      {onSwipeLeft && (
        <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      )}
      {/* Green background revealed by swipe right (check) */}
      {onSwipeRight && (
        <div className="absolute inset-y-0 left-0 w-24 bg-green-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      {/* Draggable content */}
      <div
        className="relative bg-white"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${-offset}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
        {/* Swipe hint: right-pointing arrow on left (swipe right available) */}
        {onSwipeRight && (
          <div className="absolute left-1 inset-y-0 flex items-center pointer-events-none">
            <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        {/* Swipe hint: left-pointing arrow on right (swipe left available) */}
        {onSwipeLeft && (
          <div className="absolute right-1 inset-y-0 flex items-center pointer-events-none">
            <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
