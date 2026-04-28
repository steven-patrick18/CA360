import { fmtINR, type ItrDetails } from '../lib/api-types'

interface Props {
  details: ItrDetails | null
}

/**
 * Compact in-row summary of the parsed Computation of Income. The full
 * print-styled CA sheet lives at /filings/:id/preview — this panel is
 * just the at-a-glance view inside the expanded row.
 */
export default function FilingDetailsPanel({ details }: Props) {
  if (!details || !hasAnyData(details)) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
        No structured details available — this filing was either created manually
        or imported before COI extraction was added. Re-import the JSON to populate.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {details.income.length > 0 && (
        <Card title="Income heads">
          {details.income.map((h) => (
            <Row key={h.label} label={h.label} value={h.total} />
          ))}
          {details.grossTotalIncome !== null && (
            <Row label="Gross total income" value={details.grossTotalIncome} bold />
          )}
        </Card>
      )}

      {details.deductions.length > 0 && (
        <Card title="Chapter VI-A deductions">
          {details.deductions.map((d) => (
            <Row key={d.code} label={`${d.code} — ${d.label.replace(/^.* u\/s .*/, d.label)}`} value={d.amount} />
          ))}
          {details.totalDeductions !== null && (
            <Row label="Total deductions" value={details.totalDeductions} bold />
          )}
        </Card>
      )}

      {details.taxComputation.length > 0 && (
        <Card title="Tax computation">
          {details.taxComputation.map((r, i) => (
            <Row key={i} label={r.label} value={r.amount} bold={r.emphasise} />
          ))}
          {details.totalTaxLiability !== null && (
            <Row label="Total tax liability" value={details.totalTaxLiability} bold />
          )}
        </Card>
      )}

      {(details.tdsRows.length > 0 || details.tcsRows.length > 0 || details.prepaidChallans.length > 0) && (
        <Card title="Taxes paid">
          {details.tdsRows.length > 0 && (
            <Row label={`TDS (${details.tdsRows.length} deductor${details.tdsRows.length === 1 ? '' : 's'})`}
                 value={sum(details.tdsRows.map((r) => r.totalTaxDeducted))} />
          )}
          {details.tcsRows.length > 0 && (
            <Row label={`TCS (${details.tcsRows.length} collector${details.tcsRows.length === 1 ? '' : 's'})`}
                 value={sum(details.tcsRows.map((r) => r.totalTaxDeducted))} />
          )}
          {details.prepaidChallans.length > 0 && (
            <Row label={`Advance / SAT (${details.prepaidChallans.length} challan${details.prepaidChallans.length === 1 ? '' : 's'})`}
                 value={sum(details.prepaidChallans.map((r) => r.amount))} />
          )}
        </Card>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <dl className="space-y-1">{children}</dl>
    </div>
  )
}

function Row({ label, value, bold = false }: { label: string; value: number | null; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 text-xs ${bold ? 'border-t border-slate-200 pt-1 font-semibold' : ''}`}>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-mono tabular-nums text-slate-900">{fmtINR(value)}</dd>
    </div>
  )
}

function sum(xs: (number | null)[]): number {
  return xs.reduce<number>((acc, x) => acc + (x ?? 0), 0)
}

function hasAnyData(d: ItrDetails): boolean {
  return (
    d.income.length > 0 ||
    d.deductions.length > 0 ||
    d.taxComputation.length > 0 ||
    d.tdsRows.length > 0 ||
    d.tcsRows.length > 0 ||
    d.prepaidChallans.length > 0
  )
}
