'use client'

// Duo broadcasts (20261009000261) arrive on the private inbox:<user id> topic as event 'duo'. The
// bottom-nav unread hook owns that channel (one subscription per topic) and re-emits them here.
export type DuoSignal =
  | { kind: 'invite'; team_id: string; from: string }
  | { kind: 'accepted'; team_id: string; by: string }
  | { kind: 'dissolved'; team_id: string; by: string }
  | { kind: 'like'; team_id: string; by: string }
  | { kind: 'match'; group_id: string; match_id: string }

const EVENT = 'vibely:duo'

export function emitDuoSignal(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('kind' in payload)) return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }))
}

export function onDuoSignal(listener: (signal: DuoSignal) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<DuoSignal>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
