import { Suspense, type ReactNode } from 'react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { PageSpinner } from '@/components/ui/spinner'
import { localeRedirect } from '@/features/auth/redirect'
import { getViewer, nextStepFor } from '@/features/auth/session'
import { CallLayerGate } from '@/features/calls/components/call-layer-gate'
import { InstallPrompt } from '@/features/pwa/components/install-prompt'

// Every (main) route requires a verified user. RLS enforces the same rule in the database.
export default function MainLayout({ children }: LayoutProps<'/[lang]'>) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Suspense fallback={<PageSpinner />}>
          <VerifiedGate>{children}</VerifiedGate>
        </Suspense>
      </main>
      <InstallPrompt />
      <BottomNav />
      <Suspense fallback={null}>
        <CallLayerGate />
      </Suspense>
    </>
  )
}

async function VerifiedGate({ children }: { children: ReactNode }) {
  const next = nextStepFor(await getViewer())
  if (next !== '/swipe') return localeRedirect(next)
  return children
}
