import { useEffect, useState, type FormEvent } from 'react'
import { filingsApi } from '../lib/filings-api'
import { clientsApi, metaApi } from '../lib/clients-api'
import {
  FILING_STATUS_LABELS,
  ITR_FORM_LABELS,
  recentAssessmentYears,
  type ClientListItem,
  type CreateFilingPayload,
  type FilingListItem,
  type FilingStatus,
  type ItrForm,
  type StaffMember,
  type UpdateFilingPayload,
} from '../lib/api-types'
import { InputField, SelectField, TextareaField } from './forms/Field'
import Spinner from './Spinner'
import { useToast, getApiErrorMessage } from '../lib/toast'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (filing: FilingListItem) => void
  /** When set, scopes the create form to a single client (read-only client selector). */
  clientId?: string
  /** When set, opens in edit mode for this filing. */
  filing?: FilingListItem
}

const AY_REGEX = /^(\d{4})-(\d{2})$/

export default function FilingFormModal({ open, onClose, onSaved, clientId, filing }: Props) {
  const toast = useToast()
  const isEdit = !!filing

  const [clients, setClients] = useState<ClientListItem[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const ays = recentAssessmentYears(6)

  const [values, setValues] = useState({
    clientId: clientId ?? filing?.clientId ?? '',
    assessmentYear: filing?.assessmentYear ?? ays[0],
    itrForm: filing?.itrForm ?? '',
    status: filing?.status ?? ('PENDING' as FilingStatus),
    dueDate: filing?.dueDate ? filing.dueDate.split('T')[0] : '',
    filedDate: filing?.filedDate ? filing.filedDate.split('T')[0] : '',
    acknowledgementNo: filing?.acknowledgementNo ?? '',
    grossIncome: filing?.grossIncome ?? '',
    taxPaid: filing?.taxPaid ?? '',
    refundAmount: filing?.refundAmount ?? '',
    preparedById: filing?.preparedById ?? '',
    filedById: filing?.filedById ?? '',
    remarks: filing?.remarks ?? '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setLoadingMeta(true)
    Promise.all([
      clientId ? Promise.resolve({ items: [] as ClientListItem[] }) : clientsApi.list({ limit: 200 }),
      metaApi.staff(),
    ])
      .then(([cs, st]) => {
        if (!clientId && 'items' in cs) setClients(cs.items)
        setStaff(st)
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setLoadingMeta(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId])

  function set<K extends keyof typeof values>(k: K, v: (typeof values)[K]) {
    setValues((s) => ({ ...s, [k]: v }))
    if (errors[k]) {
      setErrors((e) => {
        const { [k]: _, ...rest } = e
        return rest
      })
    }
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!values.clientId) e.clientId = 'Client is required'
    if (!values.assessmentYear || !AY_REGEX.test(values.assessmentYear)) {
      e.assessmentYear = 'Format: YYYY-YY (e.g., 2024-25)'
    } else {
      const m = AY_REGEX.exec(values.assessmentYear)!
      const start = parseInt(m[1], 10)
      const expectedEnd = (start + 1) % 100
      if (parseInt(m[2], 10) !== expectedEnd) {
        e.assessmentYear = 'Second year must be the next year (e.g., 2024-25, not 2024-26)'
      }
    }
    if (values.acknowledgementNo && values.acknowledgementNo.length > 50) {
      e.acknowledgementNo = 'Too long'
    }
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    try {
      const numOrUndef = (v: unknown) => {
        if (v === '' || v === null || v === undefined) return undefined
        const n = typeof v === 'string' ? Number(v) : (v as number)
        return Number.isNaN(n) ? undefined : n
      }

      const payload: CreateFilingPayload = {
        clientId: values.clientId,
        assessmentYear: values.assessmentYear,
        itrForm: (values.itrForm || undefined) as ItrForm | undefined,
        status: values.status,
        dueDate: values.dueDate || undefined,
        filedDate: values.filedDate || undefined,
        acknowledgementNo: values.acknowledgementNo || undefined,
        grossIncome: numOrUndef(values.grossIncome),
        taxPaid: numOrUndef(values.taxPaid),
        refundAmount: numOrUndef(values.refundAmount),
        preparedById: values.preparedById || undefined,
        filedById: values.filedById || undefined,
        remarks: values.remarks || undefined,
      }

      let saved: FilingListItem
      if (isEdit && filing) {
        const { clientId: _omit, ...rest } = payload
        saved = await filingsApi.update(filing.id, rest as UpdateFilingPayload)
        toast.success('Filing updated')
      } else {
        saved = await filingsApi.create(payload)
        toast.success(`Filing for AY ${saved.assessmentYear} created`)
      }
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-medium text-slate-900">
            {isEdit ? 'Edit ITR filing' : 'New ITR filing'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {loadingMeta ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <form id="filing-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {!clientId && !isEdit ? (
                  <SelectField
                    label="Client"
                    required
                    value={values.clientId}
                    onChange={(e) => set('clientId', e.target.value)}
                    error={errors.clientId}
                    placeholder="Select a client"
                    options={clients.map((c) => ({
                      value: c.id,
                      label: `#${c.srNo} ${c.name}${c.pan ? ` (${c.pan})` : ''}`,
                    }))}
                  />
                ) : (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {isEdit && filing ? `Client: #${filing.client.srNo} ${filing.client.name}` : ''}
                  </div>
                )}

                <SelectField
                  label="Assessment Year"
                  required
                  value={values.assessmentYear}
                  onChange={(e) => set('assessmentYear', e.target.value)}
                  error={errors.assessmentYear}
                  options={ays.map((ay) => ({ value: ay, label: ay }))}
                />

                <SelectField
                  label="ITR Form"
                  value={values.itrForm}
                  onChange={(e) => set('itrForm', e.target.value as ItrForm | '')}
                  placeholder="Not yet decided"
                  options={Object.entries(ITR_FORM_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                />

                <SelectField
                  label="Status"
                  required
                  value={values.status}
                  onChange={(e) => set('status', e.target.value as FilingStatus)}
                  options={Object.entries(FILING_STATUS_LABELS).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />

                <InputField
                  label="Due Date"
                  type="date"
                  value={values.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                />

                <InputField
                  label="Filed Date"
                  type="date"
                  value={values.filedDate}
                  onChange={(e) => set('filedDate', e.target.value)}
                />

                <InputField
                  label="Acknowledgement No"
                  value={values.acknowledgementNo}
                  onChange={(e) => set('acknowledgementNo', e.target.value)}
                  error={errors.acknowledgementNo}
                />

                <SelectField
                  label="Prepared By"
                  value={values.preparedById}
                  onChange={(e) => set('preparedById', e.target.value)}
                  placeholder="—"
                  options={staff.map((s) => ({ value: s.id, label: s.name }))}
                />

                <SelectField
                  label="Filed By"
                  value={values.filedById}
                  onChange={(e) => set('filedById', e.target.value)}
                  placeholder="—"
                  options={staff.map((s) => ({ value: s.id, label: s.name }))}
                />

                <InputField
                  label="Gross Income (₹)"
                  type="number"
                  step="0.01"
                  value={values.grossIncome ?? ''}
                  onChange={(e) => set('grossIncome', e.target.value)}
                />

                <InputField
                  label="Tax Paid (₹)"
                  type="number"
                  step="0.01"
                  value={values.taxPaid ?? ''}
                  onChange={(e) => set('taxPaid', e.target.value)}
                />

                <InputField
                  label="Refund Amount (₹)"
                  type="number"
                  step="0.01"
                  value={values.refundAmount ?? ''}
                  onChange={(e) => set('refundAmount', e.target.value)}
                  hint="Negative if amount payable"
                />
              </div>

              <TextareaField
                label="Remarks"
                value={values.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                rows={3}
              />
            </form>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="filing-form"
            disabled={submitting || loadingMeta}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Spinner size="sm" /> : isEdit ? 'Save changes' : 'Create filing'}
          </button>
        </div>
      </div>
    </div>
  )
}
