import api from './api'
import type {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  User,
  RecoverySetupRequest,
  RecoveryUpdateRequest,
  RecoveryCheckResponse,
  RecoveryStatusResponse,
  PasswordResetRequest
} from '@/types'

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

  // Password Recovery methods
  async checkRecovery(email: string): Promise<RecoveryCheckResponse> {
    const response = await api.post('/auth/check-recovery', { email })
    return response.data
  },

  async getRecoveryStatus(): Promise<RecoveryStatusResponse> {
    const response = await api.get('/auth/recovery-status')
    return response.data
  },

  async setupRecovery(data: RecoverySetupRequest): Promise<RecoveryStatusResponse> {
    const response = await api.post('/auth/setup-recovery', data)
    return response.data
  },

  async updateRecovery(data: RecoveryUpdateRequest): Promise<RecoveryStatusResponse> {
    const response = await api.put('/auth/update-recovery', data)
    return response.data
  },

  async resetPassword(data: PasswordResetRequest): Promise<void> {
    await api.post('/auth/reset-password', data)
  },
}

export default authService
