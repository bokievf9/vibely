// Creates a QA run: verified users with photos, a match with messages, optional admin role.
//   node --env-file=.env.local scripts/qa/setup.mjs <state.json>
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { db } from './lib.mjs'

const statePath = process.argv[2]
if (!statePath) throw new Error('usage: setup.mjs <state.json>')
const runId = `qa-${Date.now().toString(36)}`

const PEOPLE = [
  { key: 'a', name: 'QA Arif', gender: 'male', wants: ['female'], age: 27, admin: 'owner' },
  { key: 'b', name: 'QA Siti', gender: 'female', wants: ['male'], age: 25 },
  { key: 'c', name: 'QA Mei Ling', gender: 'female', wants: ['male'], age: 29 },
]

async function photo(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960"><rect width="720" height="960" fill="hsl(${hue},55%,45%)"/><text x="360" y="500" font-family="Helvetica" font-size="120" font-weight="700" fill="#fff" text-anchor="middle">${label}</text><text x="360" y="900" font-family="Helvetica" font-size="30" fill="#fff" text-anchor="middle">QA TEST</text></svg>`
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer()
}

const users = {}
for (const [i, p] of PEOPLE.entries()) {
  const phone = `60119998${String(Date.now() % 1000).padStart(3, '0')}${i}`
  const email = `${runId}-${p.key}@qa.vibelydate.com`
  const { data, error } = await db.auth.admin.createUser({
    phone,
    phone_confirm: true,
    email,
    email_confirm: true,
    app_metadata: { seed: 'fake', qa_run: runId },
  })
  if (error) throw new Error(`${p.key}: ${error.message}`)
  const id = data.user.id
  const birth = new Date()
  birth.setFullYear(birth.getFullYear() - p.age)
  const { error: pErr } = await db.from('profiles').insert({
    id,
    display_name: p.name,
    birth_date: birth.toISOString().slice(0, 10),
    gender: p.gender,
    interested_in: p.wants,
    bio: 'QA test account, deleted after the run.',
    city: 'Kuala Lumpur',
    location: `SRID=4326;POINT(${101.69 + i * 0.01} 3.14)`,
    verification_status: 'approved',
    last_active_at: new Date().toISOString(),
  })
  if (pErr) throw new Error(`${p.key} profile: ${pErr.message}`)
  for (const v of [0, 1]) {
    const path = `${id}/${crypto.randomUUID()}.webp`
    const { error: up } = await db.storage
      .from('profile-photos')
      .upload(path, await photo(p.name.split(' ')[1], i * 90 + v * 40), {
        contentType: 'image/webp',
      })
    if (up) throw new Error(`${p.key} photo: ${up.message}`)
    await db
      .from('profile_photos')
      .insert({ profile_id: id, storage_path: path, width: 720, height: 960, position: v })
  }
  if (p.admin) {
    const { error: aErr } = await db.from('admins').insert({ user_id: id, role: p.admin })
    if (aErr) throw new Error(`admin: ${aErr.message}`)
  }
  users[p.key] = { id, email, phone, name: p.name }
}

// A and B are matched with a short conversation; C has liked A.
const [ua, ub] = [users.a.id, users.b.id].sort()
await db.from('swipes').insert([
  { swiper_id: users.a.id, swiped_id: users.b.id, direction: 'like' },
  { swiper_id: users.b.id, swiped_id: users.a.id, direction: 'like' },
  { swiper_id: users.c.id, swiped_id: users.a.id, direction: 'like' },
])
const { data: match } = await db
  .from('matches')
  .select('id')
  .eq('user_a', ua)
  .eq('user_b', ub)
  .single()
await db.from('messages').insert([
  { match_id: match.id, sender_id: users.b.id, body: 'Hi Arif! QA message one.' },
  { match_id: match.id, sender_id: users.a.id, body: 'Hello Siti, QA reply.' },
])
writeFileSync(statePath, JSON.stringify({ runId, users, matchId: match.id }, null, 2))
console.log(`QA run ${runId}: ${Object.keys(users).length} users, match ${match.id}`)
