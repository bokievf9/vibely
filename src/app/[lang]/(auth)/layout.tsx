import Link from 'next/link'
import { Heart } from 'lucide-react'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export default async function AuthLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-center gap-2">
        <Heart className="fill-accent text-accent size-7" aria-hidden />
        <span className="text-2xl font-bold tracking-tight">Vibely</span>
      </header>
      {children}
      <footer className="text-muted mt-auto flex justify-center gap-4 pt-8 text-xs">
        <Link href={localePath(locale, '/terms')}>{dict.legal.terms}</Link>
        <Link href={localePath(locale, '/privacy')}>{dict.legal.privacy}</Link>
      </footer>
    </main>
  )
}
