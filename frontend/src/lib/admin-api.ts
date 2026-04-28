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
