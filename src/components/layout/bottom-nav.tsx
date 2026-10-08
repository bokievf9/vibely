'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Flame, MessageCircle, Newspaper, Shuffle, User } from 'lucide-react'
import { useUnreadCount } from '@/features/chat/components/use-unread-count'
import { usePresenceHeartbeat } from '@/features/presence/use-heartbeat'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/swipe', key: 'swipe', icon: Flame },
  { href: '/feed', key: 'feed', icon: Newspaper },
  { href: '/randomizer', key: 'randomizer', icon: Shuffle },
  { href: '/chats', key: 'chats', icon: MessageCircle },
  { href: '/profile', key: 'profile', icon: User },
] as const

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
      aria-label="Vibely"
      className="bg-background/90 border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = activePath?.startsWith(`/${locale}${href}`) ?? false
          return (
            <li key={href}>
              <LocaleLink
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  active ? 'text-accent' : 'text-muted',
                )}
              >
                <span className="relative">
                  <Icon className="size-6" aria-hidden />
                  {key === 'chats' && unread > 0 && (
                    <span
                      aria-hidden
                      className="bg-accent text-accent-foreground ring-background absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold ring-2"
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </span>
                {dict.nav[key]}
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
