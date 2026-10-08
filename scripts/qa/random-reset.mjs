// Ends any active random chat of the QA run's users (A and B) and leaves the queue.
//   node --env-file=.env.local scripts/qa/random-reset.mjs <state.json>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { sessionFor } from './lib.mjs'
const { users } = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const k of ['a', 'b']) {
  const s = await sessionFor(users[k].email)
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${s.access_token}` } },
      auth: { persistSession: false },
    },
  )
  const { data } = await c.rpc('get_random_session')
  for (const row of data ?? []) await c.rpc('randomizer_end', { p_session_id: row.id })
  await c.rpc('randomizer_leave')
}
console.log('random chat reset')
