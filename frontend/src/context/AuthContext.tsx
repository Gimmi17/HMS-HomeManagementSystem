import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User, LoginRequest, RegisterRequest } from '@/types'
import authService from '@/services/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  hasRecoverySetup: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  updateUser: (data: Partial<User>) => Promise<void>
  refreshRecoveryStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasRecoverySetup, setHasRecoverySetup] = useState(false)

  const checkRecoveryStatus = async () => {
    try {
      const status = await authService.getRecoveryStatus()
      setHasRecoverySetup(status.has_recovery_setup)
    } catch {
      setHasRecoverySetup(false)
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token')

      // No token = not authenticated, skip API call entirely
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const userData = await authService.getMe()
        setUser(userData)
        // Check recovery status after user is loaded
        await checkRecoveryStatus()
      } catch {
        // Token invalid/expired - clear local storage
        // The API interceptor will handle redirect if needed
        authService.logout()
        setUser(null)
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = async (data: LoginRequest) => {
    const response = await authService.login(data)
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
    // Fetch user data after storing tokens
    const userData = await authService.getMe()
    setUser(userData)
    // Check recovery status
    await checkRecoveryStatus()
  }

  const register = async (data: RegisterRequest) => {
    const response = await authService.register(data)
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
    // Fetch user data after storing tokens
    const userData = await authService.getMe()
    setUser(userData)
    // New users don't have recovery setup
    setHasRecoverySetup(false)
  }

  const logout = () => {
    authService.logout()
    setUser(null)
    setHasRecoverySetup(false)
  }

  const refreshRecoveryStatus = async () => {
    await checkRecoveryStatus()
  }

  const updateUser = async (data: Partial<User>) => {
    const updatedUser = await authService.updateProfile(data)
    setUser(updatedUser)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasRecoverySetup,
        login,
        register,
        logout,
        updateUser,
        refreshRecoveryStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
