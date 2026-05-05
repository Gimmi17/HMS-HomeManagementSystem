import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { type EventInput, type EventContentArg } from '@fullcalendar/core'
import { simulate, DEFAULTS, STORAGE_KEY, DAYS_PER_MONTH, type SimSeries } from '@/utils/compoundSimulate'

const fmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtE = (v: number) => '€' + fmt.format(v)

function loadParams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

function buildEvents(series: SimSeries, startDate: Date): EventInput[] {
  const events: EventInput[] = []
  const days = series.capital.length

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)

    const capital = series.capital[i]
    const net = series.net_value[i]
    const injection = series.injection[i]
    const withdrawal = series.withdrawal_gross[i]
    const phase = series.phase[i]

    // Proiezione chiusura giornata
    events.push({
      id: `proj-${i}`,
      title: `${fmtE(capital)} cap | ${fmtE(net)} net`,
      start: dateStr,
      allDay: true,
      extendedProps: { type: 'projection', capital, net, phase },
      display: 'block',
    })

    // TODO: iniezione mensile
    if (injection > 10) {
      events.push({
        id: `inj-${i}`,
        title: `Deposita ${fmtE(injection)} nel bot`,
        start: dateStr,
        allDay: true,
        extendedProps: { type: 'todo-inject' },
        display: 'block',
      })
    }

    // TODO: prelievo cashflow
    if (withdrawal > 10) {
      events.push({
        id: `wdraw-${i}`,
        title: `Preleva cashflow ${fmtE(withdrawal)}`,
        start: dateStr,
        allDay: true,
        extendedProps: { type: 'todo-withdraw' },
        display: 'block',
      })
    }
  }

  // Loan payment todos: every 30 days if loan is active
  const params = loadParams()
  if (params.loanAmount > 0 && params.loanMonths > 0) {
    const mp = series.cum_loan_payments
    for (let i = DAYS_PER_MONTH - 1; i < days; i += DAYS_PER_MONTH) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const monthIdx = Math.floor(i / DAYS_PER_MONTH)
      if (monthIdx < params.loanMonths) {
        const monthPayment = monthIdx === 0
          ? mp[i]
          : mp[i] - mp[i - DAYS_PER_MONTH]
        if (monthPayment > 1) {
          events.push({
            id: `loan-${i}`,
            title: `Rata prestito ${fmtE(monthPayment)}`,
            start: dateStr,
            allDay: true,
            extendedProps: { type: 'todo-loan' },
            display: 'block',
          })
        }
      }
    }
  }

  return events
}

function EventContent({ info }: { info: EventContentArg }) {
  const type = info.event.extendedProps.type as string

  if (type === 'projection') {
    const { capital, net, phase } = info.event.extendedProps as { capital: number; net: number; phase: string }
    const isGrowth = net > 0
    return (
      <div className="cal-proj-event">
        <div className="cal-proj-capital">{fmtE(capital)}</div>
        <div className={`cal-proj-net ${isGrowth ? 'pos' : 'neg'}`}>net {fmtE(net)}</div>
        {phase && phase !== 'growth' && <div className="cal-proj-phase">{phase}</div>}
      </div>
    )
  }

  const colorMap: Record<string, string> = {
    'todo-inject': '#6366f1',
    'todo-withdraw': '#10b981',
    'todo-loan': '#f59e0b',
  }
  const bg = colorMap[type] ?? '#6b7280'

  return (
    <div className="cal-todo-event" style={{ background: bg }}>
      {info.event.title}
    </div>
  )
}

export function FinanceCalendar() {
  const [startDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const params = useMemo(() => loadParams(), [])
  const result = useMemo(() => simulate(params), [params])
  const events = useMemo(() => buildEvents(result.series, startDate), [result, startDate])

  const certStartDate = startDate.toISOString().slice(0, 10)

  return (
    <div className="p-4 max-w-full">
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Calendario Proiezioni</h1>
        <div className="flex gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#e5e7eb', border: '1px solid #9ca3af' }} />
            Chiusura giornata
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-indigo-500" />
            Deposita nel bot
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-emerald-500" />
            Preleva cashflow
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-amber-500" />
            Rata prestito
          </span>
        </div>
      </div>

      <style>{`
        .fc-daygrid-event { margin: 1px 0 !important; }
        .cal-proj-event {
          padding: 1px 4px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 3px;
          font-size: 10px;
          line-height: 1.3;
        }
        .cal-proj-capital { font-weight: 600; color: #1f2937; }
        .cal-proj-net { color: #6b7280; }
        .cal-proj-net.pos { color: #059669; }
        .cal-proj-net.neg { color: #dc2626; }
        .cal-proj-phase {
          font-size: 9px;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 2px;
          padding: 0 2px;
          display: inline-block;
        }
        .cal-todo-event {
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 10px;
          color: white;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc-col-header-cell-cushion { font-size: 12px; }
        .fc-daygrid-day-number { font-size: 12px; }
      `}</style>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={certStartDate}
        events={events}
        eventContent={(info) => <EventContent info={info} />}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth',
        }}
        height="auto"
        dayMaxEvents={false}
        locale="it"
        buttonText={{ today: 'Oggi' }}
      />
    </div>
  )
}
