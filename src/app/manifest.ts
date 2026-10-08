import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Vibely: dating with verified people',
    short_name: 'Vibely',
    description: 'Swipes, an anonymous feed and blind dates with verified people in Malaysia.',
    lang: 'en',
    // The proxy sends "/" to the visitor's language: landing when signed out, swipes when signed in.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0b10',
    theme_color: '#0b0b10',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
