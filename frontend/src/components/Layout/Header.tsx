import { useAuth } from '@/context/AuthContext'

interface HeaderProps {
  onMenuToggle: () => void
  isMenuOpen: boolean
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Buongiorno'
  if (hour >= 12 && hour < 18) return 'Buon pomeriggio'
  if (hour >= 18 && hour < 22) return 'Buonasera'
  return 'Buonanotte'
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {/* Hamburger button */}
        <button
          onClick={onMenuToggle}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={isMenuOpen ? 'Chiudi menu' : 'Apri menu'}
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="text-sm font-medium text-gray-700 truncate">
          {getGreeting()}, {firstName}!
        </span>
      </div>
    </header>
  )
}

export default Header
