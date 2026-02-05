import { useHouse } from '@/context/HouseContext'

interface HeaderProps {
  onMenuToggle: () => void
  isMenuOpen: boolean
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const { currentHouse, houses, setCurrentHouse } = useHouse()

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

        {/* House selector */}
        {houses.length > 0 && (
          <select
            value={currentHouse?.id || ''}
            onChange={(e) => {
              const house = houses.find((h) => h.id === e.target.value)
              setCurrentHouse(house || null)
            }}
            className="input flex-1 sm:flex-none sm:max-w-[180px]"
          >
            {houses.map((house) => (
              <option key={house.id} value={house.id}>
                {house.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </header>
  )
}

export default Header
