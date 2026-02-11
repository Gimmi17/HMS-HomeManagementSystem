import { useState, useRef, useEffect, useCallback } from 'react'

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface TouchCropProps {
  src: string
  onCropChange?: (crop: CropArea) => void
  initialCrop?: CropArea
  style?: React.CSSProperties
  imageStyle?: React.CSSProperties
  onImageLoad?: () => void
  imageRef?: React.RefObject<HTMLImageElement | null>
}

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move'

export function TouchCrop({
  src,
  onCropChange,
  initialCrop,
  style,
  imageStyle,
  onImageLoad,
  imageRef: externalImageRef,
}: TouchCropProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalImageRef = useRef<HTMLImageElement | null>(null)

  // Callback ref to set both internal and external refs
  const setImageRef = useCallback((node: HTMLImageElement | null) => {
    internalImageRef.current = node
    if (externalImageRef) {
      (externalImageRef as React.MutableRefObject<HTMLImageElement | null>).current = node
    }
  }, [externalImageRef])
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 })
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [startCrop, setStartCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 })

  const MIN_SIZE = 50

  // Initialize crop when image loads
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const width = img.clientWidth
    const height = img.clientHeight
    setImageSize({ width, height })

    // Set initial crop to 80% of image, centered
    const defaultCrop = initialCrop || {
      x: width * 0.1,
      y: height * 0.1,
      width: width * 0.8,
      height: height * 0.8,
    }
    setCrop(defaultCrop)
    onCropChange?.(defaultCrop)
    onImageLoad?.()
  }, [initialCrop, onCropChange, onImageLoad])

  // Get touch/mouse position relative to container
  const getPosition = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }

    const rect = container.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  // Start drag
  const handleStart = useCallback((handle: HandlePosition, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveHandle(handle)
    setStartPos(getPosition(e))
    setStartCrop({ ...crop })
  }, [crop, getPosition])

  // Handle drag movement
  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!activeHandle) return
    e.preventDefault()

    const pos = getPosition(e)
    const dx = pos.x - startPos.x
    const dy = pos.y - startPos.y

    let newCrop = { ...startCrop }

    switch (activeHandle) {
      case 'move':
        newCrop.x = Math.max(0, Math.min(imageSize.width - startCrop.width, startCrop.x + dx))
        newCrop.y = Math.max(0, Math.min(imageSize.height - startCrop.height, startCrop.y + dy))
        break

      case 'nw':
        newCrop.x = Math.max(0, Math.min(startCrop.x + startCrop.width - MIN_SIZE, startCrop.x + dx))
        newCrop.y = Math.max(0, Math.min(startCrop.y + startCrop.height - MIN_SIZE, startCrop.y + dy))
        newCrop.width = startCrop.width - (newCrop.x - startCrop.x)
        newCrop.height = startCrop.height - (newCrop.y - startCrop.y)
        break

      case 'ne':
        newCrop.y = Math.max(0, Math.min(startCrop.y + startCrop.height - MIN_SIZE, startCrop.y + dy))
        newCrop.width = Math.max(MIN_SIZE, Math.min(imageSize.width - startCrop.x, startCrop.width + dx))
        newCrop.height = startCrop.height - (newCrop.y - startCrop.y)
        break

      case 'sw':
        newCrop.x = Math.max(0, Math.min(startCrop.x + startCrop.width - MIN_SIZE, startCrop.x + dx))
        newCrop.width = startCrop.width - (newCrop.x - startCrop.x)
        newCrop.height = Math.max(MIN_SIZE, Math.min(imageSize.height - startCrop.y, startCrop.height + dy))
        break

      case 'se':
        newCrop.width = Math.max(MIN_SIZE, Math.min(imageSize.width - startCrop.x, startCrop.width + dx))
        newCrop.height = Math.max(MIN_SIZE, Math.min(imageSize.height - startCrop.y, startCrop.height + dy))
        break

      case 'n':
        newCrop.y = Math.max(0, Math.min(startCrop.y + startCrop.height - MIN_SIZE, startCrop.y + dy))
        newCrop.height = startCrop.height - (newCrop.y - startCrop.y)
        break

      case 's':
        newCrop.height = Math.max(MIN_SIZE, Math.min(imageSize.height - startCrop.y, startCrop.height + dy))
        break

      case 'w':
        newCrop.x = Math.max(0, Math.min(startCrop.x + startCrop.width - MIN_SIZE, startCrop.x + dx))
        newCrop.width = startCrop.width - (newCrop.x - startCrop.x)
        break

      case 'e':
        newCrop.width = Math.max(MIN_SIZE, Math.min(imageSize.width - startCrop.x, startCrop.width + dx))
        break
    }

    setCrop(newCrop)
    onCropChange?.(newCrop)
  }, [activeHandle, startPos, startCrop, imageSize, getPosition, onCropChange])

  // End drag
  const handleEnd = useCallback(() => {
    setActiveHandle(null)
  }, [])

  // Global mouse/touch events for drag
  useEffect(() => {
    if (!activeHandle) return

    const handleGlobalMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault()
      const syntheticEvent = e as unknown as React.TouchEvent | React.MouseEvent
      handleMove(syntheticEvent)
    }

    const handleGlobalEnd = () => {
      handleEnd()
    }

    document.addEventListener('mousemove', handleGlobalMove, { passive: false })
    document.addEventListener('mouseup', handleGlobalEnd)
    document.addEventListener('touchmove', handleGlobalMove, { passive: false })
    document.addEventListener('touchend', handleGlobalEnd)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove)
      document.removeEventListener('mouseup', handleGlobalEnd)
      document.removeEventListener('touchmove', handleGlobalMove)
      document.removeEventListener('touchend', handleGlobalEnd)
    }
  }, [activeHandle, handleMove, handleEnd])

  const handleSize = 44 // Touch-friendly handle size
  const handleOffset = handleSize / 2

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Image */}
      <img
        ref={setImageRef}
        src={src}
        alt="Crop"
        onLoad={handleImageLoad}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          ...imageStyle,
        }}
        draggable={false}
      />

      {/* Overlay outside crop area */}
      {imageSize.width > 0 && (
        <>
          {/* Dark overlay - top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: crop.y,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          />
          {/* Dark overlay - bottom */}
          <div
            style={{
              position: 'absolute',
              top: crop.y + crop.height,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          />
          {/* Dark overlay - left */}
          <div
            style={{
              position: 'absolute',
              top: crop.y,
              left: 0,
              width: crop.x,
              height: crop.height,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          />
          {/* Dark overlay - right */}
          <div
            style={{
              position: 'absolute',
              top: crop.y,
              left: crop.x + crop.width,
              right: 0,
              height: crop.height,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          />

          {/* Crop area border */}
          <div
            style={{
              position: 'absolute',
              top: crop.y,
              left: crop.x,
              width: crop.width,
              height: crop.height,
              border: '2px solid #fff',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            {/* Grid lines */}
            <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
            <div style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
            <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
            <div style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </div>

          {/* Move handle (center area) */}
          <div
            style={{
              position: 'absolute',
              top: crop.y,
              left: crop.x,
              width: crop.width,
              height: crop.height,
              cursor: 'move',
            }}
            onMouseDown={(e) => handleStart('move', e)}
            onTouchStart={(e) => handleStart('move', e)}
          />

          {/* Corner handles */}
          {/* NW */}
          <div
            style={{
              position: 'absolute',
              top: crop.y - handleOffset,
              left: crop.x - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('nw', e)}
            onTouchStart={(e) => handleStart('nw', e)}
          >
            <div style={{ width: 16, height: 16, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* NE */}
          <div
            style={{
              position: 'absolute',
              top: crop.y - handleOffset,
              left: crop.x + crop.width - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'nesw-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('ne', e)}
            onTouchStart={(e) => handleStart('ne', e)}
          >
            <div style={{ width: 16, height: 16, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* SW */}
          <div
            style={{
              position: 'absolute',
              top: crop.y + crop.height - handleOffset,
              left: crop.x - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'nesw-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('sw', e)}
            onTouchStart={(e) => handleStart('sw', e)}
          >
            <div style={{ width: 16, height: 16, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* SE */}
          <div
            style={{
              position: 'absolute',
              top: crop.y + crop.height - handleOffset,
              left: crop.x + crop.width - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('se', e)}
            onTouchStart={(e) => handleStart('se', e)}
          >
            <div style={{ width: 16, height: 16, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* Edge handles */}
          {/* N */}
          <div
            style={{
              position: 'absolute',
              top: crop.y - handleOffset,
              left: crop.x + crop.width / 2 - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('n', e)}
            onTouchStart={(e) => handleStart('n', e)}
          >
            <div style={{ width: 24, height: 8, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* S */}
          <div
            style={{
              position: 'absolute',
              top: crop.y + crop.height - handleOffset,
              left: crop.x + crop.width / 2 - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('s', e)}
            onTouchStart={(e) => handleStart('s', e)}
          >
            <div style={{ width: 24, height: 8, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* W */}
          <div
            style={{
              position: 'absolute',
              top: crop.y + crop.height / 2 - handleOffset,
              left: crop.x - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('w', e)}
            onTouchStart={(e) => handleStart('w', e)}
          >
            <div style={{ width: 8, height: 24, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* E */}
          <div
            style={{
              position: 'absolute',
              top: crop.y + crop.height / 2 - handleOffset,
              left: crop.x + crop.width - handleOffset,
              width: handleSize,
              height: handleSize,
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => handleStart('e', e)}
            onTouchStart={(e) => handleStart('e', e)}
          >
            <div style={{ width: 8, height: 24, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>
        </>
      )}
    </div>
  )
}

export type { CropArea }
export default TouchCrop
