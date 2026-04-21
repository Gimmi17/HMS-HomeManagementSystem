import api from './api'

export interface UserAnagrafica {
  id: string
  email: string
  full_name?: string
  first_name?: string
  last_name?: string
  codice_fiscale?: string
  birth_date?: string
  birth_place?: string
  gender?: string
  height_cm?: number
  phone?: string
  address?: string
  blood_type?: string
  allergies_medical: string[]
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
}

export type UserAnagraficaUpdate = Partial<Omit<UserAnagrafica, 'id' | 'email' | 'full_name'>>

const anagraficaService = {
  async get(): Promise<UserAnagrafica> {
    const response = await api.get('/users/me/anagrafica')
    return response.data
  },

  async update(data: UserAnagraficaUpdate): Promise<UserAnagrafica> {
    const response = await api.put('/users/me/anagrafica', data)
    return response.data
  },
}

export default anagraficaService
