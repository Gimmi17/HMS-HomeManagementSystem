import { useEffect, useState, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useHouse } from '@/context/HouseContext'
import biometricService from '@/services/biometric'
import type {
  BiometricProfile,
  BiometricLog,
  HealthGoal,
  BiometricDashboard,
} from '@/types/biometric'
import {
  METRIC_LABELS,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  DIET_LABELS,
} from '@/types/biometric'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })

const fmtNum = (n: number | null | undefined, d = 1) =>
  n != null ? Number(n).toFixed(d) : '-'

// ─── Component ──────────────────────────────────────────────────────────────

export function Health() {
  useAuth()
  const { currentHouse } = useHouse()
  const houseId = currentHouse?.id

  // Dashboard data
  const [dashboard, setDashboard] = useState<BiometricDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Profile form
  const [showProfile, setShowProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<Partial<BiometricProfile>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  // Log form
  const [showLogForm, setShowLogForm] = useState(false)
  const [logMetric, setLogMetric] = useState('weight_kg')
  const [logValue, setLogValue] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 16))

  // Logs list
  const [recentLogs, setRecentLogs] = useState<BiometricLog[]>([])

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalMetric, setGoalMetric] = useState('weight_kg')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalStarted, setGoalStarted] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [goalNotes, setGoalNotes] = useState('')

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    if (!houseId) return
    setIsLoading(true)
    try {
      const [dash, logsRes] = await Promise.all([
        biometricService.getDashboard(houseId),
        biometricService.getLogs(houseId, undefined, 10),
      ])
      setDashboard(dash)
      setRecentLogs(logsRes.logs)
      if (dash.profile) {
        setProfileForm(dash.profile)
      }
    } catch (err) {
      console.error('Failed to fetch health data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [houseId])

  // ─── Weight chart data (last 30 days) ───────────────────────────────────

  const [weightLogs, setWeightLogs] = useState<BiometricLog[]>([])

  useEffect(() => {
    if (!houseId) return
    biometricService.getLogs(houseId, 'weight_kg', 30).then((res) => {
      setWeightLogs(res.logs.slice().reverse()) // chronological
    }).catch(() => {})
  }, [houseId, recentLogs])

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!houseId) return
    setSavingProfile(true)
    try {
      const { id, user_id, house_id, created_at, updated_at, ...data } = profileForm as any
      await biometricService.updateProfile(houseId, data)
      await fetchAll()
      setShowProfile(false)
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAddLog = async (e: FormEvent) => {
    e.preventDefault()
    if (!houseId) return
    try {
      await biometricService.createLog(houseId, {
        metric: logMetric,
        value: parseFloat(logValue),
        recorded_at: new Date(logDate).toISOString(),
        notes: logNotes || undefined,
      })
      setLogValue('')
      setLogNotes('')
      setShowLogForm(false)
      await fetchAll()
    } catch (err) {
      console.error('Failed to add log:', err)
    }
  }

  const handleDeleteLog = async (logId: string) => {
    if (!houseId) return
    try {
      await biometricService.deleteLog(houseId, logId)
      await fetchAll()
    } catch (err) {
      console.error('Failed to delete log:', err)
    }
  }

  const handleAddGoal = async (e: FormEvent) => {
    e.preventDefault()
    if (!houseId) return
    try {
      await biometricService.createGoal(houseId, {
        metric: goalMetric,
        target_value: parseFloat(goalTarget),
        started_value: goalStarted ? parseFloat(goalStarted) : undefined,
        deadline: goalDeadline || undefined,
        notes: goalNotes || undefined,
      })
      setGoalTarget('')
      setGoalStarted('')
      setGoalDeadline('')
      setGoalNotes('')
      setShowGoalForm(false)
      await fetchAll()
    } catch (err) {
      console.error('Failed to add goal:', err)
    }
  }

  const handleGoalStatus = async (goal: HealthGoal, status: string) => {
    if (!houseId) return
    try {
      await biometricService.updateGoal(houseId, goal.id, { status })
      await fetchAll()
    } catch (err) {
      console.error('Failed to update goal:', err)
    }
  }

  // ─── Derived values ────────────────────────────────────────────────────

  const currentWeight = dashboard?.latest_logs?.weight_kg?.value ?? null
  const bmi = dashboard?.bmi ?? null
  const tdee = dashboard?.tdee ?? null
  const targetKcal = dashboard?.profile?.target_kcal ?? null

  // ─── No house guard ────────────────────────────────────────────────────

  if (!currentHouse) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Seleziona una casa per vedere i dati</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Salute</h1>
        <button onClick={() => setShowLogForm(!showLogForm)} className="btn btn-primary">
          + Nuova misurazione
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Peso attuale</p>
          <p className="text-3xl font-bold">{currentWeight != null ? `${fmtNum(currentWeight)} kg` : '-'}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">BMI</p>
          <p className={`text-3xl font-bold ${bmi != null && bmi > 25 ? 'text-red-600' : bmi != null && bmi < 18.5 ? 'text-yellow-600' : ''}`}>
            {fmtNum(bmi)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">TDEE</p>
          <p className="text-3xl font-bold">{tdee != null ? `${fmtNum(tdee, 0)} kcal` : '-'}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Target kcal</p>
          <p className="text-3xl font-bold">{targetKcal != null ? `${fmtNum(targetKcal, 0)} kcal` : '-'}</p>
        </div>
      </div>

      {/* New log form */}
      {showLogForm && (
        <form onSubmit={handleAddLog} className="card space-y-4">
          <h3 className="font-semibold">Nuova misurazione</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Metrica</label>
              <select value={logMetric} onChange={(e) => setLogMetric(e.target.value)} className="input">
                {Object.entries(METRIC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Valore</label>
              <input type="number" step="0.01" value={logValue} onChange={(e) => setLogValue(e.target.value)} className="input" required placeholder="0.0" />
            </div>
            <div>
              <label className="label">Data/ora</label>
              <input type="datetime-local" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Note</label>
              <input type="text" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} className="input" placeholder="opzionale" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">Salva</button>
            <button type="button" onClick={() => setShowLogForm(false)} className="btn btn-secondary">Annulla</button>
          </div>
        </form>
      )}

      {/* Profilo Biometrico */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Profilo Biometrico</h2>
          <button onClick={() => setShowProfile(!showProfile)} className="btn btn-secondary text-sm">
            {showProfile ? 'Chiudi' : 'Modifica'}
          </button>
        </div>

        {!showProfile && dashboard?.profile ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {dashboard.profile.height_cm && <div><span className="text-gray-500">Altezza:</span> {fmtNum(dashboard.profile.height_cm)} cm</div>}
            {dashboard.profile.birth_date && <div><span className="text-gray-500">Nascita:</span> {dashboard.profile.birth_date}</div>}
            {dashboard.profile.biological_sex && <div><span className="text-gray-500">Sesso:</span> {dashboard.profile.biological_sex}</div>}
            {dashboard.profile.activity_level && <div><span className="text-gray-500">Attività:</span> {ACTIVITY_LABELS[dashboard.profile.activity_level] || dashboard.profile.activity_level}</div>}
            {dashboard.profile.goal && <div><span className="text-gray-500">Obiettivo:</span> {GOAL_LABELS[dashboard.profile.goal] || dashboard.profile.goal}</div>}
            {dashboard.profile.diet_type && <div><span className="text-gray-500">Dieta:</span> {DIET_LABELS[dashboard.profile.diet_type] || dashboard.profile.diet_type}</div>}
            {dashboard.profile.target_weight_kg && <div><span className="text-gray-500">Peso target:</span> {fmtNum(dashboard.profile.target_weight_kg)} kg</div>}
            {dashboard.profile.target_protein_g && <div><span className="text-gray-500">Proteine target:</span> {fmtNum(dashboard.profile.target_protein_g, 0)} g</div>}
          </div>
        ) : !showProfile ? (
          <p className="text-gray-500 text-sm">Nessun profilo configurato. Clicca Modifica per iniziare.</p>
        ) : null}

        {showProfile && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Altezza (cm)</label>
                <input type="number" step="0.1" value={profileForm.height_cm ?? ''} onChange={(e) => setProfileForm({ ...profileForm, height_cm: e.target.value ? parseFloat(e.target.value) : null })} className="input" placeholder="175" />
              </div>
              <div>
                <label className="label">Data di nascita</label>
                <input type="date" value={profileForm.birth_date ?? ''} onChange={(e) => setProfileForm({ ...profileForm, birth_date: e.target.value || null })} className="input" />
              </div>
              <div>
                <label className="label">Sesso biologico</label>
                <select value={profileForm.biological_sex ?? ''} onChange={(e) => setProfileForm({ ...profileForm, biological_sex: e.target.value || null })} className="input">
                  <option value="">-</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </div>
              <div>
                <label className="label">Livello attività</label>
                <select value={profileForm.activity_level ?? ''} onChange={(e) => setProfileForm({ ...profileForm, activity_level: e.target.value || null })} className="input">
                  <option value="">-</option>
                  {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Obiettivo</label>
                <select value={profileForm.goal ?? ''} onChange={(e) => setProfileForm({ ...profileForm, goal: e.target.value || null })} className="input">
                  <option value="">-</option>
                  {Object.entries(GOAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tipo dieta</label>
                <select value={profileForm.diet_type ?? ''} onChange={(e) => setProfileForm({ ...profileForm, diet_type: e.target.value || null })} className="input">
                  <option value="">-</option>
                  {Object.entries(DIET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Peso target (kg)</label>
                <input type="number" step="0.1" value={profileForm.target_weight_kg ?? ''} onChange={(e) => setProfileForm({ ...profileForm, target_weight_kg: e.target.value ? parseFloat(e.target.value) : null })} className="input" />
              </div>
              <div>
                <label className="label">Target kcal</label>
                <input type="number" step="1" value={profileForm.target_kcal ?? ''} onChange={(e) => setProfileForm({ ...profileForm, target_kcal: e.target.value ? parseFloat(e.target.value) : null })} className="input" />
              </div>
              <div>
                <label className="label">Proteine (g)</label>
                <input type="number" step="1" value={profileForm.target_protein_g ?? ''} onChange={(e) => setProfileForm({ ...profileForm, target_protein_g: e.target.value ? parseFloat(e.target.value) : null })} className="input" />
              </div>
              <div>
                <label className="label">Carboidrati (g)</label>
                <input type="number" step="1" value={profileForm.target_carbs_g ?? ''} onChange={(e) => setProfileForm({ ...profileForm, target_carbs_g: e.target.value ? parseFloat(e.target.value) : null })} className="input" />
              </div>
              <div>
                <label className="label">Grassi (g)</label>
                <input type="number" step="1" value={profileForm.target_fat_g ?? ''} onChange={(e) => setProfileForm({ ...profileForm, target_fat_g: e.target.value ? parseFloat(e.target.value) : null })} className="input" />
              </div>
              <div>
                <label className="label">Note</label>
                <input type="text" value={profileForm.notes ?? ''} onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value || null })} className="input" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingProfile} className="btn btn-primary">
                {savingProfile ? 'Salvataggio...' : 'Salva profilo'}
              </button>
              <button type="button" onClick={() => setShowProfile(false)} className="btn btn-secondary">Annulla</button>
            </div>
          </form>
        )}
      </div>

      {/* Weight Chart (SVG) */}
      {weightLogs.length >= 2 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Andamento peso — ultimi 30 giorni</h2>
          <WeightChart logs={weightLogs} />
        </div>
      )}

      {/* Recent Logs */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Ultime misurazioni</h2>
        {isLoading ? (
          <p className="text-gray-500">Caricamento...</p>
        ) : recentLogs.length === 0 ? (
          <p className="text-gray-500">Nessuna misurazione registrata</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium bg-gray-100 rounded px-2 py-0.5">{METRIC_LABELS[log.metric] || log.metric}</span>
                  <span className="font-semibold">{fmtNum(log.value, 2)}</span>
                  {log.notes && <span className="text-sm text-gray-500">({log.notes})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{fmtDate(log.recorded_at)}</span>
                  <button onClick={() => handleDeleteLog(log.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Obiettivi attivi</h2>
          <button onClick={() => setShowGoalForm(!showGoalForm)} className="btn btn-secondary text-sm">
            + Nuovo obiettivo
          </button>
        </div>

        {showGoalForm && (
          <form onSubmit={handleAddGoal} className="space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Metrica</label>
                <select value={goalMetric} onChange={(e) => setGoalMetric(e.target.value)} className="input">
                  {Object.entries(METRIC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Valore target</label>
                <input type="number" step="0.01" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Valore iniziale</label>
                <input type="number" step="0.01" value={goalStarted} onChange={(e) => setGoalStarted(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Scadenza</label>
                <input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Note</label>
              <input type="text" value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} className="input" placeholder="opzionale" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">Salva</button>
              <button type="button" onClick={() => setShowGoalForm(false)} className="btn btn-secondary">Annulla</button>
            </div>
          </form>
        )}

        {(dashboard?.goals ?? []).length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun obiettivo attivo</p>
        ) : (
          <div className="space-y-3">
            {(dashboard?.goals ?? []).map((goal) => (
              <GoalCard key={goal.id} goal={goal} latestValue={dashboard?.latest_logs?.[goal.metric]?.value ?? null} onStatus={handleGoalStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Weight Chart (inline SVG) ──────────────────────────────────────────────

function WeightChart({ logs }: { logs: BiometricLog[] }) {
  const W = 600
  const H = 200
  const PAD = 40

  const values = logs.map((l) => l.value)
  const minV = Math.min(...values) - 1
  const maxV = Math.max(...values) + 1
  const rangeV = maxV - minV || 1

  const points = logs.map((l, i) => {
    const x = PAD + (i / Math.max(logs.length - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - ((l.value - minV) / rangeV) * (H - PAD * 2)
    return { x, y, value: l.value, date: l.recorded_at }
  })

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 250 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = H - PAD - frac * (H - PAD * 2)
        const val = minV + frac * rangeV
        return (
          <g key={frac}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{val.toFixed(1)}</text>
          </g>
        )
      })}

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth={2} />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
      ))}

      {/* X-axis labels (first and last) */}
      {points.length > 0 && (
        <>
          <text x={points[0].x} y={H - 8} textAnchor="start" fontSize={9} fill="#9ca3af">
            {new Date(points[0].date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </text>
          <text x={points[points.length - 1].x} y={H - 8} textAnchor="end" fontSize={9} fill="#9ca3af">
            {new Date(points[points.length - 1].date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </text>
        </>
      )}
    </svg>
  )
}

// ─── Goal Card ──────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  latestValue,
  onStatus,
}: {
  goal: HealthGoal
  latestValue: number | null
  onStatus: (goal: HealthGoal, status: string) => void
}) {
  const started = goal.started_value ?? 0
  const target = goal.target_value
  const current = latestValue ?? started
  const totalDelta = Math.abs(target - started) || 1
  const doneDelta = Math.abs(current - started)
  const pct = Math.min(100, Math.max(0, (doneDelta / totalDelta) * 100))

  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium">{METRIC_LABELS[goal.metric] || goal.metric}</span>
          <span className="text-sm text-gray-500 ml-2">
            {fmtNum(started, 1)} → {fmtNum(target, 1)}
          </span>
          {goal.deadline && <span className="text-xs text-gray-400 ml-2">entro {goal.deadline}</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onStatus(goal, 'achieved')} className="text-xs text-green-600 hover:underline">Raggiunto</button>
          <button onClick={() => onStatus(goal, 'abandoned')} className="text-xs text-gray-400 hover:underline">Abbandona</button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>Attuale: {fmtNum(current, 1)}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      {goal.notes && <p className="text-xs text-gray-400 mt-1">{goal.notes}</p>}
    </div>
  )
}

export default Health
