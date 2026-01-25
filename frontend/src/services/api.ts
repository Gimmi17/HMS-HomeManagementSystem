import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Determine API URL based on environment
const getApiUrl = () => {
  // On Cloudflare tunnel (mp.gimmidefranceschi.casa), use the API tunnel URL
  if (window.location.hostname === 'mp.gimmidefranceschi.casa') {
    return 'https://mp-api.gimmidefranceschi.casa/api/v1'
  }
  // On local access (HTTP or HTTPS via local IP), use relative path (nginx proxies to backend)
  return '/api/v1'
}

const API_URL = getApiUrl()

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * Force logout - clear all tokens and force page reload to login
 * This ensures all React state is cleared and user must re-authenticate
 */
const forceLogout = () => {
  // Clear all auth data
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('current_house_id')

  // Only redirect if not already on login/register page
  const currentPath = window.location.pathname
  if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
    // Force full page reload to clear all React state
    window.location.replace('/login')
  }
}

// Flag to prevent multiple logout calls
let isLoggingOut = false

// Response interceptor - handle token refresh and auto-logout
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Prevent multiple logout attempts
      if (isLoggingOut) {
        return Promise.reject(error)
      }

      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refresh_token')

      // No refresh token - force logout immediately
      if (!refreshToken) {
        isLoggingOut = true
        forceLogout()
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        const { access_token, refresh_token } = response.data
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('refresh_token', refresh_token)

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch {
        // Refresh failed - token expired, force logout
        isLoggingOut = true
        forceLogout()
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
