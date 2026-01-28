/**
 * LLM Service
 * API calls for managing LLM connections
 */

import { api } from './api'

export interface LLMConnection {
  id: string
  name: string
  url: string
  model: string
  purpose: string
  enabled: boolean
  timeout: number
  temperature: number
  max_tokens: number
  has_api_key: boolean
}

export interface LLMConnectionCreate {
  name: string
  url: string
  model?: string
  purpose?: string
  enabled?: boolean
  timeout?: number
  temperature?: number
  max_tokens?: number
  api_key?: string
}

export interface LLMConnectionUpdate {
  name?: string
  url?: string
  model?: string
  purpose?: string
  enabled?: boolean
  timeout?: number
  temperature?: number
  max_tokens?: number
  api_key?: string
}

export interface LLMPurpose {
  value: string
  label: string
  description: string
}

export interface LLMTestResult {
  status: 'ok' | 'offline' | 'error'
  message?: string
  models?: string[]
  test_response?: string
}

export interface LLMHealthResult {
  connection_id: string
  status: 'ok' | 'offline' | 'error'
  message?: string
}

const llmService = {
  /**
   * List all LLM connections for a house
   */
  async getConnections(houseId: string): Promise<LLMConnection[]> {
    const response = await api.get('/llm/connections', {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Get a specific LLM connection
   */
  async getConnection(connectionId: string, houseId: string): Promise<LLMConnection> {
    const response = await api.get(`/llm/connections/${connectionId}`, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Create a new LLM connection
   */
  async createConnection(data: LLMConnectionCreate, houseId: string): Promise<LLMConnection> {
    const response = await api.post('/llm/connections', data, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Update an LLM connection
   */
  async updateConnection(connectionId: string, data: LLMConnectionUpdate, houseId: string): Promise<LLMConnection> {
    const response = await api.put(`/llm/connections/${connectionId}`, data, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Delete an LLM connection
   */
  async deleteConnection(connectionId: string, houseId: string): Promise<void> {
    await api.delete(`/llm/connections/${connectionId}`, {
      params: { house_id: houseId }
    })
  },

  /**
   * Test a connection before saving
   */
  async testConnection(url: string, model: string = 'default'): Promise<LLMTestResult> {
    const response = await api.post('/llm/test', { url, model })
    return response.data
  },

  /**
   * Check health of a saved connection
   */
  async checkHealth(connectionId: string, houseId: string): Promise<LLMHealthResult> {
    const response = await api.get(`/llm/connections/${connectionId}/health`, {
      params: { house_id: houseId }
    })
    return response.data
  },

  /**
   * Get available purposes
   */
  async getPurposes(): Promise<LLMPurpose[]> {
    const response = await api.get('/llm/purposes')
    return response.data.purposes
  }
}

export default llmService
