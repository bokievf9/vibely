import Link from 'next/link'
import { Heart } from 'lucide-react'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export default async function AuthLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-10 flex items-center gap-2.5">
        {/* App-icon style mark: the heart on the accent gradient, with a soft glow. */}
        <span
          aria-hidden
          className="btn-accent flex size-10 items-center justify-center rounded-[0.8rem]"
        >
          <Heart className="size-5 fill-current" />
        </span>
        <span className="text-[1.375rem] font-bold tracking-[-0.03em]">Vibely</span>
      </header>
      {children}
      <footer className="text-muted mt-auto flex justify-center gap-5 pt-8 text-xs [&>a]:py-2">
        <Link href={localePath(locale, '/terms')}>{dict.legal.terms}</Link>
        <Link href={localePath(locale, '/privacy')}>{dict.legal.privacy}</Link>
      </footer>
    </main>
  )
}
