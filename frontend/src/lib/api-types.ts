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
