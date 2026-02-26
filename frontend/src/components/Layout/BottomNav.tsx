import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const leftItems = [
  { to: '/shopping-lists', label: 'Spesa', icon: '🛒' },
  { to: '/giacenze', label: 'Giacenze', icon: '🏠' },
]

const rightItems = [
  { to: '/meals', label: 'Pasti', icon: '🍽️' },
  { to: '/health', label: 'Salute', icon: '❤️' },
]

function useKeyboardVisible() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    // Use visualViewport API (reliable on iOS/Android)
    const vv = window.visualViewport
    if (vv) {
      const threshold = 150
      const onResize = () => {
        const keyboardOpen = window.innerHeight - vv.height > threshold
        setHidden(keyboardOpen)
      }
      vv.addEventListener('resize', onResize)
      return () => vv.removeEventListener('resize', onResize)
    }

    // Fallback: listen for focus/blur on input elements
    const onFocus = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setHidden(true)
      }
    }
    const onBlur = () => setHidden(false)

    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
    }
  }, [])

  return hidden
}

export function BottomNav() {
  const keyboardVisible = useKeyboardVisible()

  if (keyboardVisible) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 sm:hidden safe-area-bottom">
      <div className="flex justify-around items-center h-16 relative">
        {/* Left items */}
        {leftItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-500 active:bg-gray-100'
              }`
            }
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}

        {/* Home - center raised button */}
        <div className="flex-1 flex items-center justify-center">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-14 h-14 -mt-7 rounded-full border-4 border-white shadow-lg transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`
            }
          >
            <span className="text-2xl leading-none">📊</span>
          </NavLink>
        </div>

        {/* Right items */}
        {rightItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-500 active:bg-gray-100'
              }`
            }
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default BottomNav
