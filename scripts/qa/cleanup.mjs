// Deletes everything of one QA run: only auth users tagged seed='fake' AND qa_run=<run id>.
//   node --env-file=.env.local scripts/qa/cleanup.mjs <state.json>
import { readFileSync } from 'node:fs'
import { db, listRunUsers } from './lib.mjs'

const { runId } = JSON.parse(readFileSync(process.argv[2], 'utf8'))
if (!/^qa-[a-z0-9]+$/.test(runId)) throw new Error('bad run id')
const users = await listRunUsers(runId)
for (const u of users) {
  if (u.app_metadata?.qa_run !== runId || u.app_metadata?.seed !== 'fake') continue
  const { data: files } = await db.storage.from('profile-photos').list(u.id)
  if (files?.length)
    await db.storage.from('profile-photos').remove(files.map((f) => `${u.id}/${f.name}`))
  await db.from('admins').delete().eq('user_id', u.id)
  const { error } = await db.auth.admin.deleteUser(u.id)
  console.log(error ? `failed ${u.id}: ${error.message}` : `deleted ${u.email}`)
}
console.log(`QA run ${runId}: ${users.length} users removed`)
