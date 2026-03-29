import api from './api'
import type {
  BiometricProfile,
  BiometricLog,
  BiometricLogList,
  HealthGoal,
  BiometricDashboard,
} from '@/types/biometric'

export const biometricService = {
  // Profile
  async getProfile(houseId: string): Promise<BiometricProfile> {
    const res = await api.get(`/biometric-profile/${houseId}`)
    return res.data
  },

  async createProfile(houseId: string, data: Partial<BiometricProfile>): Promise<BiometricProfile> {
    const res = await api.post(`/biometric-profile/${houseId}`, data)
    return res.data
  },

  async updateProfile(houseId: string, data: Partial<BiometricProfile>): Promise<BiometricProfile> {
    const res = await api.put(`/biometric-profile/${houseId}`, data)
    return res.data
  },

  // Logs
  async getLogs(houseId: string, metric?: string, limit = 100): Promise<BiometricLogList> {
    const res = await api.get(`/biometric-logs/${houseId}`, {
      params: { metric, limit },
    })
    return res.data
  },

  async createLog(houseId: string, data: {
    metric: string
    value: number
    unit?: string
    source?: string
    notes?: string
    recorded_at?: string
  }): Promise<BiometricLog> {
    const res = await api.post(`/biometric-logs/${houseId}`, data)
    return res.data
  },

  async deleteLog(houseId: string, logId: string): Promise<void> {
    await api.delete(`/biometric-logs/${houseId}/${logId}`)
  },

  // Goals
  async getGoals(houseId: string, status?: string): Promise<HealthGoal[]> {
    const res = await api.get(`/health-goals/${houseId}`, {
      params: status ? { status } : undefined,
    })
    return res.data
  },

  async createGoal(houseId: string, data: {
    metric: string
    target_value: number
    started_value?: number
    deadline?: string
    notes?: string
  }): Promise<HealthGoal> {
    const res = await api.post(`/health-goals/${houseId}`, data)
    return res.data
  },

  async updateGoal(houseId: string, goalId: string, data: Partial<HealthGoal>): Promise<HealthGoal> {
    const res = await api.put(`/health-goals/${houseId}/${goalId}`, data)
    return res.data
  },

  async deleteGoal(houseId: string, goalId: string): Promise<void> {
    await api.delete(`/health-goals/${houseId}/${goalId}`)
  },

  // Dashboard
  async getDashboard(houseId: string): Promise<BiometricDashboard> {
    const res = await api.get(`/health-dashboard/${houseId}`)
    return res.data
  },
}

export default biometricService
