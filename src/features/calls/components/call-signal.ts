'use client'

import type { CallKind } from '../types'

// In-tab signals between the chat screen and the global call layer (mounted once in the (main)
// layout), so neither has to wrap the other.
const START = 'vibely:call-start'
const PERMISSION = 'vibely:call-permission'
const HISTORY = 'vibely:call-history'

type StartDetail = { matchId: string; kind: CallKind }
type MatchDetail = { matchId: string | null }

function emit<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent<T>(name, { detail }))
}

function listen<T>(name: string, listener: (detail: T) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<T>).detail)
  window.addEventListener(name, handler)
  return () => window.removeEventListener(name, handler)
}

// Chat call button → call layer. Must run inside the tap handler (iOS audio unlock follows it).
export const requestCall = (detail: StartDetail) => emit(START, detail)
export const onCallRequest = (l: (d: StartDetail) => void) => listen(START, l)

// The partner changed "Allow calls in this chat".
export const signalCallPermission = (matchId: string) => emit<MatchDetail>(PERMISSION, { matchId })
export const onCallPermission = (l: (d: MatchDetail) => void) => listen(PERMISSION, l)

// A call of this match changed state: refresh its entries in the chat.
export const signalCallHistory = (matchId: string | null) => emit<MatchDetail>(HISTORY, { matchId })
export const onCallHistory = (l: (d: MatchDetail) => void) => listen(HISTORY, l)
