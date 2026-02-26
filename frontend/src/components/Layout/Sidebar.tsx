import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/meals', label: 'Pasti', icon: '🍽️' },
  { to: '/shopping-lists', label: 'Lista Spesa', icon: '🛒' },
  { to: '/recipes', label: 'Ricette', icon: '📖' },
  { to: '/pantry', label: 'Giacenze', icon: '🏠' },
  { to: '/environments', label: 'Ambienti', icon: '🗄️' },
  { to: '/health', label: 'Salute', icon: '❤️' },
  { to: '/house', label: 'Casa', icon: '👥' },
  { to: '/settings', label: 'Impostazioni', icon: '⚙️' },
]

export function Sidebar() {
  return (
    // Hidden on mobile, shown on sm and larger
    <aside className="hidden sm:block w-56 lg:w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-57px)] sticky top-[57px]">
      <nav className="p-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
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
      </nav>
    </aside>
  )
}

export default Sidebar
