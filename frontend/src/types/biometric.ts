export interface BiometricProfile {
  id: string
  user_id: string
  house_id: string
  birth_date?: string | null
  biological_sex?: string | null
  height_cm?: number | null
  activity_level?: string | null
  goal?: string | null
  diet_type?: string | null
  target_weight_kg?: number | null
  target_kcal?: number | null
  target_protein_g?: number | null
  target_carbs_g?: number | null
  target_fat_g?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface BiometricLog {
  id: string
  user_id: string
  house_id: string
  metric: string
  value: number
  unit?: string | null
  source: string
  notes?: string | null
  recorded_at: string
  created_at: string
  updated_at: string
}

export interface BiometricLogList {
  logs: BiometricLog[]
  total: number
}

export interface HealthGoal {
  id: string
  user_id: string
  house_id: string
  metric: string
  target_value: number
  started_value?: number | null
  deadline?: string | null
  status: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface BiometricDashboard {
  profile: BiometricProfile | null
  latest_logs: Record<string, BiometricLog>
  goals: HealthGoal[]
  bmi: number | null
  tdee: number | null
}

export const METRIC_LABELS: Record<string, string> = {
  weight_kg: 'Peso (kg)',
  body_fat_pct: 'Grasso corporeo (%)',
  waist_cm: 'Girovita (cm)',
  resting_hr: 'FC riposo (bpm)',
  hrv_ms: 'HRV (ms)',
  bp_systolic: 'PA sistolica (mmHg)',
  bp_diastolic: 'PA diastolica (mmHg)',
  vo2max: 'VO2max',
  sleep_hours: 'Sonno (ore)',
  sleep_quality: 'Qualità sonno (1-10)',
  energy_level: 'Energia (1-10)',
  steps_day: 'Passi/giorno',
  muscle_mass_kg: 'Massa muscolare (kg)',
}

export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentario',
  light: 'Leggero',
  moderate: 'Moderato',
  active: 'Attivo',
  very_active: 'Molto attivo',
}

export const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Perdere grasso',
  maintain: 'Mantenimento',
  gain_muscle: 'Massa muscolare',
  performance: 'Performance',
}

export const DIET_LABELS: Record<string, string> = {
  iperproteica: 'Iperproteica',
  ipocalorica: 'Ipocalorica',
  mediterranea: 'Mediterranea',
  chetogenica: 'Chetogenica',
}
