// Server-safe header pieces (no 'use client'), shared by PageHeader and custom bars.

// Shared bar geometry for every sticky top bar, including custom ones (chat room, post page):
// 3.25rem of content PLUS the status-bar inset, so in the installed PWA (black-translucent status
// bar) the inset no longer eats the bar. Sticky children below it use top-[var(--header-h)].
export const headerBarClassName =
  'material-bar sticky top-0 z-30 flex h-[var(--header-h)] shrink-0 items-center pt-[env(safe-area-inset-top)]'

// Hairline that fades in once content scrolls under the bar. Put it as the bar's last child.
export function HeaderEdge() {
  return (
    <span
      aria-hidden
      className="header-edge pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.07]"
    />
  )
}

// Round 44px icon button for header actions (search, filters, settings). Pass a LocaleLink href or
// an onClick through `as`.
export const headerActionClassName =
  'text-foreground relative flex size-11 items-center justify-center rounded-full transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.92] active:bg-fill focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none'
