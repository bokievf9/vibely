import Link from 'next/link'
import { Search } from 'lucide-react'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

// Discover header: opens people search (by @username or name).
export async function SearchButton() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <Link
      href={localePath(locale, '/search')}
      aria-label={dict.username.searchOpen}
      className="active:bg-surface flex size-12 items-center justify-center rounded-2xl"
    >
      <Search className="size-6" />
    </Link>
  )
}
