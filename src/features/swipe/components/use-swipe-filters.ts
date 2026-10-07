'use client'

import { useState } from 'react'
import { filtersSchema, type SwipeFilters } from '../schemas'

const STORAGE_KEY = 'vibely.swipeFilters'

function readSaved(): SwipeFilters | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = filtersSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
    return saved.success ? saved.data : null
  } catch {
    return null // Private mode or corrupted value: keep defaults.
  }
}

// Filters are a per-device convenience, so localStorage is enough (and may be unavailable).
export function useSwipeFilters(defaults: SwipeFilters) {
  const [filters, setFilters] = useState<SwipeFilters>(() => readSaved() ?? defaults)

  const update = (next: SwipeFilters) => {
    setFilters(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Not persisted; filters still apply for this session.
    }
  }

  return { filters, setFilters: update }
}
