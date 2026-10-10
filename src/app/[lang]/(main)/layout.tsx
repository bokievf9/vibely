import { Suspense, type ReactNode } from 'react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { PageSpinner } from '@/components/ui/spinner'
import { localeRedirect } from '@/features/auth/redirect'
import { getViewer, nextStepFor } from '@/features/auth/session'
import { CallLayerGate } from '@/features/calls/components/call-layer-gate'
import { CrossedPathsPinger } from '@/features/crossed-paths/components/crossed-paths-pinger'
import { InstallPrompt } from '@/features/pwa/components/install-prompt'
import { AccessProvider } from '@/features/plans/components/access-provider'
import { getAccess } from '@/features/plans/queries'
import { SanctionNotice } from '@/features/sanctions/components/sanction-notice'
import { TourProvider } from '@/features/tour/components/tour-provider'
import { getTourState } from '@/features/tour/queries'

// Every (main) route requires a verified user. RLS enforces the same rule in the database.
// The viewer's plan (my_access) is fetched once per request and handed down as a promise: gated
// controls read it under their own Suspense boundaries (useAccess). The guided tour works the same
// way: its state is a promise, read under the tour's own boundary (src/features/tour).
export default function MainLayout({ children }: LayoutProps<'/[lang]'>) {
  return (
    <AccessProvider access={getAccess()}>
      <TourProvider state={getTourState()}>
        <main
          data-main
          className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[var(--tabbar-h)]"
        >
          <Suspense fallback={<PageSpinner />}>
            <VerifiedGate>{children}</VerifiedGate>
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
        <BottomNav />
        <CrossedPathsPinger />
        <Suspense fallback={null}>
          <CallLayerGate />
        </Suspense>
        <Suspense fallback={null}>
          <SanctionNotice />
        </Suspense>
      </TourProvider>
    </AccessProvider>
  )
}

async function VerifiedGate({ children }: { children: ReactNode }) {
  const next = nextStepFor(await getViewer())
  if (next !== '/swipe') return localeRedirect(next)
  return children
}
