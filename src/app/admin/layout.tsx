import { Suspense, type ReactNode } from 'react'
import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { AdminNav } from '@/features/admin/components/admin-nav'
import { getAdmin } from '@/features/admin/guard'
import { ROLE_LABELS } from '@/features/admin/roles'
import { geistSans } from '../fonts'
import '../globals.css'

export const metadata: Metadata = {
  title: { default: 'Модерация', template: '%s · Модерация Vibely' },
  robots: { index: false, follow: false },
}

// Separate root layout: the panel is Russian-only and lives outside the /[lang] tree.
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <html lang="ru" className={`${geistSans.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-dvh flex-col">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
          <header className="flex items-center gap-2">
            <ShieldCheck className="text-accent size-7" aria-hidden />
            <span className="text-xl font-bold">Модерация Vibely</span>
          </header>
          <Suspense fallback={<PageSpinner />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </div>
      </body>
    </html>
  )
}

// 404 for everyone who isn't in public.admins.
async function AdminGate({ children }: { children: ReactNode }) {
  const { role } = await getAdmin()
  return (
    <>
      <p className="text-muted -mt-3 text-xs">Роль: {ROLE_LABELS[role]}</p>
      <AdminNav role={role} />
      <main className="flex flex-col gap-4">{children}</main>
    </>
  )
}
