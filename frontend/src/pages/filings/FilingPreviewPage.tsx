import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { filingsApi } from '../../lib/filings-api'
import {
  FILING_STATUS_LABELS,
  ITR_FORM_LABELS,
  fmtDate,
  fmtINR,
  safeDetails,
  type FilingListItem,
  type IncomeHead,
  type ItrDetails,
  type TdsTcsRow,
} from '../../lib/api-types'
import { useAuth } from '../../lib/auth'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'

/**
 * Print-friendly Computation of Income page, modelled after the CompuTax /
 * Winman style sheets that CAs already share with clients. The toolbar at
 * the top is hidden in print (`print:hidden`); the rest is laid out for A4
 * portrait so "Save as PDF" gives a clean, dense, professional output.
 */
export default function FilingPreviewPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const [filing, setFiling] = useState<FilingListItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    filingsApi
      .detail(id)
      .then((f) => {
        if (!cancelled) setFiling(f)
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
  }, [id, toast])

  useEffect(() => {
    if (!filing) return
    const prev = document.title
    const safeName = (filing.client.name || filing.client.pan || 'COI').replace(/[^A-Za-z0-9 _-]/g, '')
    document.title = `COI_AY_${filing.assessmentYear}_${safeName}`
    return () => {
      document.title = prev
    }
  }, [filing])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!filing) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-slate-500">Filing not found.</p>
        <Link to="/clients" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
      </div>
    )
  }

  const d = safeDetails(filing.details)
  const hasCOI = d && hasAnyDetailsData(d)

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to={`/clients/${filing.clientId}`} className="text-sm text-blue-600 hover:underline">
            ← Back to client
          </Link>
          <div className="flex items-center gap-2">
            {filing.hasSourceJson && (
              <button
                type="button"
                onClick={() =>
                  filingsApi.downloadSourceJson(filing).catch((e) => toast.error(getApiErrorMessage(e)))
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Download JSON
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="mx-auto my-6 max-w-5xl bg-white px-12 py-10 text-[12px] leading-relaxed text-slate-900 shadow-sm print:my-0 print:max-w-none print:px-10 print:py-8 print:shadow-none print:text-[11px]">
        <Letterhead firmName={user?.firmName ?? 'CA Firm'} firmLogo={user?.firmLogoDataUrl ?? null} />

        <AssesseeTable filing={filing} details={d} />

        {hasCOI ? (
          <>
            <ComputationTitle regime={d!.regime} />
            <IncomeSection income={d!.income} grossTotalIncome={d!.grossTotalIncome} />
            <DeductionsSection
              deductions={d!.deductions}
              totalDeductions={d!.totalDeductions}
              totalIncome={d!.totalIncome}
              gti={d!.grossTotalIncome}
            />
            <TaxComputationSection
              rows={d!.taxComputation}
              totalTaxLiability={d!.totalTaxLiability}
              interestRows={d!.interestRows}
              refundOrPayable={d!.refundOrPayable}
              fallbackRefund={
                typeof filing.refundAmount === 'string'
                  ? Number(filing.refundAmount)
                  : filing.refundAmount
              }
              fallbackTaxPaid={
                typeof filing.taxPaid === 'string' ? Number(filing.taxPaid) : filing.taxPaid
              }
            />

            {d!.interestRows.length > 0 && <InterestTable rows={d!.interestRows} />}
            {d!.tdsRows.length > 0 && <TdsTable title="Details of T.D.S." rows={d!.tdsRows} />}
            {d!.tcsRows.length > 0 && <TdsTable title="Details of T.C.S." rows={d!.tcsRows} />}
            {d!.prepaidChallans.length > 0 && <PrepaidChallansTable rows={d!.prepaidChallans} />}
            {d!.bankAccounts.length > 0 && <BankAccountsTable rows={d!.bankAccounts} />}
          </>
        ) : (
          <div className="my-8 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No structured Computation of Income on file. Re-import the ITR JSON to
            generate this sheet.
          </div>
        )}

        <Footer
          firmName={user?.firmName ?? 'CA Firm'}
          assesseeName={d?.assessee.name ?? filing.client.name}
          pan={filing.client.pan ?? d?.assessee.pan ?? '—'}
          ay={filing.assessmentYear}
          status={FILING_STATUS_LABELS[filing.status]}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Sub-components — kept in this file for now; pull out if reused.
// ────────────────────────────────────────────────────────────────────

function Letterhead({ firmName, firmLogo }: { firmName: string; firmLogo: string | null }) {
  return (
    <header className="mb-4 flex items-start justify-between border-b-[1.5px] border-slate-900 pb-3">
      <div className="flex items-center gap-3">
        {firmLogo ? (
          <img src={firmLogo} alt={firmName} className="h-14 w-14 object-contain" />
        ) : (
          <img src="/ca-logo.svg" alt="CA360" className="h-14 w-14" />
        )}
        <div>
          <div className="text-lg font-bold text-slate-900">{firmName}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-600">Chartered Accountants</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-base font-semibold text-slate-900">Computation of Income</div>
        <div className="mt-0.5 text-[10px] text-slate-500">Prepared by CA360</div>
      </div>
    </header>
  )
}

function AssesseeTable({ filing, details }: { filing: FilingListItem; details: ItrDetails | null }) {
  const a = details?.assessee
  const m = details?.filing
  const rows: { left: [string, string]; right: [string, string] }[] = [
    {
      left: ['Name of Assessee', a?.name ?? filing.client.name],
      right: ['Assessment Year', filing.assessmentYear],
    },
    {
      left: ["Father's Name", a?.fatherName ?? '—'],
      right: ['Year Ended', m?.yearEnded ?? deriveYearEnded(filing.assessmentYear)],
    },
    {
      left: ['Address', a?.address ?? '—'],
      right: ['Status', FILING_STATUS_LABELS[filing.status]],
    },
    {
      left: ['E-Mail', a?.email ?? '—'],
      right: ['Filing Type', m?.filingType ?? '—'],
    },
    {
      left: ['PAN', filing.client.pan ?? a?.pan ?? '—'],
      right: ['Date of Birth', a?.dateOfBirth ?? '—'],
    },
    {
      left: ['Aadhaar No.', a?.aadhaar ?? '—'],
      right: ['Gender', a?.gender ?? '—'],
    },
    {
      left: ['Residential Status', a?.residentialStatus ?? '—'],
      right: ['ITR Form', filing.itrForm ? ITR_FORM_LABELS[filing.itrForm] : '—'],
    },
    {
      left: ['Nature of Business', a?.natureOfBusiness ?? '—'],
      right: ['Mobile', a?.mobile ?? '—'],
    },
    {
      left: ['Filed On', m?.filedDate ?? fmtDate(filing.filedDate)],
      right: ['Acknowledgement No.', m?.acknowledgementNo ?? filing.acknowledgementNo ?? '—'],
    },
  ]
  return (
    <section className="mb-4">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200 last:border-b-0">
              <td className="w-[18%] border-r border-slate-200 py-1 pr-2 text-slate-600">{r.left[0]}</td>
              <td className="w-[32%] border-r border-slate-200 py-1 pl-2 pr-3 font-medium text-slate-900">
                {r.left[1]}
              </td>
              <td className="w-[18%] border-r border-slate-200 py-1 pl-3 pr-2 text-slate-600">
                {r.right[0]}
              </td>
              <td className="w-[32%] py-1 pl-2 font-medium text-slate-900">{r.right[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ComputationTitle({ regime }: { regime: 'OLD' | 'NEW' | null }) {
  const label =
    regime === 'NEW'
      ? '[As per Section 115BAC (New Tax Regime)]'
      : regime === 'OLD'
        ? '[Old Tax Regime]'
        : ''
  return (
    <h2 className="mb-2 mt-4 border-y border-slate-900 bg-slate-100 px-2 py-1 text-center text-[12px] font-bold text-slate-900 print:bg-slate-200">
      Computation of Total Income {label}
    </h2>
  )
}

/**
 * Two-column ledger row: a label on the left, an amount column for sub-totals,
 * and a total column on the far right. Mirrors the look of CompuTax's COI.
 */
function LedgerRow({
  label,
  subAmount,
  amount,
  bold = false,
  indent = 0,
  rule = false,
}: {
  label: React.ReactNode
  subAmount?: number | null
  amount?: number | null
  bold?: boolean
  indent?: number
  rule?: boolean
}) {
  const cls = bold ? 'font-semibold' : ''
  return (
    <tr className={rule ? 'border-t border-slate-400' : ''}>
      <td
        className={`py-[3px] ${cls} text-slate-900`}
        style={{ paddingLeft: `${indent * 12}px` }}
      >
        {label}
      </td>
      <td className={`w-[22%] py-[3px] text-right font-mono tabular-nums ${cls} text-slate-900`}>
        {subAmount !== undefined && subAmount !== null ? fmtINR(subAmount) : ''}
      </td>
      <td className={`w-[22%] py-[3px] pl-2 text-right font-mono tabular-nums ${cls} text-slate-900`}>
        {amount !== undefined && amount !== null ? fmtINR(amount) : ''}
      </td>
    </tr>
  )
}

function IncomeSection({
  income,
  grossTotalIncome,
}: {
  income: IncomeHead[]
  grossTotalIncome: number | null
}) {
  return (
    <section className="mb-2">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {income.map((h, i) => (
            <FragmentHead key={i} head={h} />
          ))}
          {grossTotalIncome !== null && (
            <LedgerRow label="Gross Total Income" amount={grossTotalIncome} bold rule />
          )}
        </tbody>
      </table>
    </section>
  )
}

function FragmentHead({ head }: { head: IncomeHead }) {
  return (
    <>
      <LedgerRow label={head.label} amount={head.total} bold />
      {head.subRows.map((sr, i) => (
        <LedgerRow key={i} label={sr.label} subAmount={sr.amount} indent={2} />
      ))}
    </>
  )
}

function DeductionsSection({
  deductions,
  totalDeductions,
  totalIncome,
  gti,
}: {
  deductions: { code: string; label: string; amount: number }[]
  totalDeductions: number | null
  totalIncome: number | null
  gti: number | null
}) {
  // Show even if no deductions — that's important info for the COI.
  const totalDed = totalDeductions ?? deductions.reduce((s, d) => s + d.amount, 0)
  return (
    <section className="mb-2">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <LedgerRow label="Less: Deductions (Chapter VI-A)" amount={totalDed} bold />
          {deductions.map((d) => (
            <LedgerRow
              key={d.code}
              label={`${d.code} — ${d.label.replace(/ u\/s.*$/, '')}`}
              subAmount={d.amount}
              indent={2}
            />
          ))}
          {totalIncome !== null && (
            <LedgerRow label="Total Income" amount={totalIncome} bold rule />
          )}
          {totalIncome === null && gti !== null && totalDed > 0 && (
            <LedgerRow label="Total Income" amount={gti - totalDed} bold rule />
          )}
        </tbody>
      </table>
    </section>
  )
}

function TaxComputationSection({
  rows,
  totalTaxLiability,
  interestRows,
  refundOrPayable,
  fallbackRefund,
  fallbackTaxPaid,
}: {
  rows: { label: string; amount: number | null; emphasise?: boolean }[]
  totalTaxLiability: number | null
  interestRows: { section: string; amount: number }[]
  refundOrPayable: number | null
  fallbackRefund: number | null
  fallbackTaxPaid: number | null
}) {
  const interestTotal = interestRows.reduce((s, r) => s + r.amount, 0)
  const refundLabel =
    refundOrPayable !== null && refundOrPayable < 0
      ? 'Tax Payable'
      : 'Refund Due'
  const refundAmount =
    refundOrPayable !== null
      ? Math.abs(refundOrPayable)
      : fallbackRefund && fallbackRefund > 0
        ? fallbackRefund
        : null

  return (
    <section className="mb-3">
      <h3 className="mb-1 mt-4 border-y border-slate-700 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 print:bg-slate-100">
        Tax Computation
      </h3>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {rows.map((r, i) => (
            <LedgerRow
              key={i}
              label={r.label}
              subAmount={r.emphasise ? undefined : r.amount}
              amount={r.emphasise ? r.amount : undefined}
              bold={r.emphasise}
            />
          ))}
          {interestTotal > 0 && (
            <LedgerRow
              label={`Interest u/s 234${interestRows.map((r) => r.section.slice(-1)).join('/')}`}
              subAmount={interestTotal}
              indent={1}
            />
          )}
          {fallbackTaxPaid !== null && fallbackTaxPaid > 0 && (
            <LedgerRow label="Less: Taxes paid (TDS / TCS / Advance / SAT)" subAmount={fallbackTaxPaid} indent={1} />
          )}
          {totalTaxLiability !== null && (
            <LedgerRow label="Total Tax Liability" amount={totalTaxLiability} bold rule />
          )}
          {refundAmount !== null && (
            <LedgerRow label={refundLabel} amount={refundAmount} bold rule />
          )}
        </tbody>
      </table>
    </section>
  )
}

function InterestTable({ rows }: { rows: { section: string; amount: number }[] }) {
  return (
    <Table title="Interest Charged u/s 234">
      <thead>
        <tr className="border-b border-slate-400 bg-slate-50 text-left text-[10px] uppercase text-slate-600 print:bg-slate-100">
          <th className="py-1 pr-2">Section</th>
          <th className="py-1 pl-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.section} className="border-b border-slate-200 last:border-b-0">
            <td className="py-1 pr-2 text-slate-700">u/s {r.section}</td>
            <td className="py-1 pl-2 text-right font-mono tabular-nums">{fmtINR(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function TdsTable({ title, rows }: { title: string; rows: TdsTcsRow[] }) {
  return (
    <Table title={title}>
      <thead>
        <tr className="border-b border-slate-400 bg-slate-50 text-left text-[10px] uppercase text-slate-600 print:bg-slate-100">
          <th className="py-1 pr-2">Name</th>
          <th className="py-1 px-2">TAN</th>
          <th className="py-1 px-2 text-right">Amount Paid/Credited</th>
          <th className="py-1 px-2 text-right">Tax Deducted</th>
          <th className="py-1 pl-2 text-right">Claimed This Year</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200 last:border-b-0">
            <td className="py-1 pr-2 text-slate-800">{r.name}</td>
            <td className="py-1 px-2 font-mono text-[10px] text-slate-600">{r.tan ?? '—'}</td>
            <td className="py-1 px-2 text-right font-mono tabular-nums">
              {r.amountPaidCredited !== null ? fmtINR(r.amountPaidCredited) : '—'}
            </td>
            <td className="py-1 px-2 text-right font-mono tabular-nums">
              {r.totalTaxDeducted !== null ? fmtINR(r.totalTaxDeducted) : '—'}
            </td>
            <td className="py-1 pl-2 text-right font-mono tabular-nums">
              {r.amountClaimedThisYear !== null ? fmtINR(r.amountClaimedThisYear) : '—'}
            </td>
          </tr>
        ))}
        <tr className="border-t border-slate-400">
          <td className="py-1 pr-2 font-semibold">Total</td>
          <td />
          <td />
          <td className="py-1 px-2 text-right font-mono font-semibold tabular-nums">
            {fmtINR(rows.reduce((s, r) => s + (r.totalTaxDeducted ?? 0), 0))}
          </td>
          <td className="py-1 pl-2 text-right font-mono font-semibold tabular-nums">
            {fmtINR(rows.reduce((s, r) => s + (r.amountClaimedThisYear ?? 0), 0))}
          </td>
        </tr>
      </tbody>
    </Table>
  )
}

function PrepaidChallansTable({
  rows,
}: {
  rows: { bsrCode: string | null; date: string | null; challanNo: string | null; bankName: string | null; amount: number | null }[]
}) {
  return (
    <Table title="Prepaid Taxes (Advance Tax & Self-Assessment Tax)">
      <thead>
        <tr className="border-b border-slate-400 bg-slate-50 text-left text-[10px] uppercase text-slate-600 print:bg-slate-100">
          <th className="py-1 pr-2">BSR Code</th>
          <th className="py-1 px-2">Date</th>
          <th className="py-1 px-2">Challan No</th>
          <th className="py-1 px-2">Bank</th>
          <th className="py-1 pl-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200 last:border-b-0">
            <td className="py-1 pr-2 font-mono text-[10px]">{r.bsrCode ?? '—'}</td>
            <td className="py-1 px-2">{r.date ?? '—'}</td>
            <td className="py-1 px-2 font-mono text-[10px]">{r.challanNo ?? '—'}</td>
            <td className="py-1 px-2 text-slate-700">{r.bankName ?? '—'}</td>
            <td className="py-1 pl-2 text-right font-mono tabular-nums">
              {r.amount !== null ? fmtINR(r.amount) : '—'}
            </td>
          </tr>
        ))}
        <tr className="border-t border-slate-400">
          <td colSpan={4} className="py-1 pr-2 font-semibold">
            Total
          </td>
          <td className="py-1 pl-2 text-right font-mono font-semibold tabular-nums">
            {fmtINR(rows.reduce((s, r) => s + (r.amount ?? 0), 0))}
          </td>
        </tr>
      </tbody>
    </Table>
  )
}

function BankAccountsTable({
  rows,
}: {
  rows: { bankName: string | null; accountNo: string | null; ifsc: string | null; type: string | null; primary: boolean }[]
}) {
  return (
    <Table title="Bank Account Details">
      <thead>
        <tr className="border-b border-slate-400 bg-slate-50 text-left text-[10px] uppercase text-slate-600 print:bg-slate-100">
          <th className="py-1 pr-2">Bank</th>
          <th className="py-1 px-2">Account No.</th>
          <th className="py-1 px-2">IFSC</th>
          <th className="py-1 px-2">Type</th>
          <th className="py-1 pl-2">Refund</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200 last:border-b-0">
            <td className="py-1 pr-2 text-slate-800">{r.bankName ?? '—'}</td>
            <td className="py-1 px-2 font-mono text-[10px]">{r.accountNo ?? '—'}</td>
            <td className="py-1 px-2 font-mono text-[10px]">{r.ifsc ?? '—'}</td>
            <td className="py-1 px-2">{r.type ?? '—'}</td>
            <td className="py-1 pl-2 text-slate-700">{r.primary ? 'Primary' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function Table({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 break-inside-avoid">
      <h3 className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        {title}
      </h3>
      <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
        {children}
      </table>
    </section>
  )
}

function Footer({
  firmName,
  assesseeName,
  pan,
  ay,
  status,
}: {
  firmName: string
  assesseeName: string | null
  pan: string
  ay: string
  status: string
}) {
  return (
    <footer className="mt-8 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <strong>Assessee:</strong> {assesseeName ?? '—'} &nbsp;|&nbsp; <strong>PAN:</strong>{' '}
          <span className="font-mono">{pan}</span> &nbsp;|&nbsp; <strong>A.Y.:</strong> {ay}{' '}
          &nbsp;|&nbsp; <strong>Status:</strong> {status}
        </div>
        <div>
          Generated by {firmName} via CA360 ·{' '}
          {new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </div>
    </footer>
  )
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function hasAnyDetailsData(d: ItrDetails): boolean {
  return (
    d.income.length > 0 ||
    d.deductions.length > 0 ||
    d.taxComputation.length > 0 ||
    d.tdsRows.length > 0 ||
    d.tcsRows.length > 0 ||
    d.prepaidChallans.length > 0 ||
    d.bankAccounts.length > 0 ||
    d.grossTotalIncome !== null ||
    d.totalIncome !== null
  )
}

/** AY "2024-25" → "31.3.2024". */
function deriveYearEnded(ay: string): string {
  const m = /^(\d{4})-/.exec(ay)
  if (!m) return '—'
  const startYear = parseInt(m[1], 10)
  return `31.3.${startYear}`
}
