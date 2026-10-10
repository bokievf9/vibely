import Link from 'next/link'
import { Heart } from 'lucide-react'
import { headerActionClassName } from '@/components/layout/header-styles'
import { fmt, localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'
import { countIncomingLikes } from '../queries'

// Discover header: heart with the number of people waiting for an answer.
// Reads the session, so render it inside <Suspense>.
export async function LikesButton() {
  const [count, dict, locale] = await Promise.all([
    countIncomingLikes(),
    getDictionary(),
    getLocale(),
  ])
  return (
    <Link
      href={localePath(locale, '/likes')}
      aria-label={fmt(dict.likes.open, { count })}
      className={headerActionClassName}
      data-tour="swipe-people"
    >
      <Heart className="size-[1.375rem]" />
      {count > 0 && (
        <span className="bg-accent-gradient text-accent-foreground absolute top-0.5 -right-0.5 min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold tabular-nums shadow-[0_0_0_2px_var(--background)]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
