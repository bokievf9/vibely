import { ImageResponse } from 'next/og'
import { DEFAULT_LOCALE, LOCALES, hasLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'

// Share preview for the landing page, one per locale (prerendered at build time).
// The bundled default font (Geist) covers Latin and Cyrillic, so no font fetching is needed.
export const alt = 'Vibely'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { landing } = await getDictionary(hasLocale(lang) ? lang : DEFAULT_LOCALE)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 96,
        color: '#ffffff',
        background: 'linear-gradient(135deg, #ff4d7d 0%, #c2185b 55%, #0b0b10 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <svg width="112" height="112" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" />
        </svg>
        <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -4 }}>Vibely</div>
      </div>
      <div style={{ marginTop: 40, fontSize: 56, lineHeight: 1.2, maxWidth: 960 }}>
        {landing.ogTagline}
      </div>
      <div style={{ marginTop: 56, fontSize: 32, opacity: 0.85 }}>vibelydate.com</div>
    </div>,
    size,
  )
}
