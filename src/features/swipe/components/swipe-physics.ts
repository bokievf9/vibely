// Pure gesture math for the swipe deck (.claude/skills/apple-design §5, §6). No React, no DOM.

export type Direction = 'like' | 'pass'

// Where a released card would come to rest if it kept decelerating (Apple's projection function).
// 0.995 sits between UIScrollView's "normal" (0.998) and "fast" (0.99): a flick carries, a nudge doesn't.
export function project(velocity: number, decelerationRate = 0.995) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// Commit when the projected resting point is past ~40% of the card width (min 96px on tiny cards).
export function commitThreshold(cardWidth: number) {
  return Math.max(96, cardWidth * 0.4)
}

// Decide from where the card is going, not where the finger let go: a fast flick from 30px commits,
// a slow release at 150px that is being pulled back does not.
export function decideRelease(x: number, vx: number, cardWidth: number): Direction | null {
  const projected = x + project(vx)
  const threshold = commitThreshold(cardWidth)
  if (projected > threshold) return 'like'
  if (projected < -threshold) return 'pass'
  return null
}

// Velocity from the last ~80ms of pointer samples (px/s). Older samples are ignored so a pause
// before letting go reads as "placed", not "thrown".
export type Sample = { x: number; y: number; t: number }

export function releaseVelocity(samples: Sample[], windowMs = 80): { vx: number; vy: number } {
  const last = samples.at(-1)
  if (!last) return { vx: 0, vy: 0 }
  const first = samples.find((s) => last.t - s.t <= windowMs) ?? last
  const dt = (last.t - first.t) / 1000
  if (dt <= 0) return { vx: 0, vy: 0 }
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
}

// Off-screen target for a committed card, far enough that the tilted corners clear the viewport.
export function exitTarget(dir: Direction, viewportWidth: number, cardWidth: number) {
  const sign = dir === 'like' ? 1 : -1
  return sign * (viewportWidth / 2 + cardWidth * 1.1)
}

// A committed card always leaves at least this fast, so a slow drag past the line still reads as
// a throw and buttons get the same feel as a flick.
export const MIN_EXIT_VELOCITY = 900
