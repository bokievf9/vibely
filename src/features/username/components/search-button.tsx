import Link from 'next/link'
import { Search } from 'lucide-react'
import { headerActionClassName } from '@/components/layout/header-styles'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

// Discover header: opens people search (by @username or name).
export async function SearchButton() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <Link
      href={localePath(locale, '/search')}
      aria-label={dict.username.searchOpen}
      className={headerActionClassName}
    >
      <Search className="size-[1.375rem]" />
    </Link>
  )
}
