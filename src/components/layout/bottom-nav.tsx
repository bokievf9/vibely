'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { Flame, MessageCircle, Newspaper, Shuffle, User } from 'lucide-react'
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
export function BottomNav() {
  return (
    <Suspense fallback={<NavBar activePath={null} />}>
      <ActiveNavBar />
    </Suspense>
  )
}

function ActiveNavBar() {
  return <NavBar activePath={usePathname()} />
}

function NavBar({ activePath }: { activePath: string | null }) {
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
                <Icon className="size-6" aria-hidden />
                {dict.nav[key]}
              </LocaleLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
