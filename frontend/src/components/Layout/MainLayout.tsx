import { ReactNode, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'
import Header from './Header'
import DrawerMenu from './DrawerMenu'
import BottomNav from './BottomNav'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { isLoading: isHouseLoading } = useHouse()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (isLoading || isHouseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onMenuToggle={() => setIsMenuOpen((prev) => !prev)}
        isMenuOpen={isMenuOpen}
      />
      <main className="p-4 sm:p-6 pb-20 sm:pb-6 min-h-[calc(100vh-57px)]">
        {children}
      </main>
      <BottomNav />
      <DrawerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userName={user?.full_name || user?.email || null}
        isAdmin={user?.role === 'admin'}
        onLogout={logout}
      />
    </div>
  )
}

export default MainLayout
