import { useEffect, useState, type FormEvent } from 'react'
import { metaApi } from '../lib/clients-api'
import {
  CLIENT_TYPE_LABELS,
  STATUS_LABELS,
  type Branch,
  type ClientStatus,
  type ClientType,
  type CreateClientPayload,
  type StaffMember,
  type UpdateClientPayload,
} from '../lib/api-types'
import { InputField, SelectField, TextareaField } from './forms/Field'
import Spinner from './Spinner'
import { ROLE_LABELS } from '../lib/auth'

type Mode = 'create' | 'edit'

export interface ClientFormValues {
  branchId: string
  assignedUserId: string
  name: string
  fatherName: string
  pan: string
  aadhaarLast4: string
  dob: string
  typeOfAssessee: ClientType
  email: string
  mobile: string
  address: string
  notes: string
  status: ClientStatus
}

export const EMPTY_CLIENT_FORM: ClientFormValues = {
  branchId: '',
  assignedUserId: '',
  name: '',
  fatherName: '',
  pan: '',
  aadhaarLast4: '',
  dob: '',
  typeOfAssessee: 'INDIVIDUAL',
  email: '',
  mobile: '',
  address: '',
  notes: '',
  status: 'ACTIVE',
}

interface ClientFormProps {
  mode: Mode
  initialValues?: Partial<ClientFormValues>
  onSubmit: (payload: CreateClientPayload | UpdateClientPayload) => Promise<void>
  submitting: boolean
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

function buildPayload(v: ClientFormValues, mode: Mode): CreateClientPayload | UpdateClientPayload {
  const base = {
    branchId: v.branchId,
    assignedUserId: v.assignedUserId || undefined,
    name: v.name.trim(),
    fatherName: v.fatherName.trim() || undefined,
    pan: v.pan.trim() ? v.pan.trim().toUpperCase() : undefined,
    aadhaarLast4: v.aadhaarLast4.trim() || undefined,
    dob: v.dob || undefined,
    typeOfAssessee: v.typeOfAssessee,
    email: v.email.trim() || undefined,
    mobile: v.mobile.trim() || undefined,
    address: v.address.trim() || undefined,
    notes: v.notes.trim() || undefined,
  }
  if (mode === 'edit') {
    return { ...base, status: v.status }
  }
  return base
}

export default function ClientForm({ mode, initialValues, onSubmit, submitting }: ClientFormProps) {
  const [values, setValues] = useState<ClientFormValues>({
    ...EMPTY_CLIENT_FORM,
    ...initialValues,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [branches, setBranches] = useState<Branch[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  useEffect(() => {
    Promise.all([metaApi.branches(), metaApi.staff()])
      .then(([b, s]) => {
        setBranches(b)
        setStaff(s)
        // Default to single branch if there's only one
        if (mode === 'create' && b.length === 1 && !values.branchId) {
          setValues((v) => ({ ...v, branchId: b[0].id }))
        }
      })
      .finally(() => setLoadingMeta(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set<K extends keyof ClientFormValues>(k: K, val: ClientFormValues[K]) {
    setValues((v) => ({ ...v, [k]: val }))
    setErrors((e) => {
      if (!e[k]) return e
      const { [k]: _omit, ...rest } = e
      return rest
    })
  }

  function validate(v: ClientFormValues): Record<string, string> {
    const e: Record<string, string> = {}
    if (!v.name.trim()) e.name = 'Name is required'
    if (!v.branchId) e.branchId = 'Branch is required'
    if (v.pan && !PAN_REGEX.test(v.pan.trim().toUpperCase())) {
      e.pan = 'Invalid PAN format (e.g., ABCDE1234F)'
    }
    if (v.aadhaarLast4 && !/^\d{4}$/.test(v.aadhaarLast4)) {
      e.aadhaarLast4 = 'Enter exactly 4 digits'
    }
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
      e.email = 'Invalid email'
    }
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate(values)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    await onSubmit(buildPayload(values, mode))
  }

  if (loadingMeta) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField
          label="Name"
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
        />
        <InputField
          label="Father's Name"
          value={values.fatherName}
          onChange={(e) => set('fatherName', e.target.value)}
        />
        <SelectField
          label="Type of Assessee"
          required
          value={values.typeOfAssessee}
          onChange={(e) => set('typeOfAssessee', e.target.value as ClientType)}
          options={Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Branch"
          required
          value={values.branchId}
          onChange={(e) => set('branchId', e.target.value)}
          error={errors.branchId}
          placeholder="Select a branch"
          options={branches.map((b) => ({
            value: b.id,
            label: `${b.name} — ${b.city}${b.isHq ? ' (HQ)' : ''}`,
          }))}
        />
        <SelectField
          label="Assigned To"
          value={values.assignedUserId}
          onChange={(e) => set('assignedUserId', e.target.value)}
          placeholder="Unassigned"
          options={staff.map((s) => ({
            value: s.id,
            label: `${s.name} — ${ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] ?? s.role}`,
          }))}
        />
        {mode === 'edit' && (
          <SelectField
            label="Status"
            required
            value={values.status}
            onChange={(e) => set('status', e.target.value as ClientStatus)}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
        )}
        <InputField
          label="PAN"
          value={values.pan}
          onChange={(e) => set('pan', e.target.value.toUpperCase())}
          error={errors.pan}
          maxLength={10}
          placeholder="ABCDE1234F"
        />
        <InputField
          label="Aadhaar (last 4 digits only)"
          value={values.aadhaarLast4}
          onChange={(e) => set('aadhaarLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
          error={errors.aadhaarLast4}
          maxLength={4}
          placeholder="1234"
          hint="Stored as XXXX-XXXX-NNNN. We never store the full Aadhaar."
        />
        <InputField
          label="Date of Birth"
          type="date"
          value={values.dob}
          onChange={(e) => set('dob', e.target.value)}
        />
        <InputField
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
        />
        <InputField
          label="Mobile"
          value={values.mobile}
          onChange={(e) => set('mobile', e.target.value)}
          maxLength={20}
        />
      </div>

      <TextareaField
        label="Address"
        value={values.address}
        onChange={(e) => set('address', e.target.value)}
        rows={2}
      />

      <TextareaField
        label="Notes"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
        rows={3}
        hint="Internal notes — visible only to your firm staff."
      />

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Spinner size="sm" /> : mode === 'create' ? 'Create client' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
