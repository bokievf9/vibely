// Deletes every account tagged app_metadata.seed = 'fake' (created by seed.mjs) and its photos.
// Deleting the auth user cascades to profiles, swipes, matches, messages, posts, comments, likes.
//   node --env-file=.env.local scripts/fake-users/delete.mjs
import { db, listFakeUsers } from './lib.mjs'

const fakes = await listFakeUsers()
console.log(`Fake users found: ${fakes.length}`)
for (const u of fakes) {
  const { data: files } = await db.storage.from('profile-photos').list(u.id)
  if (files?.length) await db.storage.from('profile-photos').remove(files.map((f) => `${u.id}/${f.name}`))
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) console.error(`  ${u.id}: ${error.message}`)
}
console.log(`Remaining fake users: ${(await listFakeUsers()).length}`)
