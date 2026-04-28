// Mirrors of the backend response shapes. Keep in sync when DTOs change.

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export type ClientType =
  | 'INDIVIDUAL'
  | 'HUF'
  | 'PROPRIETORSHIP'
  | 'PARTNERSHIP'
  | 'LLP'
  | 'COMPANY'
  | 'TRUST'
  | 'AOP_BOI'
  | 'OTHER'

export type Portal = 'INCOME_TAX' | 'GST' | 'TRACES' | 'MCA'

export type FilingStatus =
  | 'PENDING'
  | 'DOCS_AWAITED'
  | 'IN_PROCESS'
  | 'READY'
  | 'FILED'
  | 'ACKNOWLEDGED'
  | 'DEFECTIVE'

export type ItrForm = 'ITR1' | 'ITR2' | 'ITR3' | 'ITR4' | 'ITR5' | 'ITR6' | 'ITR7'

export interface FilingListItem {
  id: string
  clientId: string
  assessmentYear: string
  itrForm: ItrForm | null
  status: FilingStatus
  dueDate: string | null
  filedDate: string | null
  acknowledgementNo: string | null
  grossIncome: string | null
  taxPaid: string | null
  refundAmount: string | null
  remarks: string | null
  preparedById: string | null
  filedById: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; srNo: number; name: string; pan: string | null }
  preparedBy: { id: string; name: string } | null
  filedBy: { id: string; name: string } | null
}

export interface PaginatedFilings {
  items: FilingListItem[]
  total: number
  limit: number
  offset: number
}

export interface CreateFilingPayload {
  clientId: string
  assessmentYear: string
  itrForm?: ItrForm
  status?: FilingStatus
  dueDate?: string
  filedDate?: string
  acknowledgementNo?: string
  grossIncome?: number
  taxPaid?: number
  refundAmount?: number
  preparedById?: string
  filedById?: string
  remarks?: string
}

export type UpdateFilingPayload = Partial<Omit<CreateFilingPayload, 'clientId'>>

export interface DashboardStats {
  activeClients: number
  totalClients: number
  pendingFilings: number
  filedThisMonth: number
  pipeline: Partial<Record<FilingStatus, number>>
}

export interface Branch {
  id: string
  name: string
  city: string
  isHq: boolean
}

export interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  branchId: string | null
}

export interface ClientListItem {
  id: string
  srNo: number
  name: string
  pan: string | null
  email: string | null
  mobile: string | null
  typeOfAssessee: ClientType
  status: ClientStatus
  branchId: string
  assignedUserId: string | null
  branch: { id: string; name: string; city: string }
  assignedTo: { id: string; name: string } | null
  onboardedOn: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedClients {
  items: ClientListItem[]
  total: number
  limit: number
  offset: number
}

export interface ClientCredentialSummary {
  id: string
  portal: Portal
  username: string
  lastUpdated: string
  lastRevealedAt: string | null
  revealedBy?: { id: string; name: string } | null
}

export interface ClientDetail extends Omit<ClientListItem, 'branch' | 'assignedTo'> {
  fatherName: string | null
  aadharMasked: string | null
  dob: string | null
  address: string | null
  notes: string | null
  branch: { id: string; name: string; city: string }
  assignedTo: { id: string; name: string; email: string } | null
  credentials: ClientCredentialSummary[]
}

export interface CreateClientPayload {
  branchId: string
  assignedUserId?: string
  name: string
  fatherName?: string
  pan?: string
  aadhaarLast4?: string
  dob?: string
  typeOfAssessee: ClientType
  email?: string
  mobile?: string
  address?: string
  notes?: string
}

export interface UpdateClientPayload extends Partial<CreateClientPayload> {
  status?: ClientStatus
}

export interface UpsertCredentialPayload {
  portal: Portal
  username: string
  password: string
}

export interface RevealedCredential {
  portal: Portal
  username: string
  password: string
}

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  INDIVIDUAL: 'Individual',
  HUF: 'HUF',
  PROPRIETORSHIP: 'Proprietorship',
  PARTNERSHIP: 'Partnership',
  LLP: 'LLP',
  COMPANY: 'Company',
  TRUST: 'Trust',
  AOP_BOI: 'AOP / BOI',
  OTHER: 'Other',
}

export const PORTAL_LABELS: Record<Portal, string> = {
  INCOME_TAX: 'Income Tax',
  GST: 'GST',
  TRACES: 'TRACES',
  MCA: 'MCA',
}

export const STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
}

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  PENDING: 'Pending',
  DOCS_AWAITED: 'Docs Awaited',
  IN_PROCESS: 'In Process',
  READY: 'Ready',
  FILED: 'Filed',
  ACKNOWLEDGED: 'Acknowledged',
  DEFECTIVE: 'Defective',
}

export const ITR_FORM_LABELS: Record<ItrForm, string> = {
  ITR1: 'ITR-1 (Sahaj)',
  ITR2: 'ITR-2',
  ITR3: 'ITR-3',
  ITR4: 'ITR-4 (Sugam)',
  ITR5: 'ITR-5',
  ITR6: 'ITR-6',
  ITR7: 'ITR-7',
}

/** Generate a list of recent assessment years for dropdowns. e.g. ['2026-27', '2025-26', ...] */
export function recentAssessmentYears(count: number = 6): string[] {
  // Indian financial year runs Apr–Mar; AY is the year AFTER the FY ends.
  // For a date 28-Apr-2026, the *current* AY is 2026-27.
  const now = new Date()
  const inApr = now.getMonth() >= 3 // 0-indexed: 3 = April
  const startFy = inApr ? now.getFullYear() : now.getFullYear() - 1
  const currentAyStart = startFy + 1 // AY start year
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const a = currentAyStart - i
    out.push(`${a}-${String((a + 1) % 100).padStart(2, '0')}`)
  }
  return out
}

export function fmtINR(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—'
  const v = typeof n === 'string' ? Number(n) : n
  if (Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(v)
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
