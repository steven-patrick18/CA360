import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  newsApi,
  NEWS_CATEGORY_COLORS,
  NEWS_CATEGORY_LABELS,
  type NewsCategory,
  type NewsItem,
  type NewsSourceStatus,
} from '../lib/news-api'
import Spinner from '../components/Spinner'
import { useToast, getApiErrorMessage } from '../lib/toast'

const TABS: Array<{ key: NewsCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'press_release', label: 'Press Releases' },
  { key: 'updates', label: 'Updates' },
  { key: 'case_law', label: 'Case Laws' },
]

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function NewsPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as NewsCategory | 'all' | null) ?? 'all'
  const [items, setItems] = useState<NewsItem[]>([])
  const [sources, setSources] = useState<NewsSourceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function load(force = false) {
    if (force) setRefreshing(true)
    else setLoading(true)
    Promise.all([newsApi.list({ category: tab, refresh: force }), newsApi.sources()])
      .then(([its, srcs]) => {
        setItems(its)
        setSources(srcs)
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => load(false), [tab])

  function toggle(id: string) {
    setExpanded((s) => {
      const ns = new Set(s)
      if (ns.has(id)) ns.delete(id)
      else ns.add(id)
      return ns
    })
  }

  const lastFetched = sources
    .map((s) => s.lastFetchedAt)
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">News &amp; Updates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live tax-related news pulled from public sources. Click any headline to expand.{' '}
            {lastFetched && (
              <span className="text-slate-400">Last refreshed {timeAgo(lastFetched)}.</span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? <Spinner size="sm" /> : 'Refresh now'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              const next = new URLSearchParams(params)
              if (t.key === 'all') next.delete('tab')
              else next.set('tab', t.key)
              setParams(next)
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          No items in this category right now. Try{' '}
          <button onClick={() => load(true)} className="text-blue-600 hover:underline">
            refreshing
          </button>{' '}
          or check back later.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const isOpen = expanded.has(it.id)
            return (
              <article
                key={it.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-300"
              >
                <button
                  onClick={() => toggle(it.id)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${NEWS_CATEGORY_COLORS[it.category]}`}
                      >
                        {NEWS_CATEGORY_LABELS[it.category]}
                      </span>
                      <span className="text-slate-500">{it.sourceName}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{timeAgo(it.publishedAt)}</span>
                    </div>
                    <h2 className="text-base font-medium text-slate-900">{it.title}</h2>
                    {!isOpen && it.summary && (
                      <p className="mt-1 text-sm text-slate-600">{it.summary}</p>
                    )}
                  </div>
                  <span className="mt-1 shrink-0 text-slate-400">{isOpen ? '▴' : '▾'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    {it.fullText ? (
                      <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                        {it.fullText}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Full text not available — open the original article for details.
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                      >
                        Open original ↗
                      </a>
                      {it.sourceHomepage && (
                        <a
                          href={it.sourceHomepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:underline"
                        >
                          More from {it.sourceName}
                        </a>
                      )}
                      <span className="ml-auto text-slate-400">
                        Published{' '}
                        {new Date(it.publishedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Sources footer */}
      {sources.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <strong>Sources:</strong> {sources.map((s) => s.name).join(' · ')}. News is fetched live
          from these public RSS feeds and cached for 30 minutes. Items are categorized
          automatically by content keywords. Always verify against the original source before
          acting on tax-sensitive information.
        </div>
      )}
    </div>
  )
}
