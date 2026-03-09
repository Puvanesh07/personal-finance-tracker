// src/hooks/useStockMetadata.ts
// Resolves metadata for ALL investment types.
// Known stocks resolve SYNCHRONOUSLY from static DB (no loading state).
// Unknown stocks go to Netlify function (Screener.in API).

import { useState, useEffect, useCallback, useRef } from 'react'
import { resolveMetadata, fetchAllMetadata, type StockMetadata } from '../services/stockMetadataService'
import type { Investment } from '../types/investmentTypes'

export interface UseStockMetadataReturn {
  metadata:  Map<string, StockMetadata>
  isLoading: boolean
  error:     string | null
  refresh:   () => void
}

function toItem(inv: Investment): { key: string; symbol?: string; isin?: string; name?: string } | null {
  if (inv.type === 'fixed_deposit' || inv.type === 'bond' || inv.type === 'other') return null
  if (inv.type === 'stock') {
    return { key: inv.id, symbol: inv.symbol?.trim() || undefined, name: inv.name?.trim() || undefined }
  }
  if (inv.type === 'mutual_fund') {
    return { key: inv.id, name: inv.name?.trim() || undefined }
  }
  return null
}

export function useStockMetadata(investments: Investment[]): UseStockMetadataReturn {
  const [metadata, setMetadata]   = useState<Map<string, StockMetadata>>(() => {
    // Resolve offline synchronously on first render — zero loading time for known stocks
    const map = new Map<string, StockMetadata>()
    for (const inv of investments) {
      const item = toItem(inv)
      if (!item) continue
      const r = resolveMetadata(item)
      if (!(r instanceof Promise)) map.set(inv.id, r)
    }
    return map
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const fetchedRef = useRef<Set<string>>(new Set())
  const loadingRef = useRef(false)

  const depsKey = investments.map((i) => `${i.id}:${i.symbol ?? ''}:${i.name ?? ''}`).sort().join('|')

  const load = useCallback(async (items: ReturnType<typeof toItem>[]) => {
    const valid = items.filter(Boolean) as NonNullable<ReturnType<typeof toItem>>[]
    if (valid.length === 0 || loadingRef.current) return
    loadingRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const map = await fetchAllMetadata(valid)
      setMetadata((prev) => { const n = new Map(prev); map.forEach((v, k) => n.set(k, v)); return n })
      valid.forEach((i) => fetchedRef.current.add(i.key))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metadata')
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Sync-resolve what we can immediately
    const syncResults = new Map<string, StockMetadata>()
    const needsNetwork: ReturnType<typeof toItem>[] = []

    for (const inv of investments) {
      if (fetchedRef.current.has(inv.id)) continue
      const item = toItem(inv)
      if (!item) continue
      const r = resolveMetadata(item)
      if (r instanceof Promise) {
        needsNetwork.push(item)
      } else {
        syncResults.set(inv.id, r)
        fetchedRef.current.add(inv.id)
      }
    }

    if (syncResults.size > 0) {
      setMetadata((prev) => { const n = new Map(prev); syncResults.forEach((v, k) => n.set(k, v)); return n })
    }

    if (needsNetwork.length > 0) void load(needsNetwork)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])

  const refresh = useCallback(() => {
    fetchedRef.current.clear()
    loadingRef.current = false
    setMetadata(new Map())
    const items = investments.map(toItem).filter(Boolean) as NonNullable<ReturnType<typeof toItem>>[]
    void load(items)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, load])

  return { metadata, isLoading, error, refresh }
}