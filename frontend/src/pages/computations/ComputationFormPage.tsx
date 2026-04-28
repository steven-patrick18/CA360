import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clientsApi } from '../../lib/clients-api'
import { computationsApi } from '../../lib/computations-api'
import { fmtINR, type ClientListItem } from '../../lib/api-types'
import {
  AGE_LABELS,
  REGIME_LABELS,
  SUPPORTED_AYS,
  compute,
  emptyInputs,
  reverseSolve,
  type AgeCategory,
  type AssessmentYear,
  type CalcInputs,
  type TaxRegime,
} from '../../lib/tax-calculator'
import Spinner from '../../components/Spinner'
import { useToast, getApiErrorMessage } from '../../lib/toast'

/**
 * Form for creating or editing a tax computation. Live-calculates as the user
 * types — the saved snapshot is whatever was on screen at Save time, so the
 * user always sees what's about to be persisted.
 */
export default function ComputationFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()

  const [clients, setClients] = useState<ClientListItem[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingExisting, setLoadingExisting] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [clientId, setClientId] = useState('')
  const [inputs, setInputs] = useState<CalcInputs>(emptyInputs())
  const [remarks, setRemarks] = useState('')

  // Reverse-solve "plan from target tax" panel state
  const [planOpen, setPlanOpen] = useState(false)
  const [targetTax, setTargetTax] = useState<number>(10000)

  // Load clients (and existing computation if editing)
  useEffect(() => {
    let cancelled = false
    setLoadingMeta(true)
    clientsApi
      .list({ limit: 500 })
      .then((res) => {
        if (!cancelled) setClients(res.items)
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoadingExisting(true)
    computationsApi
      .detail(id)
      .then((c) => {
        if (cancelled) return
        setClientId(c.clientId)
        setInputs({
          assessmentYear: c.assessmentYear as AssessmentYear,
          regime: c.regime,
          ageCategory: c.ageCategory,
          income: c.inputs.income,
          deductions: c.inputs.deductions,
          taxesPaid: c.inputs.taxesPaid,
        })
        setRemarks(c.remarks ?? '')
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => {
        if (!cancelled) setLoadingExisting(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, toast])

  // Live calculation
  const result = useMemo(() => compute(inputs), [inputs])

  // Reverse solve uses the form's current AY / regime / age — so the user
  // can change those dropdowns first and then plan from the target tax.
  const plan = useMemo(
    () => reverseSolve(targetTax, inputs.assessmentYear, inputs.regime, inputs.ageCategory),
    [targetTax, inputs.assessmentYear, inputs.regime, inputs.ageCategory],
  )

  function applyPlan(withDeductions: boolean) {
    setInputs((s) => ({
      ...s,
      income: {
        salary: withDeductions ? plan.requiredGrossIncome : plan.taxableIncome,
        houseProperty: 0,
        business: 0,
        capitalGains: 0,
        otherSources: 0,
      },
      deductions: withDeductions
        ? plan.suggestedDeductions
        : { s80C: 0, s80CCD1B: 0, s80D: 0, s80G: 0, s80TTA: 0, s80TTB: 0 },
    }))
    setPlanOpen(false)
    toast.success(
      withDeductions
        ? 'Applied with suggested deductions — tweak income split / deductions as needed.'
        : 'Applied income only — tweak across heads as needed.',
    )
  }

  function setIncome<K extends keyof CalcInputs['income']>(k: K, v: number) {
    setInputs((s) => ({ ...s, income: { ...s.income, [k]: v } }))
  }
  function setDed<K extends keyof CalcInputs['deductions']>(k: K, v: number) {
    setInputs((s) => ({ ...s, deductions: { ...s.deductions, [k]: v } }))
  }
  function setPaid<K extends keyof CalcInputs['taxesPaid']>(k: K, v: number) {
    setInputs((s) => ({ ...s, taxesPaid: { ...s.taxesPaid, [k]: v } }))
  }

  async function handleSave() {
    if (!clientId) {
      toast.error('Please select a client first.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        clientId,
        assessmentYear: inputs.assessmentYear,
        regime: inputs.regime,
        ageCategory: inputs.ageCategory,
        inputs,
        computed: result,
        taxPayable: result.taxPayable,
        remarks: remarks || undefined,
      }
      const saved = isEdit
        ? await computationsApi.update(id!, payload)
        : await computationsApi.create(payload)
      toast.success(isEdit ? 'Computation updated' : 'Computation saved')
      if (!isEdit) navigate(`/computations/${saved.id}`, { replace: true })
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!window.confirm('Delete this computation? This cannot be undone.')) return
    setDeleting(true)
    try {
      await computationsApi.remove(id!)
      toast.success('Computation deleted')
      navigate('/computations')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loadingMeta || loadingExisting) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const isOldRegime = inputs.regime === 'OLD'

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link to="/computations" className="text-sm text-blue-600 hover:underline">
          ← Back to computations
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {isEdit ? 'Edit Tax Computation' : 'New Tax Computation'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Individual taxpayer · slabs and surcharge applied automatically based on AY +
              regime. Saved snapshot reflects what's shown here.
            </p>
          </div>
          <div className="flex gap-2">
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Reverse-solve "Plan from Target Tax" — collapsible card sitting above the form */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setPlanOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-indigo-900">
              Plan from Target Tax
              <span className="ml-2 text-[11px] font-normal text-indigo-700">
                (reverse-solve — enter desired tax, get the income figures)
              </span>
            </div>
            <div className="mt-0.5 text-xs text-indigo-700">
              Use this when a client says "I want to pay ₹X tax" and you need to work backwards.
            </div>
          </div>
          <span className="text-xl text-indigo-700">{planOpen ? '−' : '+'}</span>
        </button>

        {planOpen && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Input side */}
            <div className="space-y-3">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">
                  Target Tax Payable (₹)
                </div>
                <input
                  type="number"
                  min={0}
                  value={targetTax === 0 ? '' : targetTax}
                  onChange={(e) => setTargetTax(Number(e.target.value) || 0)}
                  placeholder="e.g. 10000"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  Final tax to govt., post-cess. AY / regime / age use the form's
                  current selections — change those dropdowns first if needed.
                </div>
              </label>

              <div className="rounded-md bg-white p-3 text-xs ring-1 ring-slate-200">
                <Row label="Required Total Income" value={plan.taxableIncome} bold />
                {plan.suggestedDeductions && inputs.regime === 'OLD' && (
                  <>
                    <div className="mt-2 border-t border-slate-200 pt-2 text-[10px] uppercase tracking-wide text-slate-500">
                      Suggested deductions (Old regime baseline)
                    </div>
                    {plan.suggestedDeductions.s80C > 0 && (
                      <Row label="80C" value={plan.suggestedDeductions.s80C} />
                    )}
                    {plan.suggestedDeductions.s80CCD1B > 0 && (
                      <Row label="80CCD(1B)" value={plan.suggestedDeductions.s80CCD1B} />
                    )}
                    {plan.suggestedDeductions.s80D > 0 && (
                      <Row label="80D" value={plan.suggestedDeductions.s80D} />
                    )}
                    {plan.suggestedDeductions.s80TTA > 0 && (
                      <Row label="80TTA" value={plan.suggestedDeductions.s80TTA} />
                    )}
                    {plan.suggestedDeductions.s80TTB > 0 && (
                      <Row label="80TTB" value={plan.suggestedDeductions.s80TTB} />
                    )}
                  </>
                )}
                <Row
                  label={inputs.regime === 'OLD' ? 'Required Gross Total Income' : 'Required Gross Total Income'}
                  value={plan.requiredGrossIncome}
                  bold
                  rule
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPlan(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Apply income only
                </button>
                {inputs.regime === 'OLD' && (
                  <button
                    type="button"
                    onClick={() => applyPlan(true)}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Apply with suggested deductions
                  </button>
                )}
              </div>
            </div>

            {/* Slab + notes */}
            <div className="space-y-3">
              {plan.slabBreakdown.length > 0 && (
                <div className="rounded-md bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                    Slab-wise tax (target ₹{targetTax.toLocaleString('en-IN')})
                  </div>
                  <ul className="space-y-1 text-slate-700">
                    {plan.slabBreakdown.map((s, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{s.label}</span>
                        <span className="shrink-0 font-mono tabular-nums">
                          {fmtINR(s.taxOnBracket)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.notes.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                  <strong>Notes</strong>
                  <ul className="mt-1 list-disc pl-5 space-y-0.5">
                    {plan.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Inputs (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Parameters */}
          <Card title="Parameters">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Client"
                value={clientId}
                onChange={setClientId}
                options={clients.map((c) => ({
                  value: c.id,
                  label: `#${c.srNo} ${c.name}${c.pan ? ` (${c.pan})` : ''}`,
                }))}
                placeholder="Select a client"
                required
              />
              <Select
                label="Assessment Year"
                value={inputs.assessmentYear}
                onChange={(v) => setInputs((s) => ({ ...s, assessmentYear: v as AssessmentYear }))}
                options={SUPPORTED_AYS.map((a) => ({ value: a, label: `AY ${a}` }))}
              />
              <Select
                label="Tax Regime"
                value={inputs.regime}
                onChange={(v) => setInputs((s) => ({ ...s, regime: v as TaxRegime }))}
                options={[
                  { value: 'NEW', label: REGIME_LABELS.NEW },
                  { value: 'OLD', label: REGIME_LABELS.OLD },
                ]}
              />
              <Select
                label="Age Category"
                value={inputs.ageCategory}
                onChange={(v) => setInputs((s) => ({ ...s, ageCategory: v as AgeCategory }))}
                options={[
                  { value: 'BELOW_60', label: AGE_LABELS.BELOW_60 },
                  { value: 'SENIOR_60_TO_79', label: AGE_LABELS.SENIOR_60_TO_79 },
                  { value: 'SUPER_SENIOR_80_PLUS', label: AGE_LABELS.SUPER_SENIOR_80_PLUS },
                ]}
                hint={
                  isOldRegime
                    ? 'Affects basic exemption limit (₹2.5L / ₹3L / ₹5L)'
                    : 'Same exemption (₹3L) for all ages under New regime'
                }
              />
            </div>
          </Card>

          <Card title="Income">
            <Money
              label="Income from Salary (gross)"
              value={inputs.income.salary}
              onChange={(v) => setIncome('salary', v)}
              hint={`Standard deduction of ₹${result.standardDeductionApplied.toLocaleString('en-IN')} auto-applied`}
            />
            <Money
              label="Income from House Property (net)"
              value={inputs.income.houseProperty}
              onChange={(v) => setIncome('houseProperty', v)}
              hint="After 30% std deduction and interest on borrowed capital"
            />
            <Money
              label="Profits from Business or Profession"
              value={inputs.income.business}
              onChange={(v) => setIncome('business', v)}
            />
            <Money
              label="Income from Capital Gains"
              value={inputs.income.capitalGains}
              onChange={(v) => setIncome('capitalGains', v)}
              hint="v1 limitation: taxed at slab rates. STCG 111A / LTCG 112A special rates not applied yet."
              warn={inputs.income.capitalGains > 0}
            />
            <Money
              label="Income from Other Sources"
              value={inputs.income.otherSources}
              onChange={(v) => setIncome('otherSources', v)}
              hint="Interest, dividend, family pension, etc."
            />
          </Card>

          <Card title={`Chapter VI-A Deductions ${isOldRegime ? '' : '(disabled — New Regime)'}`}>
            <div className={isOldRegime ? '' : 'pointer-events-none opacity-50'}>
              <Money
                label="80C — Investments (cap ₹1,50,000)"
                value={inputs.deductions.s80C}
                onChange={(v) => setDed('s80C', v)}
              />
              <Money
                label="80CCD(1B) — NPS additional (cap ₹50,000)"
                value={inputs.deductions.s80CCD1B}
                onChange={(v) => setDed('s80CCD1B', v)}
              />
              <Money
                label="80D — Health insurance (cap ₹1,00,000)"
                value={inputs.deductions.s80D}
                onChange={(v) => setDed('s80D', v)}
              />
              <Money
                label="80G — Donations (eligible amount)"
                value={inputs.deductions.s80G}
                onChange={(v) => setDed('s80G', v)}
              />
              <Money
                label="80TTA — Savings interest (cap ₹10,000)"
                value={inputs.deductions.s80TTA}
                onChange={(v) => setDed('s80TTA', v)}
              />
              <Money
                label="80TTB — Senior savings interest (cap ₹50,000)"
                value={inputs.deductions.s80TTB}
                onChange={(v) => setDed('s80TTB', v)}
              />
            </div>
          </Card>

          <Card title="Taxes Already Paid">
            <Money label="TDS" value={inputs.taxesPaid.tds} onChange={(v) => setPaid('tds', v)} />
            <Money
              label="Advance Tax"
              value={inputs.taxesPaid.advanceTax}
              onChange={(v) => setPaid('advanceTax', v)}
            />
            <Money
              label="Self-Assessment Tax"
              value={inputs.taxesPaid.selfAssessmentTax}
              onChange={(v) => setPaid('selfAssessmentTax', v)}
            />
          </Card>

          <Card title="Remarks">
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Internal notes — visible only to your firm"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Card>
        </div>

        {/* Output (1/3, sticky) */}
        <div className="space-y-3">
          <div className="sticky top-4 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Computed Result
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <Row label="Net salary (after std ded)" value={result.netSalary} />
                <Row label="Gross Total Income" value={result.grossTotalIncome} bold />
                {result.deductions.total > 0 && (
                  <Row label="Less: Deductions" value={result.deductions.total} />
                )}
                <Row label="Total Income" value={result.totalIncome} bold rule />
                <Row label="Tax on income (slabs)" value={result.taxOnIncome} />
                {result.surcharge > 0 && (
                  <Row
                    label={`Surcharge @ ${(result.surchargeRate * 100).toFixed(0)}%`}
                    value={result.surcharge}
                  />
                )}
                <Row label="Health & Edu cess @ 4%" value={result.healthEduCess} />
                <Row label="Gross tax liability" value={result.grossTaxLiability} bold />
                {result.rebate87A > 0 && (
                  <Row label="Less: Rebate u/s 87A" value={result.rebate87A} />
                )}
                <Row label="Net tax liability" value={result.netTaxLiability} bold rule />
                {result.totalTaxesPaid > 0 && (
                  <Row label="Less: Taxes paid" value={result.totalTaxesPaid} />
                )}
              </div>

              <div className="mt-4 rounded-md border-2 border-slate-900 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {result.taxPayable > 0
                    ? 'Tax Payable to Govt.'
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

            {/* Slab breakdown */}
            {result.slabBreakdown.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                  Slab-wise Tax
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  {result.slabBreakdown.map((s, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{s.label}</span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {fmtINR(s.taxOnBracket)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {result.notes.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Notes</strong>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Tiny field components
// ────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-base font-medium text-slate-900">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  )
}

function Money({
  label,
  value,
  onChange,
  hint,
  warn,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
  warn?: boolean
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-700">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-slate-400">
          {value > 0 ? `= ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)}` : ''}
        </span>
      </div>
      <input
        type="number"
        min={0}
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder="0"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && (
        <div className={`mt-1 text-[11px] ${warn ? 'text-amber-700' : 'text-slate-500'}`}>{hint}</div>
      )}
    </label>
  )
}

function Row({
  label,
  value,
  bold = false,
  rule = false,
}: {
  label: string
  value: number
  bold?: boolean
  rule?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 ${bold ? 'font-semibold' : ''} ${rule ? 'border-t border-slate-300 pt-1' : ''}`}
    >
      <span className="text-slate-700">{label}</span>
      <span className="font-mono tabular-nums text-slate-900">{fmtINR(value)}</span>
    </div>
  )
}
