import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { DEFAULT_LOCALE, LOCALES, hasLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'

// Share preview for the landing page, one per locale (prerendered at build time): the headline
// on the left, the real Discover screen on the right. The bundled default font (Geist) covers
// Latin and Cyrillic. The OG renderer does not read WebP, so a PNG copy of the Discover
// screenshot lives next to the landing code (src/features/landing/og-discover.png, 300 px wide).
export const alt = 'Vibely'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

async function screenshot(): Promise<string | null> {
  try {
    const png = await readFile(join(process.cwd(), 'src/features/landing/og-discover.png'))
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { landing } = await getDictionary(hasLocale(lang) ? lang : DEFAULT_LOCALE)
  const shot = await screenshot()

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 88px',
        color: '#f7f3f6',
        backgroundColor: '#0e0b10',
        backgroundImage:
          'radial-gradient(circle at 78% 60%, rgba(255,77,125,0.38) 0%, rgba(255,77,125,0) 55%)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(155deg, #ff6b93 0%, #ff4d7d 38%, #d42a63 100%)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" />
            </svg>
          </div>
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -2 }}>Vibely</div>
        </div>
        <div
          style={{ marginTop: 44, fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5 }}
        >
          {landing.ogTagline}
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: '#9d95a2' }}>{landing.trust.selfie}</div>
        <div style={{ marginTop: 40, fontSize: 26, color: '#ff4d7d' }}>vibelydate.com</div>
      </div>
      {shot && (
        <div
          style={{
            display: 'flex',
            padding: 6,
            borderRadius: 40,
            backgroundColor: '#060507',
            border: '1px solid rgba(255,255,255,0.12)',
            marginTop: 120,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} width={300} height={649} alt="" style={{ borderRadius: 34 }} />
        </div>
      )}
    </div>,
    size,
  )
}
