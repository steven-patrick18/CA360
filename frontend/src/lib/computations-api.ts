import { api } from './api'
import type { CalcInputs, CalcOutput, AgeCategory, TaxRegime } from './tax-calculator'

export interface ComputationListItem {
  id: string
  clientId: string
  assessmentYear: string
  regime: TaxRegime
  ageCategory: AgeCategory
  inputs: CalcInputs
  computed: CalcOutput
  taxPayable: string | number | null
  remarks: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; srNo: number; name: string; pan: string | null }
}

export interface PaginatedComputations {
  items: ComputationListItem[]
  total: number
  limit: number
  offset: number
}

export interface CreateComputationPayload {
  clientId: string
  assessmentYear: string
  regime: TaxRegime
  ageCategory: AgeCategory
  inputs: CalcInputs
  computed: CalcOutput
  taxPayable?: number
  remarks?: string
}

export type UpdateComputationPayload = Partial<Omit<CreateComputationPayload, 'clientId'>>

export interface ListComputationsParams {
  clientId?: string
  assessmentYear?: string
  regime?: TaxRegime
  limit?: number
  offset?: number
}

export const computationsApi = {
  async list(params: ListComputationsParams = {}): Promise<PaginatedComputations> {
    const { data } = await api.get<PaginatedComputations>('/computations', { params })
    return data
  },

  async detail(id: string): Promise<ComputationListItem> {
    const { data } = await api.get<ComputationListItem>(`/computations/${id}`)
    return data
  },

  async create(payload: CreateComputationPayload): Promise<ComputationListItem> {
    const { data } = await api.post<ComputationListItem>('/computations', payload)
    return data
  },

  async update(id: string, payload: UpdateComputationPayload): Promise<ComputationListItem> {
    const { data } = await api.patch<ComputationListItem>(`/computations/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<{ ok: true }> {
    const { data } = await api.delete<{ ok: true }>(`/computations/${id}`)
    return data
  },
}
