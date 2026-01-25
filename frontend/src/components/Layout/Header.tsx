import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'

export function Header() {
  const { user, logout } = useAuth()
  const { currentHouse, houses, setCurrentHouse } = useHouse()

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between gap-2">
        {/* Logo - hidden on mobile, shown on desktop */}
        <h1 className="text-lg font-bold text-primary-600 hidden sm:block">
          Meal Planner
        </h1>

        {/* House selector - takes full width on mobile */}
        {houses.length > 0 && (
          <select
            value={currentHouse?.id || ''}
            onChange={(e) => {
              const house = houses.find((h) => h.id === e.target.value)
              setCurrentHouse(house || null)
            }}
            className="input text-sm flex-1 sm:flex-none sm:max-w-[180px]"
          >
            {houses.map((house) => (
              <option key={house.id} value={house.id}>
                {house.name}
              </option>
            ))}
          </select>
        )}

        {/* User info and logout */}
        <div className="flex items-center gap-2">
          {user && (
            <>
              {/* User name - hidden on small mobile */}
              <span className="text-sm text-gray-600 hidden xs:inline truncate max-w-[100px]">
                {user.full_name || user.email}
              </span>
              <button
                onClick={logout}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Esci
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
