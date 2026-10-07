import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vibely — знакомства',
    short_name: 'Vibely',
    description: 'Свайпы, анонимная лента и рандом-чат с верифицированными людьми.',
    lang: 'ru',
    start_url: '/swipe',
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
