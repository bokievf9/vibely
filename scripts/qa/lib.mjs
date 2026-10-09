// QA tooling for browser tests against the configured Supabase project (also production).
// Safety (CLAUDE.md): every account is created by this tooling, tagged
// app_metadata.seed = 'fake' and app_metadata.qa_run = <run id>, and cleanup deletes only
// accounts carrying that exact run id. Nothing else is ever modified or deleted.
import { createClient } from '@supabase/supabase-js'

const {
  NEXT_PUBLIC_SUPABASE_URL: URL,
  SUPABASE_SECRET_KEY: SECRET,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
} = process.env
if (!URL || !SECRET || !ANON) {
  console.error('Run with: node --env-file=.env.local scripts/qa/<script>.mjs')
  process.exit(1)
}

export const db = createClient(URL, SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
})
export const projectRef = new globalThis.URL(URL).hostname.split('.')[0]

export async function listRunUsers(runId) {
  const out = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    out.push(
      ...data.users.filter(
        (u) => u.app_metadata?.qa_run === runId && u.app_metadata?.seed === 'fake',
      ),
    )
    if (data.users.length < 200) return out
  }
}

// A fresh session for a QA user: magic link generated server-side, verified with the anon key.
export async function sessionFor(email) {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: v, error: vErr } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  })
  if (vErr) throw vErr
  return v.session
}

// @supabase/ssr cookie format: "base64-" + base64url(JSON), split into 3180-char chunks.
export function sessionCookies(session, domain) {
  const name = `sb-${projectRef}-auth-token`
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  const MAX = 3180
  const base = {
    domain,
    path: '/',
    httpOnly: false,
    secure: domain !== 'localhost',
    sameSite: 'Lax',
  }
  if (value.length <= MAX) return [{ ...base, name, value }]
  const chunks = []
  for (let i = 0; i * MAX < value.length; i++)
    chunks.push({ ...base, name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) })
  return chunks
}
