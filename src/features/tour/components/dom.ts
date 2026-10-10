// Browser helpers shared by the tour overlay and the tips (call from effects and handlers only).
import type { Rect } from '../placement'

// Every rendered element carrying this data-tour key (an element may carry several, space
// separated). display:none and detached elements have no client rects and are left out.
export function findTargets(key: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour~="${key}"]`)].filter(
    (el) => el.getClientRects().length > 0,
  )
}

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

export function tipPresent(key: string): boolean {
  return [...document.querySelectorAll(`[data-tip~="${key}"]`)].some((el) => el.isConnected)
}

// Something modal is open (a sheet, a dialog, a full-screen viewer): tips wait.
export function modalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null
}

// The device's safe-area insets, read from a probe that uses env() (0 outside notched phones).
export function safeInsets(): { top: number; bottom: number } {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
  }
  probe.remove()
  return insets
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Keeps Tab inside `root` (the tour card is modal while it is open).
export function trapTab(e: KeyboardEvent, root: HTMLElement | null): void {
  if (e.key !== 'Tab' || !root) return
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  )
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    e.preventDefault()
    return
  }
  const current = document.activeElement
  if (!root.contains(current)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && current === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && current === last) {
    e.preventDefault()
    first.focus()
  }
}
