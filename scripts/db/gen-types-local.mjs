// Generates src/types/database.types.ts from supabase/migrations WITHOUT a live database:
// applies all migrations to in-memory Postgres (PGlite + PostGIS, Supabase stubs from tests/sql)
// and emits the same shape as `supabase gen types typescript`. The generic helper types
// (Tables<>, Enums<>, …) are reused from the current file, so they stay identical to the official
// generator. Use it when branches change the schema before it is applied to Supabase; after
// `supabase db push` prefer the official `npm run db:types` equivalent with --linked.
//   node scripts/db/gen-types-local.mjs
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(root, 'src/types/database.types.ts')
const db = new PGlite({ extensions: { postgis } })
await db.exec(readFileSync(join(root, 'tests/sql/supabase-stubs.sql'), 'utf8'))
for (const f of readdirSync(join(root, 'supabase/migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
}

  const q = async (s) => (await db.query(s)).rows
const enums = await q(`select t.typname n, array_agg(e.enumlabel order by e.enumsortorder) v
  from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace ns on ns.oid=t.typnamespace
  where ns.nspname='public' group by 1 order by 1`)
const enumNames = new Set(enums.map(e => e.n))
const ts = (udt, isArr) => {
  const base = udt.replace(/^_/, '')
  let t
  if (enumNames.has(base)) t = `Database["public"]["Enums"]["${base}"]`
  else if (['int2','int4','int8','float4','float8','numeric'].includes(base)) t = 'number'
  else if (base === 'bool') t = 'boolean'
  else if (['json','jsonb'].includes(base)) t = 'Json'
  else if (['uuid','text','varchar','date','timestamptz','timestamp','bpchar'].includes(base)) t = 'string'
  else if (base === 'void') t = 'undefined'
  else t = 'unknown'
  return (isArr || udt.startsWith('_')) ? `${t}[]` : t
}
const cols = await q(`select c.table_name t, c.column_name c, c.udt_name u, c.is_nullable='YES' nullable,
    (c.column_default is not null) has_def, c.is_identity='YES' and c.identity_generation='ALWAYS' ident, c.ordinal_position
  from information_schema.columns c where c.table_schema='public' order by t, c.column_name`)
const rels = await q(`select tc.table_name t, tc.constraint_name fk, kcu.column_name col, ccu.table_name rt, ccu.column_name rc
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema='public'
  join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
  where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public' and ccu.table_schema='public' order by 1,2`)
const kinds = Object.fromEntries((await q(`select table_name t, table_type k from information_schema.tables where table_schema='public'`)).map(r => [r.t, r.k]))
const byTable = {}
for (const c of cols) (byTable[c.t] ??= []).push(c)
const I = (n) => ' '.repeat(n)
const relBlock = (t, ind) => {
  const r = rels.filter(x => x.t === t)
  if (!r.length) return `${I(ind)}Relationships: []`
  return `${I(ind)}Relationships: [\n` + r.map(x => `${I(ind+2)}{\n${I(ind+4)}foreignKeyName: "${x.fk}"\n${I(ind+4)}columns: ["${x.col}"]\n${I(ind+4)}isOneToOne: false\n${I(ind+4)}referencedRelation: "${x.rt}"\n${I(ind+4)}referencedColumns: ["${x.rc}"]\n${I(ind+2)}},\n`).join('') + `${I(ind)}]`
}
const tables = [], views = []
for (const t of Object.keys(byTable).sort()) {
  const cs = byTable[t]
  const row = cs.map(c => `${I(10)}${c.c}: ${ts(c.u)}${c.nullable ? ' | null' : ''}`).join('\n')
  if (kinds[t] === 'VIEW') {
    views.push(`${I(6)}${t}: {\n${I(8)}Row: {\n${row}\n${I(8)}}\n${I(8)}Relationships: []\n${I(6)}}`)
    continue
  }
  const ins = cs.map(c => c.ident ? `${I(10)}${c.c}?: never` : `${I(10)}${c.c}${c.nullable || c.has_def ? '?' : ''}: ${ts(c.u)}${c.nullable ? ' | null' : ''}`).join('\n')
  const upd = cs.map(c => c.ident ? `${I(10)}${c.c}?: never` : `${I(10)}${c.c}?: ${ts(c.u)}${c.nullable ? ' | null' : ''}`).join('\n')
  tables.push(`${I(6)}${t}: {\n${I(8)}Row: {\n${row}\n${I(8)}}\n${I(8)}Insert: {\n${ins}\n${I(8)}}\n${I(8)}Update: {\n${upd}\n${I(8)}}\n${relBlock(t, 8)}\n${I(6)}}`)
}
const fns = await q(`select p.proname n, p.proretset setof, p.prorettype::regtype::text rt, t.typname rtn,
    p.proargnames names, p.proargmodes modes, p.pronargdefaults ndef, p.pronargs nargs,
    array(select format_type(x, null) from unnest(p.proallargtypes) x) alltypes,
    array(select ty.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as u(x, ord) join pg_type ty on ty.oid=u.x order by u.ord) alludt
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace join pg_type t on t.oid=p.prorettype
  where ns.nspname='public' and t.typname <> 'trigger'
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute')) and p.proname not like 'hook\_%' order by 1`)
const functions = fns.map(f => {
  const names = f.names ?? [], modes = f.modes ?? names.map(() => 'i'), udts = f.alludt
  const ins = [], outs = []
  names.forEach((n, i) => (modes[i] === 'i' ? ins : modes[i] === 't' || modes[i] === 'o' ? outs : ins).push({ n, u: udts[i], i }))
  const firstDefault = f.nargs - f.ndef
  const args = ins.length ? `{\n${ins.map((a, k) => `${I(10)}${a.n}${k >= firstDefault ? '?' : ''}: ${ts(a.u)}`).join('\n')}\n${I(8)}}` : 'never'
  let ret
  if (outs.length) ret = `{\n${outs.map(o => `${I(10)}${o.n}: ${ts(o.u)}`).join('\n')}\n${I(8)}}[]`
  else if (f.setof) ret = `${ts(f.rtn)}[]`
  else ret = ts(f.rtn)
  return `${I(6)}${f.n}: {\n${I(8)}Args: ${args}\n${I(8)}Returns: ${ret}\n${I(6)}}`
})

const enumsTs = enums.map((e) => `      ${e.n}: ${e.v.map((v) => `"${v}"`).join(' | ')}`).join('\n')
const consts = enums.map((e) => `      ${e.n}: [${e.v.map((v) => `"${v}"`).join(', ')}],`).join('\n')
const current = readFileSync(OUT, 'utf8')
const helpers = current.slice(current.indexOf('type DatabaseWithoutInternals'), current.indexOf('export const Constants'))
const file = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
${tables.join('\n')}
    }
    Views: {
${views.join('\n')}
    }
    Functions: {
${functions.join('\n')}
    }
    Enums: {
${enumsTs}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

${helpers}export const Constants = {
  public: {
    Enums: {
${consts}
    },
  },
} as const
`
writeFileSync(OUT, file)
console.log(`wrote ${OUT}`)
process.exit(0)
