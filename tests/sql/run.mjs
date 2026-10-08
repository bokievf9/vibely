// Applies supabase/migrations + seed to an in-memory Postgres (PGlite + PostGIS) with minimal stubs
// of Supabase's auth/realtime/storage schemas, then runs the behavior tests.
//   npm run test:sql
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const supabaseDir = join(here, '../../supabase')
const db = new PGlite({ extensions: { postgis } })

await db.exec(readFileSync(join(here, 'supabase-stubs.sql'), 'utf8'))
for (const file of readdirSync(join(supabaseDir, 'migrations')).sort()) {
  try {
    await db.exec(readFileSync(join(supabaseDir, 'migrations', file), 'utf8'))
  } catch (e) {
    console.error(`FAIL migration ${file}: ${e.message}`)
    process.exit(1)
  }
}
await db.exec(readFileSync(join(supabaseDir, 'seed.sql'), 'utf8'))
console.log('migrations + seed applied')

const { run } = await import('./behavior.test.mjs')
const failed = await run(db)
process.exit(failed ? 1 : 0)
