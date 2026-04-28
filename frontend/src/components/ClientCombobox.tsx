import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClientListItem } from '../lib/api-types'

interface Props {
  value: string
  onChange: (clientId: string) => void
  clients: ClientListItem[]
  placeholder?: string
  required?: boolean
  /** Optional id for label htmlFor association. */
  id?: string
}

/**
 * Type-to-filter client picker. The native <select> becomes unusable past
 * a few dozen clients (no search, only scroll). This shows the same data
 * as a search input + dropdown, filtering on Sr No / name / PAN as the
 * user types. Fully self-contained — no extra dependencies.
 *
 * Keyboard support:
 *   ArrowDown / ArrowUp — move highlight
 *   Enter              — pick highlighted match
 *   Escape             — close dropdown
 */
export default function ClientCombobox({
  value,
  onChange,
  clients,
  placeholder = 'Search by name, PAN, or Sr No…',
  required,
  id,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = clients.find((c) => c.id === value)

  // Filter (and cap) the visible list
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = q
      ? clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.pan ?? '').toLowerCase().includes(q) ||
            String(c.srNo).includes(q),
        )
      : clients
    return all.slice(0, 100) // cap so the dropdown never gets gigantic
  }, [query, clients])

  // Keep highlight in range when matches shrink
  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, matches.length - 1)))
  }, [matches.length])

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function pick(c: ClientListItem) {
    onChange(c.id)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) {
        e.preventDefault()
        pick(matches[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Display value: selected label when closed; live query when open
  const display = open
    ? query
    : selected
      ? `#${selected.srNo} ${selected.name}${selected.pan ? ` (${selected.pan})` : ''}`
      : ''

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={display}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {selected && !open && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setQuery('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">
              No clients match “{query}”.
            </div>
          ) : (
            <>
              {matches.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  data-idx={i}
                  role="option"
                  aria-selected={c.id === value}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(c)}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    i === highlight ? 'bg-blue-50' : ''
                  } ${c.id === value ? 'font-medium text-blue-700' : 'text-slate-800'}`}
                >
                  <span className="font-mono text-xs text-slate-500">#{c.srNo}</span>{' '}
                  <span>{c.name}</span>
                  {c.pan && (
                    <span className="ml-1 font-mono text-[11px] text-slate-500">({c.pan})</span>
                  )}
                </button>
              ))}
              {clients.length > 100 && !query && (
                <div className="border-t border-slate-100 px-3 py-2 text-[11px] italic text-slate-500">
                  Showing first 100 of {clients.length}. Type to search.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
