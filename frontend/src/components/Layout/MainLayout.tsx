import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
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
      <Header />
      <div className="flex">
        <Sidebar />
        {/* Main content - add bottom padding on mobile for BottomNav */}
        <main className="flex-1 p-4 sm:p-6 pb-20 sm:pb-6 min-h-[calc(100vh-57px)]">
          {children}
        </main>
      </div>
      {/* Bottom navigation for mobile */}
      <BottomNav />
    </div>
  )
}

export default MainLayout
