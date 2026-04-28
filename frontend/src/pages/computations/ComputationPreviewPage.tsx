import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { computationsApi, type ComputationListItem } from '../../lib/computations-api'
import { fmtINR } from '../../lib/api-types'
import { AGE_LABELS, REGIME_LABELS, compute, type CalcInputs, type CalcOutput } from '../../lib/tax-calculator'
import { useAuth } from '../../lib/auth'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'

/**
 * Print-friendly Tax Computation sheet. Same A4 / print:hidden toolbar
 * pattern as the COI page, so the user gets a one-click "Save as PDF"
 * via the browser's native print dialog. Re-runs the calculator from
 * the saved inputs so the on-screen sheet is always self-consistent
 * with the live calculator (no drift between snapshot and current
 * formula updates).
 */
export default function ComputationPreviewPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const [c, setC] = useState<ComputationListItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    computationsApi
      .detail(id)
      .then((x) => {
        if (!cancelled) setC(x)
      })
      .catch((err) => {
        if (!cancelled) toast.error(getApiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!c) return
    const prev = document.title
    const safe = (c.client.name || c.client.pan || 'Computation').replace(/[^A-Za-z0-9 _-]/g, '')
    document.title = `Tax_Computation_${c.assessmentYear}_${safe}`
    return () => {
      document.title = prev
    }
  }, [c])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!c) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-slate-500">Computation not found.</p>
        <Link to="/computations" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Back to computations
        </Link>
      </div>
    )
  }

  // Re-derive output from the saved inputs so changes to the calculator
  // (e.g. updated slabs, new fields) are reflected immediately.
  const inputs = c.inputs as CalcInputs
  const result: CalcOutput = compute(inputs)

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to={`/computations/${c.id}`} className="text-sm text-blue-600 hover:underline">
            ← Back to computation
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="mx-auto my-6 max-w-5xl bg-white px-12 py-10 text-[12px] leading-relaxed text-slate-900 shadow-sm print:my-0 print:max-w-none print:px-10 print:py-8 print:shadow-none print:text-[11px]">
        {/* Letterhead */}
        <header className="mb-4 flex items-start justify-between border-b-[1.5px] border-slate-900 pb-3">
          <div className="flex items-center gap-3">
            {user?.firmLogoDataUrl ? (
              <img src={user.firmLogoDataUrl} alt={user.firmName} className="h-14 w-14 object-contain" />
            ) : (
              <img src="/ca-logo.svg" alt="CA360" className="h-14 w-14" />
            )}
            <div>
              <div className="text-lg font-bold">{user?.firmName ?? 'CA Firm'}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">
                Chartered Accountants
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold">Statement of Tax Computation</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Prepared by CA360</div>
          </div>
        </header>

        {/* Assessee + parameters */}
        <section className="mb-4">
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <Row2 left={['Name of Assessee', c.client.name]} right={['Assessment Year', c.assessmentYear]} />
              <Row2 left={['PAN', c.client.pan ?? '—']} right={['Tax Regime', REGIME_LABELS[c.regime]]} />
              <Row2
                left={['Client No.', `#${c.client.srNo}`]}
                right={['Age Category', AGE_LABELS[c.ageCategory]]}
              />
              {c.remarks && (
                <tr className="border-t border-slate-200">
                  <td className="w-[18%] border-r border-slate-200 py-1 pr-2 align-top text-slate-600">
                    Remarks
                  </td>
                  <td colSpan={3} className="py-1 pl-2 italic text-slate-700">
                    {c.remarks}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Computation title */}
        <h2 className="mb-2 mt-4 border-y border-slate-900 bg-slate-100 px-2 py-1 text-center text-[12px] font-bold print:bg-slate-200">
          Computation of Total Income{' '}
          {c.regime === 'NEW' ? '[Section 115BAC — New Tax Regime]' : '[Old Tax Regime]'}
        </h2>

        {/* Income */}
        <section className="mb-2">
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {result.netSalary > 0 && (
                <>
                  <Ledger label="Income from Salary" amount={inputs.income.salary} bold />
                  {result.standardDeductionApplied > 0 && (
                    <Ledger
                      label="Less: Standard deduction u/s 16(ia)"
                      sub={result.standardDeductionApplied}
                      indent={2}
                    />
                  )}
                  <Ledger label="Net salary income" amount={result.netSalary} indent={1} />
                </>
              )}
              {inputs.income.houseProperty !== 0 && (
                <Ledger
                  label="Income from House Property (Chapter IV C)"
                  amount={inputs.income.houseProperty}
                  bold
                />
              )}
              {inputs.income.business !== 0 && (
                <Ledger
                  label="Profits & Gains of Business or Profession (Chapter IV D)"
                  amount={inputs.income.business}
                  bold
                />
              )}
              {inputs.income.capitalGains !== 0 && (
                <Ledger
                  label="Capital Gains (Chapter IV E) — taxed at slab rates"
                  amount={inputs.income.capitalGains}
                  bold
                />
              )}
              {inputs.income.otherSources !== 0 && (
                <Ledger
                  label="Income from Other Sources (Chapter IV F)"
                  amount={inputs.income.otherSources}
                  bold
                />
              )}
              <Ledger label="Gross Total Income" amount={result.grossTotalIncome} bold rule />

              {result.deductions.rows.length > 0 && (
                <>
                  <Ledger
                    label="Less: Deductions (Chapter VI-A)"
                    amount={result.deductions.total}
                    bold
                  />
                  {result.deductions.rows.map((d) => (
                    <Ledger
                      key={d.code}
                      label={`${d.code} — ${d.label.replace(/ u\/s.*$/, '')}${
                        d.cappedAt !== undefined
                          ? ` (capped at ₹${d.cappedAt.toLocaleString('en-IN')})`
                          : ''
                      }`}
                      sub={d.allowed}
                      indent={2}
                    />
                  ))}
                </>
              )}
              <Ledger label="Total Income" amount={result.totalIncome} bold rule />
            </tbody>
          </table>
        </section>

        {/* Tax computation */}
        <h3 className="mb-1 mt-4 border-y border-slate-700 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 print:bg-slate-100">
          Tax Computation
        </h3>
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <Ledger label="Tax on total income" sub={result.taxOnIncome} indent={1} />
            {result.surcharge > 0 && (
              <Ledger
                label={`Surcharge @ ${(result.surchargeRate * 100).toFixed(0)}%`}
                sub={result.surcharge}
                indent={1}
              />
            )}
            <Ledger label="Health & Education Cess @ 4%" sub={result.healthEduCess} indent={1} />
            <Ledger label="Gross tax liability" amount={result.grossTaxLiability} bold />
            {result.rebate87A > 0 && (
              <Ledger label="Less: Rebate u/s 87A" sub={result.rebate87A} indent={1} />
            )}
            <Ledger label="Net tax liability" amount={result.netTaxLiability} bold rule />

            {result.interest.s234A > 0 && (
              <Ledger label="Add: Interest u/s 234A" sub={result.interest.s234A} indent={1} />
            )}
            {result.interest.s234B > 0 && (
              <Ledger label="Add: Interest u/s 234B" sub={result.interest.s234B} indent={1} />
            )}
            {result.interest.s234C > 0 && (
              <Ledger label="Add: Interest u/s 234C" sub={result.interest.s234C} indent={1} />
            )}
            {result.totalInterest > 0 && (
              <Ledger
                label="Total liability with interest"
                amount={result.totalLiabilityWithInterest}
                bold
                rule
              />
            )}

            {inputs.taxesPaid.tds > 0 && (
              <Ledger label="Less: TDS" sub={inputs.taxesPaid.tds} indent={1} />
            )}
            {inputs.taxesPaid.advanceTax > 0 && (
              <Ledger label="Less: Advance tax" sub={inputs.taxesPaid.advanceTax} indent={1} />
            )}
            {inputs.taxesPaid.selfAssessmentTax > 0 && (
              <Ledger
                label="Less: Self-Assessment tax"
                sub={inputs.taxesPaid.selfAssessmentTax}
                indent={1}
              />
            )}
          </tbody>
        </table>

        {/* Headline payable / refund */}
        <div className="mt-4 flex justify-end">
          <div className="rounded-md border-2 border-slate-900 px-6 py-3 text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {result.taxPayable > 0
                ? 'Tax Payable to Government'
                : result.taxPayable < 0
                  ? 'Refund Due'
                  : 'Net Position'}
            </div>
            <div
              className={`font-mono text-2xl font-bold ${
                result.taxPayable > 0
                  ? 'text-amber-700'
                  : result.taxPayable < 0
                    ? 'text-emerald-700'
                    : 'text-slate-700'
              }`}
            >
              {fmtINR(Math.abs(result.taxPayable))}
            </div>
          </div>
        </div>

        {/* Slab-wise breakdown */}
        {result.slabBreakdown.length > 0 && (
          <section className="mt-6 break-inside-avoid">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              Slab-wise Tax Calculation
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
              <thead>
                <tr className="border-b border-slate-400 bg-slate-50 text-left text-[10px] uppercase text-slate-600 print:bg-slate-100">
                  <th className="py-1 px-2">Bracket</th>
                  <th className="py-1 px-2 text-right">Taxable in bracket</th>
                  <th className="py-1 px-2 text-right">Rate</th>
                  <th className="py-1 px-2 text-right">Tax</th>
                </tr>
              </thead>
              <tbody>
                {result.slabBreakdown.map((s, i) => (
                  <tr key={i} className="border-b border-slate-200 last:border-b-0">
                    <td className="py-1 px-2 text-slate-700">{s.label.replace(/^[\d.]+% on |^Nil up to /, '')}</td>
                    <td className="py-1 px-2 text-right font-mono tabular-nums">{fmtINR(s.taxableInBracket)}</td>
                    <td className="py-1 px-2 text-right font-mono">
                      {(s.rate * 100).toFixed(0)}%
                    </td>
                    <td className="py-1 px-2 text-right font-mono tabular-nums">
                      {fmtINR(s.taxOnBracket)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Interest workings */}
        {inputs.interest?.enabled && result.interest.explanations.length > 0 && (
          <section className="mt-4 break-inside-avoid">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              Interest u/s 234 — Workings
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
              <tbody>
                {result.interest.explanations.map((e, i) => (
                  <tr key={i} className="border-b border-slate-200 last:border-b-0">
                    <td className="w-[15%] py-1 px-2 font-mono text-slate-700">{e.section}</td>
                    <td className="py-1 px-2 text-slate-700">{e.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Calculator notes */}
        {result.notes.length > 0 && (
          <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-[10.5px] text-amber-900 print:border-amber-400">
            <strong>Notes</strong>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <strong>Assessee:</strong> {c.client.name} &nbsp;|&nbsp; <strong>PAN:</strong>{' '}
              <span className="font-mono">{c.client.pan ?? '—'}</span> &nbsp;|&nbsp;{' '}
              <strong>A.Y.:</strong> {c.assessmentYear} &nbsp;|&nbsp;{' '}
              <strong>Regime:</strong> {REGIME_LABELS[c.regime]}
            </div>
            <div>
              Generated by {user?.firmName ?? 'CA360'} ·{' '}
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
          <div className="mt-2 text-[9px] italic text-slate-400">
            This statement is generated by automated tax computation software for planning and
            review purposes. Please verify before filing or sharing with the client.
          </div>
        </footer>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Tiny components — local to this page so we don't bloat shared code.
// ────────────────────────────────────────────────────────────────────

function Row2({ left, right }: { left: [string, string]; right: [string, string] }) {
  return (
    <tr className="border-b border-slate-200 last:border-b-0">
      <td className="w-[18%] border-r border-slate-200 py-1 pr-2 text-slate-600">{left[0]}</td>
      <td className="w-[32%] border-r border-slate-200 py-1 pl-2 pr-3 font-medium">{left[1]}</td>
      <td className="w-[18%] border-r border-slate-200 py-1 pl-3 pr-2 text-slate-600">{right[0]}</td>
      <td className="w-[32%] py-1 pl-2 font-medium">{right[1]}</td>
    </tr>
  )
}

function Ledger({
  label,
  sub,
  amount,
  bold = false,
  indent = 0,
  rule = false,
}: {
  label: React.ReactNode
  sub?: number
  amount?: number
  bold?: boolean
  indent?: number
  rule?: boolean
}) {
  const cls = bold ? 'font-semibold' : ''
  return (
    <tr className={rule ? 'border-t border-slate-400' : ''}>
      <td className={`py-[3px] ${cls}`} style={{ paddingLeft: `${indent * 12}px` }}>
        {label}
      </td>
      <td className={`w-[22%] py-[3px] text-right font-mono tabular-nums ${cls}`}>
        {sub !== undefined ? fmtINR(sub) : ''}
      </td>
      <td className={`w-[22%] py-[3px] pl-2 text-right font-mono tabular-nums ${cls}`}>
        {amount !== undefined ? fmtINR(amount) : ''}
      </td>
    </tr>
  )
}
