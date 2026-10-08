// Adds a NEW batch of 40 fully filled fake profiles (about fields, 3 prompts, 5-8 tags, 4-6
// synthetic photos, username), plus likes, matches with short chats and feed posts, all strictly
// between fake accounts. Never touches real users, never modifies existing fake accounts.
//   node --env-file=.env.local scripts/fake-users/seed-full.mjs
// Every account is tagged app_metadata = { seed: 'fake', batch: 'full-<timestamp>' }.
// Remove this batch: node --env-file=.env.local scripts/fake-users/delete.mjs --batch <batch>
// Remove every fake: node --env-file=.env.local scripts/fake-users/delete.mjs
import { CITIES, MATCHES, PEOPLE_FULL, POSTS_FULL } from './data-full.mjs'
import { SEED_TAG } from './data.mjs'
import { db, fakePhotoFull, hoursAgo, pick } from './lib.mjs'

const PHONE_BASE = 601199991001
const COUNT = PEOPLE_FULL.length
const PROMPT_KEYS = new Set([
  'ideal_weekend', 'way_to_heart', 'mamak_order', 'weirdly_good_at', 'two_truths_lie', 'simple_pleasures',
  'lets_debate', 'perfect_first_date', 'looking_for', 'karaoke_song', 'travel_story', 'green_flags',
])
const BATCH = `full-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`
const phoneOf = (i) => String(PHONE_BASE + i)

// 1. Validate the data before touching anything.
function validate() {
  const problems = []
  const all = JSON.stringify([PEOPLE_FULL, MATCHES, POSTS_FULL])
  if (/[\u2013\u2014]/.test(all)) problems.push('copy contains an em/en dash')
  if (COUNT !== 40) problems.push(`expected 40 people, got ${COUNT}`)
  const names = new Set(PEOPLE_FULL.map((p) => p.n))
  if (names.size !== COUNT) problems.push('duplicate names')
  if (new Set(PEOPLE_FULL.map((p) => p.u)).size !== COUNT) problems.push('duplicate usernames')
  for (const p of PEOPLE_FULL) {
    if (!CITIES[p.c]) problems.push(`${p.n}: unknown city ${p.c}`)
    if (p.a < 20 || p.a > 40) problems.push(`${p.n}: age ${p.a}`)
    if (p.tags.length < 5 || p.tags.length > 8) problems.push(`${p.n}: ${p.tags.length} tags`)
    if (p.pr.length !== 3 || new Set(p.pr.map(([k]) => k)).size !== 3) problems.push(`${p.n}: prompts`)
    for (const [k, ans] of p.pr) {
      if (!PROMPT_KEYS.has(k)) problems.push(`${p.n}: prompt key ${k}`)
      if (ans.length > 200) problems.push(`${p.n}: prompt answer too long`)
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(p.u) || /^\.|\.$|\.\./.test(p.u)) problems.push(`${p.n}: username ${p.u}`)
    if (p.job.length > 60) problems.push(`${p.n}: job too long`)
    if (p.lang.length > 6) problems.push(`${p.n}: too many languages`)
  }
  for (const [x, y] of MATCHES) if (!names.has(x) || !names.has(y)) problems.push(`match ${x}/${y}`)
  for (const [author, , , comments] of POSTS_FULL) {
    if (!names.has(author)) problems.push(`post author ${author}`)
    for (const [c] of comments) if (!names.has(c)) problems.push(`comment author ${c}`)
  }
  return problems
}

const problems = validate()
if (problems.length) {
  console.error(`Invalid data:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

// 2. Read-only pre-flight: every target phone must be free, every tag must exist.
const allUsers = []
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  allUsers.push(...data.users)
  if (data.users.length < 200) break
}
const targetPhones = new Set(PEOPLE_FULL.map((_, i) => phoneOf(i)))
const taken = allUsers.filter((u) => targetPhones.has(u.phone))
if (taken.length) {
  console.error(`Aborting: ${taken.length} phone(s) in +${phoneOf(0)}..+${phoneOf(COUNT - 1)} already exist (${taken.map((u) => u.phone).join(', ')}).`)
  process.exit(1)
}

const { data: tagRows, error: tagErr } = await db.from('tags').select('id, slug, label')
if (tagErr) throw tagErr
const tagBySlug = new Map(tagRows.map((t) => [t.slug, t]))
const missingTags = [...new Set(PEOPLE_FULL.flatMap((p) => p.tags))].filter((s) => !tagBySlug.has(s))
if (missingTags.length) {
  console.error(`Aborting: unknown tag slugs ${missingTags.join(', ')}`)
  process.exit(1)
}

const { data: takenNames } = await db.from('profiles').select('username').in('username', PEOPLE_FULL.map((p) => p.u))
const takenUsernames = new Set((takenNames ?? []).map((r) => r.username))

// Existing fake accounts from seed.mjs (likes go to them, nothing else is changed).
const existingFakeIds = allUsers
  .filter((u) => u.app_metadata?.seed === SEED_TAG && !u.app_metadata?.qa_run && !u.app_metadata?.batch)
  .filter((u) => /^6011999900\d\d$/.test(u.phone ?? ''))
  .map((u) => u.id)
const { data: existingFakes } = existingFakeIds.length
  ? await db.from('profiles').select('id, gender, interested_in').in('id', existingFakeIds)
  : { data: [] }

console.log(`Batch ${BATCH}: phones +${phoneOf(0)}..+${phoneOf(COUNT - 1)} are free. Existing seed fakes: ${existingFakes.length}`)

// 3. Create. On any failure, remove only the accounts this run created.
const created = []
const stats = { users: 0, photos: 0, prompts: 0, tags: 0, likes: 0, matches: 0, messages: 0, posts: 0, comments: 0, postLikes: 0 }

async function rollback() {
  console.error(`Rolling back ${created.length} account(s) created by this run...`)
  for (const id of created) {
    const { data } = await db.auth.admin.getUserById(id)
    if (data?.user?.app_metadata?.batch !== BATCH) continue // safety: only this run's accounts
    const { data: files } = await db.storage.from('profile-photos').list(id)
    if (files?.length) await db.storage.from('profile-photos').remove(files.map((f) => `${id}/${f.name}`))
    await db.auth.admin.deleteUser(id)
  }
}

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

const people = []
try {
  for (const [i, p] of PEOPLE_FULL.entries()) {
    const { data, error } = await db.auth.admin.createUser({
      phone: phoneOf(i),
      phone_confirm: true,
      app_metadata: { seed: SEED_TAG, batch: BATCH },
    })
    if (error) throw new Error(`${p.n}: ${error.message}`)
    const id = data.user.id
    created.push(id)
    stats.users++

    const area = CITIES[p.c]
    // Exactly p.a years old: birthday 1 to 11 months ago.
    const birth = new Date()
    birth.setDate(1)
    birth.setFullYear(birth.getFullYear() - p.a, birth.getMonth() - 1 - (i % 11), 1 + ((i * 7) % 27))
    // A third were active in the last 15 minutes ("online"), the rest within two days.
    const lastActive = i % 3 === 0 ? hoursAgo(Math.random() * 0.25) : hoursAgo(0.5 + Math.random() * 47)

    must(await db.from('profiles').insert({
      id,
      display_name: p.n,
      username: takenUsernames.has(p.u) ? null : p.u,
      birth_date: birth.toISOString().slice(0, 10),
      gender: p.g,
      interested_in: [p.g === 'female' ? 'male' : 'female'],
      bio: p.bio,
      city: area.city,
      location: `SRID=4326;POINT(${area.lng + (Math.random() - 0.5) * 0.04} ${area.lat + (Math.random() - 0.5) * 0.04})`,
      verification_status: 'approved',
      terms_accepted_at: hoursAgo(24 * (3 + (i % 20))),
      last_active_at: lastActive,
      relationship_goal: p.goal,
      height_cm: p.h,
      job_title: p.job,
      education: p.edu,
      languages: p.lang,
      religion: p.rel,
      smoking: p.sm,
      drinking: p.dr,
      pets: p.pets,
      children: p.kids,
    }), `${p.n} profile`)

    must(await db.from('profile_tags').insert(p.tags.map((s) => ({ profile_id: id, tag_id: tagBySlug.get(s).id }))), `${p.n} tags`)
    stats.tags += p.tags.length
    must(await db.from('profile_prompts').insert(
      p.pr.map(([prompt_key, answer], position) => ({ profile_id: id, prompt_key, answer, position })),
    ), `${p.n} prompts`)
    stats.prompts += p.pr.length

    const photoCount = 4 + (i % 3) // 4, 5 or 6
    const captions = [area.city, ...p.tags.map((s) => tagBySlug.get(s).label)]
    for (let v = 0; v < photoCount; v++) {
      const path = `${id}/${crypto.randomUUID()}.webp`
      const buf = await fakePhotoFull(p.n, i, v, captions[v % captions.length])
      must(await db.storage.from('profile-photos').upload(path, buf, { contentType: 'image/webp' }), `${p.n} photo upload`)
      must(await db.from('profile_photos').insert({ profile_id: id, storage_path: path, width: 720, height: 960, position: v }), `${p.n} photo row`)
      stats.photos++
    }
    people.push({ id, name: p.n, gender: p.g })
    process.stdout.write(`\r  profiles: ${people.length}/${COUNT}`)
  }
  console.log()

  const byName = new Map(people.map((x) => [x.name, x]))
  const liked = new Set() // "swiper>swiped"
  const like = async (from, to, at) => {
    const key = `${from}>${to}`
    if (liked.has(key)) return
    must(await db.from('swipes').insert({ swiper_id: from, swiped_id: to, direction: 'like', created_at: at }), 'like')
    liked.add(key)
    stats.likes++
  }

  // 4. Matches with chats (mutual likes; the trigger creates the match).
  for (const [k, [x, y, lines]] of MATCHES.entries()) {
    const [p, q] = [byName.get(x), byName.get(y)]
    const start = 20 + k * 9 // hours ago
    await like(p.id, q.id, hoursAgo(start + 2))
    await like(q.id, p.id, hoursAgo(start))
    const [a, b] = [p.id, q.id].sort()
    const match = must(await db.from('matches').select('id').eq('user_a', a).eq('user_b', b).single(), 'match lookup')
    must(await db.from('matches').update({ created_at: hoursAgo(start) }).eq('id', match.id), 'match time')
    stats.matches++
    for (const [n, [who, body]] of lines.entries()) {
      const at = start - 0.5 - n * (start / (lines.length + 2))
      must(await db.from('messages').insert({
        match_id: match.id,
        sender_id: who === 0 ? p.id : q.id,
        body,
        created_at: hoursAgo(at),
        read_at: n < lines.length - 1 ? hoursAgo(at - 0.1) : null,
      }), 'message')
      stats.messages++
    }
  }

  // 5. One-way likes: new fakes towards existing seed fakes and among themselves, never mutual
  // (only the pairs above are matches).
  const isMutual = (from, to) => liked.has(`${to}>${from}`)
  for (const [i, me] of people.entries()) {
    const wanted = me.gender === 'female' ? 'male' : 'female'
    const oldTargets = pick(existingFakes.filter((f) => f.gender === wanted && f.interested_in.includes(me.gender)), 1 + (i % 3))
    for (const t of oldTargets) await like(me.id, t.id, hoursAgo(1 + Math.random() * 70))
    const newTargets = pick(people.filter((x) => x.gender === wanted && !isMutual(me.id, x.id)), 2 + (i % 2))
    for (const t of newTargets) if (!isMutual(me.id, t.id)) await like(me.id, t.id, hoursAgo(1 + Math.random() * 70))
  }

  // 6. Feed posts and comments, anonymous or "As me" (is_named), with per-thread aliases.
  for (const [k, [authorName, named, body, comments]] of POSTS_FULL.entries()) {
    const author = byName.get(authorName)
    const at = 40 - k * 3.5
    const post = must(await db.from('posts').insert({ author_id: author.id, body, is_named: named, created_at: hoursAgo(at) }).select('id').single(), 'post')
    must(await db.from('post_aliases').insert({ post_id: post.id, user_id: author.id, alias_no: 0 }), 'alias')
    stats.posts++
    const alias = new Map([[author.id, 0]])
    for (const [n, [who, cNamed, text]] of comments.entries()) {
      const c = byName.get(who)
      if (!alias.has(c.id)) {
        alias.set(c.id, alias.size)
        must(await db.from('post_aliases').insert({ post_id: post.id, user_id: c.id, alias_no: alias.get(c.id) }), 'alias')
      }
      must(await db.from('comments').insert({
        post_id: post.id, author_id: c.id, alias_no: alias.get(c.id), body: text, is_named: cNamed,
        created_at: hoursAgo(at - 0.4 - n * 0.7),
      }), 'comment')
      stats.comments++
    }
    const likers = pick(people, 3 + ((k * 5) % 12))
    must(await db.from('post_likes').insert(likers.map((x) => ({ post_id: post.id, user_id: x.id }))), 'post likes')
    stats.postLikes += likers.length
  }
} catch (err) {
  console.error(`\nFailed: ${err.message}`)
  await rollback()
  process.exit(1)
}

console.log(`Batch: ${BATCH}`)
console.log(JSON.stringify(stats))
console.log(`Delete this batch: npm run fake:delete-batch -- ${BATCH}`)
