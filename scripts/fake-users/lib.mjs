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
