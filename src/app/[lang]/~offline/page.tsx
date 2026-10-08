import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'
import { RetryButton } from '@/features/pwa/components/retry-button'
import { getDictionary } from '@/i18n/server'

// Fully static (one per locale) and precached by the service worker: shown for any page
// navigation that fails while offline. Contains no user data.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).pwa.offlineTitle, robots: { index: false } }
}

export default async function OfflinePage() {
  const dict = await getDictionary()
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="text-muted size-16" aria-hidden />
      <h1 className="text-2xl font-bold">{dict.pwa.offlineTitle}</h1>
      <p className="text-muted">{dict.pwa.offlineText}</p>
      <RetryButton label={dict.pwa.retry} />
    </main>
  )
}
