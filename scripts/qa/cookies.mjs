// Writes Playwright cookies with a fresh session for one QA user.
//   node --env-file=.env.local scripts/qa/cookies.mjs <state.json> <user key> <domain> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { sessionCookies, sessionFor } from './lib.mjs'
const [statePath, key, domain, out] = process.argv.slice(2)
const { users } = JSON.parse(readFileSync(statePath, 'utf8'))
const session = await sessionFor(users[key].email)
writeFileSync(out, JSON.stringify(sessionCookies(session, domain)))
console.log(`cookies for ${users[key].name} -> ${out}`)
