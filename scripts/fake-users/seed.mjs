// Fills the platform with clearly-marked fake accounts for testing.
//   node --env-file=.env.local scripts/fake-users/seed.mjs [targetPhone]
// targetPhone (default: the admin account) gets pre-likes and two ready-made chats.
// Remove everything with: node --env-file=.env.local scripts/fake-users/delete.mjs
import { AREAS, CHATS, PEOPLE, POSTS, SEED_TAG } from './data.mjs'
import { db, fakePhoto, findUserByPhone, hoursAgo, listFakeUsers, pick } from './lib.mjs'

const TARGET_PHONE = process.argv[2] ?? '601124063028'

if ((await listFakeUsers()).length) {
  console.error('Fake users already exist. Run delete.mjs first.')
  process.exit(1)
}

const { data: tags } = await db.from('tags').select('id, slug')
const tagId = new Map(tags.map((t) => [t.slug, t.id]))
const target = await findUserByPhone(TARGET_PHONE)
console.log(target ? `Target user: +${TARGET_PHONE}` : `Target +${TARGET_PHONE} not found: skipping likes and chats`)

const people = []
for (const [i, [name, gender, age, bio, tagSlugs]] of PEOPLE.entries()) {
  const phone = `6011999900${String(i + 1).padStart(2, '0')}`
  const { data, error } = await db.auth.admin.createUser({
    phone,
    phone_confirm: true,
    app_metadata: { seed: SEED_TAG },
  })
  if (error) throw new Error(`${name}: ${error.message}`)
  const id = data.user.id
  const area = AREAS[i % AREAS.length]
  const birth = new Date()
  birth.setFullYear(birth.getFullYear() - age, birth.getMonth() - 1 - (i % 9), 1 + (i % 27))

  const { error: pErr } = await db.from('profiles').insert({
    id,
    display_name: name,
    birth_date: birth.toISOString().slice(0, 10),
    gender,
    interested_in: [gender === 'female' ? 'male' : 'female'],
    bio,
    city: area.city,
    location: `SRID=4326;POINT(${area.lng + (Math.random() - 0.5) * 0.03} ${area.lat + (Math.random() - 0.5) * 0.03})`,
    verification_status: 'approved',
    last_active_at: hoursAgo(Math.random() * 72),
  })
  if (pErr) throw new Error(`${name} profile: ${pErr.message}`)
  await db.from('profile_tags').insert(tagSlugs.map((s) => ({ profile_id: id, tag_id: tagId.get(s) })))

  for (const variant of [0, 1]) {
    const path = `${id}/${crypto.randomUUID()}.webp`
    const { error: upErr } = await db.storage
      .from('profile-photos')
      .upload(path, await fakePhoto(name, i, variant), { contentType: 'image/webp' })
    if (upErr) throw new Error(`${name} photo: ${upErr.message}`)
    await db.from('profile_photos').insert({ profile_id: id, storage_path: path, width: 720, height: 960, position: variant })
  }
  people.push({ id, name, gender })
  process.stdout.write(`\r  profiles: ${people.length}/${PEOPLE.length}`)
}
console.log()

if (target) {
  const women = people.filter((p) => p.gender === 'female')
  // These already liked the target: liking them back in Discover creates an instant match.
  const admirers = women.slice(2, 10)
  await db.from('swipes').insert(admirers.map((p) => ({ swiper_id: p.id, swiped_id: target.id, direction: 'like' })))
  console.log(`  pre-likes on target: ${admirers.map((p) => p.name).join(', ')}`)

  for (const [name, lines] of CHATS) {
    const p = people.find((x) => x.name === name)
    const [a, b] = [p.id, target.id].sort()
    await db.from('swipes').insert([
      { swiper_id: p.id, swiped_id: target.id, direction: 'like' },
      { swiper_id: target.id, swiped_id: p.id, direction: 'like' },
    ])
    const { data: match } = await db.from('matches').select('id').eq('user_a', a).eq('user_b', b).single()
    await db.from('messages').insert(
      lines.map((body, k) => ({ match_id: match.id, sender_id: p.id, body, created_at: hoursAgo(2 - k * 0.2) })),
    )
  }
  console.log(`  ready chats: ${CHATS.map(([n]) => n).join(', ')}`)
}

for (const [k, [body, comments]] of POSTS.entries()) {
  const [author, ...others] = pick(people, comments.length + 6)
  const at = hoursAgo(48 - k * 3)
  const { data: post, error } = await db.from('posts').insert({ author_id: author.id, body, created_at: at }).select('id').single()
  if (error) throw new Error(`post: ${error.message}`)
  await db.from('post_aliases').insert({ post_id: post.id, user_id: author.id, alias_no: 0 })
  for (const [n, text] of comments.entries()) {
    await db.from('post_aliases').insert({ post_id: post.id, user_id: others[n].id, alias_no: n + 1 })
    await db.from('comments').insert({ post_id: post.id, author_id: others[n].id, alias_no: n + 1, body: text, created_at: hoursAgo(47 - k * 3 - n * 0.3) })
  }
  const likers = pick(people, 2 + Math.floor(Math.random() * 10))
  await db.from('post_likes').insert(likers.map((p) => ({ post_id: post.id, user_id: p.id })))
}
console.log(`  feed posts: ${POSTS.length}`)
console.log('Done.')
