import { useCallback, useEffect, useRef, useState } from 'react'

/** Format angka ke Rupiah tanpa desimal. */
export function formatIDR(value) {
  const n = Number(value || 0)
  return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

export function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}

export const errorMessage = (e) => e?.message || 'Terjadi kesalahan'

/** Data loader with loading/error/reload state. `fn` should be stable via deps. */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fnRef = useRef(fn)
  fnRef.current = fn

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fnRef.current())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load, setData }
}

/** Cursor pagination over a `{ items, meta }` list loader. */
export function useCursorList(loadPage, deps = []) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadRef = useRef(loadPage)
  loadRef.current = loadPage

  const fetchPage = useCallback(
    async (nextCursor, append) => {
      setLoading(true)
      setError('')
      try {
        const data = await loadRef.current(nextCursor)
        const page = data?.items ?? []
        setItems((prev) => (append ? [...prev, ...page] : page))
        setCursor(data?.meta?.next_cursor || '')
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  )

  useEffect(() => {
    fetchPage('', false)
  }, [fetchPage])

  return {
    items,
    loading,
    error,
    hasMore: Boolean(cursor),
    loadMore: () => cursor && fetchPage(cursor, true),
    reload: () => fetchPage('', false),
    setItems,
  }
}
