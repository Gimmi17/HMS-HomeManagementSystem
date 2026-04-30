import { NavLink } from 'react-router-dom'

const navGroups = [
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

export function Sidebar() {
  return (
    <aside className="hidden sm:block w-56 lg:w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-57px)] sticky top-[57px]">
      <nav className="p-3">
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
    </aside>
  )
}

export default Sidebar
