import { useEffect, useMemo, useRef, useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import financeService, {
  type FinanceEntry,
  type FinanceSavings,
  type RevolutMovement,
  type OCRParsed,
} from '@/services/finance'

type Tab = 'dashboard' | 'storico' | 'ricorrenti' | 'revolut' | 'importa'

const fmtEur = (n: number | null | undefined) =>
  n != null && !Number.isNaN(n) ? `€ ${Number(n).toFixed(2)}` : '-'

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

const todayIso = () => new Date().toISOString().slice(0, 10)

const monthlyAmount = (e: FinanceEntry): number => {
  if (e.subtype !== 'recurring') return 0
  const today = new Date().toISOString().slice(0, 10)
  if (e.end_date && e.end_date < today) return 0
  if (e.start_date && e.start_date > today) return 0
  const amt = Number(e.amount)
  if (e.frequency === 'monthly') return amt
  if (e.frequency === 'weekly') return amt * 4.33
  if (e.frequency === 'every_n_months' && e.frequency_n) return amt / e.frequency_n
  return amt
}

export function Finance() {
  const { currentHouse } = useHouse()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [savings, setSavings] = useState<FinanceSavings>({ amount: 0, resign_date: null })
  const [revolut, setRevolut] = useState<RevolutMovement[]>([])
  const [loading, setLoading] = useState(true)

  const reloadAll = async () => {
    setLoading(true)
    try {
      const [e, s, r] = await Promise.all([
        financeService.listEntries(),
        financeService.getSavings(),
        financeService.listRevolut(),
      ])
      setEntries(e)
      setSavings(s)
      setRevolut(r)
    } catch (err) {
      console.error('finance load failed', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentHouse) reloadAll()
  }, [currentHouse?.id])

  if (!currentHouse) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Seleziona una casa per vedere la finanza</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Finanza</h1>
        <Link to="/finance/house" className="btn btn-secondary text-sm">
          👥 Vista casa
        </Link>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {(['dashboard', 'storico', 'ricorrenti', 'revolut', 'importa'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-600 text-primary-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Caricamento...</p>
      ) : (
        <>
          {tab === 'dashboard' && (
            <DashboardTab
              entries={entries}
              savings={savings}
              onSavingsChange={async (s) => {
                const saved = await financeService.saveSavings(s)
                setSavings(saved)
              }}
              onAdd={async (data) => {
                await financeService.createEntry(data)
                await reloadAll()
              }}
              onDelete={async (id) => {
                await financeService.deleteEntry(id)
                await reloadAll()
              }}
            />
          )}
          {tab === 'storico' && <StoricoTab entries={entries} />}
          {tab === 'ricorrenti' && (
            <RicorrentiTab
              entries={entries}
              onUpdate={async (id, data) => {
                await financeService.updateEntry(id, data)
                await reloadAll()
              }}
              onDelete={async (id) => {
                await financeService.deleteEntry(id)
                await reloadAll()
              }}
            />
          )}
          {tab === 'revolut' && (
            <RevolutTab
              movements={revolut}
              onAdd={async (m) => {
                await financeService.createRevolut(m)
                await reloadAll()
              }}
              onDelete={async (id) => {
                await financeService.deleteRevolut(id)
                await reloadAll()
              }}
            />
          )}
          {tab === 'importa' && (
            <ImportaTab
              onImport={async (rows) => {
                for (const r of rows) {
                  await financeService.createEntry({
                    label: r.label,
                    amount: r.amount,
                    type: r.type,
                    subtype: 'done',
                    date: r.date || undefined,
                  })
                }
                await reloadAll()
                setTab('storico')
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

type EntryInput = {
  label: string
  amount: number
  type: string
  subtype: string
  frequency?: string
  frequency_n?: number
  date?: string
  start_date?: string
  end_date?: string
}

function DashboardTab({
  entries,
  savings,
  onSavingsChange,
  onAdd,
  onDelete,
}: {
  entries: FinanceEntry[]
  savings: FinanceSavings
  onSavingsChange: (s: FinanceSavings) => Promise<void>
  onAdd: (data: EntryInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const income = entries
    .filter((e) => e.type === 'income' && e.subtype === 'recurring')
    .reduce((s, e) => s + monthlyAmount(e), 0)
  const expense = entries
    .filter((e) => e.type === 'expense' && e.subtype === 'recurring')
    .reduce((s, e) => s + monthlyAmount(e), 0)
  const leftover = income - expense
  const runway = expense > 0 ? savings.amount / expense : null

  const [resignDate, setResignDate] = useState<string>(savings.resign_date || '')
  const [savingsInput, setSavingsInput] = useState<string>(String(savings.amount ?? 0))

  useEffect(() => {
    setResignDate(savings.resign_date || '')
    setSavingsInput(String(savings.amount ?? 0))
  }, [savings])

  const handleSavingsSave = async () => {
    await onSavingsChange({
      amount: parseFloat(savingsInput) || 0,
      resign_date: resignDate || null,
    })
  }

  const expenseByLabel = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.type !== 'expense' || e.subtype !== 'recurring') continue
      const m = monthlyAmount(e)
      if (!m) continue
      map.set(e.label, (map.get(e.label) || 0) + m)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [entries])

  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Entrate/mese" value={fmtEur(income)} tone="green" />
        <KpiCard label="Uscite/mese" value={fmtEur(expense)} tone="red" />
        <KpiCard label="Leftover" value={fmtEur(leftover)} tone={leftover >= 0 ? 'green' : 'red'} />
        <KpiCard
          label="Runway"
          value={runway != null ? `${runway.toFixed(1)} mesi` : '-'}
          tone="indigo"
        />
      </div>

      {/* Savings + Resign */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Risparmi & Proiezione</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Risparmi (€)</label>
            <input
              type="number"
              step="0.01"
              value={savingsInput}
              onChange={(e) => setSavingsInput(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Data licenziamento</label>
            <input
              type="date"
              value={resignDate}
              onChange={(e) => setResignDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button onClick={handleSavingsSave} className="btn btn-primary w-full">
              Salva
            </button>
          </div>
        </div>

        {(income > 0 || expense > 0) && (
          <div className="mt-6">
            <ProjectionChart
              startSavings={savings.amount}
              income={income}
              expense={expense}
              resignDate={savings.resign_date}
            />
          </div>
        )}
      </div>

      {/* Expense donut */}
      {expenseByLabel.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Ripartizione spese ricorrenti</h2>
          <DonutChart data={expenseByLabel} />
        </div>
      )}

      {/* Add new entry */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Aggiungi voce</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-secondary text-sm">
            {showAdd ? 'Chiudi' : '+ Nuova'}
          </button>
        </div>
        {showAdd && <EntryForm onSubmit={onAdd} onDone={() => setShowAdd(false)} />}
      </div>

      {/* Recent done entries */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Ultime transazioni</h2>
        <EntriesTable
          rows={entries.filter((e) => e.subtype === 'done').slice(0, 10)}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

// ─── Storico ────────────────────────────────────────────────────────────────

function StoricoTab({ entries }: { entries: FinanceEntry[] }) {
  const [sort, setSort] = useState<'date' | 'amount' | 'label'>('date')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    let r = entries.filter((e) => e.subtype === 'done')
    if (search) r = r.filter((e) => e.label.toLowerCase().includes(search.toLowerCase()))
    if (from) r = r.filter((e) => (e.date || e.created_at.slice(0, 10)) >= from)
    if (to) r = r.filter((e) => (e.date || e.created_at.slice(0, 10)) <= to)
    r = [...r].sort((a, b) => {
      let cmp = 0
      if (sort === 'amount') cmp = Number(a.amount) - Number(b.amount)
      else if (sort === 'label') cmp = a.label.localeCompare(b.label)
      else {
        const da = a.date || a.created_at.slice(0, 10)
        const db = b.date || b.created_at.slice(0, 10)
        cmp = da.localeCompare(db)
      }
      return dir === 'asc' ? cmp : -cmp
    })
    return r
  }, [entries, search, from, to, sort, dir])

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Cerca</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="etichetta"
              className="input"
            />
          </div>
          <div>
            <label className="label">Da</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">A</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Ordina per</label>
            <div className="flex gap-1">
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="input flex-1">
                <option value="date">Data</option>
                <option value="amount">Importo</option>
                <option value="label">Etichetta</option>
              </select>
              <button
                onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
                className="btn btn-secondary px-2"
                title={dir === 'asc' ? 'Crescente' : 'Decrescente'}
              >
                {dir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessuna transazione</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr className="border-b">
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Etichetta</th>
                <th className="text-right py-2">Importo</th>
                <th className="text-left py-2">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2">{fmtDate(e.date || e.created_at)}</td>
                  <td className="py-2">{e.label}</td>
                  <td className={`py-2 text-right font-medium ${e.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {e.type === 'income' ? '+' : '-'} {fmtEur(Number(e.amount))}
                  </td>
                  <td className="py-2">
                    <span className="text-xs bg-gray-100 rounded px-2 py-0.5">{e.type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Ricorrenti ─────────────────────────────────────────────────────────────

function RicorrentiTab({
  entries,
  onUpdate,
  onDelete,
}: {
  entries: FinanceEntry[]
  onUpdate: (id: string, data: { end_date?: string | null; start_date?: string | null; label?: string; amount?: number }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const recurring = entries.filter((e) => e.subtype === 'recurring')
  const income = recurring.filter((e) => e.type === 'income')
  const expense = recurring.filter((e) => e.type === 'expense')
  return (
    <div className="space-y-4">
      <RecurringList title="Entrate ricorrenti" rows={income} onUpdate={onUpdate} onDelete={onDelete} />
      <RecurringList title="Uscite ricorrenti" rows={expense} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  )
}

function RecurringList({
  title,
  rows,
  onUpdate,
  onDelete,
}: {
  title: string
  rows: FinanceEntry[]
  onUpdate: (id: string, data: { end_date?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [endVal, setEndVal] = useState<string>('')
  const today = todayIso()

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Nessuna voce</p>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => {
            const expired = e.end_date && e.end_date < today
            const active = !expired
            return (
              <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{e.label}</span>
                    <span className="text-sm text-gray-500">
                      {fmtEur(Number(e.amount))} / {e.frequency || '-'}
                      {e.frequency === 'every_n_months' && e.frequency_n ? ` x${e.frequency_n}` : ''}
                    </span>
                    {expired ? (
                      <span className="text-xs bg-red-100 text-red-700 rounded px-2 py-0.5">scaduta</span>
                    ) : e.end_date ? (
                      <span className="text-xs bg-yellow-100 text-yellow-700 rounded px-2 py-0.5">
                        scade il {fmtDate(e.end_date)}
                      </span>
                    ) : active ? (
                      <span className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">attiva</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    mese: € {monthlyAmount(e).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editing === e.id ? (
                    <>
                      <input
                        type="date"
                        value={endVal}
                        onChange={(ev) => setEndVal(ev.target.value)}
                        className="input text-xs w-36"
                      />
                      <button
                        onClick={async () => {
                          await onUpdate(e.id, { end_date: endVal || null })
                          setEditing(null)
                        }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        Annulla
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(e.id)
                        setEndVal(e.end_date || '')
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ✎ scadenza
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-red-400 hover:text-red-600 text-xs ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Revolut ────────────────────────────────────────────────────────────────

function RevolutTab({
  movements,
  onAdd,
  onDelete,
}: {
  movements: RevolutMovement[]
  onAdd: (m: { label: string; amount: number; category: string; date: string; notes?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Altro')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [catFilter, setCatFilter] = useState('')

  const filtered = catFilter
    ? movements.filter((m) => m.category === catFilter)
    : movements

  const total = filtered.reduce((s, m) => s + Number(m.amount), 0)

  const months = new Set(filtered.map((m) => m.date.slice(0, 7)))
  const avg = months.size > 0 ? total / months.size : 0

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of movements) map.set(m.category, (map.get(m.category) || 0) + Number(m.amount))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [movements])

  const topCategory = byCategory[0]?.[0] || '-'

  const byMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of filtered) {
      const k = m.date.slice(0, 7)
      map.set(k, (map.get(k) || 0) + Number(m.amount))
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const allCategories = Array.from(new Set(movements.map((m) => m.category))).sort()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Totale uscite" value={fmtEur(total)} tone="red" />
        <KpiCard label="Media mensile" value={fmtEur(avg)} tone="indigo" />
        <KpiCard label="Top categoria" value={topCategory} tone="indigo" />
      </div>

      {byMonth.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Spese per mese</h2>
          <BarChart data={byMonth} />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Movimenti</h2>
          <div className="flex gap-2">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="">Tutte le categorie</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button onClick={() => setShowAdd(!showAdd)} className="btn btn-secondary text-sm">
              {showAdd ? 'Chiudi' : '+ Aggiungi'}
            </button>
          </div>
        </div>

        {showAdd && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!label || !amount) return
              await onAdd({
                label,
                amount: parseFloat(amount),
                category,
                date,
                notes: notes || undefined,
              })
              setLabel('')
              setAmount('')
              setNotes('')
              setShowAdd(false)
            }}
            className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-gray-50 rounded"
          >
            <div>
              <label className="label">Etichetta</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Importo</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Categoria</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn btn-primary w-full">
                Salva
              </button>
            </div>
            <div className="md:col-span-5">
              <label className="label">Note</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
            </div>
          </form>
        )}

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun movimento</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr className="border-b">
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Etichetta</th>
                <th className="text-left py-2">Categoria</th>
                <th className="text-right py-2">Importo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2">{fmtDate(m.date)}</td>
                  <td className="py-2">{m.label}</td>
                  <td className="py-2">
                    <span className="text-xs bg-gray-100 rounded px-2 py-0.5">{m.category}</span>
                  </td>
                  <td className="py-2 text-right font-medium text-red-600">{fmtEur(Number(m.amount))}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => onDelete(m.id)} className="text-red-400 hover:text-red-600 text-xs">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Importa (OCR) ──────────────────────────────────────────────────────────

function ImportaTab({ onImport }: { onImport: (rows: OCRParsed[]) => Promise<void> }) {
  const [rows, setRows] = useState<OCRParsed[]>([])
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError('')
    setLoading(true)
    try {
      const data = await financeService.importOcr(file)
      setRows(data)
      if (data.length === 0) setError('Nessuna riga riconosciuta')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore OCR')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (rows.length === 0) return
    await onImport(rows)
    setRows([])
  }

  return (
    <div className="space-y-4">
      <div
        className={`card border-2 border-dashed text-center py-10 transition-colors ${
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {loading ? (
          <p className="text-gray-600">Elaborazione OCR...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700">📎 Trascina un'immagine qui</p>
            <p className="text-sm text-gray-500 mt-1">oppure clicca per selezionarla</p>
          </>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {rows.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Anteprima ({rows.length} righe)</h2>
            <div className="flex gap-2">
              <button onClick={() => setRows([])} className="btn btn-secondary text-sm">
                Scarta
              </button>
              <button onClick={handleSubmit} className="btn btn-primary text-sm">
                Importa tutte
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr className="border-b">
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Etichetta</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-right py-2">Importo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1">
                    <input
                      type="date"
                      value={r.date || ''}
                      onChange={(e) => {
                        const v = e.target.value || null
                        setRows((prev) => prev.map((p, j) => (j === i ? { ...p, date: v } : p)))
                      }}
                      className="input text-xs"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      value={r.label}
                      onChange={(e) => {
                        const v = e.target.value
                        setRows((prev) => prev.map((p, j) => (j === i ? { ...p, label: v } : p)))
                      }}
                      className="input text-xs"
                    />
                  </td>
                  <td className="py-1">
                    <select
                      value={r.type}
                      onChange={(e) => {
                        const v = e.target.value as 'income' | 'expense'
                        setRows((prev) => prev.map((p, j) => (j === i ? { ...p, type: v } : p)))
                      }}
                      className="input text-xs"
                    >
                      <option value="income">Entrata</option>
                      <option value="expense">Uscita</option>
                    </select>
                  </td>
                  <td className="py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={r.amount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0
                        setRows((prev) => prev.map((p, j) => (j === i ? { ...p, amount: v } : p)))
                      }}
                      className="input text-xs text-right"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Helpers: shared components ─────────────────────────────────────────────

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'indigo' }) {
  const toneClass =
    tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-indigo-600'
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function EntryForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (data: EntryInput) => Promise<void>
  onDone: () => void
}) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [subtype, setSubtype] = useState<'recurring' | 'done'>('done')
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'every_n_months'>('monthly')
  const [freqN, setFreqN] = useState('')
  const [date, setDate] = useState(todayIso())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handle = async (e: FormEvent) => {
    e.preventDefault()
    if (!label || !amount) return
    const payload: any = {
      label,
      amount: parseFloat(amount),
      type,
      subtype,
    }
    if (subtype === 'recurring') {
      payload.frequency = frequency
      if (frequency === 'every_n_months' && freqN) payload.frequency_n = parseInt(freqN)
      if (startDate) payload.start_date = startDate
      if (endDate) payload.end_date = endDate
    } else {
      payload.date = date
    }
    await onSubmit(payload)
    setLabel('')
    setAmount('')
    onDone()
  }

  return (
    <form onSubmit={handle} className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div>
        <label className="label">Etichetta</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" required />
      </div>
      <div>
        <label className="label">Importo</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
          required
        />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
          <option value="expense">Uscita</option>
          <option value="income">Entrata</option>
        </select>
      </div>
      <div>
        <label className="label">Sottotipo</label>
        <select value={subtype} onChange={(e) => setSubtype(e.target.value as any)} className="input">
          <option value="done">Singola</option>
          <option value="recurring">Ricorrente</option>
        </select>
      </div>

      {subtype === 'recurring' ? (
        <>
          <div>
            <label className="label">Frequenza</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="input">
              <option value="monthly">Mensile</option>
              <option value="weekly">Settimanale</option>
              <option value="every_n_months">Ogni N mesi</option>
            </select>
          </div>
          {frequency === 'every_n_months' && (
            <div>
              <label className="label">N mesi</label>
              <input
                type="number"
                value={freqN}
                onChange={(e) => setFreqN(e.target.value)}
                className="input"
                min="1"
                max="60"
              />
            </div>
          )}
          <div>
            <label className="label">Inizio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Fine</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
          </div>
        </>
      ) : (
        <div>
          <label className="label">Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
      )}

      <div className="col-span-2 md:col-span-4 flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="btn btn-secondary">
          Annulla
        </button>
        <button type="submit" className="btn btn-primary">
          Salva
        </button>
      </div>
    </form>
  )
}

function EntriesTable({
  rows,
  onDelete,
}: {
  rows: FinanceEntry[]
  onDelete: (id: string) => Promise<void>
}) {
  if (rows.length === 0) return <p className="text-gray-500 text-sm">Nessuna transazione</p>
  return (
    <table className="w-full text-sm">
      <thead className="text-gray-500 text-xs">
        <tr className="border-b">
          <th className="text-left py-2">Data</th>
          <th className="text-left py-2">Etichetta</th>
          <th className="text-right py-2">Importo</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} className="border-b last:border-0">
            <td className="py-2">{fmtDate(e.date || e.created_at)}</td>
            <td className="py-2">{e.label}</td>
            <td className={`py-2 text-right font-medium ${e.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
              {e.type === 'income' ? '+' : '-'} {fmtEur(Number(e.amount))}
            </td>
            <td className="py-2 text-right">
              <button onClick={() => onDelete(e.id)} className="text-red-400 hover:text-red-600 text-xs">
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Charts (inline SVG) ────────────────────────────────────────────────────

function ProjectionChart({
  startSavings,
  income,
  expense,
  resignDate,
}: {
  startSavings: number
  income: number
  expense: number
  resignDate: string | null
}) {
  const months = 12
  const withJob: number[] = []
  const withoutJob: number[] = []
  let cw = startSavings
  let cwo = startSavings
  const today = new Date()
  const resign = resignDate ? new Date(resignDate) : null
  for (let i = 0; i <= months; i++) {
    withJob.push(cw)
    withoutJob.push(cwo)
    const future = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const hasSalary = !resign || future < resign
    cw += (hasSalary ? income : 0) - expense
    cwo += 0 - expense
  }
  const W = 600
  const H = 220
  const PAD = 40
  const all = [...withJob, ...withoutJob]
  const minV = Math.min(0, Math.min(...all))
  const maxV = Math.max(...all, 1)
  const range = maxV - minV || 1
  const toXY = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = PAD + (i / months) * (W - PAD * 2)
        const y = H - PAD - ((v - minV) / range) * (H - PAD * 2)
        return `${x},${y}`
      })
      .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = H - PAD - frac * (H - PAD * 2)
        const val = minV + frac * range
        return (
          <g key={frac}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              € {Math.round(val)}
            </text>
          </g>
        )
      })}
      <polyline points={toXY(withJob)} fill="none" stroke="#16a34a" strokeWidth={2} />
      <polyline points={toXY(withoutJob)} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 3" />
      <g fontSize={10} fill="#6b7280">
        <text x={PAD} y={H - 8}>
          oggi
        </text>
        <text x={W - PAD} y={H - 8} textAnchor="end">
          +12 mesi
        </text>
      </g>
      <g fontSize={11}>
        <rect x={W - 170} y={10} width={10} height={10} fill="#16a34a" />
        <text x={W - 155} y={20} fill="#374151">
          con stipendio
        </text>
        <line x1={W - 170} y1={35} x2={W - 160} y2={35} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 3" />
        <text x={W - 155} y={40} fill="#374151">
          senza stipendio
        </text>
      </g>
    </svg>
  )
}

const DONUT_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16']

function DonutChart({ data }: { data: [string, number][] }) {
  const total = data.reduce((s, [, v]) => s + v, 0)
  if (total <= 0) return null
  const R = 80
  const CX = 100
  const CY = 100
  let angle = -Math.PI / 2
  const slices = data.map(([label, value], i) => {
    const pct = value / total
    const a2 = angle + pct * Math.PI * 2
    const x1 = CX + R * Math.cos(angle)
    const y1 = CY + R * Math.sin(angle)
    const x2 = CX + R * Math.cos(a2)
    const y2 = CY + R * Math.sin(a2)
    const large = pct > 0.5 ? 1 : 0
    const d = `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`
    angle = a2
    return { d, color: DONUT_COLORS[i % DONUT_COLORS.length], label, value, pct }
  })

  return (
    <div className="flex items-start gap-6 flex-wrap">
      <svg viewBox="0 0 200 200" width={200} height={200}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} />
        ))}
        <circle cx={CX} cy={CY} r={40} fill="white" />
        <text x={CX} y={CY - 2} textAnchor="middle" fontSize={10} fill="#6b7280">
          Totale
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#111827">
          € {total.toFixed(0)}
        </text>
      </svg>
      <ul className="text-sm space-y-1 flex-1 min-w-[200px]">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ background: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="text-gray-500">€ {s.value.toFixed(2)}</span>
            <span className="text-gray-400 text-xs w-10 text-right">{(s.pct * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BarChart({ data }: { data: [string, number][] }) {
  const W = 600
  const H = 200
  const PAD = 40
  const maxV = Math.max(...data.map(([, v]) => v), 1)
  const bw = (W - PAD * 2) / Math.max(data.length, 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 250 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = H - PAD - frac * (H - PAD * 2)
        const val = frac * maxV
        return (
          <g key={frac}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              € {val.toFixed(0)}
            </text>
          </g>
        )
      })}
      {data.map(([label, v], i) => {
        const x = PAD + i * bw + bw * 0.15
        const h = ((v / maxV) * (H - PAD * 2)) || 0
        const y = H - PAD - h
        return (
          <g key={label}>
            <rect x={x} y={y} width={bw * 0.7} height={h} fill="#6366f1" rx={2} />
            <text x={x + bw * 0.35} y={H - PAD + 14} textAnchor="middle" fontSize={10} fill="#6b7280">
              {label.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default Finance
