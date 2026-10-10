// Where the spotlight and the tour card go for a target. Pure geometry (unit tested): the card sits
// below the target when it fits, else above, else the spotlight is trimmed to the target's top so
// the card fits under it, and as a last resort the card floats at the bottom over the target.
// Everything stays inside the safe area and the side gutters, down to 320px wide screens.

export type Rect = { x: number; y: number; width: number; height: number }
export type Placement = {
  spot: Rect
  card: { x: number; y: number; width: number }
  side: 'below' | 'above' | 'over'
  // Caret position along the card's top or bottom edge (px from the card's left), null for 'over'.
  arrowX: number | null
}

export const GUTTER = 16
export const GAP = 14
export const CARD_MAX_WIDTH = 360
// Breathing room around the target inside the spotlight.
export const SPOT_PADDING = 6
// A trimmed spotlight never gets shorter than this, or it stops reading as "this thing".
const MIN_SPOT = 56

export function cardWidth(viewportWidth: number): number {
  return Math.min(CARD_MAX_WIDTH, Math.max(0, viewportWidth - GUTTER * 2))
}

// The smallest rectangle around every rect (the Discover header buttons light up as one).
export function unionRect(rects: readonly Rect[]): Rect | null {
  const real = rects.filter((r) => r.width > 0 && r.height > 0)
  if (!real.length) return null
  const left = Math.min(...real.map((r) => r.x))
  const top = Math.min(...real.map((r) => r.y))
  const right = Math.max(...real.map((r) => r.x + r.width))
  const bottom = Math.max(...real.map((r) => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

export function place(
  target: Rect,
  viewport: { width: number; height: number },
  cardHeight: number,
  insets: { top: number; bottom: number },
): Placement {
  const vw = viewport.width
  const vh = viewport.height
  const top = insets.top
  const bottom = vh - insets.bottom

  // Padded, then kept on screen (a carousel that bleeds past the edges lights up to the edge).
  const left = clamp(target.x - SPOT_PADDING, 4, vw - 4)
  const right = clamp(target.x + target.width + SPOT_PADDING, left, vw - 4)
  const spotTop = clamp(target.y - SPOT_PADDING, top, bottom)
  const spotBottom = clamp(target.y + target.height + SPOT_PADDING, spotTop, vh - 4)
  let spot: Rect = { x: left, y: spotTop, width: right - left, height: spotBottom - spotTop }

  const width = cardWidth(vw)
  const centerX = spot.x + spot.width / 2
  const x = clamp(centerX - width / 2, GUTTER, vw - GUTTER - width)
  const arrow = () => clamp(centerX - x, 24, width - 24)

  if (bottom - (spot.y + spot.height + GAP) >= cardHeight) {
    return { spot, card: { x, y: spot.y + spot.height + GAP, width }, side: 'below', arrowX: arrow() }
  }
  if (spot.y - GAP - top >= cardHeight) {
    return { spot, card: { x, y: spot.y - GAP - cardHeight, width }, side: 'above', arrowX: arrow() }
  }
  // A tall target (a card, a list): light up its top part and put the card under that.
  const trimmedBottom = bottom - cardHeight - GAP
  if (trimmedBottom - spot.y >= MIN_SPOT) {
    spot = { ...spot, height: trimmedBottom - spot.y }
    return { spot, card: { x, y: trimmedBottom + GAP, width }, side: 'below', arrowX: arrow() }
  }
  return {
    spot,
    card: { x, y: clamp(bottom - cardHeight, top, bottom), width },
    side: 'over',
    arrowX: null,
  }
}
