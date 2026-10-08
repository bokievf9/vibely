// Deletes every account tagged app_metadata.seed = 'fake' (seed.mjs, seed-full.mjs) and its photos.
// Deleting the auth user cascades to profiles, profile_tags, profile_prompts, profile_photos,
// swipes, matches, messages, posts, comments, aliases and likes.
//   node --env-file=.env.local scripts/fake-users/delete.mjs                  (all fakes)
//   node --env-file=.env.local scripts/fake-users/delete.mjs --batch <batch>  (one seed-full batch)
import { db, listFakeUsers } from './lib.mjs'

const flag = process.argv.indexOf('--batch')
const batch = flag === -1 ? null : process.argv[flag + 1]
if (flag !== -1 && !batch) {
  console.error('Usage: delete.mjs --batch <batch>   (e.g. full-20261009T120000)')
  process.exit(1)
}
const inScope = (u) => !batch || u.app_metadata?.batch === batch

const fakes = (await listFakeUsers()).filter(inScope)
console.log(`Fake users found${batch ? ` in batch ${batch}` : ''}: ${fakes.length}`)
for (const u of fakes) {
  const { data: files } = await db.storage.from('profile-photos').list(u.id, { limit: 1000 })
  if (files?.length) await db.storage.from('profile-photos').remove(files.map((f) => `${u.id}/${f.name}`))
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) console.error(`  ${u.id}: ${error.message}`)
}
console.log(`Remaining fake users${batch ? ` in batch ${batch}` : ''}: ${(await listFakeUsers()).filter(inScope).length}`)
