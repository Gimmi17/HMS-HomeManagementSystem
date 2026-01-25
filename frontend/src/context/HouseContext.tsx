import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { House } from '@/types'
import housesService from '@/services/houses'
import { useAuth } from './AuthContext'

interface HouseContextType {
  houses: House[]
  currentHouse: House | null
  isLoading: boolean
  setCurrentHouse: (house: House | null) => void
  refreshHouses: () => Promise<void>
  createHouse: (data: { name: string; description?: string }) => Promise<House>
  joinHouse: (code: string) => Promise<House>
}

const HouseContext = createContext<HouseContextType | undefined>(undefined)

const CURRENT_HOUSE_KEY = 'current_house_id'

export function HouseProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [houses, setHouses] = useState<House[]>([])
  const [currentHouse, setCurrentHouseState] = useState<House | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshHouses = async () => {
    try {
      const data = await housesService.getAll()
      setHouses(data)

      // Restore current house from localStorage or use first house
      const savedHouseId = localStorage.getItem(CURRENT_HOUSE_KEY)
      const savedHouse = data.find((h) => h.id === savedHouseId)

      if (savedHouse) {
        setCurrentHouseState(savedHouse)
      } else if (data.length > 0) {
        setCurrentHouseState(data[0])
        localStorage.setItem(CURRENT_HOUSE_KEY, data[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch houses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      refreshHouses()
    } else {
      setHouses([])
      setCurrentHouseState(null)
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const setCurrentHouse = (house: House | null) => {
    setCurrentHouseState(house)
    if (house) {
      localStorage.setItem(CURRENT_HOUSE_KEY, house.id)
    } else {
      localStorage.removeItem(CURRENT_HOUSE_KEY)
    }
  }

  const createHouse = async (data: { name: string; description?: string }) => {
    const house = await housesService.create(data)
    setHouses((prev) => [...prev, house])
    setCurrentHouse(house)
    return house
  }

  const joinHouse = async (code: string) => {
    const house = await housesService.joinWithCode(code)
    setHouses((prev) => [...prev, house])
    setCurrentHouse(house)
    return house
  }

  return (
    <HouseContext.Provider
      value={{
        houses,
        currentHouse,
        isLoading,
        setCurrentHouse,
        refreshHouses,
        createHouse,
        joinHouse,
      }}
    >
      {children}
    </HouseContext.Provider>
  )
}

export function useHouse() {
  const context = useContext(HouseContext)
  if (context === undefined) {
    throw new Error('useHouse must be used within a HouseProvider')
  }
  return context
}
