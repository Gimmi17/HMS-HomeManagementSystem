// ─── Types ───────────────────────────────────────────────────────────────────
export interface Params {
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
  copyTraderFee: number
}

export interface SimSeries {
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
  cum_trader_fee: number[]
  injection: number[]
  withdrawal_gross: number[]
  target_buffer: number[]
  phase: string[]
  crash_big: boolean[]
  crash_small: boolean[]
  rebuild_mode: boolean[]
  loan_outstanding: number[]
}

export interface SimMetrics {
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
  cumTraderFee: number
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

export interface SimResult {
  series: SimSeries
  metrics: SimMetrics
}

// ─── Constants ───────────────────────────────────────────────────────────────
export const DAYS_PER_MONTH = 30
export const STORAGE_KEY = 'hms_compound_lab_v2_config'

// ─── Defaults ────────────────────────────────────────────────────────────────
export const DEFAULTS: Params = {
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
  copyTraderFee: 30,
}

// ─── Simulation engine ───────────────────────────────────────────────────────
export function computeMonthlyPayment(amount: number, taegPct: number, months: number): number {
  if (amount <= 0 || months <= 0) return 0
  if (taegPct === 0) return amount / months
  const i = Math.pow(1 + taegPct / 100, 1 / 12) - 1
  return (amount * i) / (1 - Math.pow(1 + i, -months))
}

export function simulate(params: Params, skipCrashes = false, overrideDays?: number): SimResult {
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
    copyTraderFee,
  } = params

  const days = overrideDays ?? Math.round(horizon * DAYS_PER_MONTH)
  const dailyRet = daily / 100
  const feeR = copyTraderFee / 100
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
  let cumTraderFee = 0
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
    cum_loan_payments: [], cum_trader_fee: [],
    injection: [], withdrawal_gross: [],
    target_buffer: [],
    phase: [],
    crash_big: [], crash_small: [],
    rebuild_mode: [],
    loan_outstanding: [],
  }

  for (let d = 1; d <= days; d++) {
    const dailyGross = capital * dailyRet
    const dailyFee = dailyGross * feeR
    capital += dailyGross - dailyFee
    cumTraderFee += dailyFee

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
    series.cum_trader_fee.push(cumTraderFee)
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
  const horizonActual = days / DAYS_PER_MONTH
  const years = horizonActual / 12
  const cagrNet = totalOut > 0 ? Math.pow(Math.max(1, netValue) / totalOut, 1 / years) - 1 : 0
  const theoreticalMonthly = Math.pow(1 + dailyRet, DAYS_PER_MONTH) - 1
  const effectiveMonthly = Math.pow(Math.max(1, netValue) / cap0, 1 / horizonActual) - 1

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
      cumLoanPayments, cumTraderFee, outstandingLoanEnd,
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
      days_total: days,
      milestones: msReached,
      rebuild_days: rebuildDays,
    },
  }
}
