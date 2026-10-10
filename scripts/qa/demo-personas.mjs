// Turns a QA run's three users into warm demo personas for the landing screenshots: natural
// Malaysian names, bios in the screenshot language, interests, about fields and illustrated
// (faceless, non-photo) pictures. Also clears the run's seeded QA messages and marks the
// onboarding tour as done so it does not cover the screens.
//   node --env-file=.env.local scripts/qa/demo-personas.mjs <state.json> <en|ms|ru>
// Safety: only users tagged seed='fake' AND qa_run=<this run> are touched (the same check as
// cleanup.mjs); the tags stay in place, so cleanup.mjs still deletes everything afterwards.
import { readFileSync, writeFileSync } from 'node:fs'
import { portrait, scene } from './demo-art.mjs'
import { db, listRunUsers } from './lib.mjs'

const [statePath, lang = 'en'] = process.argv.slice(2)
if (!statePath || !['en', 'ms', 'ru'].includes(lang)) {
  throw new Error('usage: demo-personas.mjs <state.json> <en|ms|ru>')
}
const state = JSON.parse(readFileSync(statePath, 'utf8'))
if (!/^qa-[a-z0-9]+$/.test(state.runId)) throw new Error('bad run id')

const PERSONAS = {
  a: {
    art: 'junwei',
    name: 'Jun Wei',
    age: 28,
    city: 'Kuala Lumpur',
    height: 176,
    languages: ['english', 'mandarin', 'malay'],
    tags: ['hiking', 'coffee', 'photography', 'street-food', 'badminton'],
    job: { en: 'Product designer', ms: 'Pereka produk', ru: 'Продуктовый дизайнер' },
    bio: {
      en: 'Designer by day, home barista by weekend. Looking for someone to hike Broga with and argue about the best char kuey teow.',
      ms: 'Pereka pada waktu siang, barista rumah pada hujung minggu. Cari kawan untuk daki Broga dan bertekak pasal char kuey teow paling sedap.',
      ru: 'Днём дизайнер, по выходным домашний бариста. Ищу, с кем встретить рассвет на Броге и поспорить, где лучший char kuey teow.',
    },
  },
  b: {
    art: 'aisyah',
    name: 'Aisyah',
    age: 26,
    city: 'Petaling Jaya',
    height: 160,
    languages: ['malay', 'english'],
    tags: ['books', 'beach', 'baking', 'cafe-hopping', 'kdramas'],
    job: {
      en: 'Primary school teacher',
      ms: 'Guru sekolah rendah',
      ru: 'Учительница начальных классов',
    },
    bio: {
      en: 'Teacher, bookworm and a sucker for beach sunsets. Teh tarik kurang manis, always.',
      ms: 'Cikgu, ulat buku dan peminat tegar matahari terbenam di pantai. Teh tarik kurang manis, selalu.',
      ru: 'Учительница, книжный червь и любительница закатов на пляже. Teh tarik всегда с меньшим количеством сахара.',
    },
  },
  c: {
    art: 'priya',
    name: 'Priya',
    age: 27,
    city: 'Kuala Lumpur',
    height: 163,
    languages: ['tamil', 'english', 'malay'],
    tags: ['karaoke', 'music', 'road-trips', 'spicy-food', 'concerts'],
    job: { en: 'Data analyst', ms: 'Penganalisis data', ru: 'Аналитик данных' },
    bio: {
      en: 'Data analyst who sings off-key at karaoke. Weekend plan: banana leaf rice, a good playlist and a long drive.',
      ms: 'Penganalisis data yang suka menyanyi sumbang di karaoke. Plan hujung minggu: nasi daun pisang, playlist best dan drive jauh.',
      ru: 'Аналитик данных, фальшиво пою в караоке. План на выходные: рис на банановом листе, хороший плейлист и долгая дорога.',
    },
  },
}

const runUsers = new Map((await listRunUsers(state.runId)).map((u) => [u.id, u]))
const { data: tagRows, error: tagErr } = await db.from('tags').select('id, slug')
if (tagErr) throw tagErr
const tagId = new Map(tagRows.map((t) => [t.slug, t.id]))

for (const [key, p] of Object.entries(PERSONAS)) {
  const user = state.users[key]
  const auth = user && runUsers.get(user.id)
  if (!auth || auth.app_metadata?.seed !== 'fake' || auth.app_metadata?.qa_run !== state.runId) {
    throw new Error(`${key}: not a user of run ${state.runId}, refusing to touch it`)
  }
  const birth = new Date()
  birth.setFullYear(birth.getFullYear() - p.age, birth.getMonth() - 2)
  const { error } = await db
    .from('profiles')
    .update({
      display_name: p.name,
      birth_date: birth.toISOString().slice(0, 10),
      bio: p.bio[lang],
      city: p.city,
      job_title: p.job[lang],
      height_cm: p.height,
      relationship_goal: 'serious',
      languages: p.languages,
    })
    .eq('id', user.id)
  if (error) throw new Error(`${key} profile: ${error.message}`)

  await db.from('profile_tags').delete().eq('profile_id', user.id)
  const tags = p.tags
    .filter((s) => tagId.has(s))
    .map((s) => ({ profile_id: user.id, tag_id: tagId.get(s) }))
  const { error: tErr } = await db.from('profile_tags').insert(tags)
  if (tErr) throw new Error(`${key} tags: ${tErr.message}`)

  // Replace the flat "QA TEST" squares with the illustrations (same bucket and path scheme).
  const { data: old } = await db
    .from('profile_photos')
    .select('storage_path')
    .eq('profile_id', user.id)
  for (const [position, image] of [await portrait(p.art), await scene(p.art)].entries()) {
    const path = `${user.id}/${crypto.randomUUID()}.webp`
    const { error: up } = await db.storage
      .from('profile-photos')
      .upload(path, image, { contentType: 'image/webp' })
    if (up) throw new Error(`${key} photo: ${up.message}`)
    // Point the existing row at the new file (deleting rows would re-number the positions).
    const { data: row, error: pErr } = await db
      .from('profile_photos')
      .update({ storage_path: path, width: 720, height: 960 })
      .eq('profile_id', user.id)
      .eq('position', position)
      .select('position')
    if (pErr) throw new Error(`${key} photo row: ${pErr.message}`)
    if (!row?.length) {
      const { error: iErr } = await db
        .from('profile_photos')
        .insert({ profile_id: user.id, storage_path: path, width: 720, height: 960, position })
      if (iErr) throw new Error(`${key} photo row: ${iErr.message}`)
    }
  }
  if (old?.length) await db.storage.from('profile-photos').remove(old.map((o) => o.storage_path))

  // The guided tour and feature tips would cover the screens.
  await db.from('onboarding_tour').upsert({
    user_id: user.id,
    completed_at: new Date().toISOString(),
    seen_tips: ['statuses', 'crossed_paths', 'event', 'duo', 'visitors', 'crush', 'matchmaker'],
  })
  user.name = p.name
  console.log(`${key}: ${p.name} (${lang})`)
}

// The seeded "QA message" lines of this run's own match go; the screenshots write their own.
if (state.matchId) {
  await db.from('messages').delete().eq('match_id', state.matchId).like('body', '%QA%')
}
writeFileSync(statePath, JSON.stringify(state, null, 2))
console.log(`run ${state.runId}: demo personas ready`)
