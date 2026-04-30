import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouse } from '@/context/HouseContext'
import financeService, { type HouseSummary } from '@/services/finance'

const fmtEur = (n: number | null | undefined) =>
  n != null && !Number.isNaN(n) ? `€ ${Number(n).toFixed(2)}` : '-'

export function FinanceHouse() {
  const { currentHouse } = useHouse()
  const [summary, setSummary] = useState<HouseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentHouse) return
    setLoading(true)
    financeService
      .houseSummary()
      .then(setSummary)
      .catch((err) => setError(err?.response?.data?.detail || 'Errore'))
      .finally(() => setLoading(false))
  }, [currentHouse?.id])

  if (!currentHouse) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Seleziona una casa</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Finanza — Vista casa</h1>
        <Link to="/finance" className="btn btn-secondary text-sm">
          ← Torna a Finanza
        </Link>
      </div>

      {loading && <p className="text-gray-500">Caricamento...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Entrate totali" value={fmtEur(summary.total_income)} tone="green" />
            <Kpi label="Uscite totali" value={fmtEur(summary.total_expense)} tone="red" />
            <Kpi
              label="Leftover totale"
              value={fmtEur(summary.total_leftover)}
              tone={summary.total_leftover >= 0 ? 'green' : 'red'}
            />
            <Kpi label="Risparmio totale" value={fmtEur(summary.total_savings)} tone="indigo" />
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Membri</h2>
            {summary.members.length === 0 ? (
              <p className="text-gray-500 text-sm">Nessun membro</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs">
                    <tr className="border-b">
                      <th className="text-left py-2">Nome</th>
                      <th className="text-right py-2">Entrate/mese</th>
                      <th className="text-right py-2">Uscite/mese</th>
                      <th className="text-right py-2">Leftover</th>
                      <th className="text-right py-2">Risparmio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.members.map((m) => (
                      <tr key={m.user_id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{m.name}</td>
                        <td className="py-2 text-right text-green-600">{fmtEur(m.monthly_income)}</td>
                        <td className="py-2 text-right text-red-600">{fmtEur(m.monthly_expense)}</td>
                        <td
                          className={`py-2 text-right font-medium ${
                            m.leftover >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {fmtEur(m.leftover)}
                        </td>
                        <td className="py-2 text-right">{fmtEur(m.savings)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-50">
                      <td className="py-2">Totale</td>
                      <td className="py-2 text-right text-green-700">{fmtEur(summary.total_income)}</td>
                      <td className="py-2 text-right text-red-700">{fmtEur(summary.total_expense)}</td>
                      <td
                        className={`py-2 text-right ${
                          summary.total_leftover >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {fmtEur(summary.total_leftover)}
                      </td>
                      <td className="py-2 text-right">{fmtEur(summary.total_savings)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {summary.members.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Contributo dei membri</h2>
              <StackedBar members={summary.members} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'indigo' }) {
  const cls = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-indigo-600'
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  )
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444']

function StackedBar({
  members,
}: {
  members: { user_id: string; name: string; monthly_income: number; monthly_expense: number }[]
}) {
  const W = 600
  const H = 200
  const PAD = 40
  const rows: { label: string; key: 'monthly_income' | 'monthly_expense' }[] = [
    { label: 'Entrate', key: 'monthly_income' },
    { label: 'Uscite', key: 'monthly_expense' },
  ]
  const maxV = Math.max(
    rows.reduce((mx, r) => Math.max(mx, members.reduce((s, m) => s + m[r.key], 0)), 0),
    1,
  )
  const barW = 80
  const gap = 120

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 260 }}>
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
      {rows.map((row, rIdx) => {
        let cum = 0
        const x = PAD + 40 + rIdx * gap
        return (
          <g key={row.key}>
            {members.map((m, i) => {
              const v = m[row.key]
              const h = (v / maxV) * (H - PAD * 2)
              const y = H - PAD - cum - h
              cum += h
              return (
                <rect
                  key={m.user_id}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  fill={COLORS[i % COLORS.length]}
                >
                  <title>
                    {m.name}: € {v.toFixed(2)}
                  </title>
                </rect>
              )
            })}
            <text x={x + barW / 2} y={H - PAD + 14} textAnchor="middle" fontSize={11} fill="#6b7280">
              {row.label}
            </text>
          </g>
        )
      })}
      <g fontSize={11}>
        {members.map((m, i) => (
          <g key={m.user_id} transform={`translate(${W - 160}, ${10 + i * 18})`}>
            <rect width={10} height={10} fill={COLORS[i % COLORS.length]} />
            <text x={14} y={10} fill="#374151">
              {m.name}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}

export default FinanceHouse
