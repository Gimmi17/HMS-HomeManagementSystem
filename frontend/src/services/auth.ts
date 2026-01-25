import api from './api'
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '@/types'

export const authService = {
  async login(data: LoginRequest): Promise<AuthTokens> {
    const response = await api.post('/auth/login', data)
    return response.data
  },

  async register(data: RegisterRequest): Promise<AuthTokens> {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken })
    return response.data
  },

  async getMe(): Promise<User> {
    const response = await api.get('/users/me')
    return response.data
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.put('/users/me', data)
    return response.data
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  logout(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('current_house_id')
  },
}

export default authService
