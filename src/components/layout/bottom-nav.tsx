'use client'

import { Suspense, useEffect, useRef, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import { Flame, MessageCircle, Newspaper, User, VenetianMask, type LucideIcon } from 'lucide-react'
import { useUnreadCount } from '@/features/chat/components/use-unread-count'
import { NavAvatar } from '@/features/profile/components/nav-avatar'
import { usePresenceHeartbeat } from '@/features/presence/use-heartbeat'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

// `fill` is how the active icon gets heavier: solid where the glyph is a closed shape, a tint
// where solid would swallow the inner lines, a bolder stroke where there is nothing to fill.
type Fill = 'solid' | 'tint' | 'none'
const ITEMS: readonly { href: string; key: TabKey; icon: LucideIcon; fill: Fill }[] = [
  { href: '/swipe', key: 'swipe', icon: Flame, fill: 'solid' },
  { href: '/feed', key: 'feed', icon: Newspaper, fill: 'tint' },
  { href: '/blind-date', key: 'randomizer', icon: VenetianMask, fill: 'tint' },
  { href: '/chats', key: 'chats', icon: MessageCircle, fill: 'solid' },
  { href: '/profile', key: 'profile', icon: User, fill: 'solid' },
]
type TabKey = 'swipe' | 'feed' | 'randomizer' | 'chats' | 'profile'

// Fired when the active tab is tapped again. The page scrolls to top by itself; screens with
// their own scroll container can listen: window.addEventListener(TAB_RESELECT_EVENT, ...)
// (event.detail.href is the tab path, e.g. '/feed').
export const TAB_RESELECT_EVENT = 'vibely:tabreselect'

// The pathname is request data, so the highlighted tab streams in; the fallback is the same bar.
// The unread badge lives outside the boundary so its subscription survives navigation.
export function BottomNav() {
  const { count, refresh } = useUnreadCount()
  usePresenceHeartbeat()
  return (
    <Suspense fallback={<NavBar activePath={null} unread={count} />}>
      <ActiveNavBar unread={count} onNavigate={refresh} />
    </Suspense>
  )
}

// Re-counts on every navigation: opening a chat marks its messages read.
function ActiveNavBar({ unread, onNavigate }: { unread: number; onNavigate: () => void }) {
  const pathname = usePathname()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    onNavigate()
  }, [pathname, onNavigate])
  return <NavBar activePath={pathname} unread={unread} />
}

function NavBar({ activePath, unread }: { activePath: string | null; unread: number }) {
  const { dict, locale } = useI18n()

  return (
    <nav
      data-tabbar
      aria-label={dict.nav.label}
      className="material-bar fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Top edge: light catching the material, brightest in the middle, instead of a hard border. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/[0.03] via-white/[0.1] to-white/[0.03]"
      />
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, key, icon: Icon, fill }) => {
          const root = `/${locale}${href}`
          const active = activePath?.startsWith(root) ?? false
          const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
            if (activePath === root) {
              // Already on this tab's root: tapping again goes back to the top, like iOS.
              e.preventDefault()
              const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
              window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
              window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: { href } }))
              return
            }
            if (!active) haptic('light')
          }
          const icon = (
            <Icon
              aria-hidden
              className="size-6"
              strokeWidth={active ? (fill === 'none' ? 2.5 : 2.1) : 1.75}
              fill={active && fill !== 'none' ? 'currentColor' : 'none'}
              fillOpacity={fill === 'tint' ? 0.22 : 1}
            />
          )
          return (
            <li key={href}>
              <LocaleLink
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={onClick}
                draggable={false}
                className={cn(
                  'group relative flex h-16 flex-col items-center justify-center rounded-2xl outline-none',
                  'focus-visible:ring-accent focus-visible:ring-2 focus-visible:ring-inset',
                  active ? 'text-accent' : 'text-muted active:text-foreground',
                )}
              >
                <span className="flex flex-col items-center gap-[3px] transition-[scale,color] duration-150 ease-out group-active:scale-[0.92]">
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {/* Active tab: a soft accent pill behind the icon, with a faint glow. */}
                    <span
                      aria-hidden
                      className={cn(
                        'bg-accent/[0.14] absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_6px_18px_-6px_rgb(255_77_125/0.45)] transition-[opacity,scale] duration-200 ease-out',
                        active ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                      )}
                    />
                    <span className="relative">
                      {key === 'profile' ? <NavAvatar active={active} fallback={icon} /> : icon}
                      {key === 'chats' && unread > 0 && (
                        <span
                          key={unread}
                          aria-hidden
                          className="badge-pop bg-accent-gradient text-accent-foreground absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold tabular-nums shadow-[0_0_0_2px_var(--background)]"
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-[10.5px] leading-none tracking-[0.01em]',
                      active ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {dict.nav[key]}
                  </span>
                </span>
                {key === 'chats' && unread > 0 && (
                  <span className="sr-only">{fmt(dict.nav.unread, { count: unread })}</span>
                )}
              </LocaleLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
