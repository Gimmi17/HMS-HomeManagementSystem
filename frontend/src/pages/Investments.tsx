import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Investment {
  id: string
  name: string
  type: string
  provider?: string
  description?: string
  currency: string
  start_date?: string
  end_date?: string
  is_active: boolean
  notes?: string
  created_at: string
}

interface InvestmentSnapshot {
  id: string
  investment_id: string
  snapshot_date: string
  current_value: number
  invested_amount?: number
  units?: number
  nav?: number
  notes?: string
}

interface LinkedEntry {
  id: string
  label: string
  amount: number
  type: string
  subtype: string
  frequency?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  pac: '📈 PAC',
  pension: '🏦 Pensione',
  etf: '📊 ETF',
  stock: '📉 Azioni',
  crypto: '₿ Crypto',
  real_estate: '🏠 Immobiliare',
  other: '💼 Altro',
}

const TYPE_COLORS: Record<string, string> = {
  pac: 'bg-blue-900 text-blue-200',
  pension: 'bg-purple-900 text-purple-200',
  etf: 'bg-teal-900 text-teal-200',
  stock: 'bg-green-900 text-green-200',
  crypto: 'bg-orange-900 text-orange-200',
  real_estate: 'bg-yellow-900 text-yellow-200',
  other: 'bg-gray-700 text-gray-200',
}

const fmtEur = (n?: number | null) =>
  n != null ? `€ ${Number(n).toFixed(2)}` : '-'

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

// ─── Service ──────────────────────────────────────────────────────────────────

const svc = {
  list: (): Promise<Investment[]> =>
    api.get('/investments/').then(r => r.data),
  create: (data: Partial<Investment>): Promise<Investment> =>
    api.post('/investments/', data).then(r => r.data),
  update: (id: string, data: Partial<Investment>): Promise<Investment> =>
    api.put(`/investments/${id}`, data).then(r => r.data),
  del: (id: string) =>
    api.delete(`/investments/${id}`),
  snapshots: (id: string): Promise<InvestmentSnapshot[]> =>
    api.get(`/investments/${id}/snapshots`).then(r => r.data),
  addSnapshot: (id: string, data: Partial<InvestmentSnapshot>): Promise<InvestmentSnapshot> =>
    api.post(`/investments/${id}/snapshots`, data).then(r => r.data),
  delSnapshot: (id: string, snapId: string) =>
    api.delete(`/investments/${id}/snapshots/${snapId}`),
  linkedEntries: (id: string): Promise<LinkedEntry[]> =>
    api.get(`/investments/linked-entries/${id}`).then(r => r.data),
}

// ─── Modal: Investment Detail ─────────────────────────────────────────────────

function InvestmentDetail({
  inv,
  onClose,
  onUpdated: _onUpdated,
}: {
  inv: Investment
  onClose: () => void
  onUpdated: () => void
}) {
  const [snapshots, setSnapshots] = useState<InvestmentSnapshot[]>([])
  const [linked, setLinked] = useState<LinkedEntry[]>([])
  const [addingSnap, setAddingSnap] = useState(false)
  const [snap, setSnap] = useState({
    snapshot_date: new Date().toISOString().slice(0, 10),
    current_value: '',
    invested_amount: '',
    units: '',
    nav: '',
    notes: '',
  })

  useEffect(() => {
    Promise.all([svc.snapshots(inv.id), svc.linkedEntries(inv.id)]).then(
      ([s, l]) => { setSnapshots(s); setLinked(l) }
    )
  }, [inv.id])

  const latestSnap = snapshots[0]
  const gainAbs = latestSnap && latestSnap.invested_amount
    ? latestSnap.current_value - latestSnap.invested_amount
    : null
  const gainPct = gainAbs && latestSnap?.invested_amount
    ? (gainAbs / latestSnap.invested_amount) * 100
    : null

  const handleAddSnap = async () => {
    if (!snap.current_value) return
    await svc.addSnapshot(inv.id, {
      snapshot_date: snap.snapshot_date,
      current_value: parseFloat(snap.current_value),
      invested_amount: snap.invested_amount ? parseFloat(snap.invested_amount) : undefined,
      units: snap.units ? parseFloat(snap.units) : undefined,
      nav: snap.nav ? parseFloat(snap.nav) : undefined,
      notes: snap.notes || undefined,
    })
    const updated = await svc.snapshots(inv.id)
    setSnapshots(updated)
    setAddingSnap(false)
    setSnap({ snapshot_date: new Date().toISOString().slice(0, 10), current_value: '', invested_amount: '', units: '', nav: '', notes: '' })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[inv.type] ?? TYPE_COLORS.other}`}>
              {TYPE_LABELS[inv.type] ?? inv.type}
            </span>
            <h2 className="text-xl font-bold text-white mt-1">{inv.name}</h2>
            {inv.provider && <p className="text-gray-400 text-sm">{inv.provider}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl ml-4">✕</button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-gray-700">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-gray-400 text-xs">Valore attuale</p>
            <p className="text-white font-bold text-lg">{fmtEur(latestSnap?.current_value)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-gray-400 text-xs">Investito</p>
            <p className="text-white font-bold text-lg">{fmtEur(latestSnap?.invested_amount)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-gray-400 text-xs">Guadagno</p>
            {gainAbs != null ? (
              <p className={`font-bold text-lg ${gainAbs >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtEur(gainAbs)} {gainPct != null && `(${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)`}
              </p>
            ) : <p className="text-gray-500 text-lg">-</p>}
          </div>
        </div>

        {/* Info */}
        {(inv.description || inv.notes || inv.start_date) && (
          <div className="px-6 pt-4 pb-2 text-sm text-gray-300 space-y-1 border-b border-gray-700">
            {inv.start_date && <p><span className="text-gray-500">Inizio:</span> {fmtDate(inv.start_date)}{inv.end_date && ` → ${fmtDate(inv.end_date)}`}</p>}
            {inv.description && <p>{inv.description}</p>}
            {inv.notes && <p className="text-gray-400 italic">{inv.notes}</p>}
          </div>
        )}

        {/* Snapshots */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">📷 Storico valutazioni</h3>
            <button
              onClick={() => setAddingSnap(!addingSnap)}
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded"
            >+ Aggiungi</button>
          </div>

          {addingSnap && (
            <div className="bg-gray-800 rounded-lg p-4 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 text-xs">Data *</label>
                  <input type="date" value={snap.snapshot_date} onChange={e => setSnap(s => ({ ...s, snapshot_date: e.target.value }))}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Valore attuale (€) *</label>
                  <input type="number" step="0.01" value={snap.current_value} onChange={e => setSnap(s => ({ ...s, current_value: e.target.value }))}
                    placeholder="0.00" className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Totale investito (€)</label>
                  <input type="number" step="0.01" value={snap.invested_amount} onChange={e => setSnap(s => ({ ...s, invested_amount: e.target.value }))}
                    placeholder="0.00" className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Quote/Unità</label>
                  <input type="number" step="0.0001" value={snap.units} onChange={e => setSnap(s => ({ ...s, units: e.target.value }))}
                    placeholder="0.0000" className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">NAV (€/quota)</label>
                  <input type="number" step="0.0001" value={snap.nav} onChange={e => setSnap(s => ({ ...s, nav: e.target.value }))}
                    placeholder="0.0000" className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Note</label>
                  <input type="text" value={snap.notes} onChange={e => setSnap(s => ({ ...s, notes: e.target.value }))}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddingSnap(false)} className="text-xs text-gray-400 px-3 py-1">Annulla</button>
                <button onClick={handleAddSnap} className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded">Salva</button>
              </div>
            </div>
          )}

          {snapshots.length === 0 ? (
            <p className="text-gray-500 text-sm italic">Nessuna valutazione inserita</p>
          ) : (
            <div className="space-y-2">
              {snapshots.slice(0, 6).map(s => {
                const gain = s.invested_amount ? s.current_value - s.invested_amount : null
                return (
                  <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 text-sm">
                    <span className="text-gray-400">{fmtDate(s.snapshot_date)}</span>
                    <span className="text-white font-medium">{fmtEur(s.current_value)}</span>
                    {gain != null && (
                      <span className={gain >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {gain >= 0 ? '+' : ''}{fmtEur(gain)}
                      </span>
                    )}
                    {s.units && <span className="text-gray-500">{s.units.toFixed(3)} quote</span>}
                    <button
                      onClick={() => svc.delSnapshot(inv.id, s.id).then(() => setSnapshots(prev => prev.filter(x => x.id !== s.id)))}
                      className="text-red-500 hover:text-red-400 ml-2"
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Linked entries */}
        <div className="p-6">
          <h3 className="text-white font-semibold mb-3">🔗 Transazioni collegate</h3>
          {linked.length === 0 ? (
            <p className="text-gray-500 text-sm italic">
              Nessuna transazione collegata. Puoi collegare le uscite ricorrenti da{' '}
              <Link to="/finance" className="text-blue-400 underline">Finanza → Ricorrenti</Link>.
            </p>
          ) : (
            <div className="space-y-2">
              {linked.map(e => (
                <div key={e.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 text-sm">
                  <span className="text-white">{e.label}</span>
                  <span className={e.type === 'income' ? 'text-green-400' : 'text-red-400'}>
                    {e.type === 'income' ? '+' : '-'}{fmtEur(e.amount)}
                  </span>
                  {e.subtype === 'recurring' && (
                    <span className="text-gray-400 text-xs">{e.frequency ?? 'mensile'}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  type: 'pac',
  provider: '',
  description: '',
  currency: 'EUR',
  start_date: '',
  end_date: '',
  notes: '',
}

export function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Investment | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const reload = () => svc.list().then(setInvestments).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      await svc.create({
        ...form,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        provider: form.provider || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        is_active: true,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (inv: Investment) => {
    await svc.update(inv.id, { is_active: !inv.is_active })
    await reload()
  }

  const handleDelete = async (inv: Investment) => {
    if (!confirm(`Eliminare "${inv.name}"?`)) return
    await svc.del(inv.id)
    await reload()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Caricamento investimenti...
      </div>
    )
  }

  const active = investments.filter(i => i.is_active)
  const inactive = investments.filter(i => !i.is_active)

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">💼 Investimenti</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Monitora PAC, pensione e altri investimenti
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Nuovo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">Nuovo investimento</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-gray-400 text-xs">Nome *</label>
              <input type="text" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                placeholder="Es. PAC Azionario Globale" className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-400 text-xs">Tipo</label>
              <select value={form.type} onChange={e => setForm(s => ({ ...s, type: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5">
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs">Provider / Banca</label>
              <input type="text" value={form.provider} onChange={e => setForm(s => ({ ...s, provider: e.target.value }))}
                placeholder="Es. Mediolanum" className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-400 text-xs">Data inizio</label>
              <input type="date" value={form.start_date} onChange={e => setForm(s => ({ ...s, start_date: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-400 text-xs">Data fine (se prevista)</label>
              <input type="date" value={form.end_date} onChange={e => setForm(s => ({ ...s, end_date: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5" />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs">Descrizione</label>
              <input type="text" value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
                placeholder="Breve descrizione" className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5" />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs">Note</label>
              <input type="text" value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 mt-0.5" />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button onClick={() => setShowForm(false)} className="text-gray-400 px-4 py-2">Annulla</button>
            <button onClick={handleCreate} disabled={saving || !form.name}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg">
              {saving ? 'Salvo...' : 'Crea'}
            </button>
          </div>
        </div>
      )}

      {/* Active investments */}
      {active.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">💼</p>
          <p>Nessun investimento ancora.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-blue-400 underline text-sm">Aggiungi il primo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {active.map(inv => (
            <InvestmentCard
              key={inv.id}
              inv={inv}
              onClick={() => setSelected(inv)}
              onToggle={() => handleToggleActive(inv)}
              onDelete={() => handleDelete(inv)}
            />
          ))}
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="mt-6">
          <h3 className="text-gray-500 text-sm font-medium mb-3">Conclusi / Inattivi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inactive.map(inv => (
              <InvestmentCard
                key={inv.id}
                inv={inv}
                onClick={() => setSelected(inv)}
                onToggle={() => handleToggleActive(inv)}
                onDelete={() => handleDelete(inv)}
                dimmed
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <InvestmentDetail
          inv={selected}
          onClose={() => setSelected(null)}
          onUpdated={reload}
        />
      )}
    </div>
  )
}

// ─── Investment Card ──────────────────────────────────────────────────────────

function InvestmentCard({
  inv,
  onClick,
  onToggle,
  onDelete,
  dimmed = false,
}: {
  inv: Investment
  onClick: () => void
  onToggle: () => void
  onDelete: () => void
  dimmed?: boolean
}) {
  return (
    <div
      className={`rounded-xl border cursor-pointer transition-all ${
        dimmed
          ? 'bg-gray-900 border-gray-800 opacity-60 hover:opacity-80'
          : 'bg-gray-800 border-gray-700 hover:border-blue-600'
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[inv.type] ?? TYPE_COLORS.other}`}>
              {TYPE_LABELS[inv.type] ?? inv.type}
            </span>
            <h3 className="text-white font-semibold mt-1 truncate">{inv.name}</h3>
            {inv.provider && <p className="text-gray-400 text-xs">{inv.provider}</p>}
          </div>
          <div className="flex gap-2 ml-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={onToggle}
              title={inv.is_active ? 'Segna come concluso' : 'Riattiva'}
              className="text-gray-500 hover:text-yellow-400 text-sm"
            >
              {inv.is_active ? '⏸' : '▶'}
            </button>
            <button
              onClick={onDelete}
              title="Elimina"
              className="text-gray-500 hover:text-red-400 text-sm"
            >✕</button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          {inv.start_date && <span>Dal {new Date(inv.start_date).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}</span>}
          {inv.end_date && <span>→ {new Date(inv.end_date).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}</span>}
          {!inv.is_active && <span className="text-orange-400">● Concluso</span>}
        </div>
      </div>
    </div>
  )
}
