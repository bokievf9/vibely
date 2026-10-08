import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { SEED_TAG } from './data.mjs'

const { NEXT_PUBLIC_SUPABASE_URL: URL, SUPABASE_SECRET_KEY: SECRET } = process.env
if (!URL || !SECRET) {
  console.error('Run with: node --env-file=.env.local scripts/fake-users/<script>.mjs')
  process.exit(1)
}

// Service role: bypasses RLS. Only for this local tooling, never in the app bundle.
export const db = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } })

export async function listFakeUsers() {
  const fakes = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    fakes.push(...data.users.filter((u) => u.app_metadata?.seed === SEED_TAG))
    if (data.users.length < 200) return fakes
  }
}

export async function findUserByPhone(phone) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => u.phone === phone)
    if (user || data.users.length < 200) return user ?? null
  }
}

const PALETTE = [
  ['#ff4d7d', '#7c3aed'], ['#f97316', '#db2777'], ['#06b6d4', '#4f46e5'], ['#10b981', '#0ea5e9'],
  ['#eab308', '#f43f5e'], ['#8b5cf6', '#ec4899'], ['#14b8a6', '#6366f1'], ['#f43f5e', '#f59e0b'],
]

// Clearly synthetic portrait card (initials + "TEST PROFILE"), never a photo of a real person.
export async function fakePhoto(name, index, variant) {
  const [a, b] = PALETTE[(index + variant * 3) % PALETTE.length]
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="720" height="960" fill="url(#g)"/>
    <circle cx="360" cy="400" r="${variant ? 150 : 210}" fill="#ffffff" fill-opacity="0.18"/>
    <text x="360" y="${variant ? 450 : 470}" font-family="Helvetica, Arial, sans-serif" font-size="${variant ? 120 : 190}" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
    <text x="360" y="900" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#fff" fill-opacity="0.8" text-anchor="middle" letter-spacing="6">TEST PROFILE</text>
  </svg>`
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer()
}

export const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)
export const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString()

const PALETTE_FULL = [
  ['#ff4d7d', '#7c3aed'], ['#f97316', '#db2777'], ['#06b6d4', '#4f46e5'], ['#10b981', '#0ea5e9'],
  ['#eab308', '#f43f5e'], ['#8b5cf6', '#ec4899'], ['#14b8a6', '#6366f1'], ['#f43f5e', '#f59e0b'],
  ['#0f766e', '#84cc16'], ['#1e3a8a', '#06b6d4'], ['#9d174d', '#fb7185'], ['#78350f', '#f59e0b'],
]
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const FONT = 'font-family="Helvetica, Arial, sans-serif"'

// Richer synthetic card for seed-full.mjs: 6 layouts (variant 0 is the main photo), a caption
// (first name, city or interest) and always the "TEST PROFILE" mark. Never a real face.
export async function fakePhotoFull(name, index, variant, caption) {
  const [a, b] = PALETTE_FULL[(index * 5 + variant * 7) % PALETTE_FULL.length]
  const initials = esc(name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())
  const first = esc(name.split(' ')[0])
  const cap = esc(caption ?? '')
  const angle = (index * 37 + variant * 53) % 360
  const layouts = [
    // Big initials in a soft circle.
    `<circle cx="360" cy="420" r="230" fill="#fff" fill-opacity="0.18"/>
     <text x="360" y="490" ${FONT} font-size="200" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
     <text x="360" y="760" ${FONT} font-size="52" font-weight="700" fill="#fff" text-anchor="middle">${first}</text>`,
    // Diagonal stripes.
    `<g transform="rotate(${angle % 90} 360 480)" fill="#fff" fill-opacity="0.12">
       ${Array.from({ length: 14 }, (_, k) => `<rect x="${-600 + k * 140}" y="-400" width="60" height="1800"/>`).join('')}
     </g>
     <text x="360" y="470" ${FONT} font-size="130" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
     <text x="360" y="560" ${FONT} font-size="44" fill="#fff" text-anchor="middle">${cap}</text>`,
    // Concentric rings.
    `${[300, 240, 180, 120].map((r, k) => `<circle cx="360" cy="440" r="${r}" fill="none" stroke="#fff" stroke-opacity="${0.12 + k * 0.08}" stroke-width="18"/>`).join('')}
     <text x="360" y="480" ${FONT} font-size="110" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
     <text x="360" y="820" ${FONT} font-size="46" fill="#fff" text-anchor="middle">${cap}</text>`,
    // Dot grid.
    `<g fill="#fff" fill-opacity="0.16">
       ${Array.from({ length: 9 * 12 }, (_, k) => `<circle cx="${40 + (k % 9) * 80}" cy="${40 + Math.floor(k / 9) * 80}" r="${6 + ((k + index) % 4) * 3}"/>`).join('')}
     </g>
     <rect x="110" y="330" width="500" height="260" rx="40" fill="#000" fill-opacity="0.22"/>
     <text x="360" y="450" ${FONT} font-size="72" font-weight="700" fill="#fff" text-anchor="middle">${first}</text>
     <text x="360" y="530" ${FONT} font-size="40" fill="#fff" text-anchor="middle">${cap}</text>`,
    // Soft blobs.
    `<circle cx="${180 + (index % 5) * 60}" cy="260" r="220" fill="#fff" fill-opacity="0.14"/>
     <circle cx="${560 - (index % 4) * 50}" cy="640" r="260" fill="#000" fill-opacity="0.12"/>
     <text x="360" y="440" ${FONT} font-size="44" letter-spacing="8" fill="#fff" fill-opacity="0.85" text-anchor="middle">ABOUT ME</text>
     <text x="360" y="540" ${FONT} font-size="76" font-weight="700" fill="#fff" text-anchor="middle">${cap}</text>`,
    // Split two-tone with one huge letter.
    `<rect x="0" y="0" width="720" height="${400 + (index % 4) * 60}" fill="#000" fill-opacity="0.18"/>
     <text x="360" y="640" ${FONT} font-size="420" font-weight="700" fill="#fff" fill-opacity="0.9" text-anchor="middle">${initials[0]}</text>
     <text x="360" y="780" ${FONT} font-size="44" fill="#fff" text-anchor="middle">${first} · ${cap}</text>`,
  ]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960">
    <defs><linearGradient id="g" x1="0" y1="0" x2="${variant % 2}" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="720" height="960" fill="url(#g)"/>
    ${layouts[variant % layouts.length]}
    <rect x="200" y="868" width="320" height="52" rx="26" fill="#000" fill-opacity="0.25"/>
    <text x="360" y="904" ${FONT} font-size="28" fill="#fff" text-anchor="middle" letter-spacing="6">TEST PROFILE</text>
  </svg>`
  return sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer()
}
