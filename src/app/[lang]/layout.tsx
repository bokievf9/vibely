import type { Metadata, Viewport } from 'next'
import { AnalyticsScript } from '@/components/analytics-script'
import { publicEnv } from '@/lib/env'
import { LOCALES } from '@/i18n/config'
import { I18nProvider } from '@/i18n/client'
import { ServiceWorkerRegister } from '@/features/pwa/components/service-worker'
import { getDictionary, getLocale } from '@/i18n/server'
import { geistSans } from '../fonts'
import '../globals.css'

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: 'Vibely', template: '%s · Vibely' },
    description: dict.meta.description,
    applicationName: 'Vibely',
    appleWebApp: { capable: true, title: 'Vibely', statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b10',
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return (
    <html lang={locale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-dvh flex-col">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
        <AnalyticsScript />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
