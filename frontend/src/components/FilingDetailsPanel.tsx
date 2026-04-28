import { fmtINR, type ItrDetails } from '../lib/api-types'

interface Props {
  details: ItrDetails | null
}

/**
 * CA-style Computation of Income panel. Renders the structured `details`
 * extracted from an imported ITR JSON: one card per section (Personal,
 * Income, Deductions, Tax, etc.) with right-aligned numeric values.
 */
export default function FilingDetailsPanel({ details }: Props) {
  if (!details || details.sections.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
        No structured details available — this filing was either created manually
        or imported before COI extraction was added. Re-import the JSON to populate.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {details.sections.map((s) => (
        <div key={s.title} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {s.title}
          </div>
          <dl className="space-y-1">
            {s.rows.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
                <dt className="text-slate-600">{r.label}</dt>
                <dd
                  className={
                    typeof r.value === 'number'
                      ? 'font-mono tabular-nums text-slate-900'
                      : 'text-right text-slate-900'
                  }
                >
                  {typeof r.value === 'number'
                    ? fmtINR(r.value)
                    : (r.value ?? '—')}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
