import { api } from './api'
import type { Branch, StaffMember } from './api-types'

// ─── Users ────────────────────────────────────────────────────────────

export interface UserDetail extends StaffMember {
  mobile: string | null
  isActive: boolean
  twoFaEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
  branch?: { id: string; name: string } | null
}

export interface UserCreatePayload {
  email: string
  name: string
  role: string
  branchId?: string
  mobile?: string
  password?: string
}

export interface UserUpdatePayload {
  name?: string
  role?: string
  branchId?: string
  mobile?: string
  isActive?: boolean
}

export interface UserCreateResponse extends UserDetail {
  tempPassword?: string
}

export const usersApi = {
  async list(): Promise<UserDetail[]> {
    const { data } = await api.get<UserDetail[]>('/users')
    return data
  },
  async create(payload: UserCreatePayload): Promise<UserCreateResponse> {
    const { data } = await api.post<UserCreateResponse>('/users', payload)
    return data
  },
  async update(id: string, payload: UserUpdatePayload): Promise<UserDetail> {
    const { data } = await api.patch<UserDetail>(`/users/${id}`, payload)
    return data
  },
  async resetPassword(id: string): Promise<{ tempPassword: string }> {
    const { data } = await api.post<{ tempPassword: string }>(`/users/${id}/reset-password`)
    return data
  },
}

// ─── Branches ─────────────────────────────────────────────────────────

export interface BranchDetail extends Branch {
  address: string | null
  headUserId: string | null
  head?: { id: string; name: string } | null
  _count?: { users: number; clients: number }
}

export interface BranchCreatePayload {
  name: string
  city: string
  address?: string
  isHq?: boolean
  headUserId?: string
}

export type BranchUpdatePayload = Partial<BranchCreatePayload>

export const branchesApi = {
  async list(): Promise<BranchDetail[]> {
    const { data } = await api.get<BranchDetail[]>('/branches')
    return data
  },
  async create(payload: BranchCreatePayload): Promise<BranchDetail> {
    const { data } = await api.post<BranchDetail>('/branches', payload)
    return data
  },
  async update(id: string, payload: BranchUpdatePayload): Promise<BranchDetail> {
    const { data } = await api.patch<BranchDetail>(`/branches/${id}`, payload)
    return data
  },
}

// ─── Import / Export ─────────────────────────────────────────────────

export interface ImportError {
  row: number
  message: string
}

export interface ImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  createdIds: string[]
}

export const importApi = {
  async clients(file: File): Promise<ImportResult> {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post<ImportResult>('/import/clients', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}

// ─── Reports ──────────────────────────────────────────────────────────

export interface FilingsSummaryRow {
  assessmentYear: string
  status: string
  count: number
  refundAmount: string | null
  taxPaid: string | null
  grossIncome: string | null
}

export interface StaffWorkloadRow {
  id: string
  name: string
  email: string
  role: string
  branchId: string | null
  assignedClients: number
  pendingFilingsAsPreparer: number
}

export interface BranchWorkloadRow {
  id: string
  name: string
  city: string
  isHq: boolean
  activeClients: number
  pendingFilings: number
}

export interface UpcomingDueFiling {
  id: string
  assessmentYear: string
  itrForm: string | null
  status: string
  dueDate: string | null
  filedDate: string | null
  client: { id: string; srNo: number; name: string; pan: string | null }
  preparedBy: { id: string; name: string } | null
}

export const reportsApi = {
  async filingsSummary(): Promise<FilingsSummaryRow[]> {
    const { data } = await api.get<FilingsSummaryRow[]>('/reports/filings-summary')
    return data
  },
  async workloadByStaff(): Promise<StaffWorkloadRow[]> {
    const { data } = await api.get<StaffWorkloadRow[]>('/reports/workload-by-staff')
    return data
  },
  async workloadByBranch(): Promise<BranchWorkloadRow[]> {
    const { data } = await api.get<BranchWorkloadRow[]>('/reports/workload-by-branch')
    return data
  },
  async upcomingDue(days: number): Promise<UpcomingDueFiling[]> {
    const { data } = await api.get<UpcomingDueFiling[]>('/reports/upcoming-due', {
      params: { days },
    })
    return data
  },
  async overdue(): Promise<UpcomingDueFiling[]> {
    const { data } = await api.get<UpcomingDueFiling[]>('/reports/overdue')
    return data
  },
}

// ─── Audit log ─────────────────────────────────────────────────────────

export interface AuditLogItem {
  id: string
  action: string
  entityType: string
  entityId: string | null
  ipAddress: string | null
  userAgent: string | null
  payloadJson: Record<string, unknown> | null
  createdAt: string
  user: { id: string; name: string; email: string } | null
}

export interface ListAuditParams {
  userId?: string
  action?: string
  entityType?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export const auditApi = {
  async list(params: ListAuditParams = {}): Promise<{
    items: AuditLogItem[]
    total: number
    limit: number
    offset: number
  }> {
    const { data } = await api.get('/audit-log', { params })
    return data as never
  },
}

// ─── Profile (self) ────────────────────────────────────────────────────

export interface MyProfile {
  id: string
  firmId: string
  firmName: string
  branchId: string | null
  branchName: string | null
  name: string
  email: string
  mobile: string | null
  role: string
  twoFaEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

export const profileApi = {
  async me(): Promise<MyProfile> {
    const { data } = await api.get<MyProfile>('/me')
    return data
  },
  async update(payload: { name?: string; mobile?: string }) {
    const { data } = await api.patch('/me', payload)
    return data
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const { data } = await api.post('/me/change-password', payload)
    return data
  },
}

export const exportApi = {
  async download(path: '/export/clients' | '/export/filings' | '/export/audit-log') {
    const res = await api.get(path, { responseType: 'blob' })
    const disposition: string = res.headers['content-disposition'] ?? ''
    const match = /filename="?([^"]+)"?/.exec(disposition)
    const filename = match?.[1] ?? path.split('/').pop() + '.xlsx'
    const blob = new Blob([res.data as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
