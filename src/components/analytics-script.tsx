import Script from 'next/script'
import { analyticsConfig } from '@/lib/env.optional'

// Privacy-friendly, cookieless analytics (Umami or Plausible). Renders nothing unless
// NEXT_PUBLIC_ANALYTICS_SRC and NEXT_PUBLIC_ANALYTICS_SITE_ID are set at build time.
// Umami reads data-website-id, Plausible reads data-domain; each ignores the other attribute.
export function AnalyticsScript() {
  if (!analyticsConfig) return null
  return (
    <Script
      src={analyticsConfig.src}
      strategy="afterInteractive"
      data-website-id={analyticsConfig.siteId}
      data-domain={analyticsConfig.siteId}
      data-do-not-track="true"
    />
  )
}
