import Link from 'next/link'
import { Heart } from 'lucide-react'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

// Public legal pages (no auth gate). src/lib/supabase/proxy.ts lists them as PUBLIC_ROUTES.
export default async function LegalLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link href={localePath(locale, '/')} className="flex items-center gap-2">
          <Heart className="fill-accent text-accent size-6" aria-hidden />
          <span className="text-xl font-bold tracking-tight">Vibely</span>
        </Link>
        <nav aria-label={dict.legal.section} className="text-muted flex gap-4 text-sm">
          <Link href={localePath(locale, '/terms')} className="hover:text-foreground">
            {dict.legal.terms}
          </Link>
          <Link href={localePath(locale, '/privacy')} className="hover:text-foreground">
            {dict.legal.privacy}
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <Link
        href={localePath(locale, '/')}
        className="text-accent mt-10 self-start text-sm font-medium"
      >
        ← {dict.legal.home}
      </Link>
    </div>
  )
}
