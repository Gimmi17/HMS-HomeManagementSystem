import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'

const baseNavGroups = [
  {
    label: 'Vita Quotidiana',
    items: [
      { to: '/', label: 'Dashboard', icon: '📊' },
      { to: '/meals', label: 'Pasti', icon: '🍽️' },
      { to: '/shopping-lists', label: 'Lista Spesa', icon: '🛒' },
      { to: '/recipes', label: 'Ricette', icon: '📖' },
    ],
  },
  {
    label: 'Casa',
    items: [
      { to: '/giacenze', label: 'Giacenze', icon: '🏠' },
      { to: '/areas', label: 'Aree', icon: '🗄️' },
      { to: '/house', label: 'Casa', icon: '👥' },
      { to: '/anagrafiche', label: 'Anagrafiche', icon: '📋' },
    ],
  },
  {
    label: 'Finanze',
    items: [
      { to: '/finance', label: 'Finanza', icon: '💶' },
      { to: '/finance/compound-lab', label: 'Proiezione', icon: '📈' },
      { to: '/investments', label: 'Portafoglio', icon: '💼' },
    ],
  },
  {
    label: 'Io',
    items: [
      { to: '/health', label: 'Salute', icon: '❤️' },
      { to: '/settings', label: 'Impostazioni', icon: '⚙️' },
    ],
  },
]

const adminNavItem = { to: '/admin', label: 'Admin', icon: '🛠️' }

interface DrawerMenuProps {
  isOpen: boolean
  onClose: () => void
  userName: string | null
  isAdmin?: boolean
  onLogout: () => void
}

export function DrawerMenu({ isOpen, onClose, userName, isAdmin, onLogout }: DrawerMenuProps) {
  const { currentHouse, houses, setCurrentHouse } = useHouse()
  const navGroups = isAdmin
    ? baseNavGroups.map((group) =>
        group.label === 'Io'
          ? { ...group, items: [...group.items.slice(0, -1), adminNavItem, group.items[group.items.length - 1]] }
          : group
      )
    : baseNavGroups
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-xl animate-slide-left flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 truncate">
              {userName}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Chiudi menu"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {houses.length > 0 && (
            <select
              value={currentHouse?.id || ''}
              onChange={(e) => {
                const house = houses.find((h) => h.id === e.target.value)
                setCurrentHouse(house || null)
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-4">
            {navGroups.map((group) => (
              <li key={group.label}>
                <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`
                        }
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        {/* Separator + Logout */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => {
              onClose()
              onLogout()
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <span>🚪</span>
            <span>Esci</span>
          </button>
        </div>
      </aside>
    </div>,
    document.body
  )
}

export default DrawerMenu
