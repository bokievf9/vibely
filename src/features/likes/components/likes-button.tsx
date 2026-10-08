import Link from 'next/link'
import { Heart } from 'lucide-react'
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
      className="active:bg-surface relative flex size-12 items-center justify-center rounded-2xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.94]"
    >
      <Heart className="size-6" />
      {count > 0 && (
        <span className="bg-accent text-accent-foreground ring-background absolute top-1 right-0.5 min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-bold tabular-nums ring-2">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
