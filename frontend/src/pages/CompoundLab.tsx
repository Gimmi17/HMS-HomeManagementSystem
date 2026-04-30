import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title,
  type ChartOptions,
  type ChartData,
  type Plugin,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import tradingService, { type BalancePoint, type TradingSummary } from '@/services/trading'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title,
)

// ─── Palette (chart colors — independent of UI theme) ──────────────────────
const COL = {
  emerald: '#10b981',
  emeraldFill: 'rgba(16, 185, 129, 0.15)',
  amber: '#f59e0b',
  amberFill: 'rgba(245, 158, 11, 0.15)',
  rose: '#f43f5e',
  roseFill: 'rgba(244, 63, 94, 0.12)',
  sky: '#0ea5e9',
  indigo: '#6366f1',
  violet: '#a78bfa',
  violetFill: 'rgba(167, 139, 250, 0.15)',
  slate: '#9ca3af',
  axis: '#6b7280',
  grid: 'rgba(209, 213, 219, 0.5)',
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Params {
  daily: number
  horizon: number
  cap0: number
  bigPct: number
  bigPer: number
  smallPct: number
  smallPer: number
  budget: number
  floor: number
  coef: number
  boostBudget: number
  boostMonths: number
  wPct: number
  wTarget: number
  beta: number
  alpha: number
  rf: number
  rebuildAlpha: number
  rebuildTrigger: number
  loanAmount: number
  loanTAEG: number
  loanMonths: number
  loanToBuffer: number
  bufferLeverage: number
  bufferLeverageFloor: number
  bufferMax: number
  phaseSwitchMonth: number
  budgetPhase2: number
  payoffFundPct: number
  loanPayedBySystem: boolean
}

interface SimSeries {
  day: number[]
  month: number[]
  capital: number[]
  buffer: number[]
  net_value: number[]
  cum_crash_loss: number[]
  cum_buffer_deploy: number[]
  cum_cashflow_net: number[]
  cum_withdrawn_gross: number[]
  cum_loan_payments: number[]
  injection: number[]
  withdrawal_gross: number[]
  target_buffer: number[]
  phase: string[]
  crash_big: boolean[]
  crash_small: boolean[]
  rebuild_mode: boolean[]
  loan_outstanding: number[]
}

interface SimMetrics {
  final_capital: number
  final_buffer: number
  net_value: number
  net_value_gross: number
  total_injected: number
  total_out_of_pocket: number
  cumWithdrawnGross: number
  cumCashflowNet: number
  cumCrashLoss: number
  cumBufferDeploy: number
  cumBufferRefill: number
  cumLoanPayments: number
  outstandingLoanEnd: number
  monthlyPayment: number
  loanInterestTotal: number
  loanBreakEven: number
  cumBufferLeveraged: number
  cumBufferOverflow: number
  breakEvenReachedMonth: number | null
  cumDeficitCoveredBySystem: number
  payoffFundFinal: number
  loanInterestPaid: number
  loanPaidEarly: boolean
  earlyPayoffMonth: number | null
  net_profit: number
  roi: number
  cagr_net: number
  theoretical_monthly: number
  effective_monthly: number
  drag_pct_points: number
  threshold: number
  first_cashflow_day: number | null
  first_cashflow_month: number | null
  days_total: number
  milestones: Record<number, number>
  rebuild_days: number
}

interface SimResult {
  series: SimSeries
  metrics: SimMetrics
}

// ─── Defaults (match original HTML exactly) ──────────────────────────────────
const DEFAULTS: Params = {
  daily: 0.4,
  horizon: 48,
  cap0: 300,
  bigPct: 10,
  bigPer: 90,
  smallPct: 2,
  smallPer: 21,
  budget: 800,
  floor: 200,
  coef: 3,
  boostBudget: 800,
  boostMonths: 0,
  wPct: 3,
  wTarget: 500,
  beta: 5,
  alpha: 30,
  rf: 75,
  rebuildAlpha: 30,
  rebuildTrigger: 0,
  loanAmount: 5000,
  loanTAEG: 7.3,
  loanMonths: 48,
  loanToBuffer: 100,
  bufferLeverage: 500,
  bufferLeverageFloor: 2000,
  bufferMax: 6000,
  phaseSwitchMonth: 4,
  budgetPhase2: 200,
  payoffFundPct: 50,
  loanPayedBySystem: true,
}

const DAYS_PER_MONTH = 30
const STORAGE_KEY = 'hms_compound_lab_v2_config'

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const fmt1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })
const fmt2 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })

// ─── Simulation engine ───────────────────────────────────────────────────────
function computeMonthlyPayment(amount: number, taegPct: number, months: number): number {
  if (amount <= 0 || months <= 0) return 0
  if (taegPct === 0) return amount / months
  const i = Math.pow(1 + taegPct / 100, 1 / 12) - 1
  return (amount * i) / (1 - Math.pow(1 + i, -months))
}

function simulate(params: Params, skipCrashes = false): SimResult {
  const {
    daily, horizon, cap0,
    bigPct, bigPer, smallPct, smallPer,
    budget, floor, coef,
    boostBudget, boostMonths,
    wPct, wTarget,
    beta, alpha, rf,
    rebuildAlpha, rebuildTrigger,
    loanAmount, loanTAEG, loanMonths, loanToBuffer,
    bufferLeverage, bufferLeverageFloor, bufferMax,
    phaseSwitchMonth, budgetPhase2, loanPayedBySystem, payoffFundPct,
  } = params

  const days = Math.round(horizon * DAYS_PER_MONTH)
  const dailyRet = daily / 100
  const bigLoss = bigPct / 100
  const smallLoss = smallPct / 100
  const coefR = coef / 100
  const wPctR = wPct / 100
  const betaR = beta / 100
  const alphaR = alpha / 100
  const rebuildAlphaR = rebuildAlpha / 100
  const rebuildTriggerR = rebuildTrigger / 100
  const rfR = rf / 100
  const threshold = wTarget / wPctR
  const loanToBufferR = loanToBuffer / 100

  const loanI = loanTAEG > 0 ? Math.pow(1 + loanTAEG / 100, 1 / 12) - 1 : 0
  const monthlyPayment = computeMonthlyPayment(loanAmount, loanTAEG, loanMonths)
  const totalToRepay = monthlyPayment * loanMonths
  const loanInterestTotal = totalToRepay - loanAmount
  const loanBreakEven = totalToRepay
  let loanCapitalRemaining = loanAmount
  let loanInterestPaid = 0
  let loanPaidEarly = false
  let earlyPayoffMonth: number | null = null
  let payoffFund = 0
  const payoffPctR = payoffFundPct / 100

  let capital = cap0 + loanAmount * (1 - loanToBufferR)
  let buffer = loanAmount * loanToBufferR
  let cumInjected = 0
  let cumWithdrawnGross = 0
  let cumCashflowNet = 0
  let cumCrashLoss = 0
  let cumBufferDeploy = 0
  let cumBufferRefill = 0
  let cumLoanPayments = 0
  let cumDeficitCoveredBySystem = 0
  let cumBufferLeveraged = 0
  let cumBufferOverflow = 0
  let breakEvenReachedMonth: number | null = null
  let firstCashflowDay: number | null = null
  let inRebuildMode = false
  let rebuildDays = 0

  const msTargets = [500, 1000, 2000, 3000, 5000, 10000]
  const msReached: Record<number, number> = {}

  const series: SimSeries = {
    day: [], month: [],
    capital: [], buffer: [], net_value: [],
    cum_crash_loss: [], cum_buffer_deploy: [],
    cum_cashflow_net: [], cum_withdrawn_gross: [],
    cum_loan_payments: [],
    injection: [], withdrawal_gross: [],
    target_buffer: [],
    phase: [],
    crash_big: [], crash_small: [],
    rebuild_mode: [],
    loan_outstanding: [],
  }

  for (let d = 1; d <= days; d++) {
    capital *= 1 + dailyRet

    let dayCrashLoss = 0
    let isBigCrash = false, isSmallCrash = false
    if (!skipCrashes && d % bigPer === 0) {
      const loss = capital * bigLoss
      capital -= loss
      dayCrashLoss += loss
      isBigCrash = true
    }
    if (!skipCrashes && d % smallPer === 0) {
      const loss = capital * smallLoss
      capital -= loss
      dayCrashLoss += loss
      isSmallCrash = true
    }
    cumCrashLoss += dayCrashLoss

    let dayBufferDeploy = 0
    if (dayCrashLoss > 0 && buffer > 0) {
      const targetDeploy = dayCrashLoss * rfR
      dayBufferDeploy = Math.min(buffer, targetDeploy)
      capital += dayBufferDeploy
      buffer -= dayBufferDeploy
      cumBufferDeploy += dayBufferDeploy
    }

    let dayInjection = 0, dayWithdrawGross = 0, dayCashflowNet = 0, dayBufferRefill = 0
    let outstandingLoan = loanCapitalRemaining
    if (d % DAYS_PER_MONTH === 1 || d === 1) {
      const monthIdx = Math.floor((d - 1) / DAYS_PER_MONTH) + 1
      const inCashflow = capital >= threshold
      const monthlyTargetBuffer = capital * betaR
      const inPhase2 = phaseSwitchMonth > 0 && monthIdx > phaseSwitchMonth

      let currentBudget: number
      if (boostMonths > 0 && monthIdx <= boostMonths) currentBudget = boostBudget
      else if (inPhase2) currentBudget = budgetPhase2
      else currentBudget = budget

      let actualPayment = 0
      if (loanCapitalRemaining > 0 && monthIdx <= loanMonths) {
        const interestPayment = loanCapitalRemaining * loanI
        let principalPayment = monthlyPayment - interestPayment
        if (principalPayment > loanCapitalRemaining) {
          principalPayment = loanCapitalRemaining
          actualPayment = principalPayment + interestPayment
        } else {
          actualPayment = monthlyPayment
        }
        loanCapitalRemaining -= principalPayment
        loanInterestPaid += interestPayment
        cumLoanPayments += actualPayment
      }
      outstandingLoan = loanCapitalRemaining

      if (!inCashflow) {
        let budgetAvailable = currentBudget
        let deficitToCover = 0

        if (inPhase2 && loanPayedBySystem && actualPayment > 0) {
          budgetAvailable = currentBudget - actualPayment
          if (budgetAvailable < 0) {
            deficitToCover = -budgetAvailable
            budgetAvailable = 0
          }
        }

        if (deficitToCover > 0) {
          const fromBuffer = Math.min(buffer, deficitToCover)
          buffer -= fromBuffer
          const remaining = deficitToCover - fromBuffer
          capital -= remaining
          cumDeficitCoveredBySystem += deficitToCover
        }

        if (budgetAvailable > 0) {
          let inj = Math.max(floor, budgetAvailable - coefR * capital)
          inj = Math.min(inj, budgetAvailable)
          const bufferContrib = budgetAvailable - inj
          capital += inj
          cumInjected += inj
          dayInjection = inj

          if (bufferMax > 0 && buffer + bufferContrib > bufferMax) {
            const toBuffer = Math.max(0, bufferMax - buffer)
            const toCapital = bufferContrib - toBuffer
            buffer += toBuffer
            capital += toCapital
            cumBufferOverflow += toCapital
          } else {
            buffer += bufferContrib
          }
        }

        if (bufferLeverage > 0 && loanAmount > 0 && capital < loanBreakEven && !inPhase2) {
          const available = Math.max(0, buffer - bufferLeverageFloor)
          const leverage = Math.min(bufferLeverage, available)
          if (leverage > 0) {
            buffer -= leverage
            capital += leverage
            cumBufferLeveraged += leverage
          }
        }

        if (breakEvenReachedMonth === null && loanAmount > 0 && capital >= loanBreakEven) {
          breakEvenReachedMonth = monthIdx
        }
      } else {
        if (firstCashflowDay === null) firstCashflowDay = d
        const wGross = capital * wPctR
        capital -= wGross
        cumWithdrawnGross += wGross
        dayWithdrawGross = wGross

        let wAfterLoan = wGross
        if (inPhase2 && loanPayedBySystem && actualPayment > 0) {
          wAfterLoan -= actualPayment
          if (wAfterLoan < 0) {
            const deficit = -wAfterLoan
            const fromBuffer = Math.min(buffer, deficit)
            buffer -= fromBuffer
            const remaining = deficit - fromBuffer
            capital -= remaining
            cumDeficitCoveredBySystem += deficit
            wAfterLoan = 0
          }
        }

        inRebuildMode = buffer < monthlyTargetBuffer * rebuildTriggerR
        const effectiveAlpha = inRebuildMode ? rebuildAlphaR : alphaR
        let refill = 0
        if (buffer < monthlyTargetBuffer && wAfterLoan > 0) {
          refill = Math.min(wAfterLoan * effectiveAlpha, monthlyTargetBuffer - buffer)
          if (bufferMax > 0) {
            refill = Math.min(refill, Math.max(0, bufferMax - buffer))
          }
          buffer += refill
          cumBufferRefill += refill
        }
        const wAfterRefill = Math.max(0, wAfterLoan - refill)

        let toPayoff = 0
        if (inPhase2 && loanCapitalRemaining > 0 && payoffPctR > 0 && wAfterRefill > 0) {
          toPayoff = wAfterRefill * payoffPctR
          payoffFund += toPayoff

          if (payoffFund >= loanCapitalRemaining) {
            const payoffUsed = loanCapitalRemaining
            cumLoanPayments += payoffUsed
            payoffFund -= payoffUsed
            loanCapitalRemaining = 0
            loanPaidEarly = true
            earlyPayoffMonth = monthIdx
            cumCashflowNet += payoffFund
            payoffFund = 0
          }
        }

        const netCashflow = wAfterRefill - toPayoff
        cumCashflowNet += netCashflow
        dayCashflowNet = netCashflow
        dayBufferRefill = refill
        if (inRebuildMode) rebuildDays++
      }
    }

    const currentMonthlyGross = capital >= threshold ? capital * wPctR : 0
    for (const t of msTargets) {
      if (msReached[t] === undefined && currentMonthlyGross >= t) {
        msReached[t] = d
      }
    }

    const netValue = capital + buffer + cumCashflowNet - cumLoanPayments
    series.day.push(d)
    series.month.push(d / DAYS_PER_MONTH)
    series.capital.push(capital)
    series.buffer.push(buffer)
    series.net_value.push(netValue)
    series.cum_crash_loss.push(cumCrashLoss)
    series.cum_buffer_deploy.push(cumBufferDeploy)
    series.cum_cashflow_net.push(cumCashflowNet)
    series.cum_withdrawn_gross.push(cumWithdrawnGross)
    series.cum_loan_payments.push(cumLoanPayments)
    series.injection.push(dayInjection)
    series.withdrawal_gross.push(dayWithdrawGross)
    series.target_buffer.push(capital * betaR)
    series.phase.push(capital >= threshold ? 'cashflow' : 'accumulation')
    series.crash_big.push(isBigCrash)
    series.crash_small.push(isSmallCrash)
    series.rebuild_mode.push(inRebuildMode)
    series.loan_outstanding.push(outstandingLoan)
    void dayCashflowNet; void dayBufferRefill
  }

  const totalOut = cap0 + cumInjected + cumDeficitCoveredBySystem
  const outstandingLoanEnd = loanCapitalRemaining
  const netValue = capital + buffer + payoffFund + cumCashflowNet - totalOut - outstandingLoanEnd
  const netValueGross = capital + buffer + payoffFund + cumCashflowNet
  const netProfit = netValue - totalOut
  const years = horizon / 12
  const cagrNet = totalOut > 0 ? Math.pow(Math.max(1, netValue) / totalOut, 1 / years) - 1 : 0
  const theoreticalMonthly = Math.pow(1 + dailyRet, DAYS_PER_MONTH) - 1
  const effectiveMonthly = Math.pow(Math.max(1, netValue) / cap0, 1 / horizon) - 1

  return {
    series,
    metrics: {
      final_capital: capital,
      final_buffer: buffer,
      net_value: netValue,
      net_value_gross: netValueGross,
      total_injected: cumInjected,
      total_out_of_pocket: totalOut,
      cumWithdrawnGross, cumCashflowNet, cumCrashLoss, cumBufferDeploy, cumBufferRefill,
      cumLoanPayments, outstandingLoanEnd,
      monthlyPayment, loanInterestTotal, loanBreakEven,
      cumBufferLeveraged, cumBufferOverflow,
      breakEvenReachedMonth,
      cumDeficitCoveredBySystem,
      payoffFundFinal: payoffFund,
      loanInterestPaid,
      loanPaidEarly, earlyPayoffMonth,
      net_profit: netProfit,
      roi: totalOut > 0 ? netProfit / totalOut : 0,
      cagr_net: cagrNet,
      theoretical_monthly: theoreticalMonthly,
      effective_monthly: effectiveMonthly,
      drag_pct_points: (theoreticalMonthly - effectiveMonthly) * 100,
      threshold,
      first_cashflow_day: firstCashflowDay,
      first_cashflow_month: firstCashflowDay ? firstCashflowDay / DAYS_PER_MONTH : null,
      days_total: Math.round(horizon * DAYS_PER_MONTH),
      milestones: msReached,
      rebuild_days: rebuildDays,
    },
  }
}

// ─── Down-sampling ──────────────────────────────────────────────────────────
function seriesToXY(series: number[], horizon: number, maxPoints = 600): { x: number; y: number }[] {
  const len = series.length
  if (len === 0) return []
  const step = Math.max(1, Math.ceil(len / maxPoints))
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < len; i += step) {
    out.push({ x: (i + 1) / DAYS_PER_MONTH, y: series[i] })
  }
  const lastX = horizon
  if (out.length === 0 || out[out.length - 1].x !== lastX) {
    out.push({ x: lastX, y: series[len - 1] })
  }
  return out
}

// ─── Sensitivity config ──────────────────────────────────────────────────────
type SensParam = keyof Omit<Params, 'loanPayedBySystem'>
type SensMetric = 'net_value' | 'cashflow_net' | 'final_capital' | 'cagr_net' | 'first_cashflow_month'

const SENS_RANGES: Record<SensParam, { min: number; max: number; step: number; label: string }> = {
  daily: { min: 0, max: 1, step: 0.02, label: 'daily return (%)' },
  horizon: { min: 6, max: 120, step: 6, label: 'orizzonte (mesi)' },
  cap0: { min: 0, max: 5000, step: 100, label: 'capitale iniziale (€)' },
  bigPct: { min: 0, max: 40, step: 1, label: 'crash grande (%)' },
  bigPer: { min: 14, max: 365, step: 15, label: 'crash grande (gg)' },
  smallPct: { min: 0, max: 15, step: 0.5, label: 'crash piccolo (%)' },
  smallPer: { min: 3, max: 90, step: 5, label: 'crash piccolo (gg)' },
  alpha: { min: 0, max: 100, step: 2, label: 'α (%)' },
  beta: { min: 0, max: 30, step: 0.5, label: 'β (%)' },
  rf: { min: 0, max: 100, step: 2, label: 'RF (%)' },
  coef: { min: 0, max: 10, step: 0.2, label: 'coef adaptive (%)' },
  floor: { min: 0, max: 1000, step: 25, label: 'floor (€)' },
  wPct: { min: 0.5, max: 8, step: 0.2, label: 'prelievo %' },
  wTarget: { min: 100, max: 3000, step: 50, label: 'target € / mese' },
  budget: { min: 100, max: 2000, step: 25, label: 'budget € / mese' },
  boostBudget: { min: 500, max: 5000, step: 100, label: 'boost budget (€)' },
  boostMonths: { min: 0, max: 24, step: 1, label: 'boost durata (mesi)' },
  rebuildAlpha: { min: 0, max: 100, step: 2, label: 'α rebuild (%)' },
  rebuildTrigger: { min: 0, max: 100, step: 5, label: 'rebuild trigger (%)' },
  loanAmount: { min: 0, max: 10000, step: 250, label: 'prestito (€)' },
  loanTAEG: { min: 0, max: 15, step: 0.2, label: 'TAEG (%)' },
  loanMonths: { min: 6, max: 120, step: 6, label: 'durata prestito (mesi)' },
  loanToBuffer: { min: 0, max: 100, step: 5, label: 'prestito → buffer (%)' },
  bufferLeverage: { min: 0, max: 2000, step: 50, label: 'leverage (€/m)' },
  bufferLeverageFloor: { min: 0, max: 5000, step: 100, label: 'leverage floor (€)' },
  bufferMax: { min: 0, max: 20000, step: 500, label: 'cap buffer (€)' },
  phaseSwitchMonth: { min: 0, max: 24, step: 1, label: 'switch month' },
  budgetPhase2: { min: 0, max: 800, step: 25, label: 'budget fase 2 (€)' },
  payoffFundPct: { min: 0, max: 100, step: 5, label: 'payoff fund (%)' },
}

const SENS_LABELS: Record<SensMetric, { lbl: string; fmt: (v: number) => string }> = {
  net_value: { lbl: 'net value €', fmt: v => '€ ' + fmt.format(v) },
  cashflow_net: { lbl: 'cashflow netto €', fmt: v => '€ ' + fmt.format(v) },
  final_capital: { lbl: 'capitale finale €', fmt: v => '€ ' + fmt.format(v) },
  cagr_net: { lbl: 'CAGR netto %', fmt: v => (v * 100).toFixed(2) + '%' },
  first_cashflow_month: { lbl: 'mese primo cashflow', fmt: v => (v ? 'mese ' + fmt1.format(v) : 'mai') },
}

// ─── Control spec ────────────────────────────────────────────────────────────
interface ControlDef {
  key: keyof Params
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

const CONTROL_SECTIONS: { title: string; note?: string; controls: ControlDef[]; extra?: (p: Params) => React.ReactNode }[] = [
  {
    title: '◉ Growth',
    controls: [
      { key: 'daily', label: 'Daily return', min: 0, max: 1, step: 0.01, format: v => v.toFixed(2) + '%' },
      { key: 'horizon', label: 'Orizzonte (mesi)', min: 6, max: 120, step: 1, format: v => fmt.format(v) },
      { key: 'cap0', label: 'Capitale iniziale €', min: 0, max: 5000, step: 50, format: v => fmt.format(v) },
    ],
  },
  {
    title: '◉ Crash events',
    controls: [
      { key: 'bigPct', label: 'Crash grande %', min: 0, max: 40, step: 0.5, format: v => v.toFixed(1) + '%' },
      { key: 'bigPer', label: 'Crash grande · ogni N giorni', min: 14, max: 365, step: 1, format: v => fmt.format(v) },
      { key: 'smallPct', label: 'Crash piccolo %', min: 0, max: 15, step: 0.1, format: v => v.toFixed(1) + '%' },
      { key: 'smallPer', label: 'Crash piccolo · ogni N giorni', min: 3, max: 90, step: 1, format: v => fmt.format(v) },
    ],
  },
  {
    title: '◉ Injection (accumulation)',
    controls: [
      { key: 'budget', label: 'Budget mensile €', min: 0, max: 2000, step: 10, format: v => fmt.format(v) },
      { key: 'floor', label: 'Floor iniezione €', min: 0, max: 1000, step: 10, format: v => fmt.format(v) },
      { key: 'coef', label: 'Coef adaptive (× capitale)', min: 0, max: 10, step: 0.1, format: v => v.toFixed(2) + '%' },
    ],
  },
  {
    title: '◉ Boost iniziale',
    note: 'Sacrificio iniziale: budget più alto per N mesi per accelerare il cashflow. Durata = 0 per disabilitare.',
    controls: [
      { key: 'boostBudget', label: 'Boost budget €', min: 0, max: 5000, step: 50, format: v => fmt.format(v) },
      { key: 'boostMonths', label: 'Durata boost (mesi)', min: 0, max: 24, step: 1, format: v => fmt.format(v) },
    ],
  },
  {
    title: '◉ Cashflow phase',
    controls: [
      { key: 'wPct', label: 'Prelievo mensile %', min: 0.1, max: 10, step: 0.1, format: v => v.toFixed(2) + '%' },
      { key: 'wTarget', label: 'Target prelievo €/mese', min: 100, max: 5000, step: 50, format: v => fmt.format(v) },
    ],
    extra: (p) => (
      <div className="text-xs text-gray-500 mt-1">
        soglia auto: <span className="text-amber-600">€ {fmt.format(p.wTarget / (p.wPct / 100))}</span>
      </div>
    ),
  },
  {
    title: '◉ Buffer logic',
    controls: [
      { key: 'beta', label: 'Target β (% capitale)', min: 0, max: 30, step: 0.5, format: v => v.toFixed(1) + '%' },
      { key: 'alpha', label: 'α refill (% del prelievo)', min: 0, max: 100, step: 1, format: v => fmt.format(v) + '%' },
      { key: 'rf', label: 'Recovery factor', min: 0, max: 100, step: 1, format: v => fmt.format(v) + '%' },
    ],
  },
  {
    title: '◉ Rebuild mode',
    note: 'Quando il buffer scende sotto la soglia trigger, α sale automaticamente al valore rebuild per ricostruirlo rapidamente.',
    controls: [
      { key: 'rebuildAlpha', label: 'α rebuild (% del prelievo)', min: 0, max: 100, step: 1, format: v => fmt.format(v) + '%' },
      { key: 'rebuildTrigger', label: 'Trigger (% del target β)', min: 0, max: 100, step: 5, format: v => fmt.format(v) + '%' },
    ],
  },
  {
    title: '◉ Prestito (opzionale)',
    note: 'Seed in prestito al giorno 1. La rata mensile viene sottratta dal net value. Amount = 0 per disabilitare.',
    controls: [
      { key: 'loanAmount', label: 'Importo prestito €', min: 0, max: 10000, step: 100, format: v => fmt.format(v) },
      { key: 'loanTAEG', label: 'TAEG %', min: 0, max: 15, step: 0.1, format: v => v.toFixed(1) + '%' },
      { key: 'loanMonths', label: 'Durata (mesi)', min: 6, max: 120, step: 1, format: v => fmt.format(v) },
      { key: 'loanToBuffer', label: '% al buffer', min: 0, max: 100, step: 5, format: v => fmt.format(v) + '%' },
    ],
    extra: (p) => (
      <div className="text-xs text-gray-500 mt-1">
        rata calcolata: <span className="text-amber-600">€ {fmt.format(computeMonthlyPayment(p.loanAmount, p.loanTAEG, p.loanMonths))}</span> /mese
      </div>
    ),
  },
  {
    title: '◉ Leveraged ramp-up',
    note: 'In accumulo, preleva N €/m dal buffer e li mette in capitale. Si auto-disattiva quando capitale ≥ break-even prestito. Safeguard: mai sotto il floor.',
    controls: [
      { key: 'bufferLeverage', label: 'Leverage mensile €', min: 0, max: 2000, step: 50, format: v => fmt.format(v) },
      { key: 'bufferLeverageFloor', label: 'Floor buffer € (stop leverage)', min: 0, max: 5000, step: 100, format: v => fmt.format(v) },
      { key: 'bufferMax', label: 'Cap buffer € (0 = nessun cap)', min: 0, max: 20000, step: 250, format: v => fmt.format(v) },
    ],
  },
  {
    title: '◉ Two-phase strategy',
    note: 'Fase 1 (1 → switchMonth): budget normale. Fase 2 (switchMonth+1 → fine): budget ridotto, rata coperta dal sistema. Switch = 0 disattiva.',
    controls: [
      { key: 'phaseSwitchMonth', label: 'Mese di switch (0 = OFF)', min: 0, max: 24, step: 1, format: v => fmt.format(v) },
      { key: 'budgetPhase2', label: 'Budget fase 2 €/m', min: 0, max: 800, step: 25, format: v => fmt.format(v) },
      { key: 'payoffFundPct', label: 'Payoff fund (% cashflow)', min: 0, max: 100, step: 5, format: v => fmt.format(v) + '%' },
    ],
  },
]

// ─── Slider control ──────────────────────────────────────────────────────────
function SliderInput({
  def, value, onChange,
}: {
  def: ControlDef
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline text-xs text-gray-600 mb-1">
        <span>{def.label}</span>
        <span className="text-primary-700 font-medium tabular-nums">{def.format(value)}</span>
      </div>
      <div className="grid grid-cols-[1fr_70px] gap-2 items-center">
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full accent-primary-600 h-1.5 bg-gray-200 rounded cursor-pointer"
        />
        <input
          type="number"
          step={def.step}
          value={value}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!Number.isNaN(v)) onChange(v)
          }}
          className="w-full bg-white text-gray-900 border border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 px-2 py-1 text-xs rounded"
        />
      </div>
    </div>
  )
}

// ─── Tile component ──────────────────────────────────────────────────────────
type TileCls = 'pos' | 'neu' | 'neg'
function MetricTile({ k, v, cls, sub }: { k: string; v: string; cls: TileCls; sub: string }) {
  const color = cls === 'pos' ? 'text-emerald-600' : cls === 'neg' ? 'text-red-600' : 'text-amber-600'
  return (
    <div className="p-4 border-r border-gray-200 last:border-r-0">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{k}</div>
      <div className={`text-2xl font-bold leading-tight tabular-nums ${color}`}>{v}</div>
      <div className="text-[11px] text-gray-500 mt-1">{sub}</div>
    </div>
  )
}

// ─── Chart common options ────────────────────────────────────────────────────
function baseChartOptions(horizon: number, extra?: Partial<ChartOptions<'line'>>): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: horizon,
        title: { display: true, text: 'mese', color: COL.axis, font: { size: 10 } },
        ticks: { color: COL.axis },
        grid: { color: COL.grid },
      },
      y: {
        type: 'linear',
        ticks: { callback: v => fmt.format(Number(v)), color: COL.axis },
        grid: { color: COL.grid },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 20, font: { size: 10 }, color: '#9ca3af' },
      },
      tooltip: {
        backgroundColor: '#111827',
        borderColor: '#374151',
        borderWidth: 1,
        titleColor: '#e5e7eb',
        bodyColor: '#e5e7eb',
        callbacks: {
          title: items => `mese ${fmt2.format(Number(items[0].parsed.x ?? 0))}`,
          label: ctx => `${ctx.dataset.label}: € ${fmt.format(Number(ctx.parsed.y ?? 0))}`,
        },
      },
    },
    ...extra,
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export function CompoundLab() {
  const [params, setParams] = useState<Params>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Params>
        return { ...DEFAULTS, ...saved }
      }
    } catch { /* noop */ }
    return DEFAULTS
  })

  const [equityHidden, setEquityHidden] = useState<Record<string, boolean>>({
    no_dd: true, net_value: false, capital: false, buffer: false, real: false,
  })
  const [equityScale, setEquityScale] = useState<'linear' | 'logarithmic'>('linear')
  const [sensParam, setSensParam] = useState<SensParam>('beta')
  const [sensMetric, setSensMetric] = useState<SensMetric>('net_value')
  const [optimizing, setOptimizing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('')
  const saveTimer = useRef<number | null>(null)

  // ── Real trading data from android-trader-monitor ──
  const [realSummary, setRealSummary] = useState<TradingSummary | null>(null)
  const [realHistory, setRealHistory] = useState<BalancePoint[]>([])
  const [realLoading, setRealLoading] = useState(true)
  const [realError, setRealError] = useState('')

  const loadRealData = useCallback(async () => {
    setRealLoading(true)
    setRealError('')
    try {
      const [summary, history] = await Promise.all([
        tradingService.getSummary(),
        tradingService.getBalanceHistory(undefined, 2000),
      ])
      setRealSummary(summary)
      setRealHistory(history)
    } catch {
      setRealError('Trader monitor offline')
    } finally {
      setRealLoading(false)
    }
  }, [])

  useEffect(() => { loadRealData() }, [loadRealData])

  // Map real balance history to simulation months axis
  // Uses the earliest data point as month 0, then calculates elapsed months
  const realEquityPoints = useMemo(() => {
    if (realHistory.length < 2) return []
    // Aggregate by timestamp: sum all traders' balance per unique timestamp
    const byTime = new Map<string, number>()
    for (const pt of realHistory) {
      const key = pt.captured_at
      byTime.set(key, (byTime.get(key) || 0) + (pt.balance_total ?? 0))
    }
    const sorted = [...byTime.entries()]
      .map(([ts, bal]) => ({ ts: new Date(ts).getTime(), bal }))
      .filter(p => p.bal > 0) // filter out zero/null
      .sort((a, b) => a.ts - b.ts)
    if (sorted.length < 2) return []
    const t0 = sorted[0].ts
    const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000
    return sorted.map(p => ({
      x: (p.ts - t0) / MS_PER_MONTH,
      y: p.bal,
    }))
  }, [realHistory])

  const update = <K extends keyof Params>(key: K, value: Params[K]) => {
    setParams(p => ({ ...p, [key]: value }))
  }

  const flashStatus = (msg: string) => {
    setSaveStatus(msg)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaveStatus(''), 2500)
  }

  const result = useMemo(() => simulate(params), [params])
  const resultNoDD = useMemo(() => simulate(params, true), [params])
  const m = result.metrics

  // Tiles
  const tiles: { k: string; v: string; cls: TileCls; sub: string }[] = useMemo(() => {
    const hasLoan = params.loanAmount > 0
    const hasLeverage = params.bufferLeverage > 0 && hasLoan
    const hasTwoPhase = params.phaseSwitchMonth > 0
    const hasPayoff = params.payoffFundPct > 0 && hasLoan
    if (hasTwoPhase && hasPayoff) {
      return [
        { k: 'Net Value finale', v: '€ ' + fmt.format(m.net_value), cls: m.net_value > 0 ? 'pos' : 'neg',
          sub: `cashflow tasca: € ${fmt.format(m.cumCashflowNet)} · debito residuo: € ${fmt.format(m.outstandingLoanEnd)}` },
        { k: 'Early payoff prestito', v: m.earlyPayoffMonth ? 'mese ' + m.earlyPayoffMonth : '—', cls: m.loanPaidEarly ? 'pos' : 'neu',
          sub: `interessi pagati: € ${fmt.format(m.loanInterestPaid)} · payoff fund: € ${fmt.format(m.payoffFundFinal)}` },
        { k: 'Prima fase cashflow', v: m.first_cashflow_month ? 'mese ' + fmt1.format(m.first_cashflow_month) : '—', cls: 'pos',
          sub: `soglia: € ${fmt.format(m.threshold)}` },
        { k: 'Deficit coperto sistema', v: '€ ' + fmt.format(m.cumDeficitCoveredBySystem), cls: m.cumDeficitCoveredBySystem > 0 ? 'neu' : 'pos',
          sub: `quando rata > budget fase 2 (${fmt.format(params.budgetPhase2)}€)` },
      ]
    }
    if (hasLeverage) {
      return [
        { k: 'Net Value (netto prestito)', v: '€ ' + fmt.format(m.net_value), cls: m.net_value > 0 ? 'pos' : 'neg',
          sub: `lordo: € ${fmt.format(m.net_value_gross)} · leverage tot: € ${fmt.format(m.cumBufferLeveraged)}` },
        { k: 'Break-even prestito', v: m.breakEvenReachedMonth ? 'mese ' + m.breakEvenReachedMonth : '—', cls: 'pos',
          sub: `soglia: € ${fmt.format(m.loanBreakEven)} · rata: € ${fmt.format(m.monthlyPayment)}` },
        { k: 'Prima fase cashflow', v: m.first_cashflow_month ? 'mese ' + fmt1.format(m.first_cashflow_month) : '—', cls: 'pos',
          sub: `soglia: € ${fmt.format(m.threshold)}` },
        { k: 'Cashflow netto totale', v: '€ ' + fmt.format(m.cumCashflowNet), cls: 'pos',
          sub: `CAGR: ${fmt2.format(m.cagr_net * 100)}%` },
      ]
    }
    if (hasLoan) {
      return [
        { k: 'Net Value (netto prestito)', v: '€ ' + fmt.format(m.net_value), cls: m.net_value > 0 ? 'pos' : 'neg',
          sub: `lordo: € ${fmt.format(m.net_value_gross)} · debito residuo: € ${fmt.format(m.outstandingLoanEnd)}` },
        { k: 'Rata prestito', v: '€ ' + fmt.format(m.monthlyPayment), cls: 'neu',
          sub: `interessi totali: € ${fmt.format(m.loanInterestTotal)} · pagati: € ${fmt.format(m.loanInterestPaid)}` },
        { k: 'Prima fase cashflow', v: m.first_cashflow_month ? 'mese ' + fmt1.format(m.first_cashflow_month) : '—', cls: 'pos',
          sub: `soglia: € ${fmt.format(m.threshold)}` },
        { k: 'Cashflow netto totale', v: '€ ' + fmt.format(m.cumCashflowNet), cls: 'pos',
          sub: `CAGR: ${fmt2.format(m.cagr_net * 100)}%` },
      ]
    }
    return [
      { k: 'Net Value', v: '€ ' + fmt.format(m.net_value), cls: 'pos',
        sub: `cashflow netto: € ${fmt.format(m.cumCashflowNet)}` },
      { k: 'Versato totale', v: '€ ' + fmt.format(m.total_out_of_pocket), cls: 'neu',
        sub: `profitto netto: € ${fmt.format(m.net_profit)}` },
      { k: 'CAGR netto', v: fmt2.format(m.cagr_net * 100) + '%', cls: 'pos',
        sub: `drag vs teorico: ${fmt2.format(m.drag_pct_points)} pt/mese` },
      { k: 'Prima fase cashflow', v: m.first_cashflow_month ? 'mese ' + fmt1.format(m.first_cashflow_month) : '—', cls: 'neu',
        sub: `soglia: € ${fmt.format(m.threshold)}` },
    ]
  }, [params, m])

  // Equity chart data
  const equityData: ChartData<'line'> = useMemo(() => {
    const datasets = [
      {
        _key: 'no_dd', label: 'No-crash (teorico)',
        data: seriesToXY(resultNoDD.series.net_value, params.horizon),
        borderColor: COL.slate, borderWidth: 1, borderDash: [4, 4],
        pointRadius: 0, tension: 0.1, hidden: equityHidden.no_dd,
      },
      {
        _key: 'net_value', label: 'Net value (sim)',
        data: seriesToXY(result.series.net_value, params.horizon),
        borderColor: COL.emerald, borderWidth: 2, backgroundColor: COL.emeraldFill,
        fill: false, pointRadius: 0, tension: 0.1, hidden: equityHidden.net_value,
      },
      {
        _key: 'capital', label: 'Capitale (sim)',
        data: seriesToXY(result.series.capital, params.horizon),
        borderColor: COL.sky, borderWidth: 1.3, pointRadius: 0, tension: 0.1, hidden: equityHidden.capital,
      },
      {
        _key: 'buffer', label: 'Buffer (sim)',
        data: seriesToXY(result.series.buffer, params.horizon),
        borderColor: COL.amber, borderWidth: 1.3, pointRadius: 0, tension: 0.1, hidden: equityHidden.buffer,
      },
      // Real data overlay from android-trader-monitor
      ...(realEquityPoints.length > 2 ? [{
        _key: 'real', label: 'Saldo REALE (trader monitor)',
        data: realEquityPoints,
        borderColor: COL.violet, borderWidth: 2.5, backgroundColor: COL.violetFill,
        fill: false, pointRadius: 1.5, pointHoverRadius: 4, tension: 0.2,
        hidden: equityHidden.real,
        borderDash: [] as number[],
      }] : []),
    ]
    return { datasets: datasets as unknown as ChartData<'line'>['datasets'] }
  }, [result, resultNoDD, equityHidden, params.horizon, realEquityPoints])

  const equityOptions: ChartOptions<'line'> = useMemo(() => {
    const opts = baseChartOptions(params.horizon)
    if (opts.scales?.y) opts.scales.y.type = equityScale
    return opts
  }, [params.horizon, equityScale])

  // Losses chart
  const lossesData: ChartData<'line'> = useMemo(() => ({
    datasets: [
      { label: 'Perdite crash cumulate', data: seriesToXY(result.series.cum_crash_loss, params.horizon),
        borderColor: COL.rose, backgroundColor: COL.roseFill, fill: true, tension: 0.1, pointRadius: 0, borderWidth: 1.5 },
      { label: 'Buffer deploy cumulato', data: seriesToXY(result.series.cum_buffer_deploy, params.horizon),
        borderColor: COL.emerald, backgroundColor: COL.emeraldFill, fill: true, tension: 0.1, pointRadius: 0, borderWidth: 1.5 },
    ],
  }), [result, params.horizon])

  // Cashflow chart
  const cashflowData: ChartData<'line'> = useMemo(() => ({
    datasets: [
      { label: 'Cashflow netto cumulato', data: seriesToXY(result.series.cum_cashflow_net, params.horizon),
        borderColor: COL.emerald, backgroundColor: COL.emeraldFill, fill: true, tension: 0.1, pointRadius: 0, borderWidth: 1.8 },
      { label: 'Prelievo lordo cumulato', data: seriesToXY(result.series.cum_withdrawn_gross, params.horizon),
        borderColor: COL.amber, fill: false, tension: 0.1, pointRadius: 0, borderWidth: 1.3, borderDash: [3, 3] },
    ],
  }), [result, params.horizon])

  // Buffer chart
  const bufferData: ChartData<'line'> = useMemo(() => ({
    datasets: [
      { label: 'Buffer corrente', data: seriesToXY(result.series.buffer, params.horizon),
        borderColor: COL.amber, backgroundColor: COL.amberFill, fill: true, tension: 0.1, pointRadius: 0, borderWidth: 1.8 },
      { label: 'Target β × capitale', data: seriesToXY(result.series.target_buffer, params.horizon),
        borderColor: COL.slate, fill: false, tension: 0.1, pointRadius: 0, borderWidth: 1.2, borderDash: [3, 3] },
    ],
  }), [result, params.horizon])

  // Sensitivity
  const sensData = useMemo(() => {
    const range = SENS_RANGES[sensParam]
    const points: { x: number; y: number }[] = []
    for (let v = range.min; v <= range.max + 1e-9; v += range.step) {
      const vRounded = +v.toFixed(3)
      const next: Params = { ...params, [sensParam]: vRounded } as Params
      const res = simulate(next)
      let y: number
      switch (sensMetric) {
        case 'net_value': y = res.metrics.net_value; break
        case 'cashflow_net': y = res.metrics.cumCashflowNet; break
        case 'final_capital': y = res.metrics.final_capital; break
        case 'cagr_net': y = res.metrics.cagr_net; break
        case 'first_cashflow_month':
          y = res.metrics.first_cashflow_month ?? (params.horizon + 1)
          break
      }
      points.push({ x: vRounded, y })
    }
    const isMinimize = sensMetric === 'first_cashflow_month'
    const best = points.reduce((a, b) => (isMinimize ? (a.y < b.y ? a : b) : (a.y > b.y ? a : b)))
    return { range, points, best }
  }, [sensParam, sensMetric, params])

  const sensChartData: ChartData<'line'> = useMemo(() => ({
    datasets: [
      {
        label: SENS_LABELS[sensMetric].lbl,
        data: sensData.points,
        borderColor: COL.emerald,
        backgroundColor: COL.emeraldFill,
        fill: true, tension: 0.2, pointRadius: 2, pointHoverRadius: 5, borderWidth: 1.8,
      },
    ],
  }), [sensData, sensMetric])

  const sensCurrentValue = params[sensParam] as number
  const sensMarkerPlugin: Plugin<'line'> = useMemo(() => ({
    id: 'sens-marker',
    afterDatasetsDraw: (chart) => {
      const ctx = chart.ctx
      const xC = chart.scales.x.getPixelForValue(sensCurrentValue)
      ctx.save()
      ctx.strokeStyle = COL.amber
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xC, chart.chartArea.top)
      ctx.lineTo(xC, chart.chartArea.bottom)
      ctx.stroke()
      ctx.fillStyle = COL.amber
      ctx.font = '10px ui-sans-serif, system-ui'
      ctx.fillText('current', xC + 4, chart.chartArea.top + 12)

      const xB = chart.scales.x.getPixelForValue(sensData.best.x)
      const yB = chart.scales.y.getPixelForValue(sensData.best.y)
      ctx.setLineDash([])
      ctx.fillStyle = COL.emerald
      ctx.beginPath(); ctx.arc(xB, yB, 5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(xB, yB, 5, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    },
  }), [sensCurrentValue, sensData.best])

  const sensChartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: sensData.range.label, color: COL.axis, font: { size: 10 } },
        ticks: { color: COL.axis }, grid: { color: COL.grid },
      },
      y: {
        title: { display: true, text: SENS_LABELS[sensMetric].lbl, color: COL.axis, font: { size: 10 } },
        ticks: {
          callback: (v) => {
            const n = Number(v)
            if (sensMetric === 'cagr_net') return (n * 100).toFixed(1) + '%'
            if (sensMetric === 'first_cashflow_month') return 'm ' + n.toFixed(0)
            return fmt.format(n)
          },
          color: COL.axis,
        },
        grid: { color: COL.grid },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${sensData.range.label}=${ctx.parsed.x} → ${SENS_LABELS[sensMetric].fmt(Number(ctx.parsed.y ?? 0))}`,
        },
      },
    },
  }), [sensData.range, sensMetric])

  // Actions
  const handleReset = () => {
    setParams(DEFAULTS)
    flashStatus('↺ valori di fabbrica ripristinati')
  }

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
      flashStatus('✓ configurazione salvata')
    } catch (e) {
      flashStatus('✗ salvataggio fallito')
    }
  }

  const handleClearSave = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      flashStatus('✓ salvataggio cancellato')
    } catch {
      flashStatus('✗ operazione fallita')
    }
  }

  const handleOptimize = () => {
    setOptimizing(true)
    window.setTimeout(() => {
      let best = { nv: -Infinity, alpha: params.alpha, beta: params.beta, rf: params.rf }
      const alphaGrid = [0, 10, 20, 30, 40, 50, 60, 80, 100]
      const betaGrid = [0, 2, 5, 8, 12, 18, 25]
      const rfGrid = [0, 20, 40, 55, 70, 85, 100]
      for (const a of alphaGrid) for (const b of betaGrid) for (const rf of rfGrid) {
        const res = simulate({ ...params, alpha: a, beta: b, rf })
        if (res.metrics.net_value > best.nv) best = { nv: res.metrics.net_value, alpha: a, beta: b, rf }
      }
      setParams(p => ({ ...p, alpha: best.alpha, beta: best.beta, rf: best.rf }))
      setOptimizing(false)
      flashStatus(`✓ ottimo: α=${best.alpha} β=${best.beta} RF=${best.rf}`)
    }, 30)
  }

  useEffect(() => {
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  }, [])

  const msTargets = [500, 1000, 2000, 3000, 5000, 10000]

  // Buffer insight
  const bufferInsight = useMemo(() => {
    const recoveryPct = m.cumCrashLoss > 0 ? ((m.cumBufferDeploy / m.cumCrashLoss) * 100).toFixed(1) + '%' : '—'
    const refillPct = ((m.cumBufferRefill / Math.max(1, m.cumWithdrawnGross)) * 100).toFixed(1) + '%'
    const netPct = ((m.cumCashflowNet / Math.max(1, m.cumWithdrawnGross)) * 100).toFixed(1) + '%'
    return {
      deploy: fmt.format(m.cumBufferDeploy),
      loss: fmt.format(m.cumCrashLoss),
      recoveryPct,
      refill: fmt.format(m.cumBufferRefill),
      refillPct,
      net: fmt.format(m.cumCashflowNet),
      netPct,
    }
  }, [m])

  // Sensitivity insight
  const sensNearest = sensData.points.reduce((a, b) =>
    Math.abs(b.x - sensCurrentValue) < Math.abs(a.x - sensCurrentValue) ? b : a
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between pb-4 mb-2 border-b border-gray-200 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Proiezione Finanziaria
            <span className="text-gray-400 text-base font-normal ml-2">v2</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Simulazione giornaliera · buffer autoricaricante · parametri dinamici
            {realEquityPoints.length > 2 && (
              <span className="text-violet-600 font-medium ml-2">· dati reali attivi</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          LIVE RECOMPUTE
          <span className="px-2 py-0.5 border border-primary-300 text-primary-700 bg-primary-50 rounded text-[10px] tracking-widest font-medium">INTERACTIVE</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* ─── Control Panel ─── */}
        <aside className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
          {CONTROL_SECTIONS.map((section, idx) => (
            <div key={idx} className="mb-5 pb-4 border-b border-dashed border-gray-200 last:border-b-0 last:mb-0">
              <div className="text-[10px] uppercase tracking-widest text-primary-600 font-semibold mb-2">
                {section.title}
              </div>
              {section.note && (
                <p className="text-[10px] text-gray-500 mb-2 leading-snug">{section.note}</p>
              )}
              {section.controls.map(def => (
                <SliderInput
                  key={def.key}
                  def={def}
                  value={params[def.key] as number}
                  onChange={v => update(def.key, v as never)}
                />
              ))}
              {section.extra?.(params)}
            </div>
          ))}

          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={handleReset}
              className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded">
              Reset
            </button>
            <button onClick={handleSave}
              className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded">
              Salva
            </button>
            <button onClick={handleClearSave}
              className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded">
              Pulisci
            </button>
          </div>
          <button onClick={handleOptimize} disabled={optimizing}
            className="w-full mt-2 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded">
            {optimizing ? 'Optimizing...' : 'Auto-opt α/β/RF'}
          </button>
          <div className="text-[11px] text-gray-500 mt-2 text-center min-h-[14px]">{saveStatus}</div>
        </aside>

        {/* ─── Content ─── */}
        <main className="min-w-0">
          {/* Documentazione collapsible */}
          <details className="bg-white border border-gray-200 border-l-4 border-l-primary-500 rounded-xl shadow-sm mb-5">
            <summary className="px-5 py-3 cursor-pointer flex items-center justify-between select-none hover:bg-gray-50">
              <span className="text-gray-700">
                Scheda progetto · contesto, scopo, come si legge
                <span className="text-primary-600 text-[10px] uppercase tracking-widest ml-2 font-semibold">
                  info
                </span>
              </span>
              <span className="text-primary-500">▸</span>
            </summary>
            <div className="px-6 pb-6 text-sm text-gray-600 leading-relaxed">
              <h3 className="text-primary-600 text-[11px] uppercase tracking-widest font-semibold mt-4 mb-2 pb-1 border-b border-dashed border-gray-200">Cos'e questo strumento</h3>
              <p className="mb-2"><strong className="text-gray-900">Proiezione Finanziaria</strong> e un simulatore deterministico per ottimizzare una strategia di accumulo + cashflow basata su un trading bot con rendimento giornaliero. Permette di confrontare numericamente diverse strategie variando in tempo reale i parametri principali: budget, prestito, leverage, fasi, payoff fund.</p>
              <p className="mb-2"><strong className="text-gray-900">Lo scopo non e dare consigli</strong>, ma esporre la matematica del compounding sotto specifiche assunzioni, per ragionare su trade-off con numeri concreti.</p>

              <h3 className="text-primary-600 text-[11px] uppercase tracking-widest font-semibold mt-4 mb-2 pb-1 border-b border-dashed border-gray-200">Assunzioni del modello</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Rendimento giornaliero: <code className="bg-gray-100 text-primary-700 px-1 rounded">0.40%</code> costante</li>
                <li>Crash grande: <code className="bg-gray-100 text-primary-700 px-1 rounded">-10%</code> ogni <code className="bg-gray-100 text-primary-700 px-1 rounded">90 giorni</code></li>
                <li>Crash piccolo: <code className="bg-gray-100 text-primary-700 px-1 rounded">-2%</code> ogni <code className="bg-gray-100 text-primary-700 px-1 rounded">21 giorni</code></li>
                <li>I due crash sono indipendenti (possono cadere lo stesso giorno)</li>
                <li>Granularita giornaliera: 30 giorni x 48 mesi = 1.440 step</li>
              </ul>

              <div className="bg-red-50 border-l-2 border-red-400 p-3 my-3 text-gray-700 text-xs">
                <span className="text-red-600 uppercase tracking-widest font-semibold mr-2">Limiti</span>
                Il mondo reale non ha crash deterministici ne rendimenti costanti. I bot di trading hanno distribuzioni a code grasse, drawdown clusterizzati, possibili blow-up. <strong className="text-gray-900">Non confondere output deterministici con probabilita di realizzazione.</strong>
              </div>

              <h3 className="text-primary-600 text-[11px] uppercase tracking-widest font-semibold mt-4 mb-2 pb-1 border-b border-dashed border-gray-200">Concetti chiave</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                <div>
                  <p className="mb-2"><strong className="text-gray-900">Capitale</strong> — euro investiti nel bot. Cresce dello 0.40% al giorno. Subisce i crash.</p>
                  <p className="mb-2"><strong className="text-gray-900">Buffer</strong> — cassa parcheggiata fuori dal bot. Non rende, ma viene deployato sul capitale durante i crash.</p>
                  <p className="mb-2"><strong className="text-gray-900">Cashflow</strong> — quando il capitale supera la soglia, ogni mese si preleva il 3%. Una % torna nel buffer, il resto va in tasca o al payoff fund.</p>
                </div>
                <div>
                  <p className="mb-2"><strong className="text-gray-900">Leverage del buffer</strong> — durante l'accumulo, prelevi N euro/m dal buffer e li metti nel capitale per accelerare la crescita.</p>
                  <p className="mb-2"><strong className="text-gray-900">Two-phase strategy</strong> — fase 1 con budget alto + leverage; fase 2 con budget ridotto e rata coperta dal sistema.</p>
                  <p className="mb-2"><strong className="text-gray-900">Payoff fund</strong> — una % del cashflow netto si accumula in un fondo dedicato per estinguere il prestito anticipatamente.</p>
                </div>
              </div>

              <h3 className="text-primary-600 text-[11px] uppercase tracking-widest font-semibold mt-4 mb-2 pb-1 border-b border-dashed border-gray-200">Scoperte matematiche</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong className="text-gray-900">Il drawdown e il fattore dominante</strong>: erode 70-85% del compound teorico.</li>
                <li><strong className="text-gray-900">Sacrificio iniziale ha ROI 2-3x</strong>: versare di piu nei primi 6 mesi vale molto di piu che versare costante per 48 mesi.</li>
                <li><strong className="text-gray-900">Il prestito ha rendimento marginale decrescente</strong>: a budget basso vale +28k, a budget alto vale solo +12k.</li>
                <li><strong className="text-gray-900">Sweet spot prestito = 5.000 euro</strong>. Oltre, il ROI marginale crolla.</li>
                <li><strong className="text-gray-900">Recovery factor non-monotono</strong>: l'ottimo e ~45%, non 100%.</li>
                <li><strong className="text-gray-900">Rebuild mode e un trade-off netto</strong>: protegge il buffer ma azzera il cashflow.</li>
              </ul>
            </div>
          </details>

          {/* Top metric tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-gray-200 rounded-xl shadow-sm mb-5">
            {tiles.map((t, i) => (
              <MetricTile key={i} {...t} />
            ))}
          </div>

          {/* Milestones */}
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              <span className="text-[11px] text-primary-600 mr-2 align-middle font-medium">§0</span>
              Milestone — quando raggiungo X€/mese
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 text-gray-500 uppercase tracking-wider font-medium text-[10px]">Milestone (prelievo lordo €/mese)</th>
                    {msTargets.map(t => (
                      <th key={t} className="text-right p-3 text-gray-500 uppercase tracking-wider font-medium text-[10px]">
                        {fmt.format(t)} €/m
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <tr className="border-t border-gray-200">
                    <td className="p-3 text-gray-800">Raggiunta al mese</td>
                    {msTargets.map(t => {
                      const day = m.milestones[t]
                      const reached = day && day <= params.horizon * 30
                      return (
                        <td key={t} className={`text-right p-3 ${reached ? 'text-emerald-600 font-medium' : 'text-gray-500 italic'}`}>
                          {reached ? fmt1.format(day! / 30) : `> ${params.horizon}`}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="p-3 text-gray-800">Capitale necessario</td>
                    {msTargets.map(t => (
                      <td key={t} className="text-right p-3 text-gray-400">
                        € {fmt.format(t / (params.wPct / 100))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Equity */}
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              <span className="text-[11px] text-primary-600 mr-2 align-middle font-medium">§1</span>
              Equity curve &amp; flussi
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-baseline pb-3 mb-3 border-b border-gray-200">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  Daily simulation · net value, capitale, buffer
                  {realEquityPoints.length > 2 && <span className="text-violet-600"> · saldo reale</span>}
                </span>
                <span className="text-[10px] text-gray-500">
                  giorni 0 → {m.days_total}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {([
                  { key: 'net_value', label: 'net value' },
                  { key: 'capital', label: 'capitale' },
                  { key: 'buffer', label: 'buffer' },
                  { key: 'no_dd', label: 'no-crash (teorico)' },
                  ...(realEquityPoints.length > 2 ? [{ key: 'real' as const, label: 'REALE' }] : []),
                ]).map(t => {
                  const on = !equityHidden[t.key]
                  const isReal = t.key === 'real'
                  return (
                    <button key={t.key}
                      onClick={() => setEquityHidden(h => ({ ...h, [t.key]: !h[t.key] }))}
                      className={`px-2.5 py-1 border text-[10px] uppercase tracking-widest rounded ${
                        isReal
                          ? on ? 'border-violet-500 text-violet-600 bg-violet-900/20' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                          : on ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}>
                      {t.label}
                    </button>
                  )
                })}
                <span className="flex-1" />
                {(['linear', 'logarithmic'] as const).map(s => (
                  <button key={s}
                    onClick={() => setEquityScale(s)}
                    className={`px-2.5 py-1 border text-[10px] uppercase tracking-widest rounded ${
                      equityScale === s ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}>
                    {s === 'logarithmic' ? 'log' : 'linear'}
                  </button>
                ))}
              </div>
              <div style={{ height: 400 }}>
                <Line data={equityData} options={equityOptions} />
              </div>
            </div>
          </section>

          {/* §Real — Confronto ipotetico vs effettivo */}
          {!realLoading && !realError && realSummary && (
            <section className="mb-7">
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                <span className="font-sans text-[11px] text-violet-600 mr-2 align-middle">§R</span>
                Confronto ipotetico vs <em className="text-violet-600 not-italic">effettivo</em>
              </h2>

              {/* KPI comparison tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 bg-gray-800 border border-gray-700 rounded mb-4">
                {(() => {
                  const realBal = realSummary.total_balance
                  const realDep = realSummary.total_deposited
                  const realPnl = realSummary.total_pnl
                  // Simulated value at the same elapsed time
                  const elapsedMonths = realEquityPoints.length > 0
                    ? realEquityPoints[realEquityPoints.length - 1].x
                    : 0
                  const simDayIdx = Math.min(
                    Math.round(elapsedMonths * DAYS_PER_MONTH) - 1,
                    result.series.net_value.length - 1
                  )
                  const simValue = simDayIdx >= 0 ? result.series.net_value[simDayIdx] : 0
                  const simCapital = simDayIdx >= 0 ? result.series.capital[simDayIdx] : 0
                  const delta = realBal - simCapital
                  const deltaPct = simCapital > 0 ? ((delta / simCapital) * 100) : 0

                  return [
                    { k: 'Saldo reale', v: `$ ${fmt.format(realBal)}`, cls: 'pos' as TileCls,
                      sub: `depositato: $ ${fmt.format(realDep)}` },
                    { k: 'PnL reale', v: `$ ${fmt2.format(realPnl)}`, cls: (realPnl >= 0 ? 'pos' : 'neg') as TileCls,
                      sub: `${realDep > 0 ? (realPnl / realDep * 100).toFixed(1) : '0'}% del depositato` },
                    { k: `Sim @ mese ${fmt1.format(elapsedMonths)}`, v: `€ ${fmt.format(simValue)}`, cls: 'neu' as TileCls,
                      sub: `capitale sim: € ${fmt.format(simCapital)}` },
                    { k: 'Delta reale vs sim', v: `${delta >= 0 ? '+' : ''}${fmt.format(delta)}`, cls: (delta >= 0 ? 'pos' : 'neg') as TileCls,
                      sub: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% rispetto alla simulazione` },
                  ].map((t, i) => <MetricTile key={i} {...t} />)
                })()}
              </div>

              {/* Traders breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {realSummary.traders.map(trader => (
                  <div key={trader.name} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-800">{trader.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        trader.pnl_account >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {trader.pnl_account >= 0 ? '+' : ''}${trader.pnl_account.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Saldo</span>
                        <p className="text-gray-800 font-medium">${trader.balance_total.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Depositato</span>
                        <p className="text-gray-800 font-medium">${trader.balance_deposited.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Credito</span>
                        <p className="text-gray-800 font-medium">${trader.credit.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Posizioni</span>
                        <p className="text-gray-800 font-medium">{trader.open_positions}</p>
                      </div>
                    </div>
                    {trader.last_update && (
                      <p className="text-[10px] text-gray-500 mt-2">
                        Ultimo scraping: {new Date(trader.last_update).toLocaleString('it-IT')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Insight box */}
              <div className="bg-violet-50 border-l-2 border-violet-400 p-3 text-sm rounded">
                <span className="text-[10px] uppercase tracking-widest text-violet-600 font-semibold mr-2">confronto</span>
                {(() => {
                  const realBal = realSummary.total_balance
                  const elapsedMonths = realEquityPoints.length > 0 ? realEquityPoints[realEquityPoints.length - 1].x : 0
                  const simDayIdx = Math.min(Math.round(elapsedMonths * DAYS_PER_MONTH) - 1, result.series.capital.length - 1)
                  const simCap = simDayIdx >= 0 ? result.series.capital[simDayIdx] : 0
                  const ahead = realBal > simCap
                  return (
                    <>
                      Dopo <strong className="text-violet-600">{fmt1.format(elapsedMonths)} mesi</strong> di operativita,
                      il portafoglio reale (<strong className="text-violet-600">${fmt.format(realBal)}</strong>) e{' '}
                      <strong className={ahead ? 'text-emerald-600' : 'text-red-600'}>
                        {ahead ? 'avanti' : 'indietro'}
                      </strong>{' '}
                      rispetto alla simulazione (<strong className="text-emerald-600">€{fmt.format(simCap)}</strong>).
                      {' '}La linea viola nel grafico equity mostra l'andamento reale sovrapposto alla proiezione.
                    </>
                  )
                })()}
              </div>
            </section>
          )}

          {realError && (
            <div className="mb-7 bg-red-50 border border-red-200 border-l-4 border-l-red-400 rounded-xl p-4">
              <p className="text-xs text-red-600">
                Dati reali non disponibili — {realError}
              </p>
              <button onClick={loadRealData} className="text-xs text-gray-400 underline mt-1">Riprova</button>
            </div>
          )}

          {/* Drag & Cashflow */}
          <section className="mb-7">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                <div className="flex justify-between items-baseline pb-3 mb-3 border-b border-gray-200">
                  <span className="text-[11px] uppercase tracking-widest text-gray-500">
                    Cumulative crash loss vs buffer recovery
                  </span>
                  <span className="text-[10px] text-gray-500">€ · daily</span>
                </div>
                <div style={{ height: 300 }}>
                  <Line data={lossesData} options={baseChartOptions(params.horizon)} />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                <div className="flex justify-between items-baseline pb-3 mb-3 border-b border-gray-200">
                  <span className="text-[11px] uppercase tracking-widest text-gray-500">
                    Cashflow netto cumulato
                  </span>
                  <span className="text-[10px] text-gray-500">€ · what you take home</span>
                </div>
                <div style={{ height: 300 }}>
                  <Line data={cashflowData} options={baseChartOptions(params.horizon)} />
                </div>
              </div>
            </div>
          </section>

          {/* Buffer dynamics */}
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              <span className="text-[11px] text-primary-600 mr-2 align-middle font-medium">§2</span>
              Dinamica del buffer
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-baseline pb-3 mb-3 border-b border-gray-200">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  Buffer vs target · deploy &amp; refill
                </span>
                <span className="text-[10px] text-gray-500">€ · phases highlighted</span>
              </div>
              <div style={{ height: 300 }}>
                <Line data={bufferData} options={baseChartOptions(params.horizon)} />
              </div>
            </div>
            <div className="bg-amber-50 border-l-2 border-amber-400 p-3 mt-3 text-sm rounded">
              <span className="text-[10px] uppercase tracking-widest text-amber-600 font-semibold mr-2">◉ buffer stats</span>
              Buffer ha deployato <strong className="text-emerald-600">€ {bufferInsight.deploy}</strong> contro perdite crash totali di € {bufferInsight.loss} (recupero <strong className="text-emerald-600">{bufferInsight.recoveryPct}</strong>).
              Il refill cumulato in fase cashflow ammonta a <strong className="text-emerald-600">€ {bufferInsight.refill}</strong> ({bufferInsight.refillPct} del prelievo lordo).
              Il prelievo netto effettivamente incassato è <strong className="text-emerald-600">€ {bufferInsight.net}</strong> ({bufferInsight.netPct} del lordo).
            </div>
          </section>

          {/* Sensitivity */}
          <section className="mb-7">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h2 className="text-xl font-serif">
                <span className="text-[11px] text-primary-600 mr-2 align-middle font-medium">§3</span>
                Sensitivity — 1D sweep
              </h2>
              <div className="flex gap-2">
                <select value={sensParam} onChange={e => setSensParam(e.target.value as SensParam)}
                  className="bg-white border border-gray-300 text-gray-700 px-2 py-1 text-xs rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  {(Object.keys(SENS_RANGES) as SensParam[]).map(k => (
                    <option key={k} value={k}>{SENS_RANGES[k].label}</option>
                  ))}
                </select>
                <select value={sensMetric} onChange={e => setSensMetric(e.target.value as SensMetric)}
                  className="bg-white border border-gray-300 text-gray-700 px-2 py-1 text-xs rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  {(Object.keys(SENS_LABELS) as SensMetric[]).map(k => (
                    <option key={k} value={k}>{SENS_LABELS[k].lbl}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-baseline pb-3 mb-3 border-b border-gray-200">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  Sweep parametrico · gli altri parametri restano fissi
                </span>
                <span className="text-[10px] text-gray-500">parameter → metric</span>
              </div>
              <div style={{ height: 300 }}>
                <Line data={sensChartData} options={sensChartOptions} plugins={[sensMarkerPlugin]} />
              </div>
            </div>
            <div className="bg-amber-50 border-l-2 border-amber-400 p-3 mt-3 text-sm rounded">
              <span className="text-[10px] uppercase tracking-widest text-amber-600 font-semibold mr-2">◉ sweep result</span>
              Ottimo di <strong className="text-emerald-600">{sensData.range.label.split(' ')[0]}</strong> per {SENS_LABELS[sensMetric].lbl} ={' '}
              <strong className="text-emerald-600">{sensData.best.x}</strong> con valore{' '}
              <strong className="text-emerald-600">{SENS_LABELS[sensMetric].fmt(sensData.best.y)}</strong>.
              {' '}Valore corrente: {sensCurrentValue} → {SENS_LABELS[sensMetric].fmt(sensNearest.y)}.
              <span className="text-gray-500"> · linea ambra = valore attuale · punto verde = ottimo</span>
            </div>
          </section>

          <footer className="mt-10 pt-4 border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
            <span>Compound Lab · simulazione deterministica giornaliera</span>
            <span>No financial advice — solo matematica del compounding</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default CompoundLab
