/**
 * Income tax calculator for Indian individual taxpayers.
 *
 * Scope (v1, by design):
 *   - Individuals only (HUF / firm / company have different surcharge rules
 *     and are out of scope here — would be added per assessee type later).
 *   - AY 2024-25 and AY 2025-26 only — slab tables for both regimes are
 *     codified below; older years are intentionally rejected.
 *   - Capital gains entered here are taxed at slab rates (treated as ordinary
 *     income). The actual special rates for STCG u/s 111A (15% / 20%) and
 *     LTCG u/s 112A (10% / 12.5% above ₹1L) are NOT applied — flag in UI.
 *   - No marginal relief on surcharge (negligible difference for most
 *     taxpayers; exact relief is a v2 nicety).
 *   - Default residential status = Resident. Non-resident special slabs not
 *     handled here.
 *
 * The function is pure: same inputs → same outputs. Used for live preview
 * in the form and for the snapshot we save to the DB.
 */

export type TaxRegime = 'OLD' | 'NEW'
export type AgeCategory = 'BELOW_60' | 'SENIOR_60_TO_79' | 'SUPER_SENIOR_80_PLUS'
export type AssessmentYear = '2024-25' | '2025-26'

export const SUPPORTED_AYS: AssessmentYear[] = ['2024-25', '2025-26']

export interface IncomeInputs {
  /** Gross salary including allowances, before any deduction. */
  salary: number
  houseProperty: number
  business: number
  capitalGains: number
  otherSources: number
}

export interface DeductionInputs {
  /** All amounts in ₹. Caps are applied automatically inside the calculator. */
  s80C: number
  s80CCD1B: number
  s80D: number
  s80G: number
  s80TTA: number
  s80TTB: number
}

export interface TaxesPaidInputs {
  tds: number
  advanceTax: number
  selfAssessmentTax: number
}

export interface CalcInputs {
  assessmentYear: AssessmentYear
  regime: TaxRegime
  ageCategory: AgeCategory
  income: IncomeInputs
  deductions: DeductionInputs
  taxesPaid: TaxesPaidInputs
}

export interface SlabApplied {
  /** Human label, e.g. "5% on ₹3,00,000 (₹3,00,001 to ₹6,00,000)". */
  label: string
  taxableInBracket: number
  rate: number
  taxOnBracket: number
}

export interface DeductionApplied {
  code: string
  label: string
  claimed: number
  /** What we actually allowed after caps. */
  allowed: number
  cappedAt?: number
}

export interface CalcOutput {
  /** Gross salary minus standard deduction (if salary > 0). */
  netSalary: number
  standardDeductionApplied: number
  grossTotalIncome: number
  deductions: {
    rows: DeductionApplied[]
    total: number
  }
  totalIncome: number
  /** Slab-by-slab breakdown shown in the COI preview. */
  slabBreakdown: SlabApplied[]
  taxOnIncome: number
  surcharge: number
  surchargeRate: number
  healthEduCess: number
  grossTaxLiability: number
  rebate87A: number
  netTaxLiability: number
  totalTaxesPaid: number
  /** Positive = payable, negative = refund. */
  taxPayable: number
  /** Sign-flipped magnitude — convenient for UI labels. */
  refundDue: number
  notes: string[]
}

// ────────────────────────────────────────────────────────────────────
// Slab tables
// ────────────────────────────────────────────────────────────────────

interface Slab {
  upto: number | null // null = and above
  rate: number // 0.05 = 5%
}

interface SlabSet {
  exemptionLimit: number
  slabs: Slab[]
}

/** Returns slabs to apply for the given (AY, regime, age). */
function slabsFor(ay: AssessmentYear, regime: TaxRegime, age: AgeCategory): SlabSet {
  if (regime === 'NEW') {
    if (ay === '2024-25') {
      // Section 115BAC, AY 2024-25
      return {
        exemptionLimit: 300000,
        slabs: [
          { upto: 300000, rate: 0 },
          { upto: 600000, rate: 0.05 },
          { upto: 900000, rate: 0.1 },
          { upto: 1200000, rate: 0.15 },
          { upto: 1500000, rate: 0.2 },
          { upto: null, rate: 0.3 },
        ],
      }
    }
    // AY 2025-26 — revised new-regime slabs (Finance Act 2024)
    return {
      exemptionLimit: 300000,
      slabs: [
        { upto: 300000, rate: 0 },
        { upto: 700000, rate: 0.05 },
        { upto: 1000000, rate: 0.1 },
        { upto: 1200000, rate: 0.15 },
        { upto: 1500000, rate: 0.2 },
        { upto: null, rate: 0.3 },
      ],
    }
  }

  // OLD regime — exemption limit varies by age category. Slabs above the
  // exemption limit are the same: 5% / 20% / 30%.
  let exemption = 250000
  if (age === 'SENIOR_60_TO_79') exemption = 300000
  if (age === 'SUPER_SENIOR_80_PLUS') exemption = 500000

  const slabs: Slab[] = [{ upto: exemption, rate: 0 }]
  if (exemption < 500000) slabs.push({ upto: 500000, rate: 0.05 })
  slabs.push({ upto: 1000000, rate: 0.2 })
  slabs.push({ upto: null, rate: 0.3 })
  return { exemptionLimit: exemption, slabs }
}

/** Standard deduction on salary income. */
function standardDeduction(ay: AssessmentYear, regime: TaxRegime): number {
  if (regime === 'NEW' && ay === '2025-26') return 75000
  return 50000
}

/** Rebate u/s 87A: full rebate up to a TI threshold, capped at a max amount. */
function rebate87A(ay: AssessmentYear, regime: TaxRegime, totalIncome: number, taxOnIncome: number): number {
  if (regime === 'NEW') {
    // Up to ₹7L taxable income → tax fully rebated, max ₹25,000
    if (totalIncome <= 700000) return Math.min(taxOnIncome, 25000)
    return 0
  }
  // OLD regime: up to ₹5L → max ₹12,500
  if (totalIncome <= 500000) return Math.min(taxOnIncome, 12500)
  return 0
  void ay // unused but kept in the signature for symmetry with new regime
}

/** Returns surcharge rate based on TI and regime. New regime caps at 25%. */
function surchargeRate(ay: AssessmentYear, regime: TaxRegime, totalIncome: number): number {
  if (totalIncome <= 5000000) return 0
  if (totalIncome <= 10000000) return 0.1
  if (totalIncome <= 20000000) return 0.15
  if (totalIncome <= 50000000) return 0.25
  // > ₹5 Cr — Old regime goes to 37%, New caps at 25%
  return regime === 'NEW' ? 0.25 : 0.37
  void ay
}

/** Apply slab tax to a positive taxable income. Returns slab-wise breakdown. */
function applySlabs(slabSet: SlabSet, taxableIncome: number): {
  total: number
  rows: SlabApplied[]
} {
  const rows: SlabApplied[] = []
  let total = 0
  let prev = 0
  for (const slab of slabSet.slabs) {
    const upper = slab.upto ?? Infinity
    if (taxableIncome <= prev) break
    const slice = Math.min(upper, taxableIncome) - prev
    if (slice <= 0) {
      prev = upper
      continue
    }
    const tax = slice * slab.rate
    total += tax
    if (slab.rate > 0) {
      const lowerLabel = prev === 0 ? 'up to ₹' + fmt(upper) : `₹${fmt(prev + 1)} to ₹${fmt(Math.min(upper, taxableIncome))}`
      rows.push({
        label: `${(slab.rate * 100).toFixed(0)}% on ₹${fmt(slice)} (${lowerLabel})`,
        taxableInBracket: slice,
        rate: slab.rate,
        taxOnBracket: tax,
      })
    } else {
      rows.push({
        label: `Nil up to ₹${fmt(Math.min(upper, taxableIncome))} (basic exemption)`,
        taxableInBracket: slice,
        rate: 0,
        taxOnBracket: 0,
      })
    }
    prev = upper
  }
  return { total: round(total), rows }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function round(n: number): number {
  return Math.round(n)
}

/** Cap helper: returns min(claimed, cap), records the cap if it actually bit. */
function applyCap(
  code: string,
  label: string,
  claimed: number,
  cap: number,
): DeductionApplied {
  const allowed = Math.max(0, Math.min(claimed, cap))
  return {
    code,
    label,
    claimed: Math.max(0, claimed),
    allowed,
    cappedAt: claimed > cap ? cap : undefined,
  }
}

// ────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────

export function compute(input: CalcInputs): CalcOutput {
  const notes: string[] = []

  // 1. Salary: net of standard deduction (auto-applied if salary > 0)
  const stdDed = input.income.salary > 0 ? standardDeduction(input.assessmentYear, input.regime) : 0
  const netSalary = Math.max(0, input.income.salary - stdDed)

  // 2. Capital gains note (we don't apply special rates in v1)
  if (input.income.capitalGains > 0) {
    notes.push(
      'Capital gains are taxed at slab rates here — special rates for STCG u/s 111A and LTCG u/s 112A are not applied in this version.',
    )
  }

  // 3. Gross Total Income
  const gti =
    netSalary +
    Math.max(0, input.income.houseProperty) +
    Math.max(0, input.income.business) +
    Math.max(0, input.income.capitalGains) +
    Math.max(0, input.income.otherSources)

  // 4. Chapter VI-A deductions — Old regime only
  let deductionRows: DeductionApplied[] = []
  let totalDeductions = 0
  if (input.regime === 'OLD') {
    deductionRows = [
      applyCap('80C', 'Investments u/s 80C', input.deductions.s80C, 150000),
      applyCap('80CCD(1B)', 'NPS additional u/s 80CCD(1B)', input.deductions.s80CCD1B, 50000),
      applyCap('80D', 'Health insurance u/s 80D', input.deductions.s80D, 100000),
      // 80G commonly capped at 50% or 100% of donation depending on donee — we keep it
      // as-claimed here; the user is expected to enter the eligible amount.
      applyCap('80G', 'Donations u/s 80G', input.deductions.s80G, Number.MAX_SAFE_INTEGER),
      applyCap('80TTA', 'Savings interest u/s 80TTA', input.deductions.s80TTA, 10000),
      applyCap('80TTB', 'Senior citizen interest u/s 80TTB', input.deductions.s80TTB, 50000),
    ].filter((r) => r.claimed > 0)
    totalDeductions = deductionRows.reduce((s, r) => s + r.allowed, 0)
    // Cap total deductions at GTI — you can't take negative TI.
    if (totalDeductions > gti) totalDeductions = gti
  } else if (anyDeductionEntered(input.deductions)) {
    notes.push(
      'Chapter VI-A deductions are not allowed under the New Tax Regime (Section 115BAC). Switch to Old regime to claim them.',
    )
  }

  // 5. Total income
  const totalIncome = Math.max(0, gti - totalDeductions)

  // 6. Slab tax
  const slabSet = slabsFor(input.assessmentYear, input.regime, input.ageCategory)
  const { total: taxOnIncome, rows: slabBreakdown } = applySlabs(slabSet, totalIncome)

  // 7. Surcharge
  const surchargeR = surchargeRate(input.assessmentYear, input.regime, totalIncome)
  const surcharge = round(taxOnIncome * surchargeR)

  // 8. Health & education cess @ 4%
  const cess = round((taxOnIncome + surcharge) * 0.04)

  // 9. Gross liability
  const gross = taxOnIncome + surcharge + cess

  // 10. Rebate 87A (applied to tax on income — the cess/surcharge dance for
  //     marginal-rebate cases is omitted; v1 simplification.)
  const rebate = rebate87A(input.assessmentYear, input.regime, totalIncome, taxOnIncome)
  // If rebate fully wipes tax, surcharge + cess also fall away.
  let netTaxLiability = gross
  if (rebate > 0 && rebate >= taxOnIncome) {
    netTaxLiability = 0
  } else if (rebate > 0) {
    // Reapply cess on (tax - rebate)
    const taxAfterRebate = taxOnIncome - rebate
    const cessRecalc = round(taxAfterRebate * 0.04)
    netTaxLiability = taxAfterRebate + surcharge + cessRecalc
  }

  // 11. Less taxes paid
  const totalPaid =
    Math.max(0, input.taxesPaid.tds) +
    Math.max(0, input.taxesPaid.advanceTax) +
    Math.max(0, input.taxesPaid.selfAssessmentTax)

  const taxPayable = round(netTaxLiability - totalPaid)
  const refundDue = taxPayable < 0 ? -taxPayable : 0
  const payable = taxPayable > 0 ? taxPayable : 0

  return {
    netSalary,
    standardDeductionApplied: stdDed,
    grossTotalIncome: round(gti),
    deductions: { rows: deductionRows, total: round(totalDeductions) },
    totalIncome: round(totalIncome),
    slabBreakdown,
    taxOnIncome,
    surcharge,
    surchargeRate: surchargeR,
    healthEduCess: cess,
    grossTaxLiability: round(gross),
    rebate87A: rebate,
    netTaxLiability: round(netTaxLiability),
    totalTaxesPaid: round(totalPaid),
    taxPayable: payable - refundDue, // signed: + payable, - refund
    refundDue,
    notes,
  }
}

function anyDeductionEntered(d: DeductionInputs): boolean {
  return d.s80C > 0 || d.s80CCD1B > 0 || d.s80D > 0 || d.s80G > 0 || d.s80TTA > 0 || d.s80TTB > 0
}

// ────────────────────────────────────────────────────────────────────
// Reverse-solve: given a target tax payable, what does the underlying
// taxable income need to be? Useful for advance-tax planning and "client
// wants to pay ₹X — work the numbers backwards" scenarios.
//
// Simplifications (v1):
//   - Surcharge ignored (only matters above ₹50L total income — we flag
//     in notes if the solved TI looks like it would attract surcharge).
//   - Marginal-relief edge cases just above the ₹7L / ₹5L rebate
//     thresholds are not finely tuned — solved TI is bumped to just
//     above the threshold and the user can verify in forward mode.
//   - Cess @ 4% is stripped: target tax is assumed to be the all-in
//     headline number (post-cess, pre-credit-of-taxes-paid).
// ────────────────────────────────────────────────────────────────────

export interface ReverseSolveResult {
  /** Total income that would yield (approximately) the target tax. */
  taxableIncome: number
  /** Slab-by-slab breakdown of how the target tax is reached. */
  slabBreakdown: SlabApplied[]
  /** Suggested deduction allocation (Old regime only) — caps maxed. */
  suggestedDeductions: DeductionInputs
  /** Required Gross Total Income if the suggested deductions are applied. */
  requiredGrossIncome: number
  notes: string[]
}

const SURCHARGE_THRESHOLD = 5000000

export function reverseSolve(
  targetTax: number,
  ay: AssessmentYear,
  regime: TaxRegime,
  age: AgeCategory,
): ReverseSolveResult {
  const notes: string[] = []
  const rebateThreshold = regime === 'NEW' ? 700000 : 500000

  // Suggested Chapter VI-A allocation (only meaningful under Old regime).
  const suggested: DeductionInputs =
    regime === 'OLD'
      ? {
          s80C: 150000,
          s80CCD1B: 50000,
          s80D: age === 'BELOW_60' ? 25000 : 50000,
          s80G: 0,
          s80TTA: age === 'BELOW_60' ? 10000 : 0,
          s80TTB: age !== 'BELOW_60' ? 50000 : 0,
          // The 80G slot stays at 0 — donations are entirely a planning lever, not
          // a default to pre-fill; the rest are "use-it-or-lose-it" caps that
          // most planning tools max out as a baseline.
        }
      : { s80C: 0, s80CCD1B: 0, s80D: 0, s80G: 0, s80TTA: 0, s80TTB: 0 }

  const suggestedTotal =
    suggested.s80C +
    suggested.s80CCD1B +
    suggested.s80D +
    suggested.s80G +
    suggested.s80TTA +
    suggested.s80TTB

  // Zero target → just stay below the rebate threshold (87A wipes the tax).
  if (targetTax <= 0) {
    notes.push(
      `To pay ₹0 in tax, total income must stay at or below ₹${fmt(rebateThreshold)} so Rebate u/s 87A wipes the tax.`,
    )
    return {
      taxableIncome: rebateThreshold,
      slabBreakdown: [],
      suggestedDeductions: suggested,
      requiredGrossIncome: rebateThreshold + suggestedTotal,
      notes,
    }
  }

  // Strip cess: tax-on-income = target / 1.04
  const taxOnIncome = targetTax / 1.04

  // Walk slabs forward, accumulating tax until we hit the target.
  const slabSet = slabsFor(ay, regime, age)
  let income = 0
  let taxAcc = 0
  let prev = 0
  const breakdown: SlabApplied[] = []

  for (const slab of slabSet.slabs) {
    const upper = slab.upto ?? Number.POSITIVE_INFINITY
    const sliceMax = upper - prev

    if (slab.rate === 0) {
      // Free band: count it in income but don't accumulate tax.
      const slice = sliceMax === Number.POSITIVE_INFINITY ? 0 : sliceMax
      income += slice
      breakdown.push({
        label: `Nil up to ₹${fmt(income)} (basic exemption)`,
        taxableInBracket: slice,
        rate: 0,
        taxOnBracket: 0,
      })
      prev = upper
      continue
    }

    const taxRemaining = taxOnIncome - taxAcc
    if (taxRemaining <= 0) break

    const sliceForRemaining = taxRemaining / slab.rate
    if (sliceForRemaining <= sliceMax) {
      // We can finish inside this bracket.
      income += sliceForRemaining
      taxAcc += sliceForRemaining * slab.rate
      breakdown.push({
        label: `${(slab.rate * 100).toFixed(0)}% on ₹${fmt(sliceForRemaining)} (₹${fmt(prev + 1)} to ₹${fmt(income)})`,
        taxableInBracket: sliceForRemaining,
        rate: slab.rate,
        taxOnBracket: sliceForRemaining * slab.rate,
      })
      break
    } else {
      // Take the whole bracket and continue into the next one.
      income += sliceMax
      taxAcc += sliceMax * slab.rate
      breakdown.push({
        label: `${(slab.rate * 100).toFixed(0)}% on ₹${fmt(sliceMax)} (₹${fmt(prev + 1)} to ₹${fmt(upper)})`,
        taxableInBracket: sliceMax,
        rate: slab.rate,
        taxOnBracket: sliceMax * slab.rate,
      })
      prev = upper
    }
  }

  // Rebate 87A check: if solved TI fell at or below the threshold, the actual
  // tax would be wiped by the rebate. Bump TI to just above the threshold so
  // the user gets a workable starting point.
  if (income <= rebateThreshold) {
    notes.push(
      `To pay any positive tax, taxable income must exceed ₹${fmt(rebateThreshold)} (Rebate u/s 87A would otherwise wipe the tax). Suggested income bumped above the threshold — verify in forward mode.`,
    )
    income = rebateThreshold + 100
  }

  // Surcharge warning if we're up at high incomes where surcharge bites.
  if (income > SURCHARGE_THRESHOLD) {
    notes.push(
      `Solved total income exceeds ₹${fmt(SURCHARGE_THRESHOLD)} — surcharge applies in reality but is not factored here. Run forward mode to verify the headline tax.`,
    )
  }

  if (regime === 'OLD') {
    notes.push(
      'Suggested deductions assume baseline Chapter VI-A allocation (80C ₹1.5L, 80CCD(1B) ₹50K, 80D age-appropriate, 80TTA/TTB age-appropriate). Adjust to your client\'s actual investments.',
    )
  } else {
    notes.push('Chapter VI-A deductions are not available under the New Regime.')
  }

  return {
    taxableIncome: round(income),
    slabBreakdown: breakdown,
    suggestedDeductions: suggested,
    requiredGrossIncome: round(income) + suggestedTotal,
    notes,
  }
}

// ────────────────────────────────────────────────────────────────────
// Defaults — used to seed empty form state.
// ────────────────────────────────────────────────────────────────────

export function emptyInputs(ay: AssessmentYear = '2025-26'): CalcInputs {
  return {
    assessmentYear: ay,
    regime: 'NEW',
    ageCategory: 'BELOW_60',
    income: { salary: 0, houseProperty: 0, business: 0, capitalGains: 0, otherSources: 0 },
    deductions: { s80C: 0, s80CCD1B: 0, s80D: 0, s80G: 0, s80TTA: 0, s80TTB: 0 },
    taxesPaid: { tds: 0, advanceTax: 0, selfAssessmentTax: 0 },
  }
}

export const REGIME_LABELS: Record<TaxRegime, string> = {
  OLD: 'Old Regime',
  NEW: 'New Regime (115BAC)',
}

export const AGE_LABELS: Record<AgeCategory, string> = {
  BELOW_60: 'Below 60',
  SENIOR_60_TO_79: 'Senior (60–79)',
  SUPER_SENIOR_80_PLUS: 'Super Senior (80+)',
}
