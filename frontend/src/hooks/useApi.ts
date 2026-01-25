import { useState, useCallback } from 'react'
import { AxiosError } from 'axios'
import type { ApiError } from '@/types'

interface UseApiState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
}

interface UseApiReturn<T, Args extends unknown[]> extends UseApiState<T> {
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
}

export function useApi<T, Args extends unknown[] = []>(
  apiFunction: (...args: Args) => Promise<T>
): UseApiReturn<T, Args> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const data = await apiFunction(...args)
        setState({ data, isLoading: false, error: null })
        return data
      } catch (err) {
        const error = err as AxiosError<ApiError>
        const message = error.response?.data?.detail || error.message || 'An error occurred'
        setState({ data: null, isLoading: false, error: message })
        return null
      }
    },
    [apiFunction]
  )

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}

export default useApi
