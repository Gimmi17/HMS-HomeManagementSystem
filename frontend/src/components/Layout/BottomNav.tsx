import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home', icon: '📊' },
  { to: '/meals', label: 'Pasti', icon: '🍽️' },
  { to: '/shopping-lists', label: 'Spesa', icon: '🛒' },
  { to: '/recipes', label: 'Ricette', icon: '📖' },
  { to: '/settings', label: 'Altro', icon: '⚙️' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 sm:hidden safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
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
