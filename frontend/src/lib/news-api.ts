import { api } from './api'

export type NewsCategory = 'press_release' | 'updates' | 'case_law'

export interface NewsItem {
  id: string
  title: string
  summary: string
  fullText: string
  publishedAt: string
  url: string
  sourceId: string
  sourceName: string
  sourceHomepage?: string
  category: NewsCategory
}

export interface NewsSourceStatus {
  id: string
  name: string
  homepage?: string
  lastFetchedAt: string | null
  itemCount: number
}

export const newsApi = {
  async list(params: { category?: NewsCategory | 'all'; refresh?: boolean } = {}) {
    const { data } = await api.get<NewsItem[]>('/news', {
      params: {
        category: params.category && params.category !== 'all' ? params.category : undefined,
        refresh: params.refresh ? '1' : undefined,
      },
    })
    return data
  },

  async sources() {
    const { data } = await api.get<NewsSourceStatus[]>('/news/sources')
    return data
  },
}

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  press_release: 'Press Releases',
  updates: 'Updates',
  case_law: 'Case Laws',
}

export const NEWS_CATEGORY_COLORS: Record<NewsCategory, string> = {
  press_release: 'bg-amber-50 text-amber-800 ring-amber-200',
  updates: 'bg-blue-50 text-blue-700 ring-blue-200',
  case_law: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}
