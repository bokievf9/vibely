const U = ['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
           '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444']
let pass = 0, fail = 0
// Prints only failures and a summary; returns the number of failed checks.
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; if (!cond) console.log('  ✗', name, extra) }
export async function run(db) {
  const su = async (sql, p) => { await db.exec('reset role'); return db.query(sql, p) }
  const as = async (u, sql, p, topic='') => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${u}',false); select set_config('realtime.topic','${topic}',false); set role authenticated;`)
    try { return await db.query(sql, p) } finally { await db.exec('reset role') }
  }
  const fails = async (fn) => { try { await fn(); return null } catch (e) { return e.message } }
  for (const [i, u] of U.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6012345678' + i])
  const prof = (i, g, want, bd, lon) => as(U[i], `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
     values ($1,$2,$3,$4,'Tashkent', 'SRID=4326;POINT(${lon} 41.3)')`, ['User'+i, bd, g, want])
  await prof(0,'male','{female}','1995-01-01',69.24); await prof(1,'female','{male}','1997-05-05',69.30)
  await prof(2,'female','{male}','1990-01-01',69.25); await prof(3,'male','{female}','1999-01-01',69.26)
  ok('profile id defaults to auth.uid()', (await su(`select count(*)::int c from profiles`)).rows[0].c === 4)
  await su(`insert into auth.users(id, phone) values ('55555555-5555-5555-5555-555555555555', '60123456789')`)
  ok('under-18 rejected', !!(await fails(() => as('55555555-5555-5555-5555-555555555555', `insert into profiles (display_name,birth_date,gender,interested_in) values ('Kid','2015-01-01','male','{female}')`))))
  ok('cannot self-approve', !!(await fails(() => as(U[0], `update profiles set verification_status='approved' where id=$1`, [U[0]]))))
  ok('cannot read location', !!(await fails(() => as(U[0], `select location from profiles where id=$1`, [U[0]]))))
  ok('unverified cannot swipe', !!(await fails(() => as(U[0], `insert into swipes (swiped_id, direction) values ($1,'like')`, [U[1]]))))
  // verification flow
  for (const u of U) await as(u, `insert into verification_requests (selfie_path, challenge) values ($1, 'peace')`, [`${u}/s.jpg`])
  ok('request sets pending', (await su(`select verification_status v from profiles where id=$1`, [U[0]])).rows[0].v === 'pending')
  ok('selfie path must be own folder', !!(await fails(() => as(U[0], `insert into verification_requests (selfie_path, challenge) values ($1,'x')`, [`${U[1]}/s.jpg`]))))
  await su(`update verification_requests set status='approved'`)
  ok('approval syncs profile', (await su(`select count(*)::int c from profiles where verification_status='approved'`)).rows[0].c === 4)
  // swipe candidates
  const cand = (await as(U[0], `select * from get_swipe_candidates('{female}', 18, 40, 50)`)).rows
  ok('candidates: mutual interest + distance', cand.length === 2 && cand.every(c => c.distance_km !== null && c.distance_km <= 6), JSON.stringify(cand))
  // swipe & match
  await as(U[0], `insert into swipes (swiped_id, direction) values ($1,'like')`, [U[1]])
  ok('one-way like: no match', (await su(`select count(*)::int c from matches`)).rows[0].c === 0)
  ok('cannot see who liked me', (await as(U[1], `select count(*)::int c from swipes`)).rows[0].c === 0)
  await as(U[1], `insert into swipes (swiped_id, direction) values ($1,'like')`, [U[0]])
  const m = (await su(`select id from matches`)).rows[0]
  ok('mutual like creates match', !!m)
  await as(U[0], `insert into messages (match_id, body) values ($1,'привет')`, [m.id])
  ok('participant reads messages', (await as(U[1], `select count(*)::int c from messages`)).rows[0].c === 1)
  ok('outsider sees nothing', (await as(U[2], `select count(*)::int c from messages`)).rows[0].c === 0)
  ok('realtime: match participant may join', (await as(U[1], `select count(*)::int c from realtime.messages`, [], 'match:' + m.id)).rows[0].c >= 0 &&
     !(await fails(() => as(U[1], `select 1`, [], 'match:' + m.id))))
  await su(`insert into realtime.messages (topic, event, payload) values ($1, 'probe', '{}')`, ['match:' + m.id])
  ok('realtime: match channel visible to participant', (await as(U[1], `select count(*)::int c from realtime.messages where topic=$1`, ['match:' + m.id], 'match:' + m.id)).rows[0].c === 1)
  ok('realtime: match channel hidden from outsider', (await as(U[2], `select count(*)::int c from realtime.messages where topic=$1`, ['match:' + m.id], 'match:' + m.id)).rows[0].c === 0)
  ok('outsider cannot write', !!(await fails(() => as(U[2], `insert into messages (match_id, body) values ($1,'hi')`, [m.id]))))
  ok('swiped excluded from deck', (await as(U[0], `select * from get_swipe_candidates('{female}', 18, 40, 50)`)).rows.length === 1)
  // feed
  const post = (await as(U[0], `select create_post('анонимный пост') id`)).rows[0].id
  ok('posts table closed', !!(await fails(() => as(U[1], `select * from posts`))))
  const fp = (await as(U[1], `select * from feed_posts`)).rows
  ok('feed view hides author', fp.length === 1 && fp[0].author_id === null && fp[0].author_name === null && fp[0].is_mine === false)
  ok('author sees is_mine', (await as(U[0], `select is_mine from feed_posts`)).rows[0].is_mine === true)
  await as(U[1], `select create_comment($1,'c1')`, [post]); await as(U[2], `select create_comment($1,'c2')`, [post])
  await as(U[1], `select create_comment($1,'c3')`, [post]); await as(U[0], `select create_comment($1,'op')`, [post])
  const cs = (await as(U[3], `select body, alias_no, is_op from post_comments order by created_at`)).rows
  ok('stable aliases + OP flag', JSON.stringify(cs.map(c => [c.alias_no, c.is_op])) === '[[1,false],[2,false],[1,false],[0,true]]', JSON.stringify(cs))
  ok('like toggles on', (await as(U[1], `select toggle_post_like($1) v`, [post])).rows[0].v === true)
  ok('likes_count = 1, comments_count = 4', JSON.stringify((await as(U[1], `select likes_count, comments_count, is_liked_by_me from feed_posts`)).rows[0]) === '{"likes_count":1,"comments_count":4,"is_liked_by_me":true}')
  ok('like toggles off', (await as(U[1], `select toggle_post_like($1) v`, [post])).rows[0].v === false)
  for (let i = 0; i < 4; i++) await as(U[2], `select create_post('p${i}')`)
  ok('post rate limit (5/h)', !!(await fails(async () => { await as(U[2], `select create_post('p5')`); await as(U[2], `select create_post('p6')`) })))
  await as(U[1], `select delete_post($1)`, [post])
  ok('non-author cannot delete', (await as(U[3], `select count(*)::int c from feed_posts where id=$1`, [post])).rows[0].c === 1)
  ok('feed broadcast has no author', (await su(`select payload from realtime.messages where topic='feed' limit 1`)).rows[0].payload.post_id !== undefined)
  // randomizer: U3 (male, wants female 18-40, tag 1) and U2 (female 1990 → age 36)
  await su(`insert into profile_tags values ($1,1),($2,1),($2,2)`, [U[3], U[2]])
  ok('first join waits', (await as(U[3], `select randomizer_join('{female}',18,40,'{1}') s`)).rows[0].s === null)
  ok('incompatible filters do not pair', (await as(U[1], `select randomizer_join('{male}',30,40) s`)).rows[0].s === null)
  await as(U[1], `select randomizer_leave()`)
  const sid = (await as(U[2], `select randomizer_join('{male}',18,40) s`)).rows[0].s
  ok('compatible join pairs', !!sid)
  ok('waiting user notified', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='paired'`, ['randomizer:'+U[3]])).rows[0].c === 1)
  const rs = (await as(U[3], `select * from get_random_session()`)).rows[0]
  ok('partner hidden, common tags shown', rs.partner === null && JSON.stringify(rs.common_tags) === '["sport"]', JSON.stringify(rs))
  ok('sessions table closed', !!(await fails(() => as(U[3], `select * from random_chat_sessions`))))
  await as(U[3], `select randomizer_send($1,'hey')`, [sid])
  const msgs = (await as(U[2], `select * from get_random_messages($1)`, [sid])).rows
  ok('history without sender id', msgs.length === 1 && msgs[0].is_mine === false && !('sender_id' in msgs[0]))
  ok('outsider cannot send', !!(await fails(() => as(U[0], `select randomizer_send($1,'x')`, [sid]))))
  ok('outsider cannot read history', (await as(U[0], `select * from get_random_messages($1)`, [sid])).rows.length === 0)
  const t = 'random:' + sid
  ok('realtime: participant receives', (await as(U[2], `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c >= 1)
  ok('realtime: outsider blocked', (await as(U[0], `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c === 0)
  ok('realtime: client cannot write to random:<id>', !!(await fails(() => as(U[2], `insert into realtime.messages (topic, event, payload) values ($1,'message','{}')`, [t], t))))
  const tt = 'random-typing:' + sid
  const twErr = await fails(() => as(U[2], `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, [tt], tt))
  ok('realtime: participant may write typing', !twErr, twErr)
  ok('realtime: outsider cannot write typing', !!(await fails(() => as(U[0], `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, [tt], tt))))
  ok('first reveal waits', (await as(U[3], `select randomizer_reveal($1) v`, [sid])).rows[0].v === false)
  ok('still hidden after one consent', (await as(U[2], `select partner from get_random_session()`)).rows[0].partner === null)
  ok('mutual reveal', (await as(U[2], `select randomizer_reveal($1) v`, [sid])).rows[0].v === true)
  const after = (await as(U[2], `select * from get_random_session()`)).rows[0]
  ok('partner revealed + match', after.partner?.id === U[3] && !!after.match_id, JSON.stringify(after))
  ok('match source = randomizer', (await su(`select source from matches where id=$1`, [after.match_id])).rows[0].source === 'randomizer')
  // storage
  ok('storage: no upload to foreign folder', !!(await fails(() => as(U[0], `insert into storage.objects (bucket_id, name) values ('profile-photos', $1)`, [`${U[1]}/a.jpg`]))))
  await as(U[0], `insert into storage.objects (bucket_id, name) values ('selfies', $1)`, [`${U[0]}/s.jpg`])
  ok('storage: selfies unreadable', (await as(U[0], `select count(*)::int c from storage.objects where bucket_id='selfies'`)).rows[0].c === 0)
  // blocks
  await as(U[3], `insert into blocks (blocked_id) values ($1)`, [U[2]])
  ok('block hides profile', (await as(U[2], `select count(*)::int c from profiles where id=$1`, [U[3]])).rows[0].c === 0)
  // randomizer presence: stale waiting users are never paired
  await as(U[1], `select randomizer_end(id) from get_random_session()`)
  await as(U[2], `select randomizer_end(id) from get_random_session()`)
  await su(`delete from blocks`)
  ok('stale join waits', (await as(U[3], `select randomizer_join('{female}',18,99) s`)).rows[0].s === null)
  await su(`update random_chat_queue set last_seen_at = now() - interval '2 minutes' where user_id=$1`, [U[3]])
  ok('stale user not paired', (await as(U[2], `select randomizer_join('{male}',18,99) s`)).rows[0].s === null)
  await as(U[3], `select randomizer_ping()`)
  ok('pinged user paired', !!(await as(U[1], `select randomizer_join('{male}',18,99) s`)).rows[0].s)
  // Malaysia-only
  const hook = async (phone) => (await su(`select hook_before_user_created($1::jsonb) r`, [JSON.stringify({ user: { phone } })])).rows[0].r
  ok('hook: +60 mobile allowed', JSON.stringify(await hook('60123456789')) === '{}' && JSON.stringify(await hook('+60 11-1234 5678')) === '{}')
  ok('hook: non-MY rejected', (await hook('998901234567')).error?.http_code === 403 && (await hook('79990000001')).error?.http_code === 403)
  ok('hook: MY landline rejected', (await hook('60321234567')).error?.http_code === 403)
  ok('hook: missing phone rejected', (await hook(null)).error?.http_code === 403)
  await su(`insert into auth.users(id, phone) values ('66666666-6666-6666-6666-666666666666', '998901234567')`)
  ok('profile requires MY phone', !!(await fails(() => as('66666666-6666-6666-6666-666666666666', `insert into profiles (display_name,birth_date,gender,interested_in) values ('Uz','1990-01-01','male','{female}')`))))
  ok('hook not callable by clients', !!(await fails(() => as(U[0], `select hook_before_user_created('{}'::jsonb)`))))
  // moderation
  const A = U[0]
  const svc = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
  ok('non-admin rejected', !!(await fails(() => svc(`select admin_set_ban($1,$2,true,'spam')`, [A, U[1]]))))
  await su(`insert into admins values ($1)`, [A])
  ok('admin RPC not callable by users', !!(await fails(() => as(A, `select admin_set_ban($1,$2,true,'spam')`, [A, U[1]]))))
  ok('ban requires reason', !!(await fails(() => svc(`select admin_set_ban($1,$2,true,'')`, [A, U[1]]))))
  await as(U[1], `select randomizer_join('{male}',18,99)`)
  await svc(`select admin_set_ban($1,$2,true,'спам')`, [A, U[1]])
  ok('banned user hidden', (await as(U[0], `select count(*)::int c from profiles where id=$1`, [U[1]])).rows[0].c === 0)
  ok('banned user loses access', (await as(U[1], `select is_verified() v`)).rows[0].v === false)
  ok('banned user removed from queue', (await su(`select count(*)::int c from random_chat_queue where user_id=$1`, [U[1]])).rows[0].c === 0)
  // is_active is server-only since 20261008000085: the update is rejected outright.
  await fails(() => as(U[1], `update profiles set is_active = true where id=$1`, [U[1]]))
  ok('banned user cannot reactivate', (await su(`select is_active from profiles where id=$1`, [U[1]])).rows[0].is_active === false)
  ok('owner sees own ban', (await as(U[1], `select ban_reason from profiles where id=$1`, [U[1]])).rows[0]?.ban_reason === 'спам')
  await svc(`select admin_set_ban($1,$2,false)`, [A, U[1]])
  ok('unban restores', (await as(U[0], `select count(*)::int c from profiles where id=$1`, [U[1]])).rows[0].c === 1)
  const p2 = (await as(U[3], `select create_post('плохой пост') id`)).rows[0].id
  await as(U[1], `insert into reports (target_type, target_id, reason) values ('post', $1, 'оскорбление')`, [p2])
  await as(U[2], `insert into reports (target_type, target_id, reason) values ('post', $1, 'спам')`, [p2])
  ok('duplicate open report blocked', !!(await fails(() => as(U[1], `insert into reports (target_type, target_id, reason) values ('post', $1, 'ещё')`, [p2]))))
  await svc(`select admin_set_content_hidden($1,'post',$2,true,'оскорбление')`, [A, p2])
  ok('hidden post leaves feed', (await as(U[0], `select count(*)::int c from feed_posts where id=$1`, [p2])).rows[0].c === 0)
  ok('resolve closes all reports on target', (await svc(`select admin_resolve_reports($1,'post',$2,'скрыт') n`, [A, p2])).rows[0].n === 2)
  await as(U[1], `insert into verification_requests (selfie_path, challenge) values ($1,'ok')`, [`${U[1]}/s2.jpg`])
  const vr = (await su(`select id from verification_requests where status='pending' and user_id=$1`, [U[1]])).rows[0].id
  ok('reject requires reason', !!(await fails(() => svc(`select admin_review_verification($1,$2,false,'')`, [A, vr]))))
  await svc(`select admin_review_verification($1,$2,false,'лицо не видно')`, [A, vr])
  ok('rejection stored', (await su(`select status, rejection_reason, reviewer_id from verification_requests where id=$1`, [vr])).rows[0].reviewer_id === A)
  await svc(`select admin_revoke_verification($1,$2,'фейк')`, [A, U[2]])
  ok('revoke forces re-verification', (await su(`select verification_status v from profiles where id=$1`, [U[2]])).rows[0].v === 'unverified')
  ok('find users by phone', (await svc(`select * from admin_find_users($1,'+60 12345 6783')`, [A])).rows.map(r => r.id).join() === U[3])
  ok('audit log: 6 actions', (await su(`select string_agg(action, ',' order by created_at, action) a, count(*)::int c from moderation_actions`)).rows[0].c === 6, JSON.stringify((await su(`select array_agg(action) a from moderation_actions`)).rows[0]))
  // consent at sign-up
  const D = '77777777-7777-7777-7777-777777777777'
  await su(`insert into auth.users(id, phone) values ($1, '60123450007')`, [D])
  await as(D, `insert into profiles (display_name,birth_date,gender,interested_in,terms_accepted_at) values ('Del','1990-01-01','female','{male}','2000-01-01')`)
  ok('terms: server clock wins', (await su(`select terms_accepted_at > now() - interval '1 minute' v from profiles where id=$1`, [D])).rows[0].v === true)
  ok('terms: not updatable by client', !!(await fails(() => as(D, `update profiles set terms_accepted_at = now() where id=$1`, [D]))))
  // account deletion: every trace of the user goes, other users' data stays consistent
  await su(`update profiles set verification_status='approved' where id=$1`, [D])
  await su(`insert into verification_requests (user_id, selfie_path, challenge, status) values ($1, $2, 'ok', 'approved')`, [D, `${D}/s.jpg`])
  const op = (await as(U[0], `select create_post('пост для удаления') id`)).rows[0].id
  await as(D, `select toggle_post_like($1)`, [op]); await as(D, `select create_comment($1,'bye')`, [op])
  const dp = (await as(D, `select create_post('мой пост') id`)).rows[0].id
  await as(U[0], `select create_comment($1,'hi')`, [dp])
  await su(`insert into blocks (blocker_id, blocked_id) values ($1,$2)`, [U[0], D])
  await su(`insert into reports (reporter_id, target_type, target_id, reason) values ($1,'user',$2,'фейк'),($2,'user',$3,'спам')`, [U[2], D, U[3]])
  await as(D, `insert into swipes (swiped_id, direction) values ($1,'like')`, [U[3]])
  await as(U[3], `insert into swipes (swiped_id, direction) values ($1,'like') on conflict do nothing`, [D])
  const dm = (await su(`select id from matches where $1 in (user_a, user_b)`, [D])).rows[0]
  ok('deletion setup: match exists', !!dm)
  await as(D, `insert into messages (match_id, body) values ($1,'hey')`, [dm.id])
  const ds = (await su(`insert into random_chat_sessions (user_a, user_b, status, ended_at) values ($1,$2,'ended',now()) returning id`, [D, U[0]])).rows[0].id
  await su(`insert into random_chat_messages (session_id, sender_id, body) values ($1,$2,'anon')`, [ds, D])
  await su(`insert into admins values ($1)`, [D])
  await su(`insert into moderation_actions (admin_id, action, target_type, target_id) values ($1,'test','user',$2)`, [D, U[3]])
  const delErr = await fails(() => su(`delete from auth.users where id=$1`, [D]))
  ok('account deletion succeeds', !delErr, delErr)
  const left = (await su(`select
      (select count(*) from profiles where id=$1) + (select count(*) from posts where author_id=$1)
    + (select count(*) from comments where author_id=$1) + (select count(*) from post_likes where user_id=$1)
    + (select count(*) from blocks where $1 in (blocker_id, blocked_id)) + (select count(*) from reports where reporter_id=$1)
    + (select count(*) from swipes where $1 in (swiper_id, swiped_id)) + (select count(*) from matches where $1 in (user_a, user_b))
    + (select count(*) from random_chat_sessions where $1 in (user_a, user_b)) + (select count(*) from verification_requests where user_id=$1)
    + (select count(*) from admins where user_id=$1) as n`, [D])).rows[0].n
  ok('deletion: no rows left', Number(left) === 0, String(left))
  ok('deletion: counters on others\' posts updated', JSON.stringify((await su(`select likes_count, comments_count from posts where id=$1`, [op])).rows[0]) === '{"likes_count":0,"comments_count":0}')
  ok('deletion: audit log kept, admin nulled', (await su(`select admin_id from moderation_actions where action='test'`)).rows[0]?.admin_id === null)
  // random chat retention
  const sess = async (age) => (await su(`insert into random_chat_sessions (user_a, user_b, status, started_at, ended_at) values ($1,$2,'ended',now()-$3::interval,now()-$3::interval) returning id`, [U[0], U[2], age])).rows[0].id
  const oldS = await sess('40 days'), reportedS = await sess('40 days'), newS = await sess('1 day')
  for (const [s, age] of [[oldS, '40 days'], [reportedS, '40 days'], [newS, '1 day']])
    await su(`insert into random_chat_messages (session_id, sender_id, body, created_at) values ($1,$2,'x',now()-$3::interval)`, [s, U[0], age])
  await su(`insert into reports (reporter_id, target_type, target_id, reason) values ($1,'random_session',$2,'оскорбления')`, [U[2], reportedS])
  ok('purge not callable by users', !!(await fails(() => as(U[0], `select purge_old_random_messages()`))))
  ok('purge deletes old unreported messages', (await su(`select purge_old_random_messages() n`)).rows[0].n === 1)
  const kept = (await su(`select s.id, count(m.id)::int c from random_chat_sessions s left join random_chat_messages m on m.session_id=s.id where s.id = any($1) group by s.id`, [[oldS, reportedS, newS]])).rows
  ok('purge: old session gone, reported and recent kept', kept.length === 2 && kept.every(r => r.c === 1 && r.id !== oldS), JSON.stringify(kept))
  // rate limits (P0429): bulk rows are inserted with the trigger disabled, then the user's own
  // inserts hit the limit; backdating the bulk rows frees the window again.
  const code = async (fn) => { try { await fn(); return null } catch (e) { return e.code } }
  const bulk = async (table, trigger, sql, p) => {
    await su(`alter table ${table} disable trigger ${trigger}`)
    try { await su(sql, p) } finally { await su(`alter table ${table} enable trigger ${trigger}`) }
  }
  await su(`insert into auth.users (id, phone) select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
    '6011' || lpad(i::text, 8, '0') from generate_series(1, 300) i`)
  await su(`insert into profiles (id, display_name, birth_date, gender, interested_in)
    select id, 'Bot', '1990-01-01', 'female', '{male}' from auth.users where id::text like '00000000-%'`)
  await bulk('swipes', 'swipes_rate_limit', `insert into swipes (swiper_id, swiped_id, direction)
    select $1, id, 'pass' from profiles where id::text like '00000000-%' order by id limit 299`, [U[3]])
  ok('swipe #300 allowed', !(await code(() => as(U[3], `insert into swipes (swiped_id, direction) values ($1,'pass')`, [U[0]]))))
  const lastBot = '00000000-0000-0000-0000-000000000300'
  await su(`update profiles set verification_status = 'approved' where id = $1`, [lastBot])
  ok('swipe #301 rate limited', (await code(() => as(U[3], `insert into swipes (swiped_id, direction) values ($1,'pass')`, [lastBot]))) === 'P0429')
  await su(`update swipes set created_at = now() - interval '25 hours' where swiper_id = $1`, [U[3]])
  ok('swipe limit resets after 24h', !(await code(() => as(U[3], `insert into swipes (swiped_id, direction) values ($1,'pass')`, [lastBot]))))
  await su(`delete from messages`)
  await bulk('messages', 'messages_rate_limit', `insert into messages (match_id, sender_id, body)
    select $1, $2, 'm' || i from generate_series(1, 29) i`, [m.id, U[0]])
  ok('message #30 allowed', !(await code(() => as(U[0], `insert into messages (match_id, body) values ($1,'30')`, [m.id]))))
  ok('message #31 rate limited', (await code(() => as(U[0], `insert into messages (match_id, body) values ($1,'31')`, [m.id]))) === 'P0429')
  await su(`update messages set created_at = now() - interval '2 minutes'`)
  ok('message limit resets after a minute', !(await code(() => as(U[0], `insert into messages (match_id, body) values ($1,'again')`, [m.id]))))
  const rsid = (await su(`insert into random_chat_sessions (user_a, user_b) values ($1,$2) returning id`, [U[0], U[3]])).rows[0].id
  await bulk('random_chat_messages', 'random_chat_messages_rate_limit', `insert into random_chat_messages (session_id, sender_id, body)
    select $1, $2, 'r' || i from generate_series(1, 29) i`, [rsid, U[0]])
  ok('random message #30 allowed', !(await code(() => as(U[0], `select randomizer_send($1,'30')`, [rsid]))))
  ok('random message #31 rate limited', (await code(() => as(U[0], `select randomizer_send($1,'31')`, [rsid]))) === 'P0429')
  ok('other sender unaffected', !(await code(() => as(U[3], `select randomizer_send($1,'hi')`, [rsid]))))
  // auto-hide: 3 distinct open reports hide a post/comment and log 'auto.hide' without an admin
  const pA = (await as(U[0], `select create_post('пост для автоскрытия') id`)).rows[0].id
  const cA = (await as(U[3], `select create_comment($1,'плохой коммент') id`, [pA])).rows[0].id
  const rep = (u, type, id) => as(u, `insert into reports (target_type, target_id, reason) values ($1,$2,'spam')`, [type, id])
  await rep(U[1], 'post', pA); await rep(U[2], 'post', pA)
  ok('2 reports: post still visible', (await su(`select is_hidden h from posts where id=$1`, [pA])).rows[0].h === false)
  await rep(U[3], 'post', pA)
  ok('3 reports: post auto-hidden', (await su(`select is_hidden h from posts where id=$1`, [pA])).rows[0].h === true)
  await rep(U[0], 'comment', cA); await rep(U[1], 'comment', cA); await rep(U[2], 'comment', cA)
  ok('3 reports: comment auto-hidden', (await su(`select is_hidden h from comments where id=$1`, [cA])).rows[0].h === true)
  const auto = (await su(`select count(*)::int c, bool_and(admin_id is null) n from moderation_actions where action='auto.hide'`)).rows[0]
  ok('auto-hide logged without admin', auto.c === 2 && auto.n === true, JSON.stringify(auto))
  await svc(`select admin_set_content_hidden($1,'post',$2,false,'ок')`, [A, pA])
  await rep(U[0], 'post', pA)
  ok('moderator unhide is respected', (await su(`select is_hidden h from posts where id=$1`, [pA])).rows[0].h === false)
  ok('user reports never auto-hide', (await su(`select count(*)::int c from moderation_actions where action='auto.hide'`)).rows[0].c === 2)
  // report limit: 20 per 24h
  const mine = (await su(`select count(*)::int c from reports where reporter_id=$1 and created_at > now() - interval '24 hours'`, [U[0]])).rows[0].c
  await bulk('reports', 'reports_rate_limit', `insert into reports (reporter_id, target_type, target_id, reason)
    select $1, 'user', gen_random_uuid(), 'spam' from generate_series(1, $2::int)`, [U[0], 19 - mine])
  ok('report #20 allowed', !(await code(() => rep(U[0], 'user', U[3]))))
  ok('report #21 rate limited', (await code(() => rep(U[0], 'user', U[2]))) === 'P0429')
  // admin photo deletion
  const ph = (await su(`insert into profile_photos (profile_id, storage_path, width, height, position)
    values ($1, $2, 600, 800, 5) returning id`, [U[3], `${U[3]}/bad.jpg`])).rows[0].id
  ok('photo delete: non-admin rejected', !!(await fails(() => svc(`select admin_delete_photo($1,$2,'фейк')`, [U[1], ph]))))
  ok('photo delete: not callable by users', !!(await fails(() => as(A, `select admin_delete_photo($1,$2,'фейк')`, [A, ph]))))
  ok('photo delete: reason required', !!(await fails(() => svc(`select admin_delete_photo($1,$2,' ')`, [A, ph]))))
  const path = (await svc(`select admin_delete_photo($1,$2,'чужое фото') p`, [A, ph])).rows[0].p
  ok('photo delete returns storage path', path === `${U[3]}/bad.jpg`)
  ok('photo row removed', (await su(`select count(*)::int c from profile_photos where id=$1`, [ph])).rows[0].c === 0)
  const plog = (await su(`select target_type, target_id, reason from moderation_actions where action='photo.delete'`)).rows
  ok('photo delete logged against user', plog.length === 1 && plog[0].target_id === U[3] && plog[0].reason === 'чужое фото', JSON.stringify(plog))
  ok('photo delete: missing photo errors', !!(await fails(() => svc(`select admin_delete_photo($1,$2,'x')`, [A, ph]))))
  // engagement: inbox topic, match typing, unread count, randomizer stats
  const inbox = 'inbox:' + U[0]
  await su(`insert into realtime.messages (topic, event, payload) values ($1, 'probe', '{}')`, [inbox])
  ok('realtime: own inbox visible', (await as(U[0], `select count(*)::int c from realtime.messages where topic=$1`, [inbox], inbox)).rows[0].c === 1)
  ok('realtime: foreign inbox hidden', (await as(U[1], `select count(*)::int c from realtime.messages where topic=$1`, [inbox], inbox)).rows[0].c === 0)
  ok('realtime: client cannot write to inbox', !!(await fails(() => as(U[0], `insert into realtime.messages (topic, event, payload) values ($1,'x','{}')`, [inbox], inbox))))
  const mt = 'match-typing:' + m.id
  const mtErr = await fails(() => as(U[1], `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, [mt], mt))
  ok('realtime: participant may write match typing', !mtErr, mtErr)
  ok('realtime: participant reads match typing', (await as(U[0], `select count(*)::int c from realtime.messages where topic=$1`, [mt], mt)).rows[0].c === 1)
  ok('realtime: outsider cannot read match typing', (await as(U[2], `select count(*)::int c from realtime.messages where topic=$1`, [mt], mt)).rows[0].c === 0)
  ok('realtime: outsider cannot write match typing', !!(await fails(() => as(U[2], `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, [mt], mt))))
  ok('realtime: client cannot write to match:<id>', !!(await fails(() => as(U[1], `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, ['match:' + m.id], 'match:' + m.id))))
  await su(`update messages set read_at = now()`)
  await su(`update profiles set verification_status='approved' where id=$1`, [U[1]])
  await su(`insert into messages (match_id, sender_id, body) values ($1,$2,'a'),($1,$2,'b'),($1,$3,'mine')`, [m.id, U[1], U[0]])
  ok('unread count: partner messages only', (await as(U[0], `select unread_message_count() n`)).rows[0].n === 2)
  ok('unread count: outsider sees 0', (await as(U[2], `select unread_message_count() n`)).rows[0].n === 0)
  await as(U[0], `insert into blocks (blocked_id) values ($1)`, [U[1]])
  ok('unread count: blocked partner skipped', (await as(U[0], `select unread_message_count() n`)).rows[0].n === 0)
  await as(U[0], `delete from blocks where blocked_id=$1`, [U[1]])
  await as(U[0], `update messages set read_at = now() where match_id=$1 and sender_id<>$2 and read_at is null`, [m.id, U[0]])
  ok('unread count drops after read', (await as(U[0], `select unread_message_count() n`)).rows[0].n === 0)
  ok('sender sees read receipt', (await as(U[1], `select count(*)::int c from messages where sender_id=$1 and read_at is not null and body in ('a','b')`, [U[1]])).rows[0].c === 2)
  await su(`delete from random_chat_queue`)
  await su(`insert into random_chat_queue (user_id, want_genders, min_age, max_age, last_seen_at) values
    ($1,'{male}',18,99,now()), ($2,'{male}',18,99,now()), ($3,'{female}',18,99,now() - interval '2 minutes')`, [U[0], U[2], U[3]])
  ok('randomizer stats: present others only', (await as(U[0], `select randomizer_stats() n`)).rows[0].n === 1)
  ok('randomizer stats: no anon access', (await su(`select has_function_privilege('anon', 'public.randomizer_stats()', 'execute') v`)).rows[0].v === false)
  // push subscriptions
  const sub = (u, ep, loc = 'ms') => as(u, `insert into push_subscriptions (endpoint, p256dh, auth, locale) values ($1,'key','auth',$2)`, [ep, loc])
  await sub(U[0], 'https://push.example/u0'); await sub(U[1], 'https://push.example/u1')
  ok('push: user_id defaults to auth.uid()', (await su(`select user_id from push_subscriptions where endpoint=$1`, ['https://push.example/u0'])).rows[0].user_id === U[0])
  ok('push: cannot subscribe for someone else', !!(await fails(() => as(U[0], `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,'https://push.example/x','k','a')`, [U[1]]))))
  ok('push: sees only own rows', JSON.stringify((await as(U[0], `select endpoint from push_subscriptions`)).rows.map(r => r.endpoint)) === '["https://push.example/u0"]')
  ok('push: duplicate endpoint rejected', !!(await fails(() => sub(U[0], 'https://push.example/u1'))))
  ok('push: non-https endpoint rejected', !!(await fails(() => sub(U[0], 'http://push.example/plain'))))
  ok('push: unknown locale rejected', !!(await fails(() => sub(U[0], 'https://push.example/l', 'xx'))))
  ok('push: no update grant', !!(await fails(() => as(U[0], `update push_subscriptions set locale='en'`))))
  await as(U[0], `delete from push_subscriptions where endpoint=$1`, ['https://push.example/u1'])
  ok('push: cannot delete others', (await su(`select count(*)::int c from push_subscriptions where user_id=$1`, [U[1]])).rows[0].c === 1)
  await as(U[0], `delete from push_subscriptions where endpoint=$1`, ['https://push.example/u0'])
  ok('push: owner deletes own', (await su(`select count(*)::int c from push_subscriptions where user_id=$1`, [U[0]])).rows[0].c === 0)
  ok('push: anon has no access', !!(await fails(async () => { await db.exec('set role anon'); try { await db.query(`select * from push_subscriptions`) } finally { await db.exec('reset role') } })))
  await su(`delete from profiles where id=$1`, [U[1]])
  ok('push: removed with profile', (await su(`select count(*)::int c from push_subscriptions`)).rows[0].c === 0)
  // interest catalog
  const original = ['sport','fitness','travel','movies','series','music','concerts','books','gaming','anime',
    'cooking','coffee','art','photography','tech','startups','nature','pets','dancing','psychology']
  const ids = (await su(`select id, slug from tags where id <= 20 order by id`)).rows
  ok('tags: original 20 keep ids 1..20', JSON.stringify(ids.map(r => r.slug)) === JSON.stringify(original), JSON.stringify(ids))
  const cat = (await su(`select count(*)::int n, count(distinct category)::int c, count(*) filter (where category is null)::int z from tags`)).rows[0]
  ok('tags: catalog has ~100 tags in 10 categories', cat.n >= 80 && cat.n <= 120 && cat.c === 10 && cat.z === 0, JSON.stringify(cat))
  ok('tags: new tags categorised', (await su(`select category from tags where slug='nasi-lemak'`)).rows[0]?.category === 'food')
  ok('tags: original tags backfilled', (await su(`select category, sort from tags where slug='sport'`)).rows[0]?.category === 'sports')
  ok('tags: sort unique', (await su(`select count(distinct sort)::int c, count(*)::int n from tags`)).rows.every(r => r.c === r.n))
  ok('tags: unknown category rejected', !!(await fails(() => su(`insert into tags (slug, label, category) values ('zz-test','x','politics')`))))
  ok('tags: category required', !!(await fails(() => su(`insert into tags (slug, label) values ('zz-test','x')`))))
  const seen = (await as(U[0], `select slug, category, sort from tags where slug in ('badminton','sport')`)).rows
  ok('tags: authenticated reads category + sort', seen.length === 2 && seen.every(r => r.category && r.sort > 0), JSON.stringify(seen))
  ok('tags: authenticated cannot write', !!(await fails(() => as(U[0], `update tags set category='food' where slug='sport'`))))
  ok('tags: anon has no access', !!(await fails(async () => { await db.exec('set role anon'); try { await db.query(`select * from tags`) } finally { await db.exec('reset role') } })))
  const newId = (await su(`select id from tags where slug='badminton'`)).rows[0].id
  await as(U[0], `insert into profile_tags (tag_id) values ($1)`, [newId])
  ok('tags: new tag selectable on profile', (await su(`select count(*)::int c from profile_tags where profile_id=$1 and tag_id=$2`, [U[0], newId])).rows[0].c === 1)
  // richer profiles: "about" fields + prompts (fresh users in Kuala Lumpur, away from the others)
  const R = ['a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003']
  for (const [i, u] of R.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '60198765430' + i])
  const kl = (i, g, want) => as(R[i], `insert into profiles (display_name, birth_date, gender, interested_in, location)
     values ($1,'1996-02-02',$2,$3,'SRID=4326;POINT(101.69 3.14)')`, ['Kl' + i, g, want])
  await kl(0, 'male', '{female}'); await kl(1, 'female', '{male}'); await kl(2, 'female', '{male}')
  await su(`update profiles set verification_status='approved' where id = any($1)`, [R.slice(0, 2)])
  const about = `relationship_goal='serious', height_cm=175, job_title='Engineer', education='bachelor',
    languages='{malay,english}', religion='prefer_not_to_say', smoking='never', drinking='sometimes', pets='cat', children='not_sure'`
  ok('about: owner sets fields', !(await fails(() => as(R[0], `update profiles set ${about} where id=$1`, [R[0]]))))
  const own = (await su(`select * from profiles where id=$1`, [R[0]])).rows[0]
  ok('about: values stored', own.height_cm === 175 && own.job_title === 'Engineer' && own.pets === 'cat', JSON.stringify(own))
  await as(R[1], `update profiles set job_title='Hacked', height_cm=150 where id=$1`, [R[0]])
  ok('about: others cannot update', (await su(`select job_title from profiles where id=$1`, [R[0]])).rows[0].job_title === 'Engineer')
  const bad = (set) => fails(() => as(R[0], `update profiles set ${set} where id=$1`, [R[0]]))
  ok('about: height below 140 rejected', !!(await bad(`height_cm=139`)))
  ok('about: height above 220 rejected', !!(await bad(`height_cm=221`)))
  ok('about: long job title rejected', !!(await bad(`job_title='${'x'.repeat(61)}'`)))
  ok('about: blank job title rejected', !!(await bad(`job_title='   '`)))
  ok('about: unknown enum rejected', !!(await bad(`religion='atheism'`)))
  ok('about: 7 languages rejected', !!(await bad(`languages='{malay,english,mandarin,tamil,hindi,arabic,korean}'`)))
  ok('about: duplicate languages rejected', !!(await bad(`languages='{malay,malay}'`)))
  ok('about: empty languages rejected', !!(await bad(`languages='{}'`)))
  ok('about: fields can be cleared', !(await bad(`relationship_goal=null, religion=null`)))
  await as(R[0], `update profiles set relationship_goal='serious', religion='islam' where id=$1`, [R[0]])
  const seenAbout = (await as(R[1], `select relationship_goal, religion, languages from profiles where id=$1`, [R[0]])).rows
  ok('about: verified viewer reads', seenAbout.length === 1 && seenAbout[0].relationship_goal === 'serious' && seenAbout[0].religion === 'islam', JSON.stringify(seenAbout))
  ok('about: unverified user cannot read', (await as(R[2], `select count(*)::int c from profiles where id=$1`, [R[0]])).rows[0].c === 0)
  ok('about: no insert grant (set after onboarding)', !!(await fails(() => as('55555555-5555-5555-5555-555555555555', `insert into profiles (display_name, birth_date, gender, interested_in, religion) values ('X','1990-01-01','male','{female}','islam')`))))
  // prompts
  const prompt = (u, key, answer, pos) => as(u, `insert into profile_prompts (prompt_key, answer, position) values ($1,$2,$3)`, [key, answer, pos])
  await prompt(R[0], 'mamak_order', 'Roti telur + teh tarik kurang manis', 0)
  await prompt(R[0], 'karaoke_song', 'Isabella', 1)
  await prompt(R[0], 'green_flags', 'Kind to waiters', 2)
  ok('prompts: owner adds up to 3', (await su(`select count(*)::int c from profile_prompts where profile_id=$1`, [R[0]])).rows[0].c === 3)
  ok('prompts: position 3 rejected', !!(await fails(() => prompt(R[0], 'travel_story', 'x', 3))))
  ok('prompts: duplicate position rejected', !!(await fails(() => prompt(R[0], 'travel_story', 'x', 0))))
  ok('prompts: duplicate key rejected', !!(await fails(async () => { await su(`delete from profile_prompts where profile_id=$1 and position=2`, [R[0]]); await prompt(R[0], 'mamak_order', 'again', 2) })))
  await prompt(R[0], 'green_flags', 'Kind to waiters', 2)
  ok('prompts: unknown key rejected', !!(await fails(() => prompt(R[1], 'zodiac', 'Leo', 0))))
  ok('prompts: blank answer rejected', !!(await fails(() => prompt(R[1], 'travel_story', '  ', 0))))
  ok('prompts: 201 chars rejected', !!(await fails(() => prompt(R[1], 'travel_story', 'x'.repeat(201), 0))))
  ok('prompts: cannot add for someone else', !!(await fails(() => as(R[1], `insert into profile_prompts (profile_id, prompt_key, answer, position) values ($1,'travel_story','x',0)`, [R[0]]))))
  ok('prompts: verified viewer reads', (await as(R[1], `select count(*)::int c from profile_prompts where profile_id=$1`, [R[0]])).rows[0].c === 3)
  ok('prompts: unverified user reads nothing', (await as(R[2], `select count(*)::int c from profile_prompts`)).rows[0].c === 0)
  await as(R[1], `delete from profile_prompts where profile_id=$1`, [R[0]])
  ok('prompts: others cannot delete', (await su(`select count(*)::int c from profile_prompts where profile_id=$1`, [R[0]])).rows[0].c === 3)
  ok('prompts: no update grant', !!(await fails(() => as(R[0], `update profile_prompts set answer='x'`))))
  await as(R[0], `insert into blocks (blocked_id) values ($1)`, [R[1]])
  ok('prompts: hidden after block', (await as(R[1], `select count(*)::int c from profile_prompts where profile_id=$1`, [R[0]])).rows[0].c === 0)
  await as(R[0], `delete from blocks where blocked_id=$1`, [R[1]])
  // candidates RPC
  const kc = (await as(R[1], `select * from get_swipe_candidates('{male}', 18, 99, 50)`)).rows
  const c0 = kc.find((c) => c.id === R[0])
  ok('candidates: return about fields', !!c0 && c0.relationship_goal === 'serious' && c0.height_cm === 175 && c0.job_title === 'Engineer' &&
     c0.education === 'bachelor' && c0.smoking === 'never' && c0.drinking === 'sometimes' && c0.children === 'not_sure', JSON.stringify(c0))
  ok('candidates: return prompts in order', !!c0 && JSON.stringify(c0.prompts.map((p) => p.key)) === '["mamak_order","karaoke_song","green_flags"]', JSON.stringify(c0?.prompts))
  ok('candidates: still never return location', kc.length > 0 && kc.every((c) => !('location' in c)) &&
     !(await su(`select pg_get_function_result('public.get_swipe_candidates(public.gender[],int,int,int,int)'::regprocedure) r`)).rows[0].r.includes('location'))
  ok('candidates: no anon access', (await su(`select has_function_privilege('anon', 'public.get_swipe_candidates(public.gender[],int,int,int,int)', 'execute') v`)).rows[0].v === false)
  ok('candidates: empty prompts is []', JSON.stringify(kc.find((c) => c.id !== R[0])?.prompts ?? []) === '[]')
  await su(`delete from profiles where id=$1`, [R[0]])
  ok('prompts: removed with profile', (await su(`select count(*)::int c from profile_prompts`)).rows[0].c === 0)
  // match chat: replies, photos (chat-media), edit/delete, reactions, last seen
  const C = ['c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000003']
  for (const [i, u] of C.entries()) {
    await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6012999000' + i])
    await as(u, `insert into profiles (display_name,birth_date,gender,interested_in) values ($1,'1995-01-01','female','{male}')`, ['Chat' + i])
  }
  await su(`update profiles set verification_status='approved' where id = any($1)`, [C])
  const cm = (await su(`select ensure_match($1,$2,'swipe') id`, [C[0], C[1]])).rows[0].id
  const om = (await su(`select ensure_match($1,$2,'swipe') id`, [C[0], C[2]])).rows[0].id
  const send = async (u, match, body, extra = {}) => (await as(u, `insert into messages (match_id, body, reply_to, image_path, image_width, image_height)
    values ($1,$2,$3,$4,$5,$6) returning id`, [match, body, extra.reply ?? null, extra.path ?? null, extra.w ?? null, extra.h ?? null])).rows[0].id
  const m1 = await send(C[0], cm, 'first')
  const other = await send(C[0], om, 'elsewhere')
  const rErr = await fails(() => send(C[1], cm, 'reply', { reply: m1 }))
  ok('reply within match allowed', !rErr, rErr)
  ok('reply across matches rejected', !!(await fails(() => send(C[1], cm, 'x', { reply: other }))))
  ok('client cannot set edited_at/deleted_at on insert', !!(await fails(() => as(C[0], `insert into messages (match_id, body, deleted_at) values ($1,'x',now())`, [cm]))))
  ok('empty message rejected', !!(await fails(() => send(C[0], cm, null))))
  const img = `${cm}/${'d1000000-0000-4000-8000-000000000001'}.webp`
  ok('photo message needs uploaded object', !!(await fails(() => send(C[0], cm, null, { path: img, w: 600, h: 800 }))))
  const upload = (u, name) => as(u, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [name])
  ok('chat-media: outsider cannot upload', !!(await fails(() => upload(C[2], img))))
  ok('chat-media: malformed name rejected', !!(await fails(() => upload(C[0], `${cm}/x.jpg`))))
  await upload(C[0], img)
  ok('chat-media: partner can read', (await as(C[1], `select count(*)::int c from storage.objects where bucket_id='chat-media'`)).rows[0].c === 1)
  ok('chat-media: outsider cannot read', (await as(C[2], `select count(*)::int c from storage.objects where bucket_id='chat-media'`)).rows[0].c === 0)
  ok('chat-media: no delete for users', (await as(C[0], `delete from storage.objects where bucket_id='chat-media' returning id`)).rows.length === 0)
  const pErr = await fails(() => send(C[0], cm, null, { path: img, w: 600, h: 800 }))
  ok('photo message without text allowed', !pErr, pErr)
  ok('photo path must be in the match folder', !!(await fails(() => send(C[0], om, null, { path: img, w: 600, h: 800 }))))
  const photo = (await su(`select id from messages where image_path=$1`, [img])).rows[0].id
  // edit
  ok('no direct body update', !!(await fails(() => as(C[0], `update messages set body='hack' where id=$1`, [m1]))))
  ok('edit own within window', !!(await as(C[0], `select edit_message($1,'first (edited)') t`, [m1])).rows[0].t)
  ok('edit stored with edited_at', (await su(`select body, edited_at is not null e from messages where id=$1`, [m1])).rows[0].e === true)
  ok('cannot edit partner message', !!(await fails(() => as(C[1], `select edit_message($1,'x')`, [m1]))))
  ok('edit rejects blank text', !!(await fails(() => as(C[0], `select edit_message($1,'   ')`, [m1]))))
  await su(`update messages set created_at = now() - interval '16 minutes' where id=$1`, [m1])
  ok('edit window is 15 minutes', !!(await fails(() => as(C[0], `select edit_message($1,'late')`, [m1]))))
  // reactions
  const react = (u, id, e) => as(u, `select set_message_reaction($1,$2)`, [id, e])
  await react(C[1], m1, '❤️')
  ok('reaction carries match_id', (await su(`select match_id from message_reactions where message_id=$1`, [m1])).rows[0]?.match_id === cm)
  await react(C[1], m1, '😂')
  ok('one reaction per user (replaced)', JSON.stringify((await as(C[0], `select emoji from message_reactions where message_id=$1`, [m1])).rows) === '[{"emoji":"😂"}]')
  await react(C[0], m1, '🔥')
  ok('both participants may react', (await as(C[1], `select count(*)::int c from message_reactions where emoji is not null`)).rows[0].c === 2)
  await react(C[1], m1, null)
  ok('null removes reaction', (await su(`select emoji from message_reactions where message_id=$1 and user_id=$2`, [m1, C[1]])).rows[0].emoji === null)
  ok('reaction: invalid emoji rejected', !!(await fails(() => react(C[0], m1, '💩'))))
  ok('reaction: outsider rejected', !!(await fails(() => react(C[2], m1, '❤️'))))
  ok('reaction: outsider sees none', (await as(C[2], `select count(*)::int c from message_reactions`)).rows[0].c === 0)
  ok('reaction: no direct insert', !!(await fails(() => as(C[0], `insert into message_reactions (message_id, match_id, emoji) values ($1,$2,'❤️')`, [photo, cm]))))
  // delete for everyone
  ok('cannot delete partner message', !!(await fails(() => as(C[1], `select delete_message($1)`, [photo]))))
  await react(C[1], photo, '👍')
  const gone = (await as(C[0], `select delete_message($1) p`, [photo])).rows[0].p
  ok('delete returns photo path', gone === img)
  const del = (await as(C[1], `select body, image_path, deleted_at is not null d from messages where id=$1`, [photo])).rows[0]
  ok('delete clears content', del.body === null && del.image_path === null && del.d === true, JSON.stringify(del))
  ok('delete clears reactions', (await su(`select count(*)::int c from message_reactions where message_id=$1 and emoji is not null`, [photo])).rows[0].c === 0)
  ok('deleted message cannot be edited or reacted to', !!(await fails(() => as(C[0], `select edit_message($1,'x')`, [photo]))) && !!(await fails(() => react(C[1], photo, '❤️'))))
  ok('deleted message not unread', (await as(C[1], `select unread_message_count() n`)).rows[0].n === 1)
  // last seen
  ok('last_active_at not readable directly', !!(await fails(() => as(C[0], `select last_active_at from profiles where id=$1`, [C[1]]))))
  await su(`update profiles set last_active_at = now() - interval '1 hour' where id = any($1)`, [C])
  await as(C[1], `select touch_last_active()`)
  ok('heartbeat updates last_active_at', (await su(`select last_active_at > now() - interval '1 minute' v from profiles where id=$1`, [C[1]])).rows[0].v === true)
  const lastSeenOf = async (u, match) => (await as(u, `select match_partner_last_seen($1) t`, [match])).rows[0].t
  ok('partner last lastSeenOf visible', (await lastSeenOf(C[0], cm)) !== null)
  ok('outsider gets no last lastSeenOf', (await lastSeenOf(C[2], cm)) === null)
  await as(C[1], `update profiles set show_last_seen = false where id=$1`, [C[1]])
  ok('hidden last lastSeenOf not shown', (await lastSeenOf(C[0], cm)) === null)
  ok('hiding own last lastSeenOf hides others too', (await lastSeenOf(C[1], cm)) === null)
  await as(C[1], `update profiles set show_last_seen = true where id=$1`, [C[1]])
  ok('last lastSeenOf back when shared', (await lastSeenOf(C[1], cm)) !== null)
  // last_active_at is server-maintained only
  ok('last_active_at: client cannot write it', !!(await fails(() => as(U[3], `update profiles set last_active_at = now() + interval '1 day' where id=$1`, [U[3]]))))
  ok('last_active_at: touch_last_active() works', !(await fails(() => as(U[3], `select touch_last_active()`))))
  ok("reaction: '' is accepted as remove", !(await fails(() => su(`select 1 where false`))) && (await su(`select pg_get_functiondef('public.set_message_reaction(uuid,text)'::regprocedure) d`)).rows[0].d.includes("nullif(p_emoji, '')"))
  // photo order: main photo = position 0, atomic reorder, contiguous after delete
  const avatar_add = async (u, name, pos) => (await su(`insert into profile_photos (profile_id, storage_path, width, height, position)
    values ($1, $2, 600, 800, $3) returning id`, [u, `${u}/avatar_${name}.webp`, pos])).rows[0].id
  const avatar_u2 = (await su(`select id from profiles where id <> $1 order by id limit 1`, [U[0]])).rows[0].id
  await su(`delete from profile_photos where profile_id = any($1)`, [[U[0], avatar_u2]])
  const [avatar_a, avatar_b, avatar_c] = [await avatar_add(U[0], 'a', 0), await avatar_add(U[0], 'b', 1), await avatar_add(U[0], 'c', 2)]
  const avatar_other = await avatar_add(avatar_u2, 'x', 0)
  const avatar_order = async (u) => (await su(`select id from profile_photos where profile_id=$1 order by position`, [u])).rows.map(r => r.id)
  const avatar_reorder = (u, ids) => as(u, `select reorder_profile_photos($1::uuid[])`, [ids])
  const avatar_err = await fails(() => avatar_reorder(U[0], [avatar_c, avatar_a, avatar_b]))
  ok('photo order: reorder rotates positions atomically', !avatar_err && JSON.stringify(await avatar_order(U[0])) === JSON.stringify([avatar_c, avatar_a, avatar_b]), avatar_err)
  ok('photo order: swap two photos', !(await fails(() => avatar_reorder(U[0], [avatar_a, avatar_c, avatar_b]))) && (await avatar_order(U[0]))[0] === avatar_a)
  ok('photo order: incomplete list rejected', !!(await fails(() => avatar_reorder(U[0], [avatar_b, avatar_a]))))
  ok('photo order: duplicates rejected', !!(await fails(() => avatar_reorder(U[0], [avatar_b, avatar_b, avatar_a]))))
  ok('photo order: foreign photo rejected', !!(await fails(() => avatar_reorder(U[0], [avatar_a, avatar_b, avatar_other]))))
  ok('photo order: cannot reorder someone else', !!(await fails(() => avatar_reorder(avatar_u2, [avatar_a, avatar_c, avatar_b]))))
  ok('photo order: anon cannot call', (await su(`select has_function_privilege('anon', 'public.reorder_profile_photos(uuid[])', 'execute') v`)).rows[0].v === false)
  ok('photo order: other user untouched', JSON.stringify(await avatar_order(avatar_u2)) === JSON.stringify([avatar_other]))
  await as(U[0], `delete from profile_photos where id=$1`, [avatar_a])
  const avatar_pos = (await su(`select id, position from profile_photos where profile_id=$1 order by position`, [U[0]])).rows
  ok('photo order: contiguous after delete', JSON.stringify(avatar_pos) === JSON.stringify([{ id: avatar_c, position: 0 }, { id: avatar_b, position: 1 }]), JSON.stringify(avatar_pos))
  ok('photo order: unique (profile, position) still enforced', !!(await fails(() => avatar_add(U[0], 'd', 1))))
  // settings: pause profile, notification prefs, blocked users, "who liked you"
  // Fresh users in Penang, far from everyone else: S0 (woman) and S1..S3 (men).
  const S = ['5e000000-0000-4000-8000-000000000001', '5e000000-0000-4000-8000-000000000002',
             '5e000000-0000-4000-8000-000000000003', '5e000000-0000-4000-8000-000000000004']
  for (const [i, u] of S.entries()) {
    await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6017555000' + i])
    await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, location)
       values ($1,'1994-03-03',$2,$3,'SRID=4326;POINT(100.33 5.41)')`, ['Pg' + i, i === 0 ? 'female' : 'male', i === 0 ? '{male}' : '{female}'])
  }
  await su(`update profiles set verification_status='approved' where id = any($1)`, [S])
  const settingsDeck = async (u) => (await as(u, `select id from get_swipe_candidates('{male}', 18, 99, 20)`)).rows.map((r) => r.id)
  ok('settings: discoverable by default', (await settingsDeck(S[0])).includes(S[1]))
  ok('settings: is_active not writable by users', !!(await fails(() => as(S[1], `update profiles set is_active=false where id=$1`, [S[1]]))))
  await as(S[2], `update profiles set discoverable=false where id=$1`, [S[1]])
  ok('settings: cannot pause someone else', (await su(`select discoverable d from profiles where id=$1`, [S[1]])).rows[0].d === true)
  await as(S[1], `select randomizer_join('{female}',18,99)`)
  await as(S[1], `update profiles set discoverable=false where id=$1`, [S[1]])
  ok('settings: paused hidden from Discover', !(await settingsDeck(S[0])).includes(S[1]))
  ok('settings: pausing leaves the random queue', (await su(`select count(*)::int c from random_chat_queue where user_id=$1`, [S[1]])).rows[0].c === 0)
  const settingsMatch = (await su(`select ensure_match($1,$2,'swipe') id`, [S[0], S[3]])).rows[0].id
  await as(S[3], `update profiles set discoverable=false where id=$1`, [S[3]])
  ok('settings: paused profile still visible to its match', (await as(S[0], `select count(*)::int c from profiles where id=$1`, [S[3]])).rows[0].c === 1)
  ok('settings: paused user can still chat', !(await fails(() => as(S[3], `insert into messages (match_id, body) values ($1,'still here')`, [settingsMatch]))))
  await as(S[3], `update profiles set discoverable=true where id=$1`, [S[3]])
  await su(`delete from matches where id=$1`, [settingsMatch])
  // notification prefs
  ok('prefs: owner creates row', !(await fails(() => as(S[0], `insert into notification_prefs (likes, messages) values (false, true)`))))
  ok('prefs: cannot create for someone else', !!(await fails(() => as(S[1], `insert into notification_prefs (user_id, likes) values ($1, false)`, [S[0]]))))
  await as(S[0], `update notification_prefs set feed_replies=false`)
  const settingsPrefs = (await su(`select likes, messages, feed_replies, new_matches from notification_prefs where user_id=$1`, [S[0]])).rows[0]
  ok('prefs: stored', JSON.stringify(settingsPrefs) === '{"likes":false,"messages":true,"feed_replies":false,"new_matches":true}', JSON.stringify(settingsPrefs))
  ok('prefs: owner-only read', (await as(S[1], `select count(*)::int c from notification_prefs`)).rows[0].c === 0 &&
     (await as(S[0], `select count(*)::int c from notification_prefs`)).rows[0].c === 1)
  await as(S[1], `update notification_prefs set likes=true`)
  ok('prefs: others cannot update', (await su(`select likes from notification_prefs where user_id=$1`, [S[0]])).rows[0].likes === false)
  ok('prefs: no anon access', !!(await fails(async () => { await db.exec('reset role; set role anon;'); try { await db.query(`select * from notification_prefs`) } finally { await db.exec('reset role') } })))
  // blocked users list + unblock
  await as(S[0], `insert into blocks (blocked_id) values ($1)`, [S[2]])
  await as(S[2], `insert into blocks (blocked_id) values ($1)`, [S[3]])
  await su(`insert into profile_photos (profile_id, storage_path, width, height, position) values ($1, $2, 600, 800, 0)`, [S[2], `${S[2]}/a.webp`])
  const settingsBlocked = (await as(S[0], `select * from get_blocked_users()`)).rows
  ok('blocked: lists own blocks with name and photo', settingsBlocked.length === 1 && settingsBlocked[0].display_name === 'Pg2' &&
     settingsBlocked[0].photo?.path === `${S[2]}/a.webp` && !('location' in settingsBlocked[0]), JSON.stringify(settingsBlocked))
  ok('blocked: never reveals who blocked you', (await as(S[3], `select count(*)::int c from get_blocked_users()`)).rows[0].c === 0)
  ok('blocked: no anon access', (await su(`select has_function_privilege('anon', 'public.get_blocked_users()', 'execute') v`)).rows[0].v === false)
  await as(S[3], `delete from blocks where blocked_id=$1`, [S[3]])
  ok('blocked: cannot remove someone else\'s block', (await su(`select count(*)::int c from blocks where blocker_id=$1`, [S[2]])).rows[0].c === 1)
  await as(S[0], `delete from blocks where blocked_id=$1`, [S[2]])
  ok('blocked: unblock restores visibility', (await as(S[0], `select count(*)::int c from profiles where id=$1`, [S[2]])).rows[0].c === 1)
  await su(`delete from blocks where blocker_id=$1`, [S[2]])
  // who liked you
  const likesOf = async (u) => (await as(u, `select * from get_incoming_likes()`)).rows
  const likeCount = async (u) => (await as(u, `select count_incoming_likes() n`)).rows[0].n
  await as(S[1], `update profiles set discoverable=true where id=$1`, [S[1]])
  await as(S[1], `insert into swipes (swiped_id, direction) values ($1,'like')`, [S[0]])
  await as(S[2], `insert into swipes (swiped_id, direction) values ($1,'like')`, [S[0]])
  await as(S[3], `insert into swipes (swiped_id, direction) values ($1,'pass')`, [S[0]])
  const settingsIn = await likesOf(S[0])
  ok('likes: shows people who liked you (not passes)', settingsIn.length === 2 && settingsIn.every((r) => [S[1], S[2]].includes(r.id)) && (await likeCount(S[0])) === 2, JSON.stringify(settingsIn.map((r) => r.id)))
  ok('likes: card data without location', settingsIn.every((r) => !('location' in r) && r.distance_km !== null && Array.isArray(r.photos)) &&
     !(await su(`select pg_get_function_result('public.get_incoming_likes(int)'::regprocedure) r`)).rows[0].r.includes('location'))
  ok('likes: swipes table stays closed', (await as(S[0], `select count(*)::int c from swipes where swiped_id=$1`, [S[0]])).rows[0].c === 0)
  ok('likes: likers see nothing about it', (await likesOf(S[1])).length === 0)
  ok('likes: internal helper not callable', !!(await fails(() => as(S[0], `select * from incoming_like_ids()`))))
  ok('likes: no anon access', (await su(`select has_function_privilege('anon', 'public.get_incoming_likes(int)', 'execute') v`)).rows[0].v === false)
  await as(S[1], `update profiles set discoverable=false where id=$1`, [S[1]])
  ok('likes: paused liker hidden', (await likesOf(S[0])).map((r) => r.id).join() === S[2])
  await as(S[1], `update profiles set discoverable=true where id=$1`, [S[1]])
  await as(S[0], `insert into blocks (blocked_id) values ($1)`, [S[1]])
  ok('likes: blocked liker hidden', (await likeCount(S[0])) === 1)
  await as(S[0], `delete from blocks where blocked_id=$1`, [S[1]])
  await su(`update profiles set banned_at=now(), ban_reason='spam' where id=$1`, [S[1]])
  ok('likes: banned liker hidden', (await likeCount(S[0])) === 1)
  await su(`update profiles set banned_at=null, ban_reason=null, is_active=true where id=$1`, [S[1]])
  await as(S[0], `insert into swipes (swiped_id, direction) values ($1,'like')`, [S[1]])
  ok('likes: like back = instant match', (await su(`select count(*)::int c from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [S[0], S[1]])).rows[0].c === 1)
  await as(S[0], `insert into swipes (swiped_id, direction) values ($1,'pass')`, [S[2]])
  ok('likes: swiped likers leave the list', (await likeCount(S[0])) === 0)
  await su(`update profiles set verification_status='pending' where id=$1`, [S[3]])
  ok('likes: unverified caller rejected', !!(await fails(() => likesOf(S[3]))))
  await su(`delete from auth.users where id=$1`, [S[0]])
  ok('prefs: removed with the account', (await su(`select count(*)::int c from notification_prefs`)).rows[0].c === 0)
  // discover: widening counts, second chance, new-people alerts, referrals (gender 'other' keeps them apart)
  const DS = [1, 2, 3, 4, 5].map((i) => `d15c0000-0000-0000-0000-00000000000${i}`)
  const discLon = [101.7, 101.71, 101.72, 103.0, 101.705]
  const discBirth = ['1995-01-01', '1996-01-01', '1985-01-01', '1998-01-01', '1997-01-01']
  for (const [i, u] of DS.entries()) {
    await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013777000' + i])
    await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, location)
      values ($1, $2, 'other', '{other}', 'SRID=4326;POINT(${discLon[i]} 3.14)')`, ['Disc' + i, discBirth[i]])
  }
  await su(`update profiles set verification_status = 'approved' where id = any($1)`, [DS.slice(0, 4)])
  const discCount = async (u, minA, maxA, km) => (await as(u, `select count_swipe_candidates('{other}', $1, $2, $3) n`, [minA, maxA, km])).rows[0].n
  ok('disc: count matches deck filters', (await discCount(DS[0], 18, 35, 50)) === 1)
  ok('disc: wider age counts more', (await discCount(DS[0], 18, 45, 50)) === 2)
  ok('disc: wider distance counts more', (await discCount(DS[0], 18, 35, 200)) === 2)
  ok('disc: count requires verification', !!(await fails(() => discCount(DS[4], 18, 99, 50))))
  ok('disc: pool not callable by clients', !!(await fails(() => as(DS[0], `select * from swipe_candidate_pool($1, '{other}', 18, 99, 50)`, [DS[0]]))))
  await as(DS[0], `insert into swipes (swiped_id, direction) values ($1, 'pass')`, [DS[1]])
  await as(DS[0], `insert into swipes (swiped_id, direction) values ($1, 'like')`, [DS[2]])
  ok('disc: fresh pass hidden', (await discCount(DS[0], 18, 99, 500)) === 1)
  await su(`update swipes set created_at = now() - interval '15 days' where swiper_id = $1`, [DS[0]])
  const discDeck = (await as(DS[0], `select id, second_chance from get_swipe_candidates('{other}', 18, 99, 500)`)).rows
  ok('disc: old pass comes back as second chance, new people first',
    JSON.stringify(discDeck) === JSON.stringify([{ id: DS[3], second_chance: false }, { id: DS[1], second_chance: true }]), JSON.stringify(discDeck))
  ok('disc: likes never come back', !discDeck.some((c) => c.id === DS[2]))
  ok('disc: candidates never return location', !('location' in ((await as(DS[0], `select * from get_swipe_candidates('{other}', 18, 99, 500)`)).rows[0] ?? {})))
  const reSwipe = await fails(() => as(DS[0], `insert into swipes (swiped_id, direction) values ($1, 'like')`, [DS[1]]))
  ok('disc: second-chance card can be swiped again', !reSwipe && (await su(`select direction from swipes where swiper_id = $1 and swiped_id = $2`, [DS[0], DS[1]])).rows[0].direction === 'like', reSwipe)
  ok('disc: fresh pass cannot be replaced', !!(await fails(async () => {
    await as(DS[0], `insert into swipes (swiped_id, direction) values ($1, 'pass')`, [DS[3]])
    await as(DS[0], `insert into swipes (swiped_id, direction) values ($1, 'like')`, [DS[3]])
  })))
  // new-people alerts
  const discSvc = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
  ok('disc: alert requires verification', !!(await fails(() => as(DS[4], `select set_new_people_alert(true, '{other}', 18, 99, 50)`))))
  await as(DS[1], `select set_new_people_alert(true, '{other}', 18, 40, 50)`)
  await as(DS[2], `select set_new_people_alert(true, '{other}', 18, 99, 50)`)
  await as(DS[3], `select set_new_people_alert(true, '{other}', 18, 99, 10)`)
  for (const u of [DS[1], DS[3]]) await su(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [u, `https://push.example/${u}`])
  ok('disc: alert is owner-only', (await as(DS[0], `select count(*)::int c from new_people_alerts`)).rows[0].c === 0 &&
    (await as(DS[1], `select count(*)::int c from new_people_alerts`)).rows[0].c === 1)
  ok('disc: alert not writable directly', !!(await fails(() => as(DS[1], `update new_people_alerts set max_km = 500`))))
  const discRecipients = async (p) => (await discSvc(`select coalesce(array_agg(r), '{}') r from new_people_alert_recipients($1) r`, [p])).rows[0].r
  ok('disc: recipients not callable by clients', !!(await fails(() => as(DS[0], `select new_people_alert_recipients($1)`, [DS[4]]))))
  ok('disc: unapproved profile notifies nobody', (await discRecipients(DS[4])).length === 0)
  await su(`update profiles set verification_status = 'approved' where id = $1`, [DS[4]])
  const discR = await discRecipients(DS[4])
  ok('disc: only opted-in, in range, subscribed users', JSON.stringify(discR) === JSON.stringify([DS[1]]), JSON.stringify(discR))
  ok('disc: at most one alert per 12 hours', (await discRecipients(DS[4])).length === 0)
  await as(DS[1], `select set_new_people_alert(false)`)
  ok('disc: alert can be turned off', (await su(`select count(*)::int c from new_people_alerts where user_id = $1`, [DS[1]])).rows[0].c === 0)
  // referrals
  const discRef = (await as(DS[0], `select * from get_my_referral()`)).rows[0]
  ok('disc: referral code created', /^[a-z0-9]{8}$/.test(discRef.code) && discRef.invited === 0, JSON.stringify(discRef))
  ok('disc: referral code is stable', (await as(DS[0], `select code from get_my_referral()`)).rows[0].code === discRef.code)
  ok('disc: referral codes owner-only', (await as(DS[1], `select count(*)::int c from referral_codes`)).rows[0].c === 0)
  ok('disc: own code not claimable', (await as(DS[0], `select claim_referral($1) v`, [discRef.code])).rows[0].v === false)
  ok('disc: new user claims code', (await as(DS[4], `select claim_referral($1) v`, [discRef.code.toUpperCase()])).rows[0].v === true)
  ok('disc: claim only once', (await as(DS[4], `select claim_referral($1) v`, [discRef.code])).rows[0].v === false)
  await su(`update profiles set created_at = now() - interval '2 days' where id = $1`, [DS[3]])
  ok('disc: old profile cannot claim', (await as(DS[3], `select claim_referral($1) v`, [discRef.code])).rows[0].v === false)
  ok('disc: invited count', (await as(DS[0], `select invited from get_my_referral()`)).rows[0].invited === 1)
  ok('disc: referred_by not readable', !!(await fails(() => as(DS[4], `select referred_by from profiles where id = $1`, [DS[4]]))))
  ok('disc: referred_by not writable', !!(await fails(() => as(DS[4], `update profiles set referred_by = null where id = $1`, [DS[4]]))))
  // batch-3 integration: paused (discoverable=false) profiles stay out of the Discover pool and counts
  const integ_viewer = '11111111-1111-1111-1111-111111111111'
  await su(`update profiles set verification_status='approved', is_active=true, banned_at=null where id=$1`, [integ_viewer])
  const integ_before = (await as(integ_viewer, `select count_swipe_candidates('{female,male,other}', 18, 99, 300) n`)).rows[0].n
  const integ_target = (await as(integ_viewer, `select id from get_swipe_candidates('{female,male,other}', 18, 99, 300, 50) limit 1`)).rows[0]?.id
  ok('integ: viewer has at least one candidate', !!integ_target)
  await su(`update profiles set discoverable=false where id=$1`, [integ_target])
  const integ_after = (await as(integ_viewer, `select count_swipe_candidates('{female,male,other}', 18, 99, 300) n`)).rows[0].n
  const integ_ids = (await as(integ_viewer, `select id from get_swipe_candidates('{female,male,other}', 18, 99, 300, 50)`)).rows.map(r => r.id)
  ok('integ: paused profile left the deck', !integ_ids.includes(integ_target))
  ok('integ: paused profile left the count', integ_after === integ_before - 1, `${integ_before} -> ${integ_after}`)
  await su(`update profiles set discoverable=true where id=$1`, [integ_target])
  ok('integ: new_people pref column exists', (await su(`select count(*)::int c from information_schema.columns where table_name='notification_prefs' and column_name='new_people'`)).rows[0].c === 1)
  // feed identity (B + A): named/anonymous posts & comments, pseudonyms, city tab, push throttle, retention
  const FB = ['fb000000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000002',
              'fb000000-0000-4000-8000-000000000003', 'fb000000-0000-4000-8000-000000000004']
  const fbCity = ['Kuala Lumpur', ' kuala lumpur ', 'Penang', null]
  for (const [i, u] of FB.entries()) {
    await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6012888000' + i])
    await as(u, `insert into profiles (display_name,birth_date,gender,interested_in,city) values ($1,'1995-01-01','female','{male}',$2)`, ['FeedB' + i, fbCity[i]])
  }
  await su(`update profiles set verification_status='approved' where id = any($1)`, [FB])
  await su(`insert into profile_photos (profile_id, storage_path, width, height, position) values ($1, $2, 600, 800, 0)`, [FB[0], `${FB[0]}/feedb.jpg`])
  const fbPost = async (u, body, named) => (await as(u, `select create_post($1, $2) id`, [body, named])).rows[0].id
  const fbAnon = await fbPost(FB[0], 'feedb anon', false)
  const fbNamed = await fbPost(FB[0], 'feedb named', true)
  const fbLegacy = (await as(FB[3], `select create_post('feedb legacy') id`)).rows[0].id
  ok('feedb: one-arg create_post still anonymous', (await su(`select is_named from posts where id=$1`, [fbLegacy])).rows[0].is_named === false)
  const fpRow = async (u, id) => (await as(u, `select * from feed_posts where id=$1`, [id])).rows[0]
  const a1 = await fpRow(FB[1], fbAnon)
  ok('feedb: anonymous post exposes no identity', a1.is_named === false && a1.author_id === null && a1.author_name === null &&
     a1.author_age === null && a1.author_photo_path === null && a1.author_verified === null && Number.isInteger(a1.anon_adj), JSON.stringify(a1))
  const n1 = await fpRow(FB[1], fbNamed)
  ok('feedb: named post shows author', n1.is_named === true && n1.author_id === FB[0] && n1.author_name === 'FeedB0' &&
     n1.author_age >= 30 && n1.author_verified === true && n1.author_photo_path === `${FB[0]}/feedb.jpg` && n1.anon_adj === null, JSON.stringify(n1))
  ok('feedb: views have no city column', (await su(`select count(*)::int c from information_schema.columns where table_name in ('feed_posts','post_comments') and column_name like '%city' and column_name <> 'same_city'`)).rows[0].c === 0)
  ok('feedb: same_city for viewer in same city', a1.same_city === true && (await fpRow(FB[2], fbAnon)).same_city === false && (await fpRow(FB[3], fbAnon)).same_city === false)
  ok('feedb: engagement column', a1.engagement === 0)
  // banned / blocked authors lose their identity
  await su(`update profiles set banned_at = now(), ban_reason = 'feedb' where id=$1`, [FB[0]])
  const nb = await fpRow(FB[1], fbNamed)
  ok('feedb: banned author shown anonymously', nb.is_named === false && nb.author_id === null && nb.author_name === null && Number.isInteger(nb.anon_adj), JSON.stringify(nb))
  await su(`update profiles set banned_at = null, ban_reason = null, is_active = true where id=$1`, [FB[0]])
  await as(FB[2], `insert into blocks (blocked_id) values ($1)`, [FB[0]])
  ok('feedb: blocked author shown anonymously', (await fpRow(FB[2], fbNamed)).author_id === null && (await fpRow(FB[1], fbNamed)).author_id === FB[0])
  await as(FB[2], `delete from blocks where blocked_id=$1`, [FB[0]])
  // comments: pseudonyms
  const fbComment = (u, post, body, named = false) => as(u, `select create_comment($1,$2,$3)`, [post, body, named])
  await fbComment(FB[1], fbAnon, 'x1'); await fbComment(FB[2], fbAnon, 'x2'); await fbComment(FB[1], fbAnon, 'x3')
  await fbComment(FB[0], fbAnon, 'op'); await fbComment(FB[1], fbAnon, 'x4 named', true)
  const tcRows = (await as(FB[3], `select * from post_comments where post_id=$1`, [fbAnon])).rows
  const tc = ['x1', 'x2', 'x3', 'op', 'x4 named'].map((b) => tcRows.find((r) => r.body === b))
  const pn = (r) => `${r.anon_adj}/${r.anon_noun}/${r.anon_color}`
  ok('feedb: pseudonym stable within a post', pn(tc[0]) === pn(tc[2]) && pn(tc[0]) !== pn(tc[1]), JSON.stringify(tc.map(pn)))
  ok('feedb: OP comment uses the post pseudonym', tc[3].is_op === true && pn(tc[3]) === pn(a1))
  ok('feedb: anonymous comments expose no author', tc.slice(0, 4).every((c) => c.author_id === null && c.author_name === null && c.is_named === false))
  ok('feedb: named comment shows author, hides alias', tc[4].is_named === true && tc[4].author_id === FB[1] && tc[4].author_name === 'FeedB1' &&
     tc[4].alias_no === null && tc[4].anon_adj === null && tc[4].is_op === false, JSON.stringify(tc[4]))
  const others = []
  for (let i = 0; i < 3; i++) {
    const p = await fbPost(FB[3], 'feedb other ' + i, false)
    await fbComment(FB[1], p, 'y')
    others.push(pn((await as(FB[2], `select * from post_comments where post_id=$1`, [p])).rows[0]))
  }
  ok('feedb: pseudonym differs across posts', new Set([pn(tc[0]), ...others]).size > 1, JSON.stringify(others))
  await fbComment(FB[0], fbNamed, 'op anon on named')
  await fbComment(FB[0], fbNamed, 'op named on named', true)
  const ncRows = (await as(FB[1], `select * from post_comments where post_id=$1`, [fbNamed])).rows
  const nc = ['op anon on named', 'op named on named'].map((b) => ncRows.find((r) => r.body === b))
  ok('feedb: OP marker on named post', nc[0].is_op === true && nc[1].is_op === true && nc[1].author_id === FB[0])
  ok('feedb: no raw author on anonymous rows', (await as(FB[1], `select count(*)::int c from post_comments where author_id is not null and not is_named`)).rows[0].c === 0 &&
     (await as(FB[1], `select count(*)::int c from feed_posts where author_id is not null and not is_named`)).rows[0].c === 0)
  // push throttle
  const cid = async (post, body) => (await su(`select id from comments where post_id=$1 and body=$2`, [post, body])).rows[0].id
  ok('feedb: claim_comment_push not for users', !!(await fails(() => as(FB[1], `select claim_comment_push($1)`, [FB[0]]))))
  const claim = async (id) => (await su(`select claim_comment_push($1) a`, [id])).rows[0].a
  ok('feedb: first reply notifies the author', (await claim(await cid(fbAnon, 'x1'))) === FB[0])
  ok('feedb: at most one push per 10 minutes', (await claim(await cid(fbAnon, 'x2'))) === null)
  ok('feedb: own comment never notifies', (await claim(await cid(fbNamed, 'op anon on named'))) === null)
  await su(`update posts set last_comment_push_at = now() - interval '11 minutes' where id=$1`, [fbAnon])
  ok('feedb: notifies again after 10 minutes', (await claim(await cid(fbAnon, 'x3'))) === FB[0])
  // retention: 90 days, unless under an open report
  const fbOld = (await su(`insert into posts (author_id, body, created_at) values ($1,'feedb old', now() - interval '91 days') returning id`, [FB[3]])).rows[0].id
  const fbKept = (await su(`insert into posts (author_id, body, created_at) values ($1,'feedb old reported', now() - interval '91 days') returning id`, [FB[3]])).rows[0].id
  const fbOldC = (await su(`insert into comments (post_id, author_id, alias_no, body, created_at) values ($1,$2,1,'feedb old c', now() - interval '91 days') returning id`, [fbAnon, FB[1]])).rows[0].id
  await as(FB[1], `insert into reports (target_type, target_id, reason) values ('post', $1, 'feedb reason')`, [fbKept])
  ok('feedb: purge not for users', !!(await fails(() => as(FB[1], `select purge_old_feed_content()`))))
  ok('feedb: purge deletes old content', (await su(`select purge_old_feed_content() n`)).rows[0].n === 2)
  ok('feedb: old post and comment gone, reported and recent kept',
     (await su(`select count(*)::int c from posts where id=$1`, [fbOld])).rows[0].c === 0 &&
     (await su(`select count(*)::int c from comments where id=$1`, [fbOldC])).rows[0].c === 0 &&
     (await su(`select count(*)::int c from posts where id = any($1)`, [[fbKept, fbAnon, fbNamed]])).rows[0].c === 3)
  console.log(`${pass} passed, ${fail} failed`)
  return fail
}
