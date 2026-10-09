'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { getUnreadSummary } from '../unread-actions'
import { onUnreadChanged } from '../unread-signal'
import { emitDuoSignal } from '@/features/duo/signal'

const DEBOUNCE_MS = 400

// Live unread total for the bottom nav. The count always comes from the server; Realtime events
// on the private inbox:<user id> topic (message INSERTs and read_at UPDATEs, RLS-filtered to the
// user's matches) only trigger a debounced re-fetch, so bursts and missed events are harmless.
export function useUnreadCount() {
  const [count, setCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [groups, setGroups] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const refresh = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const result = await getUnreadSummary()
      if (!result.ok) return
      setCount(result.data.count)
      setUserId(result.data.userId)
      setGroups(result.data.groups)
    }, DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const off = onUnreadChanged(refresh)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      off()
    }
  }, [refresh])

  useEffect(() => {
    if (!userId) return
    const client = getBrowserClient()
    let channel = client
      .channel(`inbox:${userId}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, refresh)
    // Duo group chats (only where the table exists): new group messages, RLS-limited to members.
    if (groups) {
      channel = channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        refresh,
      )
    }
    channel = channel
      // Duo invites, partner likes and duo matches (broadcast by the duo RPCs).
      .on('broadcast', { event: 'duo' }, ({ payload }) => {
        emitDuoSignal(payload)
        refresh()
      })
      // postgres_changes attaches a few seconds after SUBSCRIBED: resync once it is ready.
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') refresh()
      })
    channel.subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [userId, groups, refresh])

  return { count, refresh }
}
