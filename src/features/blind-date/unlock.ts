// "Reveal identity" on a private reply unlocks after each side sent this many messages
// (public.reveal_unlock_messages, enforced by blind_decide). Pure module: also used by unit tests.
export const REVEAL_UNLOCK_MESSAGES = 5

export type UnlockProgress = {
  unlocked: boolean
  // Messages still missing on each side (0 when that side is done).
  mineLeft: number
  theirsLeft: number
}

export function revealProgress(
  mine: number,
  theirs: number,
  needed = REVEAL_UNLOCK_MESSAGES,
): UnlockProgress {
  const clamp = (n: number) => Math.max(0, Math.min(needed, Math.floor(Number.isFinite(n) ? n : 0)))
  const m = clamp(mine)
  const t = clamp(theirs)
  return { unlocked: m >= needed && t >= needed, mineLeft: needed - m, theirsLeft: needed - t }
}

// Which kinds of conversation gate Connect behind the unlock.
export const needsUnlock = (kind: string) => kind === 'post'
