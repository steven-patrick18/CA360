import { api } from './api'
import type {
  Branch,
  ClientDetail,
  ClientListItem,
  CreateClientPayload,
  PaginatedClients,
  Portal,
  RevealedCredential,
  StaffMember,
  UpdateClientPayload,
  UpsertCredentialPayload,
} from './api-types'

export interface ListClientsParams {
  q?: string
  status?: string
  typeOfAssessee?: string
  branchId?: string
  assignedUserId?: string
  limit?: number
  offset?: number
}

export const clientsApi = {
  async list(params: ListClientsParams = {}): Promise<PaginatedClients> {
    const { data } = await api.get<PaginatedClients>('/clients', { params })
    return data
  },

  async detail(id: string): Promise<ClientDetail> {
    const { data } = await api.get<ClientDetail>(`/clients/${id}`)
    return data
  },

  async create(payload: CreateClientPayload): Promise<ClientListItem> {
    const { data } = await api.post<ClientListItem>('/clients', payload)
    return data
  },

  async update(id: string, payload: UpdateClientPayload): Promise<ClientListItem> {
    const { data } = await api.patch<ClientListItem>(`/clients/${id}`, payload)
    return data
  },

  async archive(id: string): Promise<ClientListItem> {
    const { data } = await api.delete<ClientListItem>(`/clients/${id}`)
    return data
  },
}

export const credentialsApi = {
  async list(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/credentials`)
    return data
  },

  async upsert(clientId: string, payload: UpsertCredentialPayload) {
    const { data } = await api.post(`/clients/${clientId}/credentials`, payload)
    return data
  },

  async reveal(clientId: string, portal: Portal): Promise<RevealedCredential> {
    const { data } = await api.post<RevealedCredential>(
      `/clients/${clientId}/credentials/${portal}/reveal`,
    )
    return data
  },

  async remove(clientId: string, portal: Portal) {
    const { data } = await api.delete(`/clients/${clientId}/credentials/${portal}`)
    return data
  },
}

export const metaApi = {
  async branches(): Promise<Branch[]> {
    const { data } = await api.get<Branch[]>('/meta/branches')
    return data
  },

  async staff(): Promise<StaffMember[]> {
    const { data } = await api.get<StaffMember[]>('/meta/staff')
    return data
  },
}
