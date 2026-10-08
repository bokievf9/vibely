'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient, getBrowserUserId } from '@/lib/supabase/client'

// The signed URL of the viewer's main photo (position 0), fetched once per browser session and kept
// in sessionStorage until shortly before it expires. The photo manager calls invalidateOwnAvatar()
// after an upload, deletion or reorder.
const KEY = 'vibely:own-avatar'
const EVENT = 'vibely:own-avatar-changed'
const SIGNED_URL_TTL_S = 60 * 60
const CACHE_MS = 50 * 60 * 1000

type Cached = { uid: string; url: string | null; exp: number }

let memory: Cached | null = null
let inflight: Promise<string | null> | null = null

function readCache(uid: string): Cached | null {
  if (!memory) {
    try {
      const raw = sessionStorage.getItem(KEY)
      memory = raw ? (JSON.parse(raw) as Cached) : null
    } catch {
      memory = null
    }
  }
  return memory && memory.uid === uid && memory.exp > Date.now() ? memory : null
}

function writeCache(value: Cached) {
  memory = value
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Private mode or storage disabled: the in-memory copy still saves refetches.
  }
}

async function fetchOwnAvatar(): Promise<string | null> {
  const supabase = getBrowserClient()
  const uid = await getBrowserUserId()
  if (!uid) return null
  const cached = readCache(uid)
  if (cached) return cached.url

  const { data: photo } = await supabase
    .from('profile_photos')
    .select('storage_path')
    .eq('profile_id', uid)
    .order('position')
    .limit(1)
    .maybeSingle()
  const { data: signed } = photo
    ? await supabase.storage
        .from('profile-photos')
        .createSignedUrl(photo.storage_path, SIGNED_URL_TTL_S)
    : { data: null }
  const url = signed?.signedUrl ?? null
  writeCache({ uid, url, exp: Date.now() + CACHE_MS })
  return url
}

function loadOwnAvatar(): Promise<string | null> {
  inflight ??= fetchOwnAvatar()
    .catch(() => null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function invalidateOwnAvatar() {
  memory = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Ignored: see writeCache.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useOwnAvatar(): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => void loadOwnAvatar().then((u) => alive && setUrl(u))
    load()
    window.addEventListener(EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(EVENT, load)
    }
  }, [])
  return url
}
