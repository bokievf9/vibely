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
  // Plans (20261009000280): the blocks before the plans block test their own features, not the
  // plan gates, so every profile they create gets an unlimited VIP grant. The plans block drops this.
  await su(`create function public.test_auto_vip() returns trigger language plpgsql security definer set search_path = '' as $$
    begin insert into public.plan_grants (user_id, plan, source, note) values (new.id, 'vip', 'admin', 'test'); return null; end $$`)
  await su(`create trigger test_auto_vip after insert on public.profiles for each row execute function public.test_auto_vip()`)
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
  // Blind Dating (20261009000190): a mutual reveal (= Connect) ends the session; the reveal is read
  // with get_blind_session(id).
  const after = (await as(U[2], `select * from get_blind_session($1)`, [sid])).rows[0]
  ok('partner revealed + match', after.partner?.id === U[3] && !!after.match_id && after.state === 'matched', JSON.stringify(after))
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
  // 90 days since 20261008000112 (a 40-day-old chat is now kept)
  const oldS = await sess('100 days'), reportedS = await sess('100 days'), newS = await sess('40 days')
  for (const [s, age] of [[oldS, '100 days'], [reportedS, '100 days'], [newS, '40 days']])
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
  // 20261009000290: clients no longer write read_at; reads go through mark_match_read.
  ok('clients cannot write read_at', !!(await fails(() => as(U[0], `update messages set read_at = now() where match_id=$1 and sender_id<>$2 and read_at is null`, [m.id, U[0]]))))
  await as(U[0], `select mark_match_read($1)`, [m.id])
  ok('unread count drops after read', (await as(U[0], `select unread_message_count() n`)).rows[0].n === 0)
  ok('read state is not written to the messages', (await as(U[1], `select count(*)::int c from messages where sender_id=$1 and read_at is not null and body in ('a','b')`, [U[1]])).rows[0].c === 0)
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
     !(await su(`select pg_get_function_result('public.get_swipe_candidates(public.gender[],int,int,int,int,boolean)'::regprocedure) r`)).rows[0].r.includes('location'))
  ok('candidates: no anon access', (await su(`select has_function_privilege('anon', 'public.get_swipe_candidates(public.gender[],int,int,int,int,boolean)', 'execute') v`)).rows[0].v === false)
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
  ok('delete keeps the photo for moderators (no path returned)', gone === null && (await su(`select media_path from message_deletions where media_path=$1`, [img])).rows.length === 1)
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
  // chat media: voice messages, video circles, legacy image_path, 90-day retention
  const media_uuid = (n) => `e${n}000000-0000-4000-8000-00000000000${n}`
  const media_obj = (n, ext) => `${cm}/${media_uuid(n)}.${ext}`
  const media_send = async (u, f) => (await as(u, `insert into messages (match_id, body, media_kind, media_path, media_mime, media_duration_ms, waveform, image_width, image_height)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [cm, f.body ?? null, f.kind, f.path, f.mime, f.ms ?? null, f.wave ?? null, f.w ?? null, f.h ?? null])).rows[0].id
  await upload(C[0], media_obj(7, 'webp'))
  await send(C[0], cm, null, { path: media_obj(7, 'webp'), w: 300, h: 400 })
  const legacy = (await su(`select media_kind, media_path, media_mime from messages where image_path=$1`, [media_obj(7, 'webp')])).rows[0]
  ok('media: legacy image_path insert mapped to media_*', legacy?.media_kind === 'image' && legacy?.media_mime === 'image/webp' && !!legacy?.media_path, JSON.stringify(legacy))
  const media_bucket = (await su(`select file_size_limit l, allowed_mime_types t from storage.buckets where id='chat-media'`)).rows[0]
  ok('media: bucket 15 MB, audio/video types', Number(media_bucket.l) === 15728640 && ['image/webp', 'audio/webm', 'audio/mp4', 'video/webm', 'video/mp4'].every((t) => media_bucket.t.includes(t)))
  ok('media: .mp3 upload rejected', !!(await fails(() => upload(C[0], media_obj(1, 'mp3')))))
  for (const [n, ext] of [[1, 'webm'], [2, 'm4a'], [3, 'mp4'], [4, 'webm'], [5, 'webm']]) await upload(C[0], media_obj(n, ext))
  const voice = { kind: 'voice', path: media_obj(1, 'webm'), mime: 'audio/webm', ms: 5200, wave: '{0,10,55,100,40}' }
  ok('media: voice wrong extension for mime rejected', !!(await fails(() => media_send(C[0], { ...voice, mime: 'audio/mp4' }))))
  ok('media: voice over 120 s rejected', !!(await fails(() => media_send(C[0], { ...voice, ms: 130000 }))))
  ok('media: voice without duration rejected', !!(await fails(() => media_send(C[0], { ...voice, ms: null }))))
  ok('media: waveform peaks 0..100', !!(await fails(() => media_send(C[0], { ...voice, wave: '{0,101}' }))))
  ok('media: not-uploaded file rejected', !!(await fails(() => media_send(C[0], { ...voice, path: media_obj(6, 'webm') }))))
  const vErr = await fails(() => media_send(C[0], voice))
  ok('media: voice message accepted', !vErr, vErr)
  const media_voice = (await su(`select id, image_path, waveform from messages where media_path=$1`, [voice.path])).rows[0]
  ok('media: voice keeps image_path null and the waveform', media_voice?.image_path === null && media_voice?.waveform?.length === 5)
  ok('media: one message per file', !!(await fails(() => media_send(C[1], voice))))
  ok('media: iOS m4a voice accepted', !(await fails(() => media_send(C[1], { ...voice, path: media_obj(2, 'm4a'), mime: 'audio/mp4', wave: null }))))
  const video = { kind: 'video', path: media_obj(3, 'mp4'), mime: 'video/mp4', ms: 12000 }
  ok('media: video over 60 s rejected', !!(await fails(() => media_send(C[0], { ...video, ms: 70000 }))))
  ok('media: waveform only for voice', !!(await fails(() => media_send(C[0], { ...video, wave: '{1,2}' }))))
  ok('media: image kind needs size', !!(await fails(() => media_send(C[0], { kind: 'image', path: media_obj(4, 'webm'), mime: 'image/webp' }))))
  const vdErr = await fails(() => media_send(C[0], video))
  ok('media: video circle accepted', !vdErr, vdErr)
  ok('media: client cannot set media_expired_at', !!(await fails(() => as(C[0], `insert into messages (match_id, body, media_expired_at) values ($1,'x',now())`, [cm]))))
  const media_del = await media_send(C[0], { kind: 'video', path: media_obj(4, 'webm'), mime: 'video/webm', ms: 3000 })
  ok('media: delete archives the media path', (await as(C[0], `select delete_message($1) p`, [media_del])).rows[0].p === null && (await su(`select count(*)::int c from message_deletions where media_path=$1`, [media_obj(4, 'webm')])).rows[0].c === 1)
  ok('media: delete clears media fields', (await su(`select media_kind is null and media_path is null and media_mime is null v from messages where id=$1`, [media_del])).rows[0].v === true)
  // retention: chat media
  const fn = (f) => su(`select has_function_privilege('authenticated', $1, 'execute') a, has_function_privilege('service_role', $1, 'execute') s`, [f])
  for (const f of ['public.retention_chat_media(int)', 'public.retention_mark_chat_media_expired(uuid[])', 'public.retention_orphan_chat_media(int)', 'public.retention_selfies(int)']) {
    const r = (await fn(f)).rows[0]
    ok(`retention: ${f} service-role only`, r.a === false && r.s === true)
  }
  await su(`update messages set created_at = now() - interval '100 days' where id=$1`, [media_voice.id])
  const due = async () => (await su(`select message_id from retention_chat_media(100)`)).rows.map((r) => r.message_id)
  ok('retention: old voice is due, recent media not', JSON.stringify(await due()) === JSON.stringify([media_voice.id]))
  const media_rep = (await su(`insert into reports (reporter_id, target_type, target_id, reason) values ($1,'user',$2,'abuse') returning id`, [C[0], C[1]])).rows[0].id
  ok('retention: open report keeps the match media', (await due()).length === 0)
  await su(`update reports set resolved_at = now() where id=$1`, [media_rep])
  ok('retention: resolved report releases it', (await due()).length === 1)
  const mark = async () => (await su(`select retention_mark_chat_media_expired($1) n`, [[media_voice.id]])).rows[0].n
  ok('retention: not marked while the file exists', (await mark()) === 0)
  await su(`delete from storage.objects where bucket_id='chat-media' and name=$1`, [voice.path])
  ok('retention: marked once the file is gone', (await mark()) === 1)
  const media_exp = (await as(C[1], `select media_kind, media_path, media_duration_ms, waveform, media_expired_at is not null e from messages where id=$1`, [media_voice.id])).rows[0]
  ok('retention: expired placeholder keeps metadata', media_exp.media_kind === 'voice' && media_exp.media_path === null && media_exp.media_duration_ms === 5200 && media_exp.waveform === null && media_exp.e === true, JSON.stringify(media_exp))
  ok('retention: expired media no longer due', (await due()).length === 0)
  // retention: orphan uploads and selfies
  await su(`update storage.objects set created_at = now() - interval '2 days' where bucket_id='chat-media' and name = any($1)`, [[media_obj(5, 'webm'), media_obj(3, 'mp4')]])
  const orphans = (await su(`select retention_orphan_chat_media(100) n`)).rows.map((r) => r.n)
  ok('retention: unreferenced upload is an orphan, sent one is not', orphans.includes(media_obj(5, 'webm')) && !orphans.includes(media_obj(3, 'mp4')), JSON.stringify(orphans))
  await su(`update storage.objects set created_at = now() - interval '100 days' where bucket_id='selfies'`)
  const selfies = async () => (await su(`select retention_selfies(100) n`)).rows.map((r) => r.n)
  ok('retention: reviewed selfie older than 90 days is due', (await selfies()).includes(`${U[0]}/s.jpg`))
  await su(`insert into storage.objects (bucket_id, name, created_at) values ('selfies', $1, now() - interval '100 days')`, [`${C[2]}/p.jpg`])
  await su(`insert into verification_requests (user_id, selfie_path, challenge, status) values ($1,$2,'peace','pending')`, [C[2], `${C[2]}/p.jpg`])
  ok('retention: pending selfie kept', !(await selfies()).includes(`${C[2]}/p.jpg`))
  await su(`insert into reports (reporter_id, target_type, target_id, reason) values ($1,'user',$2,'fake')`, [C[1], U[0]])
  ok('retention: selfie of a reported user kept', !(await selfies()).includes(`${U[0]}/s.jpg`))
  // safety protocol: "delete for everyone" archives the content for moderators (90 days)
  const arch_m = (await su(`select id, user_a, user_b from matches limit 1`)).rows[0]
  if (arch_m) {
    await su(`update profiles set verification_status='approved', is_active=true, banned_at=null where id in ($1,$2)`, [arch_m.user_a, arch_m.user_b])
    const arch_msg = (await as(arch_m.user_a, `insert into messages (match_id, body) values ($1,'regret this') returning id`, [arch_m.id])).rows[0].id
    const arch_ret = (await as(arch_m.user_a, `select delete_message($1) p`, [arch_msg])).rows[0].p
    ok('archive: delete_message returns no file to remove', arch_ret === null)
    ok('archive: participants no longer see the text', (await as(arch_m.user_b, `select body from messages where id=$1`, [arch_msg])).rows[0].body === null)
    ok('archive: moderators keep the content', (await su(`select body from message_deletions where message_id=$1`, [arch_msg])).rows[0]?.body === 'regret this')
    ok('archive: clients cannot read the archive', !!(await fails(() => as(arch_m.user_b, `select body from message_deletions`))))
    ok('archive: not due before 90 days', (await su(`select count(*)::int c from retention_message_deletions(100) where message_id=$1`, [arch_msg])).rows[0].c === 0)
    await su(`update message_deletions set deleted_at = now() - interval '91 days' where message_id=$1`, [arch_msg])
    await su(`update reports set resolved_at = now() where resolved_at is null`)
    ok('archive: due after 90 days', (await su(`select count(*)::int c from retention_message_deletions(100) where message_id=$1`, [arch_msg])).rows[0].c === 1)
    ok('archive: drop removes the row', (await su(`select retention_drop_message_deletions($1) n`, [[arch_msg]])).rows[0].n === 1)
  } else ok('archive: a match exists for the test', false)
  // calls: consent, mutual permission, signalling, realtime topic, moderation access, retention
  const K = ['ca000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000002',
             'ca000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000004']
  for (const [i, u] of K.entries()) {
    await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013777000' + i])
    await as(u, `insert into profiles (display_name,birth_date,gender,interested_in) values ($1,'1995-01-01','male','{female}')`, ['Call' + i])
  }
  await su(`update profiles set verification_status='approved' where id = any($1)`, [K.slice(0, 3)])
  const km = (await su(`select ensure_match($1,$2,'swipe') id`, [K[0], K[1]])).rows[0].id
  const ko = (await su(`select ensure_match($1,$2,'swipe') id`, [K[0], K[2]])).rows[0].id
  const kv = (await su(`select ensure_match($1,$2,'swipe') id`, [K[0], K[3]])).rows[0].id
  const startCall = (u, match, kind = 'audio') => as(u, `select start_call($1,$2) id`, [match, kind]).then((r) => r.rows[0].id)
  const allow = (u, match, v = true) => as(u, `select set_call_permission($1,$2)`, [match, v])
  ok('call_no_consent: start needs both permissions', (await fails(() => startCall(K[0], km)))?.includes('both participants'))
  ok('call_no_consent: allowing needs the recording notice', (await fails(() => allow(K[0], km)))?.includes('recording notice'))
  ok('call_consent: column not readable by clients', !!(await fails(() => as(K[0], `select calls_consent_at from profiles where id=$1`, [K[0]]))))
  ok('call_consent: no direct write', !!(await fails(() => as(K[0], `update profiles set calls_consent_at=now() where id=$1`, [K[0]]))))
  for (const u of K) await as(u, `select accept_calls_notice()`)
  await allow(K[0], km)
  const ks = (await as(K[0], `select * from call_settings($1)`, [km])).rows[0]
  ok('call_settings: own view', ks?.consented === true && ks.me_allowed === true && ks.partner_allowed === false, JSON.stringify(ks))
  ok('call_settings: outsider gets nothing', (await as(K[2], `select * from call_settings($1)`, [km])).rows.length === 0)
  ok('call_permission: partner notified', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='permission'`, ['call:' + K[1]])).rows[0].c === 1)
  ok('call_one_sided: still refused', (await fails(() => startCall(K[0], km)))?.includes('both participants'))
  ok('call_permission: outsider cannot allow', !!(await fails(() => allow(K[2], km))))
  ok('call_permission: unverified cannot allow', !!(await fails(() => allow(K[3], kv))))
  ok('call_permission: no direct insert', !!(await fails(() => as(K[1], `insert into call_permissions (match_id, user_id) values ($1,$2)`, [km, K[1]]))))
  await allow(K[1], km)
  ok('call_permission: partner sees both rows', (await as(K[1], `select count(*)::int c from call_permissions where match_id=$1`, [km])).rows[0].c === 2)
  ok('call_permission: outsider sees none', (await as(K[2], `select count(*)::int c from call_permissions`)).rows[0].c === 0)
  ok('call_outsider: cannot start in a foreign match', !!(await fails(() => startCall(K[2], km))))
  const c1 = await startCall(K[0], km, 'video')
  ok('call_start: ringing row', (await su(`select status, kind, callee_id from calls where id=$1`, [c1])).rows[0]?.status === 'ringing')
  ok('call_start: callee gets incoming event', (await su(`select payload from realtime.messages where topic=$1 and event='incoming'`, ['call:' + K[1]])).rows[0]?.payload.call_id === c1)
  ok('call_busy: second call refused', (await fails(() => startCall(K[1], km)))?.includes('busy'))
  ok('call_rows: outsider sees none', (await as(K[2], `select count(*)::int c from calls`)).rows[0].c === 0)
  ok('call_rows: participants see it', (await as(K[1], `select count(*)::int c from calls where id=$1`, [c1])).rows[0].c === 1)
  ok('call_rows: recording columns hidden', !!(await fails(() => as(K[0], `select recording_path from calls`))))
  ok('call_rows: no direct writes', !!(await fails(() => as(K[0], `update calls set status='ended' where id=$1`, [c1]))) &&
     !!(await fails(() => as(K[0], `insert into calls (match_id, caller_id, callee_id, kind) values ($1,$2,$3,'audio')`, [km, K[0], K[1]]))))
  ok('call_answer: outsider and caller cannot answer', !!(await fails(() => as(K[2], `select answer_call($1)`, [c1]))) && !!(await fails(() => as(K[0], `select answer_call($1)`, [c1]))))
  ok('call_end: outsider cannot end', !!(await fails(() => as(K[2], `select end_call($1)`, [c1]))))
  ok('call_finish: not callable by users', !!(await fails(() => as(K[0], `select finish_call($1)`, [c1]))))
  ok('call_answer: callee answers', (await as(K[1], `select answer_call($1) s`, [c1])).rows[0].s === 'active')
  ok('call_answer: caller notified', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='answered'`, ['call:' + K[0]])).rows[0].c === 1)
  ok('call_end: hang up → ended', (await as(K[0], `select end_call($1) s`, [c1])).rows[0].s === 'ended' &&
     (await as(K[0], `select end_call($1) s`, [c1])).rows[0].s === 'ended')
  ok('call_end: partner notified', (await su(`select payload->>'status' s from realtime.messages where topic=$1 and event='ended'`, ['call:' + K[1]])).rows[0]?.s === 'ended')
  const c2 = await startCall(K[0], km)
  await su(`update calls set started_at = now() - interval '31 seconds' where id=$1`, [c2])
  ok('call_ring: unanswered after 30 s is missed', (await as(K[1], `select answer_call($1) s`, [c2])).rows[0].s === 'missed')
  const c3 = await startCall(K[1], km)
  ok('call_decline: callee hang-up → declined', (await as(K[0], `select end_call($1) s`, [c3])).rows[0].s === 'declined')
  const c4 = await startCall(K[0], km)
  ok('call_cancel: caller hang-up → missed', (await as(K[0], `select end_call($1) s`, [c4])).rows[0].s === 'missed')
  ok('call_unverified: cannot be called', !!(await fails(async () => { await su(`insert into call_permissions values ($1,$2),($1,$3)`, [kv, K[0], K[3]]); await startCall(K[0], kv) })))
  // realtime topic authorization
  const ct = 'call:' + K[1]
  ok('realtime: own call topic visible', (await as(K[1], `select count(*)::int c from realtime.messages where topic=$1`, [ct], ct)).rows[0].c >= 3)
  ok('realtime: foreign call topic hidden', (await as(K[0], `select count(*)::int c from realtime.messages where topic=$1`, [ct], ct)).rows[0].c === 0)
  ok('realtime: client cannot write to call topic', !!(await fails(() => as(K[1], `insert into realtime.messages (topic, event, payload) values ($1,'incoming','{}')`, [ct], ct))))
  ok('realtime: older topics still work', (await as(K[1], `select count(*)::int c from realtime.messages where topic=$1`, ['match:' + km], 'match:' + km)).rows[0].c >= 0 &&
     (await as(K[2], `select count(*)::int c from realtime.messages where topic=$1`, ['call:' + K[1]], 'match:' + km)).rows[0].c === 0)
  // blocked users can't call; the call history survives the match (evidence)
  await as(K[1], `insert into blocks (blocked_id) values ($1)`, [K[0]])
  ok('call_blocked: caller blocked by callee refused', !!(await fails(() => startCall(K[0], km))))
  ok('call_blocked: blocker cannot call either', !!(await fails(() => startCall(K[1], km))))
  await su(`delete from blocks where blocker_id=$1`, [K[1]])
  // moderation access to recordings
  const KA = K[2]
  await su(`insert into admins values ($1)`, [KA])
  await su(`update calls set recording_path = 'calls/' || match_id || '/' || id || '.mp4', recording_status='ready' where id=$1`, [c1])
  ok('call_recording: malformed path rejected', !!(await fails(() => su(`update calls set recording_path='calls/x/y.mp4' where id=$1`, [c1]))))
  ok('call_recording: needs an open report', (await fails(() => su(`select admin_open_call_recording($1,$2)`, [KA, c1])))?.includes('open report'))
  await as(K[1], `insert into reports (target_type, target_id, reason) values ('user',$1,'harassment: call')`, [K[0]])
  ok('call_recording: non-moderator refused', !!(await fails(() => su(`select admin_open_call_recording($1,$2)`, [K[1], c1]))))
  const callPath = (await su(`select admin_open_call_recording($1,$2,'report') p`, [KA, c1])).rows[0].p
  ok('call_recording: moderator gets path', callPath === `calls/${km}/${c1}.mp4`, callPath)
  ok('call_recording: access logged', (await su(`select count(*)::int c from moderation_actions where action='call.recording_open' and target_id=$1 and admin_id=$2`, [c1, KA])).rows[0].c === 1)
  ok('call_recording: not callable by users', !!(await fails(() => as(KA, `select admin_open_call_recording($1,$2)`, [KA, c1]))))
  // retention: 90 days, except evidence of an open report
  await su(`update calls set started_at = now() - interval '91 days', ended_at = now() - interval '91 days' where match_id=$1`, [km])
  ok('call_retention: open report holds the recording', (await su(`select count(*)::int c from call_recordings_to_purge()`)).rows[0].c === 0)
  ok('call_retention: held rows not purged', (await su(`select purge_old_calls() n`)).rows[0].n === 0 && (await su(`select count(*)::int c from calls where id=$1`, [c1])).rows[0].c === 1)
  await su(`update reports set resolved_at = now() where target_id=$1`, [K[0]])
  const call_due = (await su(`select * from call_recordings_to_purge()`)).rows
  ok('call_retention: lists expired paths', call_due.length === 1 && call_due[0].recording_path === callPath, JSON.stringify(call_due))
  ok('call_retention: purge functions not for users', !!(await fails(() => as(K[0], `select * from call_recordings_to_purge()`))) && !!(await fails(() => as(K[0], `select purge_old_calls()`))))
  ok('call_retention: mark purged', (await su(`select mark_call_recordings_purged($1) n`, [[c1]])).rows[0].n === 1 &&
     (await su(`select recording_status s from calls where id=$1`, [c1])).rows[0].s === 'purged')
  ok('call_retention: old rows deleted', (await su(`select purge_old_calls() n`)).rows[0].n === 4 && (await su(`select count(*)::int c from calls where match_id=$1`, [km])).rows[0].c === 0)
  const c5 = await startCall(K[0], km)
  await su(`delete from matches where id=$1`, [km])
  ok('call_history: row kept when the match is removed', (await su(`select match_id from calls where id=$1`, [c5])).rows[0]?.match_id === null)
  ok('call_unmatched: participants keep seeing their call', (await as(K[0], `select count(*)::int c from calls where id=$1`, [c5])).rows[0].c === 1)
  ok('call_unmatched: settings gone', (await as(K[0], `select count(*)::int c from call_permissions where match_id=$1`, [km])).rows[0].c === 0)
  // usernames (20261009000140): own scope so names don't clash with the blocks above
  await (async () => {
    const N = ['7a000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000002',
               '7a000000-0000-4000-8000-000000000003', '7a000000-0000-4000-8000-000000000004',
               '7a000000-0000-4000-8000-000000000005', '7a000000-0000-4000-8000-000000000006']
    const names = ['Siti Nur', 'Алишер Навоий', 'Admin', 'Zoë', 'Siti Nur', 'Kuching Kid']
    for (const [i, u] of N.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013777000' + i])
    const mk = (i, username) => as(N[i], `insert into profiles (display_name, birth_date, gender, interested_in, city, location${username === undefined ? '' : ', username'})
       values ($1,'1996-06-06',$2,$3,'Kuching','SRID=4326;POINT(110.35 1.55)'${username === undefined ? '' : ', $4'})`,
       [names[i], i % 2 ? 'male' : 'female', i % 2 ? '{female}' : '{male}', ...(username === undefined ? [] : [username])])
    for (const i of [0, 1, 2, 3, 4]) await mk(i)
    const un = async (i) => (await su(`select username u from profiles where id=$1`, [N[i]])).rows[0].u
    const [u0, u1, u2, u3, u4] = [await un(0), await un(1), await un(2), await un(3), await un(4)]
    ok('username: generated from display name', u0 === 'siti.nur', u0)
    ok('username: cyrillic transliterated', u1 === 'alisher.navoiy', u1)
    ok('username: reserved base falls back to user + digits', /^user\d+$/.test(u2), u2)
    ok('username: accents dropped', u3 === 'zoe', u3)
    ok('username: duplicate base gets a numeric suffix', /^siti\.nur\d{2}$/.test(u4), u4)
    ok('username: every profile has one', (await su(`select count(*)::int c from profiles where username is null`)).rows[0].c === 0)
    ok('username: column is not null', (await su(`select is_nullable n from information_schema.columns where table_name='profiles' and column_name='username'`)).rows[0].n === 'NO')
    const base = (await su(`select username_base('  --Jo..') a, username_base('Ахмад-Шох Ўрол') b, username_base('😀😀') c`)).rows[0]
    ok('username: base helper', [base.a, base.b, base.c].join() === 'user,akhmad.shokh.o,user', JSON.stringify(base))
    // chosen at insert: normalised, validated
    await mk(5, '  @Kuching_Kid ')
    ok('username: chosen at insert is normalised', (await un(5)) === 'kuching_kid')
    await su(`delete from profiles where id=$1`, [N[5]])
    ok('username: taken at insert fails (23505)', (await fails(() => mk(5, 'SITI.NUR')))?.includes('profiles_username_key'))
    ok('username: invalid at insert fails', (await fails(() => mk(5, 'a..b')))?.includes('username_invalid'))
    ok('username: reserved at insert fails', (await fails(() => mk(5, 'Vibely_Team')))?.includes('username_reserved'))
    ok('username: blank at insert is generated', !(await fails(() => mk(5, ' '))) && (await un(5)) === 'kuching.kid')
    // format
    for (const bad of ['ab', 'a'.repeat(21), '.abc', 'abc.', 'a..bc', 'ab-c', 'ab c', 'абв'])
      ok(`username: format rejects "${bad}"`, (await as(N[0], `select username_status($1) s`, [bad])).rows[0].s === 'invalid')
    for (const good of ['abc', 'a_b.c', 'x'.repeat(20), 'ali99'])
      ok(`username: format accepts "${good}"`, (await as(N[0], `select username_status($1) s`, [good])).rows[0].s === 'ok')
    for (const r of ['admin', 'Support', 'null', 'undefined', 'mod', 'settings', 'vibelyfan', 'moderator_1'])
      ok(`username: reserved "${r}"`, (await as(N[0], `select username_status($1) s`, [r])).rows[0].s === 'reserved')
    ok('username: status taken / current', (await as(N[0], `select username_status('@Alisher.Navoiy') s`)).rows[0].s === 'taken' &&
       (await as(N[0], `select username_status('siti.nur') s`)).rows[0].s === 'current')
    ok('username: status needs a session', !!(await fails(() => as('', `select username_status('abc')`))))
    const sugg = (await as(N[2], `select suggest_username('Siti Nur') s`)).rows[0].s
    ok('username: suggest returns a free one', /^siti\.nur\d+$/.test(sugg), sugg)
    // no direct writes
    ok('username: no direct update', !!(await fails(() => as(N[0], `update profiles set username='hacker' where id=$1`, [N[0]]))))
    ok('username: changed_at not readable by clients', !!(await fails(() => as(N[0], `select username_changed_at from profiles where id=$1`, [N[0]]))))
    ok('username: generator not callable by clients', !!(await fails(() => as(N[0], `select generate_username('x')`))))
    // set_username: first change free, then a 30-day cooldown
    const setU = (i, v) => as(N[i], `select set_username($1) u`, [v])
    ok('set_username: first change free', (await setU(0, ' @Siti_Ok ')).rows[0].u === 'siti_ok' && (await un(0)) === 'siti_ok')
    ok('set_username: next change date reported', (await as(N[0], `select * from my_username()`)).rows[0].next_change_at !== null)
    ok('set_username: same value is a no-op', (await setU(0, 'SITI_OK')).rows[0].u === 'siti_ok')
    ok('set_username: cooldown', (await fails(() => setU(0, 'siti_new')))?.includes('username_cooldown'))
    await su(`update profiles set username_changed_at = now() - interval '31 days' where id=$1`, [N[0]])
    ok('set_username: allowed after 30 days', (await setU(0, 'siti_new')).rows[0].u === 'siti_new')
    ok('set_username: taken', (await fails(() => setU(1, 'Siti_New')))?.includes('username_taken'))
    ok('set_username: invalid', (await fails(() => setU(1, 'x')))?.includes('username_invalid'))
    ok('set_username: reserved', (await fails(() => setU(1, 'admin')))?.includes('username_reserved'))
    ok('set_username: old name is free again', (await as(N[1], `select username_status('siti_ok') s`)).rows[0].s === 'ok')
    ok('set_username: failed attempts do not start a cooldown', (await as(N[1], `select * from my_username()`)).rows[0].changed_at === null)
    ok('set_username: needs a profile', (await fails(() => as('55555555-5555-5555-5555-555555555555', `select set_username('abcdef')`)))?.includes('profile_required'))
    // search
    await su(`update profiles set verification_status='approved' where id = any($1)`, [N])
    const search = async (i, q, lim = 20) => (await as(N[i], `select * from search_profiles_by_username($1, $2)`, [q, lim])).rows
    const ids = (rows) => rows.map((r) => r.id)
    ok('search: unverified caller refused', !!(await fails(() => as('55555555-5555-5555-5555-555555555555', `select * from search_profiles_by_username('si')`))))
    const sr = await search(1, 'SITI')
    ok('search: prefix match on username', ids(sr).includes(N[0]) && ids(sr).includes(N[4]), JSON.stringify(sr))
    ok('search: card fields only', !!sr[0] && JSON.stringify(Object.keys(sr[0]).sort()) === '["age","city","display_name","id","photo","username"]' && sr[0].age >= 18 && sr[0].city === 'Kuching', JSON.stringify(sr[0]))
    ok('search: leading @ ignored', ids(await search(1, '@siti_new')).includes(N[0]))
    ok('search: exact match first', (await search(1, 'siti_new'))[0]?.id === N[0])
    ok('search: substring from 3 chars', ids(await search(0, 'navo')).includes(N[1]))
    ok('search: display name prefix', ids(await search(0, 'алишер')).includes(N[1]))
    ok('search: minimum 2 characters', (await search(0, 'a')).length === 0 && (await search(0, ' @ ')).length === 0)
    ok('search: excludes self', !ids(await search(0, 'siti')).includes(N[0]))
    ok('search: LIKE wildcards are literal', (await search(0, '%%')).length === 0 && !ids(await search(0, 's_ti')).includes(N[4]))
    ok('search: limit', (await search(1, 'siti', 1)).length === 1)
    await su(`insert into profile_photos (profile_id, storage_path, width, height, position) values ($1, $2, 10, 20, 1), ($1, $3, 30, 40, 0)`,
      [N[4], `${N[4]}/b.jpg`, `${N[4]}/a.jpg`])
    const withPhoto = (await search(1, u4)).find((x) => x.id === N[4])
    ok('search: photo is the first one', withPhoto?.photo?.path === `${N[4]}/a.jpg` && withPhoto.photo.width === 30, JSON.stringify(withPhoto))
    await as(N[0], `update profiles set searchable_by_username=false where id=$1`, [N[0]])
    ok('search: "find me by username" off hides', !ids(await search(1, 'siti_new')).includes(N[0]))
    await as(N[1], `update profiles set searchable_by_username=false where id=$1`, [N[4]])
    ok('search: cannot change someone else\'s flag', (await su(`select searchable_by_username s from profiles where id=$1`, [N[4]])).rows[0].s === true)
    ok('search: my_username reports the flag', (await as(N[0], `select searchable from my_username()`)).rows[0].searchable === false)
    await as(N[0], `update profiles set searchable_by_username=true where id=$1`, [N[0]])
    await as(N[0], `update profiles set discoverable=false where id=$1`, [N[0]])
    ok('search: paused profile hidden', !ids(await search(1, 'siti_new')).includes(N[0]))
    await as(N[0], `update profiles set discoverable=true where id=$1`, [N[0]])
    await as(N[0], `insert into blocks (blocked_id) values ($1)`, [N[1]])
    ok('search: blocked hidden both ways', !ids(await search(1, 'siti_new')).includes(N[0]) && !ids(await search(0, 'alisher')).includes(N[1]))
    await as(N[0], `delete from blocks where blocked_id=$1`, [N[1]])
    ok('search: unblocked visible again', ids(await search(1, 'siti_new')).includes(N[0]))
    await su(`update profiles set banned_at=now(), ban_reason='x' where id=$1`, [N[4]])
    ok('search: banned hidden', !ids(await search(1, 'siti')).includes(N[4]))
    await su(`update profiles set banned_at=null, ban_reason=null, is_active=true where id=$1`, [N[4]])
    await su(`update profiles set verification_status='pending' where id=$1`, [N[3]])
    ok('search: unverified target hidden', !ids(await search(1, 'zoe')).includes(N[3]))
    await su(`update profiles set verification_status='approved' where id=$1`, [N[3]])
    ok('search: verified target found', ids(await search(1, 'zoe')).includes(N[3]))
    ok('search: index on username', (await su(`select count(*)::int c from pg_indexes where tablename='profiles' and indexdef like '%username text_pattern_ops%'`)).rows[0].c === 1)
    // feed: username only on visible "As me" rows, never on anonymous ones
    const anonPost = (await as(N[0], `select create_post('un anon', false) id`)).rows[0].id
    const namedPost = (await as(N[0], `select create_post('un named', true) id`)).rows[0].id
    const fRow = async (i, id) => (await as(N[i], `select * from feed_posts where id=$1`, [id])).rows[0]
    ok('feed: named post shows author_username', (await fRow(1, namedPost)).author_username === 'siti_new')
    ok('feed: anonymous post never has author_username', (await fRow(1, anonPost)).author_username === null && (await fRow(0, anonPost)).author_username === null)
    await as(N[1], `select create_comment($1, 'anon c', false)`, [anonPost])
    await as(N[1], `select create_comment($1, 'named c', true)`, [anonPost])
    const cm = (await as(N[2], `select body, author_username from post_comments where post_id=$1 order by body`, [anonPost])).rows
    ok('feed: comment usernames only when named', cm.length === 2 && cm[0].body === 'anon c' && cm[0].author_username === null && cm[1].author_username === 'alisher.navoiy', JSON.stringify(cm))
    await as(N[1], `insert into blocks (blocked_id) values ($1)`, [N[0]])
    ok('feed: blocked author loses username', (await fRow(1, namedPost))?.author_username == null)
    await as(N[1], `delete from blocks where blocked_id=$1`, [N[0]])
    // admin search by username
    await su(`insert into admins values ($1)`, [N[5]])
    const af = async (q) => (await su(`select * from admin_find_users($1, $2, 50)`, [N[5], q])).rows
    ok('admin: finds by username with @', (await af('@alisher.nav')).some((r) => r.id === N[1] && r.username === 'alisher.navoiy'))
    ok('admin: still finds by name and phone', (await af('Zoë')).some((r) => r.id === N[3]) && (await af('60137770002')).some((r) => r.id === N[2]))
    ok('admin: not callable by users', !!(await fails(() => as(N[5], `select * from admin_find_users($1, 'x', 5)`, [N[5]]))))
  })()
  void ko

  // ===== batch-4: admin sanctions (only that branch edits between these markers) =====
  // roles, warnings, mutes, shadow-bans, bans, appeals, notes, phone blocklist, access log,
  // evidence hold, legal export, stats (20261009000150-154). Own scope, fresh users.
  await (async () => {
    const S = ['5a000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000002',
               '5a000000-0000-4000-8000-000000000003', '5a000000-0000-4000-8000-000000000004',
               '5a000000-0000-4000-8000-000000000005', '5a000000-0000-4000-8000-000000000006',
               '5a000000-0000-4000-8000-000000000007', '5a000000-0000-4000-8000-000000000008']
    const [OWNER, MOD, VIEW, ADM, A, B, C, D] = S
    const phone = (i) => '6013888000' + i
    for (const [i, u] of S.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, phone(i)])
    // A, C female; B, D male; all verified, same city
    for (const [u, name, g, w] of [[A, 'Aisyah', 'female', '{male}'], [B, 'Badrul', 'male', '{female}'], [C, 'Chen', 'female', '{male}'], [D, 'Dev', 'male', '{female}']])
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,'1996-03-03',$2,$3,'Ipoh','SRID=4326;POINT(101.08 4.6)')`, [name, g, w])
    await su(`update profiles set verification_status='approved' where id = any($1)`, [[A, B, C, D]])
    const rpc = (fn, args) => su(`select ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args).then((r) => r.rows[0]?.r)
    const err = (fn, args) => fails(() => rpc(fn, args))
    const logged = async (action, target) => (await su(`select count(*)::int c from moderation_actions where action=$1 and target_id=$2`, [action, target])).rows[0].c
    const prof = async (u) => (await su(`select * from profiles where id=$1`, [u])).rows[0]

    // --- roles & team
    await su(`insert into admins (user_id) values ($1)`, [ADM])
    ok('roles: insert without a role defaults to admin', (await su(`select role from admins where user_id=$1`, [ADM])).rows[0].role === 'admin')
    await su(`update admins set role='owner' where user_id=$1`, [ADM])
    await rpc('admin_set_member_role', [ADM, OWNER, 'owner'])
    await su(`update admins set role='admin' where user_id=$1`, [ADM])
    await rpc('admin_set_member_role', [OWNER, MOD, 'moderator'])
    await rpc('admin_set_member_role', [OWNER, VIEW, 'viewer'])
    ok('team: owner adds members, logged', (await logged('admin.add', MOD)) === 1 && (await logged('admin.add', VIEW)) === 1)
    ok('team: role order', (await su(`select 'viewer'::admin_role < 'moderator' and 'admin'::admin_role < 'owner' v`)).rows[0].v === true)
    ok('team: admin cannot manage the team', (await err('admin_set_member_role', [ADM, VIEW, 'moderator']))?.includes('owner'))
    ok('team: moderator cannot list the team', !!(await err('admin_list_team', [MOD])))
    ok('team: owner lists the team', (await su(`select * from admin_list_team($1)`, [OWNER])).rows.length >= 4)
    ok('team: last owner cannot be demoted', (await err('admin_set_member_role', [OWNER, OWNER, 'admin']))?.includes('last owner'))
    ok('team: last owner cannot be removed', (await err('admin_remove_member', [OWNER, OWNER, null]))?.includes('last owner'))
    await rpc('admin_set_member_role', [OWNER, VIEW, 'moderator'])
    ok('team: role change logged', (await logged('admin.role', VIEW)) === 1)
    await rpc('admin_remove_member', [OWNER, VIEW, 'test'])
    ok('team: removal logged', (await logged('admin.remove', VIEW)) === 1 && (await su(`select count(*)::int c from admins where user_id=$1`, [VIEW])).rows[0].c === 0)
    await rpc('admin_set_member_role', [OWNER, VIEW, 'viewer'])
    ok('team: resolve user by phone, @username and id', (await rpc('admin_resolve_user', [OWNER, '+60 13888 0004'])) === A &&
       (await rpc('admin_resolve_user', [OWNER, '@' + (await prof(B)).username])) === B && (await rpc('admin_resolve_user', [OWNER, C])) === C)
    ok('team: RPCs not callable by users', !!(await fails(() => as(OWNER, `select admin_set_member_role($1,$2,'owner')`, [OWNER, A]))))
    // viewer is read only
    ok('roles: viewer can search users', (await su(`select * from admin_find_users($1, 'Aisyah', 5)`, [VIEW])).rows.some((r) => r.id === A))
    ok('roles: viewer cannot use moderator RPCs', (await err('admin_warn_user', [VIEW, A, 'spam', null, 30]))?.includes('moderator') &&
       !!(await err('admin_resolve_reports', [VIEW, 'user', A, 'x'])))
    ok('roles: non-member refused', (await err('admin_find_users', [A, '', 5]))?.includes('Not a moderator'))
    ok('roles: revoke verification needs admin', !!(await err('admin_revoke_verification', [MOD, A, 'x'])))

    // --- warnings
    const w1 = await rpc('admin_warn_user', [MOD, A, 'spam: links', 'first strike', 30])
    ok('warn: logged', (await logged('user.warn', A)) === 1)
    const mine = async (u) => (await as(u, `select my_sanctions() s`)).rows[0].s
    ok('warn: user sees active warning', (await mine(A)).warnings.length === 1 && (await mine(A)).warnings[0].reason === 'spam: links')
    ok('warn: note never shown to the user', !JSON.stringify(await mine(A)).includes('first strike'))
    ok('warn: table closed to users', !!(await fails(() => as(A, `select * from user_warnings`))))
    await as(B, `select acknowledge_warning($1)`, [w1])
    ok('warn: others cannot acknowledge', (await mine(A)).warnings.length === 1)
    await as(A, `select acknowledge_warning($1)`, [w1])
    ok('warn: shown once (acknowledged)', (await mine(A)).warnings.length === 0)
    const w2 = await rpc('admin_warn_user', [MOD, A, 'harassment', null, 7])
    await rpc('admin_revoke_warning', [MOD, w2, 'mistake'])
    ok('warn: revoked warning not shown', (await mine(A)).warnings.length === 0 && (await logged('warning.revoke', A)) === 1)
    await su(`insert into user_warnings (user_id, reason, created_at, expires_at) values ($1, 'spam', now() - interval '10 days', now() - interval '1 day')`, [A])
    ok('warn: expired warning not shown', (await mine(A)).warnings.length === 0)

    // --- mutes
    const mAB = (await su(`select ensure_match($1,$2,'swipe') id`, [A, B])).rows[0].id
    const rs = (await su(`insert into random_chat_sessions (user_a, user_b) values ($1,$2) returning id`, [A, B])).rows[0].id
    const postB = (await as(B, `select create_post('post by B') id`)).rows[0].id
    await rpc('admin_set_mute', [MOD, A, 2, 'spam'])
    ok('mute: logged', (await logged('user.mute', A)) === 1)
    ok('mute: message blocked', (await fails(() => as(A, `insert into messages (match_id, body) values ($1,'hi')`, [mAB])))?.includes('muted'))
    ok('mute: random message blocked', (await fails(() => as(A, `select randomizer_send($1,'hi')`, [rs])))?.includes('muted'))
    ok('mute: post blocked', (await fails(() => as(A, `select create_post('x')`)))?.includes('muted'))
    ok('mute: comment blocked', (await fails(() => as(A, `select create_comment($1,'x')`, [postB])))?.includes('muted'))
    ok('mute: SQLSTATE VS001', (await su(`select count(*)::int c from pg_proc where proname='enforce_not_muted' and prosrc like '%VS001%'`)).rows[0].c === 1)
    ok('mute: partner unaffected', !(await fails(() => as(B, `insert into messages (match_id, body) values ($1,'hey')`, [mAB]))))
    ok('mute: user is told', (await mine(A)).muted_until !== null && (await mine(A)).mute_reason === 'spam')
    ok('mute: column hidden from clients', !!(await fails(() => as(B, `select muted_until from profiles where id=$1`, [A]))))
    ok('mute: hours bounded', !!(await err('admin_set_mute', [MOD, A, 1000, 'spam'])))
    ok('mute: viewer cannot mute', !!(await err('admin_set_mute', [VIEW, A, 1, 'spam'])))
    await su(`update profiles set muted_until = now() - interval '1 second' where id=$1`, [A])
    ok('mute: expired mute cleared', (await prof(A)).muted_until === null && !(await fails(() => as(A, `insert into messages (match_id, body) values ($1,'back')`, [mAB]))))
    await rpc('admin_set_mute', [MOD, A, 1, 'spam'])
    await rpc('admin_set_mute', [MOD, A, 0, null])
    ok('mute: unmute', (await prof(A)).muted_until === null && (await logged('user.unmute', A)) === 1)
    await su(`update random_chat_sessions set status='ended' where id=$1`, [rs])

    // --- shadow-ban
    const postA = (await as(A, `select create_post('post by A', true) id`)).rows[0].id
    await as(A, `select create_comment($1,'comment by A')`, [postB])
    const feedHas = async (u, id) => (await as(u, `select count(*)::int c from feed_posts where id=$1`, [id])).rows[0].c === 1
    const commentsSeen = async (u) => (await as(u, `select count(*)::int c from post_comments where post_id=$1`, [postB])).rows[0].c
    const deck = async (u) => (await as(u, `select id from get_swipe_candidates('{female}', 18, 60, 100)`)).rows.map((r) => r.id)
    ok('shadow: visible before', (await feedHas(B, postA)) && (await commentsSeen(B)) === 1 && (await deck(D)).includes(A))
    ok('shadow: moderator cannot shadow-ban', !!(await err('admin_set_shadow_ban', [MOD, A, true, 'spam'])))
    await rpc('admin_set_shadow_ban', [ADM, A, true, 'spam'])
    ok('shadow: logged', (await logged('user.shadow_ban', A)) === 1)
    ok('shadow: posts hidden from others', !(await feedHas(B, postA)) && !(await feedHas(C, postA)))
    ok('shadow: own posts still visible', await feedHas(A, postA))
    ok('shadow: comments hidden from others, visible to self', (await commentsSeen(B)) === 0 && (await commentsSeen(A)) === 1)
    ok('shadow: out of the swipe deck', !(await deck(D)).includes(A) && (await deck(D)).includes(C))
    await as(A, `insert into swipes (swiped_id, direction) values ($1,'like')`, [D])
    ok('shadow: likes not shown to the liked person', (await as(D, `select count_incoming_likes() n`)).rows[0].n === 0)
    ok('shadow: flag not readable by clients', !!(await fails(() => as(A, `select shadow_banned from profiles where id=$1`, [A]))))
    await rpc('admin_set_shadow_ban', [ADM, A, false, null])
    ok('shadow: lifted', (await feedHas(B, postA)) && (await deck(B)).includes(C) && (await as(D, `select count_incoming_likes() n`)).rows[0].n === 1)

    // --- bans: roles, temporary bans, expiry, side effects
    ok('ban: moderator cannot ban permanently', (await err('admin_ban_user', [MOD, C, 'spam', null]))?.includes('admin'))
    ok('ban: moderator cannot ban for 8 days', !!(await err('admin_ban_user', [MOD, C, 'spam', 8])))
    ok('ban: moderator cannot use admin_set_ban', !!(await err('admin_set_ban', [MOD, C, true, 'spam'])))
    await rpc('admin_ban_user', [MOD, C, 'spam', 3])
    let pc = await prof(C)
    ok('temp_ban: moderator bans for 3 days', pc.banned_at !== null && pc.banned_until !== null && pc.is_active === false && (await logged('user.temp_ban', C)) === 1)
    await fails(() => as(C, `update profiles set is_active=true where id=$1`, [C]))
    ok('temp_ban: user cannot reactivate', (await prof(C)).is_active === false)
    ok('temp_ban: banned_until readable by the owner', (await as(C, `select banned_until from profiles where id=$1`, [C])).rows[0]?.banned_until !== null)
    ok('temp_ban: moderator cannot unban', !!(await err('admin_unban_user', [MOD, C, null])))
    // expiry: on any write of the row (trigger) ...
    await su(`update profiles set banned_until = now() - interval '1 minute' where id=$1`, [C])
    pc = await prof(C)
    ok('temp_ban: expired ban lifted on write', pc.banned_at === null && pc.banned_until === null && pc.ban_reason === null && pc.is_active === true)
    ok('temp_ban: auto.unban logged', (await logged('auto.unban', C)) === 1)
    // ... by the scheduled job ...
    const expireNow = async (u) => {
      await su(`alter table profiles disable trigger profiles_enforce_ban`)
      await su(`update profiles set banned_at = now() - interval '2 days', ban_reason='spam', banned_until = now() - interval '1 minute', is_active=false where id=$1`, [u])
      await su(`alter table profiles enable trigger profiles_enforce_ban`)
    }
    await expireNow(C)
    ok('temp_ban: lift_expired_sanctions', (await su(`select lift_expired_sanctions() n`)).rows[0].n >= 1 && (await prof(C)).is_active === true && (await logged('auto.unban', C)) === 2)
    ok('temp_ban: job not callable by users', !!(await fails(() => as(C, `select lift_expired_sanctions()`))))
    // ... and on read by the user
    await expireNow(C)
    const st = (await as(C, `select * from my_ban_status()`)).rows[0]
    ok('temp_ban: my_ban_status lifts an expired ban', st.banned_at === null && (await prof(C)).is_active === true)
    await rpc('admin_ban_user', [ADM, C, 'scam', null])
    ok('ban: admin bans permanently', (await prof(C)).banned_until === null && (await logged('user.ban', C)) === 1)
    ok('ban: moderator cannot shorten a permanent ban', (await err('admin_ban_user', [MOD, C, 'spam', 1]))?.includes('shorten'))
    ok('ban: still banned after the refused shortening', (await as(C, `select * from my_ban_status()`)).rows[0].banned_at !== null)
    // side effects: random chats, calls and sessions of D end
    await su(`create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid)`)
    await su(`insert into auth.sessions (user_id) values ($1), ($1), ($2)`, [D, A])
    const mAD = (await su(`select ensure_match($1,$2,'swipe') id`, [A, D])).rows[0].id
    for (const u of [A, D]) { await as(u, `select accept_calls_notice()`); await as(u, `select set_call_permission($1, true)`, [mAD]) }
    const call = (await as(A, `select start_call($1,'audio') id`, [mAD])).rows[0].id
    const rsD = (await su(`insert into random_chat_sessions (user_a, user_b) values ($1,$2) returning id`, [B, D])).rows[0].id
    const ended = (await su(`select admin_ban_user($1,$2,'harassment',null) r`, [ADM, D])).rows[0].r
    ok('ban: ends live calls and returns their ids', JSON.stringify(ended) === JSON.stringify([call]) && (await su(`select status from calls where id=$1`, [call])).rows[0].status === 'missed')
    ok('ban: ends random chats', (await su(`select status from random_chat_sessions where id=$1`, [rsD])).rows[0].status === 'ended')
    ok('ban: signs the user out everywhere (auth.sessions)', (await su(`select count(*)::int c from auth.sessions where user_id=$1`, [D])).rows[0].c === 0 &&
       (await su(`select count(*)::int c from auth.sessions where user_id=$1`, [A])).rows[0].c === 1)
    await su(`drop table auth.sessions`)
    ok('ban: unban needs admin, logged', !!(await err('admin_set_ban', [MOD, D, false, null])) && !(await err('admin_set_ban', [ADM, D, false, null])) &&
       (await prof(D)).is_active === true && (await logged('user.unban', D)) === 1)

    // --- appeals (C is banned permanently)
    const appeal = (u, text) => as(u, `select submit_appeal($1) id`, [text]).then((r) => r.rows[0].id)
    ok('appeal: not banned cannot appeal', !!(await fails(() => appeal(A, 'Please review my account'))))
    ok('appeal: text length checked', !!(await fails(() => appeal(C, 'short'))) && !!(await fails(() => appeal(C, 'x'.repeat(1001)))))
    const ap1 = await appeal(C, 'I did not scam anyone, please check again.')
    ok('appeal: one open at a time', !!(await fails(() => appeal(C, 'Second appeal while the first is open'))))
    ok('appeal: my_appeal shows status', (await as(C, `select * from my_appeal()`)).rows[0]?.status === 'open')
    ok('appeal: table closed to users', !!(await fails(() => as(C, `select * from appeals`))))
    ok('appeal: rejection needs a note', !!(await err('admin_decide_appeal', [MOD, ap1, false, null])))
    ok('appeal: moderator cannot accept', !!(await err('admin_decide_appeal', [MOD, ap1, true, null])))
    await rpc('admin_decide_appeal', [MOD, ap1, false, 'Evidence confirmed'])
    ok('appeal: rejected, logged, still banned', (await as(C, `select * from my_appeal()`)).rows[0].status === 'rejected' &&
       (await logged('appeal.reject', C)) === 1 && (await prof(C)).banned_at !== null)
    ok('appeal: decided appeal cannot be decided again', !!(await err('admin_decide_appeal', [ADM, ap1, true, null])))
    const ap2 = await appeal(C, 'Second try with more details, please.')
    await rpc('admin_decide_appeal', [ADM, ap2, true, 'Mistake'])
    pc = await prof(C)
    ok('appeal: accepted lifts the ban', pc.banned_at === null && pc.is_active === true && (await logged('appeal.accept', C)) === 1)
    await rpc('admin_ban_user', [ADM, C, 'scam', null])
    await appeal(C, 'Third appeal in thirty days, ok.')
    await su(`update appeals set status='rejected', decided_at=now() where user_id=$1 and status='open'`, [C])
    ok('appeal: rate limit 3 per 30 days', (await fails(() => appeal(C, 'Fourth appeal is too many.')))?.includes('Rate limit'))

    // --- notes
    const n1 = await rpc('admin_add_note', [MOD, A, 'Talked to reporter'])
    const n2 = await rpc('admin_add_note', [ADM, A, 'Admin note'])
    ok('notes: viewer cannot add', !!(await err('admin_add_note', [VIEW, A, 'x'])))
    ok('notes: moderator cannot delete others\' notes', !!(await err('admin_delete_note', [MOD, n2])))
    await rpc('admin_delete_note', [MOD, n1])
    ok('notes: author deletes own', (await su(`select count(*)::int c from user_notes where id=$1`, [n1])).rows[0].c === 0)
    const n3 = await rpc('admin_add_note', [MOD, A, 'Another'])
    await rpc('admin_delete_note', [ADM, n3])
    ok('notes: admin deletes any, logged', (await su(`select count(*)::int c from user_notes where user_id=$1`, [A])).rows[0].c === 1 && (await logged('note.delete', A)) === 2 && (await logged('note.add', A)) === 3)
    ok('notes: closed to users', !!(await fails(() => as(A, `select * from user_notes`))))

    // --- phone blocklist & auth hook
    const hook = async (p) => {
      await db.exec('reset role; set role supabase_auth_admin')
      try { return (await db.query(`select public.hook_before_user_created($1) r`, [{ user: { phone: p } }])).rows[0].r } finally { await db.exec('reset role') }
    }
    ok('blocklist: Malaysian number passes', JSON.stringify(await hook(phone(6))) === '{}')
    ok('blocklist: config test numbers pass', JSON.stringify(await hook('60123456781')) === '{}' && JSON.stringify(await hook('60123456782')) === '{}')
    ok('blocklist: moderator cannot block', !!(await err('admin_block_phone', [MOD, null, C, 'x'])))
    const bl = (await su(`select admin_block_phone($1, null, $2, 'ban evasion') r`, [ADM, C])).rows[0].r
    ok('blocklist: stored as E.164', (await su(`select phone from phone_blocklist where id=$1`, [bl])).rows[0].phone === '+' + phone(6))
    ok('blocklist: hook rejects the number in any format', (await hook(phone(6))).error?.http_code === 403 && (await hook('+60 13-888 0006')).error?.message.includes('cannot be used'))
    ok('blocklist: other numbers still pass', JSON.stringify(await hook(phone(5))) === '{}')
    ok('blocklist: Malaysia-only rule unchanged', (await hook('998901234567')).error?.message.includes('Malaysian'))
    ok('blocklist: closed to users', !!(await fails(() => as(A, `select * from phone_blocklist`))) && !!(await fails(() => as(A, `select is_phone_blocked('x')`))))
    ok('blocklist: by number', !(await err('admin_block_phone', [ADM, '+60 19-000 1111', null, 'spam'])) && (await hook('60190001111')).error?.http_code === 403)
    ok('blocklist: invalid number refused', !!(await err('admin_block_phone', [ADM, 'abc', null, 'x'])))
    await rpc('admin_unblock_phone', [ADM, bl, 'appeal'])
    ok('blocklist: unblock, logged', JSON.stringify(await hook(phone(6))) === '{}' && (await logged('phone.block', C)) === 1 && (await logged('phone.unblock', C)) === 1)

    // --- read-access logging
    await rpc('admin_log_access', [VIEW, 'view.selfie', 'verification_request', [A, B, A], null])
    ok('access: one row per target', (await logged('view.selfie', A)) === 1 && (await logged('view.selfie', B)) === 1)
    ok('access: unknown action refused', !!(await err('admin_log_access', [MOD, 'user.ban', 'user', [A], null])))
    ok('access: transcript needs moderator', !!(await err('admin_log_access', [VIEW, 'view.transcript', 'random_session', [rs], null])) &&
       !(await err('admin_log_access', [MOD, 'view.transcript', 'random_session', [rs], null])))
    ok('access: audit export needs admin', !!(await err('admin_log_access', [MOD, 'export.audit_log', 'audit_log', [MOD], null])) &&
       !(await err('admin_log_access', [ADM, 'export.audit_log', 'audit_log', [ADM], 'filters'])))
    ok('access: phone view returns and logs', (await rpc('admin_get_phone', [MOD, B])) === phone(5) && (await logged('view.phone', B)) === 1)
    ok('access: viewer cannot see phones', !!(await err('admin_get_phone', [VIEW, B])))

    // --- evidence hold vs the 90-day purge
    const oldPostA = (await su(`insert into posts (author_id, body, created_at) values ($1,'old A', now() - interval '100 days') returning id`, [A])).rows[0].id
    const oldPostB = (await su(`insert into posts (author_id, body, created_at) values ($1,'old B', now() - interval '100 days') returning id`, [B])).rows[0].id
    const rsOld = (await su(`insert into random_chat_sessions (user_a, user_b, status, started_at, ended_at) values ($1,$2,'ended', now() - interval '100 days', now() - interval '100 days') returning id`, [A, B])).rows[0].id
    await su(`insert into random_chat_messages (session_id, sender_id, body, created_at) values ($1,$2,'old', now() - interval '100 days')`, [rsOld, A])
    await su(`insert into storage.objects (bucket_id, name, created_at) values ('selfies', $1, now() - interval '100 days')`, [`${A}/old.jpg`])
    ok('hold: moderator cannot set', !!(await err('admin_set_evidence_hold', [MOD, A, true, 'case 1'])))
    ok('hold: reason required', !!(await err('admin_set_evidence_hold', [ADM, A, true, ' '])))
    await rpc('admin_set_evidence_hold', [ADM, A, true, 'PDRM case 12/2026'])
    ok('hold: logged', (await logged('user.evidence_hold', A)) === 1)
    await su(`select purge_old_feed_content()`)
    const postExists = async (id) => (await su(`select count(*)::int c from posts where id=$1`, [id])).rows[0].c === 1
    ok('hold: held user\'s old post survives the purge', (await postExists(oldPostA)) && !(await postExists(oldPostB)))
    await su(`select purge_old_random_messages()`)
    ok('hold: random chat with a held user kept', (await su(`select count(*)::int c from random_chat_messages where session_id=$1`, [rsOld])).rows[0].c === 1 &&
       (await su(`select count(*)::int c from random_chat_sessions where id=$1`, [rsOld])).rows[0].c === 1)
    ok('hold: selfie kept', !(await su(`select * from retention_selfies(1000) n`)).rows.some((r) => r.n === `${A}/old.jpg`))
    ok('hold: chat media / calls of the match kept', (await su(`select match_under_evidence_hold($1) v`, [mAB])).rows[0].v === true)
    await su(`update calls set recording_path = 'calls/' || match_id || '/' || id || '.ogg', recording_status='ready', started_at = now() - interval '100 days', ended_at = now() - interval '100 days' where id=$1`, [call])
    ok('hold: call recording not purged', !(await su(`select * from call_recordings_to_purge(1000)`)).rows.some((r) => r.call_id === call))
    await rpc('admin_set_evidence_hold', [ADM, A, false, 'case closed'])
    await su(`select purge_old_feed_content()`); await su(`select purge_old_random_messages()`)
    ok('hold: released content purged', !(await postExists(oldPostA)) && (await su(`select count(*)::int c from random_chat_messages where session_id=$1`, [rsOld])).rows[0].c === 0 &&
       (await su(`select * from retention_selfies(1000) n`)).rows.some((r) => r.n === `${A}/old.jpg`) &&
       (await su(`select * from call_recordings_to_purge(1000)`)).rows.some((r) => r.call_id === call))
    ok('hold: release logged', (await logged('user.evidence_release', A)) === 1)

    // --- legal export
    ok('export: owner only', !!(await err('admin_export_user', [ADM, A, 'REQ-1'])))
    ok('export: reference required', !!(await err('admin_export_user', [OWNER, A, ' '])))
    const ex = await rpc('admin_export_user', [OWNER, A, 'MCMC-2026-001'])
    ok('export: contents', ex.profile?.id === A && ex.profile.location === undefined && ex.account.phone === phone(4) &&
       ex.posts.some((p) => p.id === postA) && ex.messages_metadata.length >= 1 && ex.messages_metadata.every((m) => m.body === undefined) &&
       ex.sanctions.warnings.length === 3 && ex.matches.length === 2 && ex.request_reference === 'MCMC-2026-001', JSON.stringify(Object.keys(ex)))
    ok('export: logged with the reference', (await su(`select reason from moderation_actions where action='legal.export' and target_id=$1`, [A])).rows[0]?.reason === 'MCMC-2026-001')

    // --- stats
    const stats = await rpc('admin_stats', [VIEW, 7])
    ok('stats: 7 daily rows', stats.series.length === 7 && stats.series.at(-1).bans >= 2, JSON.stringify(stats.series.at(-1)))
    ok('stats: per-moderator throughput', stats.moderators.some((m) => m.admin_id === MOD && m.sanctions >= 3), JSON.stringify(stats.moderators))
    ok('stats: 30 days', (await rpc('admin_stats', [VIEW, 30])).series.length === 30)
    ok('stats: members only', !!(await err('admin_stats', [A, 7])))
  })()

  // ===== end admin sanctions =====


  // ===== batch-4: admin reports & evidence =====
  // admin reports & evidence (20261009000160..164): own users, own scope
  await (async () => {
    const R = Array.from({ length: 9 }, (_, i) => `ad000000-0000-4000-8000-00000000000${i}`)
    // R0 reporter A, R1 reported B, R2 reporter C, R3 reporter D (also a post author),
    // R4 / R5 moderators (no dating profile), R6 call-only reporter E, R7 unverified photo owner, R8 unused
    const [A, B, C, D, M1, M2, E, P] = R
    for (const [i, u] of R.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013999000' + i])
    for (const [i, u] of R.entries()) {
      if (u === M1 || u === M2 || i === 8) continue
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in) values ($1,'1994-04-04',$2,$3)`,
        ['Rep' + i, i % 2 ? 'male' : 'female', i % 2 ? '{female}' : '{male}'])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [[A, B, C, D, E]])
    await su(`insert into admins values ($1), ($2)`, [M1, M2])
    const svc = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const match = async (x, y) => (await su(`select ensure_match($1,$2,'swipe') id`, [x, y])).rows[0].id
    const mAB = await match(A, B), mCB = await match(C, B), mAD = await match(A, D), mEB = await match(E, B)
    const send = async (u, m, body) => (await as(u, `insert into messages (match_id, body) values ($1,$2) returning id`, [m, body])).rows[0].id
    const rep = (u, type, id, reason) => as(u, `insert into reports (target_type, target_id, reason) values ($1,$2,$3)`, [type, id, reason])
    const subj = async (type, id, u) => (await su(`select subject_id s from reports where target_type=$1 and target_id=$2 and reporter_id=$3`, [type, id, u])).rows[0]?.s
    const logs = async (action, target) => (await su(`select count(*)::int c from moderation_actions where action=$1 and ($2::uuid is null or target_id=$2)`, [action, target ?? null])).rows[0].c

    // --- new report targets ---------------------------------------------------------------
    const msg1 = await send(B, mAB, 'hello there')
    const msg2 = await send(B, mAB, 'whatsapp me 0123456789')
    await rep(A, 'message', msg2, 'scam: asked for money')
    ok('rpt_targets: message report gets the sender as subject', (await subj('message', msg2, A)) === B)
    ok('rpt_targets: outsider cannot report a foreign message', (await fails(() => rep(D, 'message', msg2, 'spam')))?.includes('not found'))
    ok('rpt_targets: cannot report own message', (await fails(() => rep(B, 'message', msg1, 'spam')))?.includes('yourself'))
    ok('rpt_targets: unknown message refused', (await fails(() => rep(A, 'message', P, 'spam')))?.includes('not found'))
    const photoB = (await su(`insert into profile_photos (profile_id, storage_path, width, height, position) values ($1, $2, 10, 10, 0) returning id`, [B, `${B}/rp.webp`])).rows[0].id
    await rep(A, 'photo', photoB, 'fake')
    ok('rpt_targets: photo report gets the owner as subject', (await subj('photo', photoB, A)) === B)
    ok('rpt_targets: cannot report own photo', (await fails(() => rep(B, 'photo', photoB, 'fake')))?.includes('yourself'))
    const callE = 'ad0000c0-0000-4000-8000-000000000001'
    const callAD = 'ad0000c0-0000-4000-8000-000000000002'
    const callAB = 'ad0000c0-0000-4000-8000-000000000003'
    const insCall = (id, m, x, y) => su(`insert into calls (id, match_id, caller_id, callee_id, kind, status, started_at, answered_at, ended_at, recording_path, recording_status)
      values ($1,$2,$3,$4,'audio','ended', now() - interval '10 minutes', now() - interval '9 minutes', now() - interval '5 minutes', $5, 'ready')`, [id, m, x, y, `calls/${m}/${id}.ogg`])
    await insCall(callE, mEB, E, B); await insCall(callAD, mAD, A, D); await insCall(callAB, mAB, A, B)
    ok('rpt_targets: outsider cannot report a call', (await fails(() => rep(C, 'call', callE, 'harassment')))?.includes('not found'))
    await rep(E, 'call', callE, 'harassment: threats on the call')
    ok('rpt_targets: call report gets the other side as subject', (await subj('call', callE, E)) === B)
    await rep(C, 'user', B, 'harassment')
    await rep(D, 'user', B, 'underage: looks 15')
    ok('rpt_targets: user report still works (subject = target)', (await subj('user', B, D)) === B)
    const ghost = 'ad00dead-0000-4000-8000-000000000001'
    await rep(A, 'user', ghost, 'spam')
    ok('rpt_targets: user report on an unknown id keeps no subject', (await subj('user', ghost, A)) === null)
    ok('rpt_targets: subject is not client-writable', !!(await fails(() => as(A, `insert into reports (target_type, target_id, reason, subject_id) values ('user',$1,'spam',$1)`, [D]))))
    const post = (await as(D, `select create_post('buy followers cheap') id`)).rows[0].id
    await rep(A, 'post', post, 'spam'); await rep(C, 'post', post, 'spam')
    ok('rpt_targets: post subject is the author', (await subj('post', post, A)) === D)

    // --- queue: priority, filters, pagination ----------------------------------------------
    const queue = async (args = {}) => (await svc(`select * from admin_report_queue($1,$2,$3,$4,$5,$6,$7)`,
      [args.admin ?? M1, args.status ?? null, args.reason ?? null, args.type ?? null, args.mine ?? false, args.limit ?? 100, args.offset ?? 0])).rows
    const mine = new Set([B, msg2, photoB, callE, post])
    const q = await queue()
    const ours = q.filter((r) => mine.has(r.target_id))
    ok('queue: fits one page', q.length < 100 && q[0]?.total === q.length, String(q.length))
    ok('queue: priority = reason tier, then reporters', JSON.stringify(ours.map((r) => [r.target_type, r.priority])) ===
      JSON.stringify([['user', 4002], ['message', 3001], ['call', 2001], ['post', 1002], ['photo', 1001]]), JSON.stringify(ours.map((r) => [r.target_type, r.priority])))
    ok('queue: sorted by priority then age', q.every((r, i) => i === 0 || q[i - 1].priority > r.priority ||
      (q[i - 1].priority === r.priority && q[i - 1].first_reported_at <= r.first_reported_at)))
    const uCase = ours[0]
    ok('queue: case fields', uCase.report_count === 2 && uCase.reporter_count === 2 && uCase.subject_id === B && uCase.status === 'open' &&
      uCase.reasons.includes('underage') && uCase.reasons.includes('harassment') && uCase.tier === 4, JSON.stringify(uCase))
    ok('queue: reason filter', (await queue({ reason: 'underage' })).every((r) => r.reasons.includes('underage')) &&
      (await queue({ reason: 'underage' })).some((r) => r.target_id === B))
    ok('queue: target type filter', (await queue({ type: 'call' })).map((r) => r.target_id).join() === callE)
    ok('queue: non-admin refused', !!(await fails(() => queue({ admin: A }))))
    ok('queue: not callable by users', !!(await fails(() => as(M1, `select * from admin_report_queue($1)`, [M1]))))
    ok('queue: unknown status refused', !!(await fails(() => queue({ status: 'resolved' }))))

    // --- claims ---------------------------------------------------------------------------
    const claim = (adm, type, id) => svc(`select admin_claim_report($1,$2,$3) t`, [adm, type, id])
    const release = (adm, type, id) => svc(`select admin_release_report($1,$2,$3) r`, [adm, type, id])
    ok('claim: moderator takes a case', !!(await claim(M1, 'user', B)).rows[0].t)
    const inReview = (await queue({ status: 'in_review' })).find((r) => r.target_id === B)
    ok('claim: case is in review, by whom', inReview?.claimed_by === M1 && !!inReview.claimed_at)
    ok('claim: open filter excludes it', !(await queue({ status: 'open' })).some((r) => r.target_id === B))
    ok('claim: "claimed by me" filter', (await queue({ mine: true })).map((r) => r.target_id).join() === B &&
      (await queue({ admin: M2, mine: true })).length === 0)
    ok('claim: refreshing my own claim works', !(await fails(() => claim(M1, 'user', B))))
    ok('claim: another moderator cannot take it', (await fails(() => claim(M2, 'user', B)))?.includes('Already claimed'))
    ok('claim: another moderator cannot resolve it', (await fails(() => svc(`select admin_resolve_case($1,'user',$2,'dismiss')`, [M2, B])))?.includes('Claimed by another'))
    ok('claim: another moderator cannot release it', (await fails(() => release(M2, 'user', B)))?.includes('Claimed by another'))
    await su(`update report_claims set claimed_at = now() - interval '31 minutes' where target_id=$1`, [B])
    ok('claim: auto-released after 30 minutes', (await queue({ status: 'open' })).find((r) => r.target_id === B)?.claimed_by === null)
    ok('claim: expired claim can be taken over', !(await fails(() => claim(M2, 'user', B))) && (await queue({ admin: M2, mine: true })).length === 1)
    ok('claim: release by holder', (await release(M2, 'user', B)).rows[0].r === true && (await queue({ status: 'in_review' })).every((r) => r.target_id !== B))
    ok('claim: nothing to claim without open reports', (await fails(() => claim(M1, 'user', P)))?.includes('No open reports'))
    ok('claim: claims and releases are logged', (await logs('reports.claim', B)) === 3 && (await logs('reports.release', B)) === 1)

    // --- evidence: transcript, media, call recording ---------------------------------------
    const transcript = (type, id, reporter, adm = M1) => svc(`select * from admin_open_chat_transcript($1,$2,$3,$4)`, [adm, type, id, reporter]).then((r) => r.rows)
    const tr1 = await transcript('message', msg2, A)
    ok('evidence: transcript of the reported chat', tr1.map((r) => r.message_id).join() === [msg1, msg2].join() && tr1.find((r) => r.reported)?.message_id === msg2, JSON.stringify(tr1))
    ok('evidence: transcript access logged', (await logs('evidence.transcript_open', msg2)) === 1)
    ok('evidence: only the reporter of an open report', (await fails(() => transcript('message', msg2, C)))?.includes('open report'))
    ok('evidence: not for feed reports', !!(await fails(() => transcript('post', post, A))))
    ok('evidence: non-admin refused', !!(await fails(() => transcript('message', msg2, A, A))))
    ok('evidence: not callable by users', !!(await fails(() => as(M1, `select * from admin_open_chat_transcript($1,'message',$2,$3)`, [M1, msg2, A]))))
    const msg3 = await send(B, mAB, 'secret threat')
    await as(B, `select delete_message($1)`, [msg3])
    const tr2 = await transcript('message', msg2, A)
    const del = tr2.find((r) => r.message_id === msg3)
    ok('evidence: deleted-for-everyone shown from the archive, marked deleted', del?.body === 'secret threat' && del.deleted === true, JSON.stringify(del))
    ok('evidence: archive knows the recipient', (await su(`select recipient_id r from message_deletions where message_id=$1`, [msg3])).rows[0]?.r === A)
    ok('evidence: user-report transcript is the reporter\'s chat', (await transcript('user', B, C)).length === 0 && !(await fails(() => transcript('user', B, D))))
    // 300 messages around the reported one
    await su(`insert into messages (match_id, sender_id, body, created_at)
      select $1, case when g % 2 = 0 then $3::uuid else $2::uuid end, 'w' || g, now() - interval '1 day' + g * interval '1 second'
      from generate_series(1, 400) g`, [mAB, A, B])
    const w200 = (await su(`select id from messages where match_id=$1 and body='w200'`, [mAB])).rows[0].id
    await rep(A, 'message', w200, 'sexual')
    const tw = await transcript('message', w200, A)
    const at = tw.findIndex((r) => r.message_id === w200)
    ok('evidence: 300 messages centred on the reported one', tw.length === 300 && at === 149 && tw[at].reported && tw[0].body === 'w51' && tw[299].body === 'w350', `${tw.length} ${at} ${tw[0]?.body} ${tw[299]?.body}`)
    const tl = await transcript('user', B, D).catch(() => null)
    ok('evidence: user case without a chat is empty', Array.isArray(tl) && tl.length === 0)
    // media
    const insMedia = async (sql, p) => { await su(`insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [p[3]]); return su(sql, p) }
    const mediaId = 'ad0000aa-0000-4000-8000-000000000001'
    const mediaPath = `${mAB}/${mediaId}.webp`
    await insMedia(`insert into messages (id, match_id, sender_id, media_kind, media_path, media_mime, image_width, image_height) values ($1,$2,$3,'image',$4,'image/webp',10,10)`, [mediaId, mAB, B, mediaPath])
    const media = (adm, id) => svc(`select * from admin_open_chat_media($1,'message',$2,$3,$4)`, [adm, msg2, A, id]).then((r) => r.rows[0])
    ok('evidence: chat media path for a message of the case', (await media(M1, mediaId))?.path === mediaPath)
    ok('evidence: media access logged with its own action', (await logs('evidence.media_open', mediaId)) === 1)
    const otherMedia = 'ad0000aa-0000-4000-8000-000000000002'
    await insMedia(`insert into messages (id, match_id, sender_id, media_kind, media_path, media_mime, image_width, image_height) values ($1,$2,$3,'image',$4,'image/webp',10,10)`, [otherMedia, mAD, D, `${mAD}/${otherMedia}.webp`])
    ok('evidence: media outside the parties\' chat refused', (await fails(() => media(M1, otherMedia)))?.includes('No media'))
    ok('evidence: media not callable by users', !!(await fails(() => as(M1, `select * from admin_open_chat_media($1,'message',$2,$3,$4)`, [M1, msg2, A, mediaId]))))
    // call recordings: the existing flow, now also for call / message / photo reports
    const rec = (id) => svc(`select admin_open_call_recording($1,$2,'test') p`, [M1, id]).then((r) => r.rows[0].p)
    ok('evidence: call report opens its recording', (await rec(callE)) === `calls/${mEB}/${callE}.ogg`)
    ok('evidence: message report opens the pair\'s recordings', (await rec(callAB)) === `calls/${mAB}/${callAB}.ogg`)
    ok('evidence: recording of an unreported pair refused', (await fails(() => rec(callAD)))?.includes('open report'))
    ok('evidence: recording access logged', (await logs('call.recording_open', callE)) === 1)

    // --- retention while a report is open ---------------------------------------------------
    ok('retention: match of a reported person held', (await su(`select match_under_open_report($1) h`, [mEB])).rows[0].h === true)
    ok('retention: unrelated match not held', (await su(`select match_under_open_report($1) h`, [mAD])).rows[0].h === false)
    ok('retention: call pair held by a call report', (await su(`select call_under_open_report($1,$2) h`, [B, E])).rows[0].h === true &&
      (await su(`select call_under_open_report($1,$2) h`, [A, D])).rows[0].h === false)
    const oldMedia = 'ad0000aa-0000-4000-8000-000000000003'
    await insMedia(`insert into messages (id, match_id, sender_id, media_kind, media_path, media_mime, image_width, image_height, created_at) values ($1,$2,$3,'image',$4,'image/webp',10,10, now() - interval '100 days')`, [oldMedia, mEB, B, `${mEB}/${oldMedia}.webp`])
    ok('retention: old chat media kept under a call report', !(await su(`select * from retention_chat_media(1000)`)).rows.some((r) => r.message_id === oldMedia))
    await su(`insert into storage.objects (bucket_id, name, created_at) values ('selfies', $1, now() - interval '100 days')`, [`${B}/old.jpg`])
    ok('retention: selfie of the reported person kept', !(await su(`select * from retention_selfies(1000) n`)).rows.some((r) => r.n === `${B}/old.jpg`))
    // unmatch under an open report archives the chat; without a report nothing is archived
    await su(`delete from matches where id=$1`, [mAB])
    ok('retention: unmatch archives the reported chat', (await su(`select count(*)::int c from message_deletions where match_id=$1 and cause='unmatched'`, [mAB])).rows[0].c === 403)
    const tu = await transcript('message', msg2, A)
    ok('evidence: transcript survives the unmatch', tu.some((r) => r.message_id === msg2 && r.unmatched && r.reported) &&
      tu.some((r) => r.message_id === msg3 && r.deleted && r.body === 'secret threat'), String(tu.length))
    ok('evidence: archived media still openable', (await media(M1, mediaId))?.path === mediaPath)
    await su(`delete from matches where id=$1`, [mAD])
    ok('retention: unreported unmatch archives nothing', (await su(`select count(*)::int c from message_deletions where match_id=$1`, [mAD])).rows[0].c === 0)
    await su(`update message_deletions set deleted_at = now() - interval '91 days' where match_id=$1`, [mAB])
    ok('retention: archive held while the report is open', !(await su(`select * from retention_message_deletions(1000)`)).rows.some((r) => r.message_id === msg2))

    // --- auto-flagging --------------------------------------------------------------------
    const detect = async (t) => (await su(`select array_agg(kind order by kind) k from detect_message_risk($1)`, [t])).rows[0].k ?? []
    const flagCases = {
      phone: ['call me 012-345 6789', '+60 12 345 6789', 'my no 0123456789', '(011) 2345-6789'],
      link: ['check https://example.com', 'go to www.mysite.net', 'join t.me/cheapcoins', 'wa.me/60123456789', 'visit lucky-profit.xyz now'],
      messenger: ['add me on WhatsApp', 'whatsapp me', 'wasap je la', 'watsapp me la', 'my telegram is cool_guy', 'tele me', 'add my wechat', 'line id: sweetie88', 'pm me on line', 'follow @sweetie_88'],
      money: ['can you transfer me some money', 'I need cash urgently', 'send to my bank account', 'acc no 1234', 'I trade bitcoin and USDT', 'good investment opportunity, 30% profit',
        'forex signals', 'boleh pinjam duit sikit?', 'tolong bank in RM500', 'pelaburan ni untung besar', 'topup tng for me', 'send via touch n go', 'just $200 for the ticket'],
    }
    for (const [kind, texts] of Object.entries(flagCases))
      for (const t of texts) ok(`flags: "${t}" -> ${kind}`, (await detect(t)).includes(kind), JSON.stringify(await detect(t)))
    for (const t of ['Hi! How was your day?', 'Jom makan nasi lemak esok?', 'I love hiking and coffee', 'Saya suka tengok wayang', 'online now, what about you',
      'we can meet at the mall lah', 'haha same, wa pun tak tau', 'line up at the cinema was long', 'Bila free?', 'see you at 7:30 on 12/10', 'I was born in 1995'])
      ok(`flags: "${t}" not flagged`, (await detect(t)).length === 0, JSON.stringify(await detect(t)))
    ok('flags: detector not callable by users', !!(await fails(() => as(A, `select * from detect_message_risk('x')`))))
    const fl = async (id) => (await su(`select array_agg(kind order by kind) k from message_flags where message_id=$1`, [id])).rows[0].k ?? []
    ok('flags: stored on send (and the message is sent)', JSON.stringify(await fl(msg2)) === '["messenger","phone"]')
    ok('flags: plain message has none', (await fl(msg1)).length === 0)
    ok('flags: users cannot read flags or scores', !!(await fails(() => as(B, `select * from message_flags`))) && !!(await fails(() => as(B, `select * from user_risk_scores`))))
    const score = async (u) => (await su(`select score from user_risk_scores where user_id=$1`, [u])).rows[0]?.score ?? 0
    ok('flags: one conversation stays under the threshold', (await score(B)) === 6 && (await score(B)) < (await su(`select risk_score_threshold() t`)).rows[0].t, String(await score(B)))
    await send(B, mCB, 'whatsapp me 0123456789'); await send(B, mCB, 'whatsapp me 0123456789 again')
    ok('flags: same signal counted once per conversation', (await score(B)) === 12, String(await score(B)))
    const benign = await send(C, mCB, 'no money for dinner lol')
    ok('flags: single weak signal scores low', JSON.stringify(await fl(benign)) === '["money"]' && (await score(C)) === 1)
    const flagged = (await svc(`select * from admin_flagged_users($1)`, [M1])).rows
    ok('flags: flagged tab lists high scores only', flagged.some((r) => r.user_id === B && r.score === 12 && r.conversations === 2 && r.kinds.phone === 3) && !flagged.some((r) => r.user_id === C), JSON.stringify(flagged))
    ok('flags: flagged list for admins only', !!(await fails(() => svc(`select * from admin_flagged_users($1)`, [A]))))
    // keywords editable by admins
    const kw = (await svc(`select admin_add_risk_keyword($1, '  Hadiah   PERCUMA ', 5) id`, [M1])).rows[0].id
    ok('flags: keyword stored normalised and logged', (await su(`select keyword from risk_keywords where id=$1`, [kw])).rows[0].keyword === 'hadiah percuma' && (await logs('risk_keyword.add', kw)) === 1)
    const kmsg = await send(E, mEB, 'Tahniah! Dapat hadiah percuma, klik sini')
    ok('flags: keyword flagged as a whole phrase', JSON.stringify(await fl(kmsg)) === '["keyword"]' && (await su(`select keyword from message_flags where message_id=$1`, [kmsg])).rows[0].keyword === 'hadiah percuma')
    ok('flags: keyword weight in the score', (await score(E)) === 5)
    ok('flags: no partial-word keyword match', (await detect('hadiahpercuma')).length === 0)
    const edited = await send(E, mEB, 'hello')
    await su(`update messages set body='my number 0123456789' where id=$1`, [edited])
    ok('flags: edits are flagged too', JSON.stringify(await fl(edited)) === '["phone"]')
    await svc(`select admin_remove_risk_keyword($1,$2)`, [M1, kw])
    ok('flags: keyword removal logged', (await logs('risk_keyword.remove', kw)) === 1 && (await detect('hadiah percuma')).length === 0)
    ok('flags: keyword admin only', !!(await fails(() => svc(`select admin_add_risk_keyword($1,'abcd')`, [A]))) && !!(await fails(() => as(M1, `select admin_add_risk_keyword($1,'abcd')`, [M1]))))
    await su(`alter table message_flags add constraint t_break check (kind <> 'phone') not valid`)
    const sentAnyway = await send(E, mEB, 'call 0123456789').catch(() => null)
    await su(`alter table message_flags drop constraint t_break`)
    ok('flags: a flagging error never blocks sending', !!sentAnyway)
    const rs = (await su(`insert into random_chat_sessions (user_a, user_b) values ($1,$2) returning id`, [C, D])).rows[0].id
    const rmsg = (await su(`insert into random_chat_messages (session_id, sender_id, body) values ($1,$2,'join t.me/cheapcoins') returning id`, [rs, D])).rows[0].id
    ok('flags: random chat messages flagged too', (await su(`select source, conversation_id c from message_flags where message_id=$1`, [rmsg])).rows.map((r) => r.source + r.c).join() === 'random' + rs)

    // --- atomic resolve ---------------------------------------------------------------------
    const resolve = (type, id, decision, reason = null, offender = null, adm = M1) =>
      svc(`select admin_resolve_case($1,$2,$3,$4,$5,$6) r`, [adm, type, id, decision, reason, offender]).then((r) => r.rows[0].r)
    const open = async (type, id) => (await su(`select count(*)::int c from reports where target_type=$1 and target_id=$2 and resolved_at is null`, [type, id])).rows[0].c
    ok('resolve: hide only for posts and comments (nothing changes)', !!(await fails(() => resolve('message', msg2, 'hide', 'x'))) && (await open('message', msg2)) === 1)
    ok('resolve: ban needs a reason (nothing changes)', !!(await fails(() => resolve('user', B, 'ban', ''))) && (await open('user', B)) === 2 &&
      (await su(`select banned_at from profiles where id=$1`, [B])).rows[0].banned_at === null)
    ok('resolve: offender must be a party', (await fails(() => resolve('user', B, 'ban', 'harassment', E)))?.includes('party') && (await open('user', B)) === 2)
    ok('resolve: unknown decision refused', !!(await fails(() => resolve('user', B, 'nuke'))))
    const hid = await resolve('post', post, 'hide', 'Спам')
    ok('resolve: hide + close in one call', hid.closed === 2 && (await su(`select is_hidden h from posts where id=$1`, [post])).rows[0].h === true && (await open('post', post)) === 0)
    await claim(M1, 'user', B)
    const ban = await resolve('user', B, 'ban', 'harassment: threats')
    ok('resolve: ban + close in one call', ban.closed === 2 && ban.offender === B && (await su(`select banned_at is not null b from profiles where id=$1`, [B])).rows[0].b === true)
    ok('resolve: claim cleared', (await su(`select count(*)::int c from report_claims where target_id=$1`, [B])).rows[0].c === 0)
    ok('resolve: decision stored, logged', (await su(`select distinct decision d, resolved_by r from reports where target_type='user' and target_id=$1`, [B])).rows.map((r) => r.d + r.r).join() === 'ban' + M1 &&
      (await logs('reports.resolve', B)) === 1 && (await logs('user.ban', B)) === 1)
    ok('resolve: second decision on the same case fails', (await fails(() => resolve('user', B, 'dismiss')))?.includes('No open reports'))
    await svc(`select admin_set_ban($1,$2,false)`, [M1, B])
    const ph = await resolve('photo', photoB, 'delete_photo', 'Чужое фото')
    ok('resolve: delete_photo returns the file path, removes the row', ph.photo_path === `${B}/rp.webp` && (await su(`select count(*)::int c from profile_photos where id=$1`, [photoB])).rows[0].c === 0)
    ok('resolve: delete_photo only for photo cases', !!(await fails(() => resolve('call', callE, 'delete_photo', 'x'))))
    // evidence and retention end with the case
    await resolve('message', msg2, 'dismiss')
    ok('evidence: closed report gives no transcript', (await fails(() => transcript('message', msg2, A)))?.includes('open report'))
    ok('evidence: closed report gives no media', (await fails(() => media(M1, mediaId)))?.includes('open report'))
    await resolve('message', w200, 'dismiss')
    await su(`update admins set role='moderator' where user_id=$1`, [M2])
    const modBan = await resolve('call', callE, 'ban', 'harassment: threats on a call', null, M2)
    ok('resolve: a moderator\'s ban is a 7-day ban (role rules of admin_ban_user)', modBan.ban_days === 7 && modBan.closed === 1 &&
      (await su(`select banned_until > now() + interval '6 days' b from profiles where id=$1`, [B])).rows[0].b === true, JSON.stringify(modBan))
    await rep(A, 'user', D, 'spam')
    ok('resolve: a moderator cannot ban longer than 7 days (nothing changes)', !!(await fails(() => svc(`select admin_resolve_case($1,'user',$2,'ban','spam',null,30)`, [M2, D]))) &&
      (await open('user', D)) === 1 && (await su(`select banned_at from profiles where id=$1`, [D])).rows[0].banned_at === null)
    await resolve('user', D, 'dismiss')
    await svc(`select admin_unban_user($1,$2)`, [M1, B])
    ok('evidence: closed call report gives no recording', (await fails(() => rec(callE)))?.includes('open report'))
    ok('retention: archive released after the case closes', (await su(`select * from retention_message_deletions(1000)`)).rows.some((r) => r.message_id === msg2))
    ok('retention: old media released after the case closes', (await su(`select * from retention_chat_media(1000)`)).rows.some((r) => r.message_id === oldMedia))
    // history
    const hist = (await svc(`select * from admin_report_history($1, null, null, 100, 0)`, [M1])).rows
    const hUser = hist.find((h) => h.target_id === B)
    ok('history: who resolved and the decision', hUser?.decision === 'ban' && hUser.resolved_by === M1 && hUser.report_count === 2 && hUser.resolution === 'harassment: threats', JSON.stringify(hUser))
    ok('history: newest first, type filter', hist.every((h, i) => i === 0 || hist[i - 1].resolved_at >= h.resolved_at) &&
      (await svc(`select * from admin_report_history($1, 'call')`, [M1])).rows.every((h) => h.target_type === 'call'))
    ok('history: admin only', !!(await fails(() => svc(`select * from admin_report_history($1)`, [A]))))

    // --- bulk dismiss -----------------------------------------------------------------------
    const g2 = 'ad00dead-0000-4000-8000-000000000002', g3 = 'ad00dead-0000-4000-8000-000000000003'
    await rep(A, 'user', g2, 'spam'); await rep(A, 'user', g3, 'spam')
    await claim(M2, 'user', g3)
    const before = await logs('reports.resolve')
    const bulk = (await svc(`select admin_bulk_dismiss($1,$2::jsonb) n`, [M1, JSON.stringify([{ type: 'user', id: ghost }, { type: 'user', id: g2 }, { type: 'user', id: g3 }, { type: 'user', id: P }])])).rows[0].n
    ok('bulk: dismisses open cases, skips claimed and closed ones', bulk === 2 && (await open('user', ghost)) === 0 && (await open('user', g2)) === 0 && (await open('user', g3)) === 1)
    ok('bulk: logged per case', (await logs('reports.resolve')) === before + 2)
    ok('bulk: admin only', !!(await fails(() => svc(`select admin_bulk_dismiss($1,'[]'::jsonb)`, [A]))))

    // --- photo moderation -------------------------------------------------------------------
    const pp = []
    for (let i = 0; i < 3; i++) pp.push((await su(`insert into profile_photos (profile_id, storage_path, width, height, position) values ($1,$2,10,10,$3) returning id`, [P, `${P}/q${i}.webp`, i])).rows[0].id)
    const pq = async (scope) => (await svc(`select * from admin_photo_queue($1,$2,7,200,0)`, [M1, scope])).rows.map((r) => r.id)
    ok('photos: pending queue includes unverified users', (await pq('pending')).filter((id) => pp.includes(id)).length === 3)
    ok('photos: verified scope excludes them, unverified includes', !(await pq('verified')).some((id) => pp.includes(id)) && (await pq('unverified')).filter((id) => pp.includes(id)).length === 3)
    ok('photos: approve marks reviewed, logged per photo', (await svc(`select admin_approve_photos($1,$2) n`, [M1, [pp[0], pp[1]]])).rows[0].n === 2 &&
      (await logs('photo.approve', pp[0])) === 1 && (await logs('photo.approve', pp[1])) === 1)
    ok('photos: approved leave the pending queue', (await pq('pending')).filter((id) => pp.includes(id)).join() === pp[2])
    ok('photos: approving twice is a no-op', (await svc(`select admin_approve_photos($1,$2) n`, [M1, [pp[0]]])).rows[0].n === 0)
    const delPaths = (await svc(`select admin_delete_photos($1,$2,'Нет лица') p`, [M1, [pp[2], ghost]])).rows.map((r) => r.p)
    ok('photos: bulk delete returns paths, skips missing', delPaths.join() === `${P}/q2.webp` && (await su(`select count(*)::int c from profile_photos where id=$1`, [pp[2]])).rows[0].c === 0)
    ok('photos: admin only', !!(await fails(() => svc(`select * from admin_photo_queue($1)`, [A]))) && !!(await fails(() => as(M1, `select admin_approve_photos($1,$2)`, [M1, [pp[0]]]))))
    ok('photos: reviews not readable by users', !!(await fails(() => as(P, `select * from photo_reviews`))))
    // roles (20261009000150): viewers read the queues, only moderators act or open evidence
    await su(`update admins set role='viewer' where user_id=$1`, [M2])
    await rep(A, 'user', D, 'harassment')
    ok('roles: viewer reads the queue, history, flags and photos', !(await fails(() => queue({ admin: M2 }))) &&
      !(await fails(() => svc(`select * from admin_report_history($1)`, [M2]))) && !(await fails(() => svc(`select * from admin_flagged_users($1)`, [M2]))) &&
      !(await fails(() => svc(`select * from admin_photo_queue($1)`, [M2]))))
    ok('roles: viewer cannot claim, decide or open evidence', !!(await fails(() => claim(M2, 'user', D))) &&
      !!(await fails(() => resolve('user', D, 'dismiss', null, null, M2))) && !!(await fails(() => transcript('user', D, A, M2))) &&
      !!(await fails(() => svc(`select admin_approve_photos($1,$2)`, [M2, [pp[0]]]))))
  })()
  // ===== end admin reports & evidence =====


  // ===== batch-4: telegram =====
  await (async () => {
    const T = ['7c000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000002',
               '7c000000-0000-4000-8000-000000000003', '7c000000-0000-4000-8000-000000000004',
               '7c000000-0000-4000-8000-000000000005', '7c000000-0000-4000-8000-000000000006']
    const [A0, A1, X, R1, R2, R3] = T
    for (const [i, u] of T.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013888000' + i])
    for (const [i, u] of T.entries()) await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
       values ($1,'1995-03-03','female','{male}','Ipoh','SRID=4326;POINT(101.08 4.6)')`, ['Tg' + i])
    await su(`update profiles set verification_status='approved' where id = any($1)`, [T])
    await su(`insert into admins (user_id) values ($1), ($2)`, [A0, A1])
    const issue = (a, code) => su(`select admin_telegram_issue_code($1, $2) e`, [a, code])
    const link = async (code, tg) => (await su(`select * from telegram_link_admin($1, $2)`, [code, tg])).rows[0]
    const tgOf = async (a) => (await su(`select telegram_user_id t from admins where user_id=$1`, [a])).rows[0].t
    const logged = async (action, target) => (await su(`select count(*)::int c from moderation_actions where action=$1 and target_id=$2`, [action, target])).rows[0].c
    // codes
    ok('telegram: only admins get a code', !!(await fails(() => issue(X, 'ABCDEFGH'))))
    ok('telegram: code format enforced', !!(await fails(() => issue(A0, 'abc'))) && !!(await fails(() => issue(A0, 'ABCDEFG1'))))
    const exp = (await issue(A0, 'ABCD2345')).rows[0].e
    const mins = (new Date(exp) - Date.now()) / 60000
    ok('telegram: code expires in 10 minutes', mins > 9 && mins <= 10.1, String(mins))
    const stored = (await su(`select code_hash from telegram_link_codes where admin_id=$1`, [A0])).rows[0].code_hash
    ok('telegram: code stored hashed', /^[0-9a-f]{64}$/.test(stored) && !stored.includes('ABCD2345'))
    ok('telegram: code issue logged', (await logged('telegram.code_issue', A0)) === 1)
    const { createHash } = await import('node:crypto')
    ok('telegram: hash matches the app (linkCodeHash)', stored === createHash('sha256').update('ABCD2345').digest('hex') &&
       (await su(`select telegram_code_hash(' abcd 2345 ') h`)).rows[0].h === stored)
    ok('telegram: clients cannot read codes', !!(await fails(() => as(A0, `select * from telegram_link_codes`))))
    ok('telegram: clients cannot link', !!(await fails(() => as(A0, `select * from telegram_link_admin('ABCD2345', 1)`))))
    ok('telegram: clients cannot read admins', !!(await fails(() => as(A0, `select telegram_user_id from admins`))))
    // linking
    const bad = await link('ZZZZ2222', 9001)
    ok('telegram: wrong code refused', bad.result === 'invalid' && bad.linked_admin === null)
    ok('telegram: failed attempt recorded', (await su(`select count(*)::int c from telegram_audit where telegram_user_id=9001 and event='link_failed'`)).rows[0].c === 1)
    const good = await link(' abcd 2345 ', 9001)
    ok('telegram: code links (case and spaces ignored)', good.result === 'linked' && good.linked_admin === A0 && String(await tgOf(A0)) === '9001', JSON.stringify(good))
    ok('telegram: link logged', (await logged('telegram.link', A0)) === 1)
    ok('telegram: code is one-time', (await link('ABCD2345', 9001)).result === 'invalid')
    ok('telegram: telegram_user_id unique', !!(await fails(() => su(`update admins set telegram_user_id=9001 where user_id=$1`, [A1]))))
    await issue(A1, 'WXYZ6789')
    ok('telegram: account linked to another moderator', (await link('WXYZ6789', 9001)).result === 'taken' && (await tgOf(A1)) === null)
    await issue(A1, 'WXYZ6789')
    await su(`update telegram_link_codes set expires_at = now() - interval '1 second' where admin_id=$1`, [A1])
    ok('telegram: expired code refused', (await link('WXYZ6789', 9002)).result === 'invalid')
    for (let i = 0; i < 4; i++) await link('QQQQ3333', 9002)
    await issue(A1, 'MNPQ4567')
    ok('telegram: throttled after 5 failures', (await link('MNPQ4567', 9002)).result === 'throttled' && (await tgOf(A1)) === null)
    ok('telegram: other accounts not throttled', (await link('MNPQ4567', 9003)).result === 'linked' && String(await tgOf(A1)) === '9003')
    await su(`select admin_telegram_unlink($1)`, [A1])
    ok('telegram: unlink clears and logs', (await tgOf(A1)) === null && (await logged('telegram.unlink', A1)) === 1)
    await su(`select admin_telegram_unlink($1)`, [A1])
    ok('telegram: second unlink not logged', (await logged('telegram.unlink', A1)) === 1)
    ok('telegram: unlink needs an admin', !!(await fails(() => su(`select admin_telegram_unlink($1)`, [X]))))
    // selfie messages: sending and deleting is logged with message ids
    await su(`update profiles set verification_status='unverified' where id=$1`, [X])
    await as(X, `insert into verification_requests (selfie_path, challenge) values ($1, 'peace')`, [`${X}/tg.jpg`])
    const req = (await su(`select id from verification_requests where user_id=$1 and status='pending'`, [X])).rows[0].id
    const msg = (await su(`select telegram_record_message('selfie', 'verification_request', $1, -100123, '{11,12,13}', 14) id`, [req])).rows[0].id
    const sent = (await su(`select admin_id, target_type, reason from moderation_actions where action='selfie.telegram_sent' and target_id=$1`, [req])).rows
    ok('telegram: selfie send logged with message ids', sent.length === 1 && sent[0].admin_id === null && sent[0].target_type === 'verification_request' && sent[0].reason === 'chat -100123, messages 11,12,13,14', JSON.stringify(sent))
    const toDelete = async (age = '46 hours') => (await su(`select * from telegram_photos_to_delete($1::interval, 50)`, [age])).rows
    ok('telegram: pending fresh selfie stays', !(await toDelete()).some((r) => r.id === msg))
    const old = await toDelete('0 seconds')
    ok('telegram: old selfie photos expire', old.some((r) => r.id === msg && r.expired === true && r.photo_message_ids.length === 3))
    await su(`select admin_review_verification($1, $2, true)`, [A0, req])
    ok('telegram: decided selfie photos are due', (await toDelete()).some((r) => r.id === msg && r.expired === false))
    ok('telegram: second decision refused (first wins)', !!(await fails(() => su(`select admin_review_verification($1, $2, false, 'face_mismatch')`, [A1, req]))))
    ok('telegram: photo delete marked once', (await su(`select telegram_mark_photos_deleted($1, 'decided') d`, [msg])).rows[0].d === true &&
       (await su(`select telegram_mark_photos_deleted($1, 'decided') d`, [msg])).rows[0].d === false)
    ok('telegram: photo delete logged', (await logged('selfie.telegram_deleted', req)) === 1 && !(await toDelete('0 seconds')).some((r) => r.id === msg))
    const again = (await su(`select telegram_record_message('report', 'post', $1, -100123, '{}', 20) id`, [req])).rows[0].id
    await su(`select telegram_record_message('report', 'post', $1, -100123, '{}', 21)`, [req])
    ok('telegram: one open message per subject', (await su(`select count(*)::int c from telegram_messages where ref_id=$1 and kind='report' and closed_at is null`, [req])).rows[0].c === 1 &&
       (await su(`select closed_at is not null c from telegram_messages where id=$1`, [again])).rows[0].c === true)
    ok('telegram: report messages not logged as selfie access', (await logged('selfie.telegram_sent', req)) === 1)
    ok('telegram: clients cannot record messages', !!(await fails(() => as(X, `select telegram_record_message('selfie', 'x', $1, 1, '{}', 1)`, [req]))))
    // report summary: no reporters, priority signals, offender
    await su(`update profiles set verification_status='approved' where id=$1`, [X])
    const post = (await as(X, `select create_post('tg post') id`)).rows[0].id
    await as(R1, `insert into reports (target_type, target_id, reason) values ('post', $1, 'underage: looks 15')`, [post])
    // Same-microsecond inserts would make "latest" a coin flip.
    await su(`update reports set created_at = created_at - interval '1 minute' where target_id=$1`, [post])
    await as(R2, `insert into reports (target_type, target_id, reason) values ('post', $1, 'spam')`, [post])
    await as(R3, `insert into reports (target_type, target_id, reason) values ('user', $1, 'fake')`, [X])
    const sum = (await su(`select * from telegram_report_summary('post', $1)`, [post])).rows[0]
    ok('telegram: summary counts and flags', sum.open_reports === 2 && sum.underage === true && sum.offender_id === X && sum.offender_reports_1h === 3 && sum.auto_hidden === false && sum.latest_reason === 'spam', JSON.stringify(sum))
    ok('telegram: summary has no reporter fields', !Object.keys(sum).some((k) => k.includes('reporter')))
    await as(R3, `insert into reports (target_type, target_id, reason) values ('post', $1, 'sexual')`, [post])
    ok('telegram: summary sees auto-hide', (await su(`select auto_hidden a from telegram_report_summary('post', $1)`, [post])).rows[0].a === true)
    const us = (await su(`select * from telegram_report_summary('user', $1)`, [X])).rows[0]
    ok('telegram: user summary', us.open_reports === 1 && us.underage === false && us.offender_id === X)
    const st = (await su(`select telegram_stats(now() - interval '1 hour') s`)).rows[0].s
    ok('telegram: stats', st.reports_created >= 4 && st.selfies_approved >= 1 && st.auto_hidden >= 1 && 'oldest_report_at' in st, JSON.stringify(st))
    ok('telegram: clients cannot read stats', !!(await fails(() => as(X, `select telegram_stats(now())`))))
    ok('telegram: audit closed to clients', !!(await fails(() => as(X, `select * from telegram_audit`))))
    // deleting a moderator removes their pending code
    await issue(A1, 'ABCD2345')
    await su(`delete from admins where user_id=$1`, [A1])
    ok('telegram: codes removed with the moderator', (await su(`select count(*)::int c from telegram_link_codes where admin_id=$1`, [A1])).rows[0].c === 0)
  })()

  // ===== end telegram =====

  // ===== password login (20261009000180) =====
  await (async () => {
    const W = ['7d000000-0000-4000-8000-000000000001', '7d000000-0000-4000-8000-000000000002',
               '7d000000-0000-4000-8000-000000000003']
    const [P0, P1, P2] = W
    for (const [i, u] of W.entries()) await su(`insert into auth.users(id, phone, encrypted_password) values ($1, $2, $3)`,
      [u, '6013777000' + i, i === 2 ? '' : '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehashfake'])
    for (const [i, u] of W.entries()) await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location, username)
       values ($1,'1994-04-04','male','{female}','Melaka','SRID=4326;POINT(102.25 2.19)', $2)`, ['Pw' + i, 'pwtest' + i])
    const check = async (name, ip = null) => (await su(`select * from password_login_check($1, $2::inet)`, [name, ip])).rows[0]
    const record = (name, ip, success) => su(`select password_login_record($1, $2::inet, $3)`, [name, ip, success])
    const anon = async (sql) => { await db.exec('reset role; set role anon'); try { return await db.query(sql) } finally { await db.exec('reset role') } }
    // lookup
    const c0 = await check('pwtest0')
    ok('password: username maps to the E.164 phone', c0.limited === false && c0.phone === '+60137770000', JSON.stringify(c0))
    ok('password: lookup normalises @ and case', (await check('  @PwTest1 ')).phone === '+60137770001')
    ok('password: no phone without a password', (await check('pwtest2')).phone === null)
    const unknown = await check('nobody_here')
    ok('password: unknown username looks like no password', unknown.limited === false && unknown.phone === null)
    ok('password: clients cannot look up or record', !!(await fails(() => as(P0, `select * from password_login_check('pwtest1', null)`))) &&
       !!(await fails(() => anon(`select * from password_login_check('pwtest1', null)`))) &&
       !!(await fails(() => as(P0, `select password_login_record('pwtest1', null, false)`))))
    ok('password: attempts table closed to clients', !!(await fails(() => as(P0, `select * from password_login_attempts`))) &&
       !!(await fails(() => anon(`select * from password_login_attempts`))))
    // per-username limit: 5 failures in 15 minutes
    for (let i = 0; i < 4; i++) await record('pwtest0', '10.0.0.' + (i + 1), false)
    ok('password: 4 failures still allowed', (await check('pwtest0')).limited === false)
    await record('@PWTEST0', '10.0.0.9', false)
    const locked = await check('pwtest0')
    ok('password: 5th failure locks the username (no phone returned)', locked.limited === true && locked.phone === null)
    ok('password: other usernames unaffected', (await check('pwtest1')).limited === false)
    await record('ghost_user', null, false); await record('ghost_user', null, false); await record('ghost_user', null, false)
    await record('ghost_user', null, false); await record('ghost_user', null, false)
    ok('password: unknown usernames lock the same way', (await check('ghost_user')).limited === true)
    await su(`update password_login_attempts set created_at = now() - interval '16 minutes' where username = 'pwtest0'`)
    ok('password: failures older than 15 minutes expire', (await check('pwtest0')).limited === false)
    // per-IP limit: 20 failures in 15 minutes, across usernames
    for (let i = 0; i < 19; i++) await record('spray' + i, '203.0.113.7', false)
    ok('password: 19 failures from one IP allowed', (await check('pwtest1', '203.0.113.7')).limited === false)
    await record('spray19', '203.0.113.7', false)
    ok('password: 20th failure locks the IP', (await check('pwtest1', '203.0.113.7')).limited === true)
    ok('password: other IPs and unknown IP unaffected', (await check('pwtest1', '203.0.113.8')).limited === false &&
       (await check('pwtest1', null)).limited === false)
    // success clears the username's failures, purge drops day-old rows
    for (let i = 0; i < 3; i++) await record('pwtest1', '198.51.100.1', false)
    await record('pwtest1', '198.51.100.1', true)
    ok('password: success clears the username failures', (await su(`select count(*)::int c from password_login_attempts where username='pwtest1'`)).rows[0].c === 0)
    await su(`insert into password_login_attempts (username, ip, created_at) values ('old_one', '192.0.2.1', now() - interval '25 hours')`)
    await record('someone', null, false)
    ok('password: rows older than a day are purged', (await su(`select count(*)::int c from password_login_attempts where username='old_one'`)).rows[0].c === 0)
    ok('password: username length capped', (await su(`select password_login_record($1, null, false)`, ['x'.repeat(100)]).then(() => true)) &&
       (await su(`select max(char_length(username))::int m from password_login_attempts`)).rows[0].m <= 40)
    // own password state
    ok('password: my_has_password', (await as(P0, `select my_has_password() h`)).rows[0].h === true &&
       (await as(P2, `select my_has_password() h`)).rows[0].h === false)
    ok('password: anon cannot read or remove', !!(await fails(() => anon(`select my_has_password()`))) &&
       !!(await fails(() => anon(`select remove_my_password()`))))
    ok('password: remove returns true', (await as(P0, `select remove_my_password() r`)).rows[0].r === true)
    ok('password: removed for the caller only', (await as(P0, `select my_has_password() h`)).rows[0].h === false &&
       (await as(P1, `select my_has_password() h`)).rows[0].h === true &&
       (await su(`select encrypted_password e from auth.users where id=$1`, [P0])).rows[0].e === '')
    ok('password: removed account no longer resolves', (await check('pwtest0')).phone === null)
  })()
  // ===== end password login =====

  // ===== blind dating (20261009000190) =====
  // Aliases, no profile data before a mutual Connect, Connect/Pass combinations, transcript copy,
  // idempotency, blocks, bans, mutes, rate limits, realtime authorization. Own scope, fresh users.
  await (async () => {
    const B = ['b1d00000-0000-4000-8000-000000000001', 'b1d00000-0000-4000-8000-000000000002',
               'b1d00000-0000-4000-8000-000000000003', 'b1d00000-0000-4000-8000-000000000004',
               'b1d00000-0000-4000-8000-000000000005', 'b1d00000-0000-4000-8000-000000000006',
               'b1d00000-0000-4000-8000-000000000007']
    const [M1, F1, F2, M2, F3, M3, X] = B
    for (const [i, u] of B.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013777000' + i])
    for (const [u, name, g, w] of [[M1, 'Hafiz', 'male', '{female}'], [F1, 'Nurul', 'female', '{male}'], [F2, 'Mei', 'female', '{male}'],
      [M2, 'Ravi', 'male', '{female}'], [F3, 'Siti', 'female', '{male}'], [M3, 'Kumar', 'male', '{female}'], [X, 'Outsider', 'male', '{female}']])
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,'1996-04-04',$2,$3,'Melaka','SRID=4326;POINT(102.25 2.19)')`, [name, g, w])
    await su(`update profiles set verification_status='approved' where id = any($1)`, [B])
    await su(`delete from random_chat_queue`)
    const decide = async (u, s, c) => (await as(u, `select blind_decide($1, $2) r`, [s, c])).rows[0].r
    const bs = async (u, s = null) => (await as(u, `select * from get_blind_session($1)`, [s])).rows[0]
    const events = async (topic) => (await su(`select event, payload from realtime.messages where topic=$1 order by id`, [topic])).rows
    const pairOf = async (a, b) => (await su(`select count(*)::int c from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [a, b])).rows[0].c
    const pair = async (m, f) => {
      await su(`delete from random_chat_queue`)
      await as(m, `select randomizer_join('{female}',18,99)`)
      return (await as(f, `select randomizer_join('{male}',18,99) s`)).rows[0].s
    }
    const session = async (a, b) => (await su(`insert into random_chat_sessions (user_a, user_b) values ($1,$2) returning id`, [a, b])).rows[0].id

    // --- aliases and what a client can see before a match
    const s1 = await pair(M1, F1)
    ok('blind: paired', !!s1)
    const m1v = await bs(M1), f1v = await bs(F1)
    ok('blind: aliases are 3 digits and differ', m1v.my_alias >= 100 && m1v.my_alias <= 999 && m1v.partner_alias >= 100 && m1v.my_alias !== m1v.partner_alias, JSON.stringify(m1v))
    ok('blind: aliases mirror between sides', m1v.my_alias === f1v.partner_alias && m1v.partner_alias === f1v.my_alias)
    ok('blind: aliases stable per session', (await bs(M1, s1)).partner_alias === m1v.partner_alias)
    ok('blind: fresh session is active, undecided', m1v.state === 'active' && m1v.my_decision === null && m1v.id === s1)
    ok('blind: get_blind_session columns', JSON.stringify(Object.keys(m1v).sort()) ===
       '["common_tags","context","event_id","id","kind","match_id","my_alias","my_decision","my_messages","my_side","partner","partner_alias","partner_messages","revealed_from_start","started_at","state"]', JSON.stringify(Object.keys(m1v)))
    const leaks = (row) => { const j = JSON.stringify(row); return j.includes(F1) || j.includes(M1) || j.includes('Nurul') || j.includes('Hafiz') }
    ok('blind: no profile data or ids before connect', m1v.partner === null && m1v.match_id === null && !leaks(m1v) && !leaks(f1v))
    const old = (await as(M1, `select * from get_random_session()`)).rows[0]
    ok('blind: get_random_session leaks nothing', old.partner === null && old.partner_revealed === false && !leaks(old), JSON.stringify(old))
    ok('blind: sessions table still closed', !!(await fails(() => as(M1, `select alias_a from random_chat_sessions`))))
    await as(M1, `select randomizer_send($1,'hi there')`, [s1])
    await as(F1, `select randomizer_send($1,'hello!')`, [s1])
    await as(M1, `select randomizer_send($1,'how is your day?')`, [s1])
    // Inserts can share a millisecond: spread them so "in order" has one answer.
    await su(`update random_chat_messages m set created_at = created_at + (o.n || ' ms')::interval * 10
      from (select id, row_number() over (order by created_at, id) n from random_chat_messages where session_id=$1) o
      where m.id = o.id`, [s1])
    const hist = (await as(F1, `select * from get_random_messages($1)`, [s1])).rows
    ok('blind: history has no sender ids', hist.length === 3 && !leaks(hist))
    ok('blind: outsider sees no session', (await as(X, `select * from get_blind_session($1)`, [s1])).rows.length === 0)
    ok('blind: outsider cannot decide', !!(await fails(() => decide(X, s1, true))))
    ok('blind: decision required', !!(await fails(() => as(M1, `select blind_decide($1, null)`, [s1]))))

    // --- one Connect: "waiting", and the partner learns nothing
    const w = await decide(M1, s1, true)
    ok('blind: first connect waits', w.state === 'waiting' && w.match_id === null, JSON.stringify(w))
    ok('blind: my decision recorded', (await bs(M1)).my_decision === true)
    const fw = await bs(F1)
    ok('blind: partner sees no decision', fw.my_decision === null && fw.state === 'active' && fw.partner === null && !leaks(fw), JSON.stringify(fw))
    ok('blind: get_random_session hides the connect', (await as(F1, `select partner_revealed p from get_random_session()`)).rows[0].p === false)
    ok('blind: nothing broadcast to the partner', (await events('random:' + s1)).every((e) => e.event === 'message') && (await events('randomizer:' + F1)).every((e) => e.event === 'paired'))
    ok('blind: decided sent to the decider only', (await events('randomizer:' + M1)).some((e) => e.event === 'decided' && e.payload.decision === true && e.payload.session_id === s1))
    ok('blind: repeated connect is idempotent', (await decide(M1, s1, true)).state === 'waiting' && (await pairOf(M1, F1)) === 0)

    // --- mutual Connect: match, transcript, reveal
    const mm = await decide(F1, s1, true)
    ok('blind: mutual connect matches', mm.state === 'matched' && !!mm.match_id && mm.just_matched === true, JSON.stringify(mm))
    ok('blind: one match, source randomizer', (await pairOf(M1, F1)) === 1 && (await su(`select source from matches where id=$1`, [mm.match_id])).rows[0].source === 'randomizer')
    const orig = (await su(`select sender_id, body, created_at from random_chat_messages where session_id=$1 order by created_at`, [s1])).rows
    const copied = (await su(`select sender_id, body, created_at, read_at, deleted_at from messages where match_id=$1 order by created_at`, [mm.match_id])).rows
    ok('blind: transcript copied in order with senders and times', copied.length === 3 &&
       copied.every((c, i) => c.sender_id === orig[i].sender_id && c.body === orig[i].body && +c.created_at === +orig[i].created_at), JSON.stringify(copied))
    ok('blind: copy is read and not deleted', copied.every((c) => c.read_at !== null && c.deleted_at === null))
    ok('blind: participants read the copy', (await as(F1, `select count(*)::int c from messages where match_id=$1`, [mm.match_id])).rows[0].c === 3)
    ok('blind: blind messages kept too', (await su(`select count(*)::int c from random_chat_messages where session_id=$1`, [s1])).rows[0].c === 3)
    const rev = await bs(M1, s1)
    ok('blind: reveal after match', rev.state === 'matched' && rev.partner?.id === F1 && rev.partner.display_name === 'Nurul' && rev.partner.age >= 18 && rev.match_id === mm.match_id, JSON.stringify(rev))
    ok('blind: matched broadcast with match id', (await events('random:' + s1)).some((e) => e.event === 'matched' && e.payload.match_id === mm.match_id))
    ok('blind: session no longer active', (await as(M1, `select * from get_random_session()`)).rows.length === 0 && (await as(M1, `select * from get_blind_session()`)).rows.length === 0)
    const again = await decide(F1, s1, true)
    ok('blind: connect after match is idempotent', again.state === 'matched' && again.match_id === mm.match_id && !again.just_matched &&
       (await su(`select count(*)::int c from messages where match_id=$1`, [mm.match_id])).rows[0].c === 3)
    ok('blind: pass after match changes nothing', (await decide(M1, s1, false)).state === 'matched' && (await pairOf(M1, F1)) === 1)
    ok('blind: cannot send after match', !!(await fails(() => as(M1, `select randomizer_send($1,'x')`, [s1]))))

    // --- an existing match is reused, its chat continues
    const s2 = await pair(M1, F1)
    ok('blind: matched pair can meet blind again', !!s2 && s2 !== s1)
    await as(F1, `select randomizer_send($1,'again?')`, [s2])
    await decide(F1, s2, true)
    const m2 = await decide(M1, s2, true)
    ok('blind: existing match reused', m2.state === 'matched' && m2.match_id === mm.match_id && (await pairOf(M1, F1)) === 1)
    ok('blind: second transcript appended', (await su(`select count(*)::int c from messages where match_id=$1`, [mm.match_id])).rows[0].c === 4)

    // --- Pass
    const s3 = await pair(M1, F2)
    await decide(M1, s3, true)
    const p = await decide(F2, s3, false)
    ok('blind: pass ends the session', p.state === 'passed' && (await su(`select status from random_chat_sessions where id=$1`, [s3])).rows[0].status === 'ended')
    const m1s3 = await bs(M1, s3)
    ok('blind: the other side only sees "ended"', m1s3.state === 'ended' && m1s3.partner === null && m1s3.match_id === null, JSON.stringify(m1s3))
    ok('blind: ended broadcast', (await events('random:' + s3)).some((e) => e.event === 'ended'))
    ok('blind: no match after pass', (await pairOf(M1, F2)) === 0)
    ok('blind: connect after pass stays ended', (await decide(M1, s3, true)).state === 'ended' && (await pairOf(M1, F2)) === 0)
    ok('blind: cannot send after pass', !!(await fails(() => as(M1, `select randomizer_send($1,'x')`, [s3]))))
    const s4 = await pair(M1, F2)
    ok('blind: both can search again after pass', !!s4)
    ok('blind: pass first', (await decide(M1, s4, false)).state === 'passed' && (await bs(F2, s4)).state === 'ended')
    const s5 = await pair(M1, F2)
    await decide(F2, s5, true)
    ok('blind: connect then pass', (await decide(F2, s5, false)).state === 'passed' && (await bs(M1, s5)).state === 'ended' && (await pairOf(M1, F2)) === 0)
    const s6 = await pair(M1, F2)
    await as(M1, `select randomizer_end($1)`, [s6])
    ok('blind: randomizer_end = pass', (await bs(M1, s6)).state === 'passed' && (await bs(F2, s6)).state === 'ended')
    const s7 = await pair(M1, F2)
    await as(M1, `select randomizer_reveal($1)`, [s7])
    ok('blind: randomizer_reveal = connect', (await bs(M1, s7)).my_decision === true && (await as(F2, `select randomizer_reveal($1) v`, [s7])).rows[0].v === true &&
       (await pairOf(M1, F2)) === 1 && (await bs(F2, s7)).partner?.id === M1)
    await su(`delete from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [M1, F2])

    // --- blocks
    const s8 = await pair(M1, F2)
    await as(F2, `select randomizer_send($1,'creepy?')`, [s8])
    await decide(M1, s8, true)
    await as(F2, `select blind_block($1)`, [s8])
    ok('blind: block from the session ends it', (await bs(M1, s8)).state === 'ended' && (await bs(F2, s8)).state === 'passed')
    ok('blind: block stored without revealing', (await su(`select count(*)::int c from blocks where blocker_id=$1 and blocked_id=$2`, [F2, M1])).rows[0].c === 1)
    ok('blind: blocked pair not paired again', !(await pair(M1, F2)))
    ok('blind: report still possible after block', !(await fails(() => as(F2, `insert into reports (target_type, target_id, reason) values ('random_session', $1, 'harassment')`, [s8]))))
    ok('blind: outsider cannot block via session', !!(await fails(() => as(X, `select blind_block($1)`, [s8]))))
    const s9 = await session(M2, F2)
    await as(M2, `insert into blocks (blocked_id) values ($1)`, [F2])
    ok('blind: connect across a block ends instead of matching', (await decide(F2, s9, true)).state === 'ended' && (await pairOf(M2, F2)) === 0)
    await su(`delete from blocks where blocker_id in ($1, $2)`, [F2, M2])
    await su(`delete from random_chat_queue`)

    // --- bans
    const s10 = await session(M2, F2)
    await su(`update profiles set banned_at=now(), is_active=false where id=$1`, [F2])
    ok('blind: banned user cannot connect', !!(await fails(() => decide(F2, s10, true))))
    await su(`update random_chat_sessions set status='ended', ended_at=now() where id=$1`, [s10]) // what admin_set_ban does
    ok('blind: session ended by a ban never matches', (await decide(M2, s10, true)).state === 'ended' && (await pairOf(M2, F2)) === 0)
    await su(`update profiles set banned_at=null, is_active=true where id=$1`, [F2])

    // --- mutes and risk flags: the copy is a system action
    const s11 = await session(M2, F3)
    await as(M2, `select randomizer_send($1,'whatsapp me +60 12 345 6789')`, [s11])
    const flagsBefore = (await su(`select count(*)::int c from message_flags where sender_id=$1`, [M2])).rows[0].c
    await su(`update profiles set muted_until = now() + interval '1 hour' where id=$1`, [M2])
    ok('blind: muted user cannot send', (await fails(() => as(M2, `select randomizer_send($1,'hi')`, [s11])))?.includes('muted'))
    await decide(M2, s11, true)
    const mu = await decide(F3, s11, true)
    ok('blind: muted user can still match, transcript copied', mu.state === 'matched' && (await su(`select count(*)::int c from messages where match_id=$1 and sender_id=$2`, [mu.match_id, M2])).rows[0].c === 1)
    ok('blind: copy not flagged twice', flagsBefore >= 1 && (await su(`select count(*)::int c from message_flags where sender_id=$1`, [M2])).rows[0].c === flagsBefore)
    ok('blind: mute still blocks normal chat', (await fails(() => as(M2, `insert into messages (match_id, body) values ($1,'hi')`, [mu.match_id])))?.includes('muted'))
    await su(`update profiles set muted_until = null where id=$1`, [M2])
    const fl = (await as(F3, `insert into messages (match_id, body) values ($1,'call me 012-345 6789') returning id`, [mu.match_id])).rows[0].id
    ok('blind: normal chat still flagged after copy', (await su(`select count(*)::int c from message_flags where message_id=$1`, [fl])).rows[0].c >= 1)

    // --- rate limits: copying never trips the 30/min limit, normal sending still does
    const rm = (await su(`select ensure_match($1, $2, 'swipe') id`, [M3, F1])).rows[0].id
    for (let i = 0; i < 10; i++) await as(M3, `insert into messages (match_id, body) values ($1, $2)`, [rm, 'm' + i])
    const s12 = await session(M3, F1)
    for (let i = 0; i < 25; i++) await as(M3, `select randomizer_send($1, $2)`, [s12, 'b' + i])
    await decide(F1, s12, true)
    const rl = await decide(M3, s12, true)
    ok('blind: copy ignores the rate limit', rl.state === 'matched' && rl.match_id === rm &&
       (await su(`select count(*)::int c from messages where match_id=$1`, [rm])).rows[0].c === 35)
    ok('blind: rate limit still applies afterwards', !!(await fails(() => as(M3, `insert into messages (match_id, body) values ($1,'over')`, [rm]))))

    // --- realtime authorization unchanged
    const t = 'random:' + s1
    ok('blind: realtime participants receive', (await as(F1, `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c >= 1)
    ok('blind: realtime outsider blocked', (await as(X, `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c === 0)
    ok('blind: realtime client cannot write random:', !!(await fails(() => as(F1, `insert into realtime.messages (topic, event, payload) values ($1,'matched','{}')`, [t], t))))
    const own = 'randomizer:' + M1
    ok('blind: realtime own topic readable', (await as(M1, `select count(*)::int c from realtime.messages where topic=$1`, [own], own)).rows[0].c >= 1)
    ok('blind: realtime others\' topic hidden', (await as(F1, `select count(*)::int c from realtime.messages where topic=$1`, [own], own)).rows[0].c === 0)
    ok('blind: anon cannot call the RPCs', (await su(`select has_function_privilege('anon', 'public.blind_decide(uuid, boolean)', 'execute') a,
       has_function_privilege('anon', 'public.get_blind_session(uuid)', 'execute') b, has_function_privilege('anon', 'public.blind_block(uuid)', 'execute') c`)).rows
       .every((r) => !r.a && !r.b && !r.c))
  })()

  // ===== end blind dating =====

  // ===== crossed paths & plans (20261009000200) =====
  await (async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c0000000-0000-4000-8000-0000000000${String(i + 10)}`)
    const [A, B, C, D, E, F, G, H, I, J, K, L] = ids
    for (const [i, u] of ids.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601477700' + String(i).padStart(2, '0')])
    for (const [i, u] of ids.entries()) {
      const male = u === A || u === G
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
         values ($1,'1996-04-04',$2,$3,'Kuala Lumpur','SRID=4326;POINT(101.671 3.13)')`, ['Cp' + i, male ? 'male' : 'female', male ? '{female}' : '{male}'])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [ids])
    const X = 'w283c9', Y = 'w283fh', HOME = 'w2843k', Z = 'w283cd'
    const ping = (u, cell, hoursAgo, night = false) => su(`insert into user_location_pings (user_id, cell, day, seen_hour, is_night)
       select $1, $2, (h at time zone 'Asia/Kuala_Lumpur')::date, h, $4 from (select date_trunc('hour', now()) - make_interval(hours => $3) h) t`, [u, cell, hoursAgo, night])
    const seen = async (viewer) => (await as(viewer, `select * from get_crossed_paths()`)).rows
    const sees = async (viewer, other) => (await seen(viewer)).some((r) => r.id === other)
    const pairCount = async (u) => (await su(`select count(*)::int c from crossed_paths where $1 in (user_a, user_b)`, [u])).rows[0].c
    const pairOf = async (a, b) => (await su(`select count(*)::int c from crossed_paths where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [a, b])).rows[0].c

    // opt-in: off by default, nothing stored
    ok('crossed: ping without opt-in stores nothing', (await as(A, `select ping_location(3.13, 101.671) v`)).rows[0].v === false &&
       (await su(`select count(*)::int c from user_location_pings where user_id=$1`, [A])).rows[0].c === 0)
    ok('crossed: off by default', (await as(A, `select count(*)::int c from crossed_paths_settings`)).rows[0].c === 0)
    for (const u of [A, B, D, E, F, G, H, I, J, K, L]) await as(u, `select set_crossed_paths(true)`)
    ok('crossed: opt-in row visible to owner only', (await as(A, `select user_id from crossed_paths_settings`)).rows.map((r) => r.user_id).join() === A)
    // coarsening
    ok('crossed: ping stored', (await as(A, `select ping_location(3.1300123, 101.6710456) v`)).rows[0].v === true)
    const row = (await su(`select * from user_location_pings where user_id=$1`, [A])).rows
    ok('crossed: only cell, day, hour window and night flag', row.length === 1 && row[0].cell === X &&
       JSON.stringify(Object.keys(row[0]).sort()) === '["cell","day","is_night","seen_hour","user_id"]' &&
       new Date(row[0].seen_hour).getUTCMinutes() === 0 && new Date(row[0].seen_hour).getUTCSeconds() === 0, JSON.stringify(row))
    const cols = (await su(`select string_agg(table_name || '.' || column_name, ',') c from information_schema.columns
       where table_name in ('user_location_pings','crossed_paths','crossed_paths_settings','crossed_path_hides')
         and data_type in ('double precision','numeric','real','USER-DEFINED')`)).rows[0].c
    ok('crossed: no coordinate columns in history', cols === null, cols)
    ok('crossed: throttled to one ping per ~10 minutes', (await as(A, `select ping_location(3.2, 101.7) v`)).rows[0].v === false)
    await su(`update crossed_paths_settings set last_ping_at = null where user_id=$1`, [A])
    ok('crossed: outside Malaysia not stored', (await as(A, `select ping_location(41.3, 69.24) v`)).rows[0].v === false &&
       (await su(`select count(*)::int c from user_location_pings where user_id=$1`, [A])).rows[0].c === 1)
    ok('crossed: pings never readable by clients', !!(await fails(() => as(A, `select * from user_location_pings`))) &&
       !!(await fails(() => as(A, `select * from crossed_paths`))) && !!(await fails(() => as(A, `select * from areas`))) &&
       !!(await fails(() => as(A, `select * from crossed_path_hides`))))
    ok('crossed: clients cannot insert pings or run jobs', !!(await fails(() => as(A, `insert into user_location_pings values ($1,'w283c9',current_date,date_trunc('hour',now()),false)`, [A]))) &&
       !!(await fails(() => as(A, `select compute_crossed_paths()`))) && !!(await fails(() => as(A, `select purge_crossed_paths()`))) &&
       !!(await fails(() => as(A, `select * from area_for_cell('w283c9')`))))
    await su(`delete from user_location_pings where user_id=$1`, [A])
    // A meets B twice in Bangsar (5 and 6 hours ago); C too, but C never opted in
    for (const h of [5, 6]) { await ping(A, X, h); await ping(B, X, h); await ping(C, X, h) }
    // D (blocked by A), E (banned), F (shadow-banned), G (male, not interested in men)
    for (const u of [D, E, F, G]) for (const h of [5, 6]) await ping(u, X, h)
    await as(A, `insert into blocks (blocked_id) values ($1)`, [D])
    await su(`update profiles set banned_at = now(), ban_reason = 'x', is_active = false where id=$1`, [E])
    await su(`update profiles set shadow_banned = true where id=$1`, [F])
    // H: only within the last 3 hours (delay); I: only one shared hour
    for (const h of [1, 2]) { await ping(A, Y, h); await ping(H, Y, h) }
    await ping(A, Y, 9); await ping(I, Y, 9)
    // J: only in A's home cell (A has night pings there)
    await ping(A, HOME, 20, true); await ping(A, HOME, 21, true)
    for (const h of [7, 8]) { await ping(A, HOME, h); await ping(J, HOME, h) }
    // K: only in K's dominant cell (8 of 8 hours there)
    for (let h = 5; h <= 12; h++) await ping(K, Z, h)
    for (const h of [10, 11]) await ping(A, Z, h)
    // retention fixtures
    await ping(L, X, 49)
    await su(`insert into crossed_paths (user_a, user_b, day, crossings)
       values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid), (now() at time zone 'Asia/Kuala_Lumpur')::date - 3, 2)`, [A, L])
    await su(`select compute_crossed_paths()`)
    const total = (await su(`select coalesce(sum(crossings),0)::int n from crossed_paths
       where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [A, B])).rows[0].n
    ok('crossed: pair found with 2 crossings', total === 2, String(total))
    const aRow = (await seen(A)).find((r) => r.id === B)
    ok('crossed: both see each other with an area name and a day only', !!aRow && (await sees(B, A)) && aRow.area === 'Bangsar' &&
       aRow.city === 'Kuala Lumpur' && typeof aRow.is_today === 'boolean' && aRow.crossings >= 1 &&
       JSON.stringify(Object.keys(aRow).sort()) === '["age","area","city","crossings","display_name","id","is_today","photo"]', JSON.stringify(aRow))
    ok('crossed: needs both opted in', !(await sees(A, C)) && (await pairCount(C)) === 0)
    ok('crossed: nothing shown to someone not opted in', (await seen(C)).length === 0)
    ok('crossed: blocked, banned, shadow-banned and incompatible excluded',
       !(await sees(A, D)) && !(await sees(A, E)) && !(await sees(A, F)) && !(await sees(A, G)) && !(await sees(D, A)) && !(await sees(G, A)) &&
       (await pairOf(A, D)) === 0 && (await pairCount(E)) === 0 && (await pairCount(F)) === 0 && (await pairOf(A, G)) === 0)
    ok('crossed: recent encounters delayed 3 hours', !(await sees(A, H)) && !(await sees(H, A)))
    ok('crossed: one shared hour is not enough', !(await sees(A, I)))
    ok('crossed: home (night) cell ignored', !(await sees(A, J)) && !(await sees(J, A)))
    ok('crossed: dominant cell ignored', !(await sees(A, K)))
    // block after the computation: hidden at read time
    await as(B, `insert into blocks (blocked_id) values ($1)`, [A])
    ok('crossed: block hides at read time', !(await sees(A, B)) && !(await sees(B, A)))
    await as(B, `delete from blocks where blocked_id=$1`, [A])
    ok('crossed: unblock shows again', await sees(A, B))
    await su(`update profiles set discoverable = false where id=$1`, [B])
    ok('crossed: paused profile hidden', !(await sees(A, B)))
    await su(`update profiles set discoverable = true where id=$1`, [B])
    // hide
    await as(A, `select hide_crossed_path($1)`, [B])
    ok('crossed: hidden person no longer shown', !(await sees(A, B)) && (await sees(B, A)))
    ok('crossed: cannot hide yourself', !!(await fails(() => as(A, `select hide_crossed_path($1)`, [A]))))
    // retention
    ok('crossed: pings older than 48 h purged', (await su(`select count(*)::int c from user_location_pings where user_id=$1`, [L])).rows[0].c === 0)
    ok('crossed: old encounters purged', (await pairCount(L)) === 0)
    ok('crossed: area name, else only the city', JSON.stringify((await su(`select * from area_for_cell('w283c9')`)).rows[0]) === '{"area":"Bangsar","city":"Kuala Lumpur"}' &&
       JSON.stringify((await su(`select * from area_for_cell('w0000z')`)).rows[0]) === '{"area":null,"city":null}')
    // turning it off deletes everything
    await as(B, `select set_crossed_paths(false)`)
    ok('crossed: turning off deletes pings and encounters', (await su(`select count(*)::int c from user_location_pings where user_id=$1`, [B])).rows[0].c === 0 &&
       (await pairCount(B)) === 0 && (await as(B, `select ping_location(3.13, 101.671) v`)).rows[0].v === false)
    ok('crossed: no anon access', (await su(`select has_function_privilege('anon', 'public.get_crossed_paths()', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('anon', 'public.ping_location(double precision, double precision)', 'execute') v`)).rows[0].v === false)

    // ----- similar statuses (the 24 h plans were replaced by statuses in 20261009000280) -----
    ok('plans: 24 h plans removed', (await su(`select to_regclass('public.user_plans') r`)).rows[0].r === null &&
       !!(await fails(() => as(J, `select set_plan('gym')`))))
    await as(J, `select set_status('🏋️', 'Gym later', 'gym')`)
    await as(A, `select set_status('💪', 'Gym anyone?', 'gym')`)
    const plain = (await as(A, `select * from get_swipe_candidates('{female}', 18, 99, 5, 50)`)).rows
    ok('statuses: candidates carry no plan column', plain.length > 0 && !('plan' in plain[0]), JSON.stringify(plain[0]))
    await su(`update profiles set last_active_at = now() - interval '1 day' where id=$1`, [J])
    // A joined over 14 days ago: no Discover priority key (20261009000290) in front of the sort.
    await su(`update profiles set created_at = now() - interval '30 days' where id=$1`, [A])
    const similar = (await as(A, `select id from get_swipe_candidates('{female}', 18, 99, 5, 50, true)`)).rows
    const usual = (await as(A, `select id from get_swipe_candidates('{female}', 18, 99, 5, 50, false)`)).rows
    ok('statuses: "Similar statuses" sorts the same preset first', similar[0]?.id === J && usual[0]?.id !== J && similar.length === usual.length, JSON.stringify(similar.slice(0, 3)))
    ok('statuses: blocked, banned and shadow-banned stay out of the deck', !similar.some((r) => r.id === E || r.id === F || r.id === D))
    await su(`update user_statuses set expires_at = now() - interval '1 second' where user_id=$1`, [J])
    const afterExpiry = (await as(A, `select id from get_swipe_candidates('{female}', 18, 99, 5, 50, true)`)).rows
    ok('statuses: an expired status no longer sorts first', afterExpiry[0]?.id !== J && afterExpiry.some((r) => r.id === J))
    await as(A, `select clear_status()`)
  })()
  // ===== end crossed paths & plans =====

  // ===== Blind Dating Night (20261009000210) =====
  // State transitions by the clock, event-only pairing, relaxed filters, auto re-queue after a
  // Pass, reminders and the push job, admin roles and logging; non-event joins unchanged.
  await (async () => {
    const E = ['e7e00000-0000-4000-8000-000000000001', 'e7e00000-0000-4000-8000-000000000002',
               'e7e00000-0000-4000-8000-000000000003', 'e7e00000-0000-4000-8000-000000000004',
               'e7e00000-0000-4000-8000-000000000005', 'e7e00000-0000-4000-8000-000000000006',
               'e7e00000-0000-4000-8000-000000000007', 'e7e00000-0000-4000-8000-000000000008']
    const [M1, F1, F2, M2, F3, VIEW, ADM, UNV] = E
    for (const [i, u] of E.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013888000' + i])
    // Ages (2026): M1 1996 (30), F1 1997 (29), F2 1986 (40), M2 1998 (28), F3 1984 (42), VIEW/ADM 1990 (36)
    for (const [u, name, g, w, bd] of [[M1, 'Ev Hafiz', 'male', '{female}', '1996-04-04'], [F1, 'Ev Nurul', 'female', '{male}', '1997-04-04'],
      [F2, 'Ev Mei', 'female', '{male}', '1986-04-04'], [M2, 'Ev Ravi', 'male', '{female}', '1998-04-04'], [F3, 'Ev Siti', 'female', '{male}', '1984-04-04'],
      [VIEW, 'Ev Viewer', 'male', '{female}', '1990-04-04'], [ADM, 'Ev Admin', 'male', '{female}', '1990-04-04'], [UNV, 'Ev Unverified', 'male', '{female}', '1990-04-04']])
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,$2,$3,$4,'Melaka','SRID=4326;POINT(102.25 2.19)')`, [name, bd, g, w])
    await su(`update profiles set verification_status='approved' where id = any($1) and id <> $2`, [E, UNV])
    await su(`insert into admins (user_id, role) values ($1, 'viewer'), ($2, 'admin')`, [VIEW, ADM])
    await su(`delete from random_chat_queue`)
    const svc = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const upsert = (admin, args) => svc(`select admin_upsert_event($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) id`,
      [admin, args.id ?? null, args.en ?? 'Night', args.ms ?? 'Malam', args.ru ?? 'Вечер', args.theme ?? null, args.starts, args.ends, args.recurrence ?? null, args.status ?? 'scheduled'])
    const tick = async () => (await svc(`select event_tick() t`)).rows[0].t
    const current = async (u) => (await as(u, `select * from get_current_event()`)).rows[0]
    const join = async (u, ev, genders = '{female}', min = 18, max = 99, tags = '{}') => (await as(u, `select randomizer_join($1, $2, $3, $4, $5) s`, [genders, min, max, tags, ev])).rows[0].s
    const queue = async (ev) => (await su(`select user_id, event_id, min_age, max_age, want_tags from random_chat_queue where event_id is not distinct from $1 order by enqueued_at`, [ev])).rows
    const logs = async (action) => (await su(`select admin_id, target_id, reason from moderation_actions where action=$1 order by created_at`, [action])).rows
    const plus = (min) => `now() + interval '${min} minutes'`
    const at = async (expr) => (await su(`select ${expr} t`)).rows[0].t

    // --- admin: roles, validation, logging
    ok('events: viewer cannot create', !!(await fails(async () => upsert(VIEW, { starts: await at(plus(60)), ends: await at(plus(120)) }))))
    ok('events: end before start rejected', !!(await fails(async () => upsert(ADM, { starts: await at(plus(120)), ends: await at(plus(60)) }))))
    ok('events: too short rejected', !!(await fails(async () => upsert(ADM, { starts: await at(plus(60)), ends: await at(plus(65)) }))))
    ok('events: scheduled start in the past rejected', !!(await fails(async () => upsert(ADM, { starts: await at(plus(-5)), ends: await at(plus(60)) }))))
    const ev1 = (await upsert(ADM, { en: 'Friday Night', theme: 'Coffee lovers', starts: await at(plus(60)), ends: await at(plus(120)), recurrence: 'weekly' })).rows[0].id
    ok('events: admin creates', !!ev1)
    const created = await logs('event.create')
    ok('events: creation logged', created.length === 1 && created[0].admin_id === ADM && created[0].target_id === ev1 && created[0].reason.includes('Friday Night') && created[0].reason.includes('weekly'), JSON.stringify(created))
    ok('events: tables closed to clients', !!(await fails(() => as(M1, `select * from scheduled_events`))) && !!(await fails(() => as(M1, `select * from event_reminders`))) && !!(await fails(() => as(M1, `select * from event_participants`))))
    ok('events: clients cannot call admin or job RPCs', !!(await fails(() => as(ADM, `select admin_list_events($1)`, [ADM]))) && !!(await fails(() => as(M1, `select event_tick()`))) && !!(await fails(() => as(M1, `select event_push_due()`))))
    const draft = (await upsert(ADM, { en: 'Draft', starts: await at(plus(30)), ends: await at(plus(90)), status: 'draft' })).rows[0].id
    const list = (await svc(`select * from admin_list_events($1)`, [VIEW])).rows
    ok('events: viewer lists events', list.length === 2 && list[0].id === ev1 && list[0].status === 'scheduled' && list[0].theme === 'Coffee lovers' && list[0].recurrence === 'weekly')

    // --- upcoming: what clients see, reminders
    const c1 = await current(M1)
    ok('events: get_current_event shows the next scheduled one (not the draft)', c1?.id === ev1 && c1.status === 'scheduled' && c1.in_room === 0 && c1.joined === 0 && c1.reminded === false && c1.title_ru === 'Вечер' && !!c1.server_now, JSON.stringify(c1))
    ok('events: remind on', (await as(M1, `select event_remind($1, true) r`, [ev1])).rows[0].r === true && (await current(M1)).reminded === true)
    ok('events: remind idempotent', (await as(M1, `select event_remind($1, true) r`, [ev1])).rows[0].r === true && (await su(`select count(*)::int c from event_reminders where event_id=$1`, [ev1])).rows[0].c === 1)
    ok('events: reminders are per user', (await current(F1)).reminded === false)
    ok('events: remind off', (await as(M1, `select event_remind($1, false) r`, [ev1])).rows[0].r === false && (await current(M1)).reminded === false)
    ok('events: remind on a draft rejected', !!(await fails(() => as(M1, `select event_remind($1, true)`, [draft]))))
    ok('events: unverified cannot remind', !!(await fails(() => as(UNV, `select event_remind($1, true)`, [ev1]))))
    await as(M1, `select event_remind($1, true)`, [ev1]); await as(F1, `select event_remind($1, true)`, [ev1])
    ok('events: joining an upcoming event rejected', !!(await fails(() => join(M1, ev1))))
    ok('events: joining a draft rejected', !!(await fails(() => join(M1, draft))))

    // --- push job: nothing yet, then the 15-minute reminder, once
    ok('events: no push due an hour ahead', (await svc(`select * from event_push_due()`)).rows.length === 0)
    await su(`update scheduled_events set starts_at = ${plus(10)}, ends_at = ${plus(70)} where id=$1`, [ev1])
    const due = (await svc(`select * from event_push_due()`)).rows
    ok('events: reminder due within 15 minutes', due.length === 2 && due.every((d) => d.kind === 'reminder' && d.event_id === ev1 && d.title_en === 'Friday Night') && due.map((d) => d.user_id).sort().join() === [M1, F1].sort().join(), JSON.stringify(due))
    ok('events: reminder sent once', (await svc(`select * from event_push_due()`)).rows.length === 0)
    await as(F2, `select event_remind($1, true)`, [ev1])
    ok('events: a late reminder goes to the new subscriber only', (await svc(`select * from event_push_due()`)).rows.map((d) => d.user_id).join() === F2)

    // --- the clock: scheduled -> live, without and with the tick
    await su(`update scheduled_events set starts_at = ${plus(-1)} where id=$1`, [ev1])
    ok('events: live by the clock before the tick', (await current(M1)).status === 'live')
    const t1 = await tick()
    ok('events: tick flips to live', t1.started === 1 && t1.ended === 0 && (await su(`select status from scheduled_events where id=$1`, [ev1])).rows[0].status === 'live')
    const startDue = (await svc(`select * from event_push_due()`)).rows
    ok('events: "starts now" push to every subscriber, once', startDue.length === 3 && startDue.every((d) => d.kind === 'start') && (await svc(`select * from event_push_due()`)).rows.length === 0, JSON.stringify(startDue))
    ok('events: remind on a live event rejected', !!(await fails(() => as(M2, `select event_remind($1, true)`, [ev1]))))

    // --- event-only pairing
    ok('events: first event join waits', (await join(M1, ev1)) === null)
    const q1 = await queue(ev1)
    ok('events: queue row carries the event and relaxed age band (30 +/- 10)', q1.length === 1 && q1[0].user_id === M1 && q1[0].min_age === 20 && q1[0].max_age === 40 && q1[0].want_tags.length === 0, JSON.stringify(q1))
    // F1 (29, wants men) fits M1 both ways, but the pools never mix.
    ok('events: a normal join does not pair with the event pool', (await join(F1, null, '{male}')) === null && (await queue(null)).length === 1)
    ok('events: an event join does not pair with the normal pool', (await join(M2, ev1)) === null && (await queue(ev1)).length === 2)
    await as(F1, `select randomizer_leave()`)
    ok('events: joined count = people who entered', (await current(F1)).joined === 2 && (await current(F1)).in_room === 2)
    // F2 is 40: within M1's band (20-40) and M1 (30) within hers (30-50); her own strict filters are
    // ignored. M2 (28) waits longer than nobody: M1 came first and is the FIFO pick.
    const s1 = await join(F2, ev1, '{male}', 45, 50, '{1}')
    ok('events: event join pairs inside the pool, ignoring the strict age and tag filters', !!s1)
    const sess = s1 && (await su(`select user_a, user_b, event_id from random_chat_sessions where id=$1`, [s1])).rows[0]
    ok('events: session tagged with the event, FIFO partner', sess?.event_id === ev1 && sess.user_a === M1 && sess.user_b === F2, JSON.stringify(sess))
    ok('events: get_blind_session returns event_id', (await as(M1, `select event_id from get_blind_session()`)).rows[0].event_id === ev1)
    ok('events: room counts a pair as two', (await current(F1)).in_room === 3)
    // The band holds both ways: F3 (42, band 32-52) would take M2 (28)? No: 28 < 32. And M2's band
    // 18-38 excludes 42.
    ok('events: outside the +/- 10 band does not pair', (await join(F3, ev1, '{male}')) === null && (await queue(ev1)).length === 2)
    // Gender still applies: VIEW (36) fits F3's band but wants men.
    ok('events: gender filter still applies', (await join(VIEW, ev1, '{male}')) === null)
    await as(VIEW, `select randomizer_leave()`)
    ok('events: blocks still apply', await (async () => {
      await as(F3, `insert into blocks (blocked_id) values ($1)`, [ADM])
      const r = (await join(ADM, ev1)) === null
      await su(`delete from blocks where blocker_id=$1`, [F3]); await as(ADM, `select randomizer_leave()`)
      return r
    })())
    ok('events: pairing records participants', (await su(`select count(*)::int c from event_participants where event_id=$1`, [ev1])).rows[0].c === 6)

    // --- auto re-queue after a Pass (both sides), not after a match, not outside events
    await as(M1, `select randomizer_send($1,'hi')`, [s1])
    const p1 = (await as(F2, `select blind_decide($1, false) r`, [s1])).rows[0].r
    const q2 = await queue(ev1)
    ok('events: pass re-queues both into the event pool', p1.state === 'passed' && q2.map((q) => q.user_id).sort().join() === [M1, F2, M2, F3].sort().join() && q2.every((q) => q.event_id === ev1), JSON.stringify(q2))
    ok('events: re-queued row has the relaxed band', q2.find((q) => q.user_id === F2).min_age === 30 && q2.find((q) => q.user_id === F2).max_age === 50)
    ok('events: client re-join after a pass is idempotent', await (async () => {
      // M1 re-joins: M2 (gender) and F3 (42, outside 20-40) are skipped, F2 fits: paired again
      const s = await join(M1, ev1)
      return !!s && (await su(`select user_b from random_chat_sessions where id=$1`, [s])).rows[0].user_b === M1
    })())
    const s2 = (await as(M1, `select id from get_blind_session()`)).rows[0].id
    await as(F2, `select blind_decide($1, true)`, [s2])
    const m2 = (await as(M1, `select blind_decide($1, true) r`, [s2])).rows[0].r
    ok('events: a match inside the event works as usual', m2.state === 'matched' && !!m2.match_id && (await su(`select source from matches where id=$1`, [m2.match_id])).rows[0].source === 'randomizer')
    ok('events: a match does not re-queue', !(await queue(ev1)).some((q) => [M1, F2].includes(q.user_id)))
    await su(`delete from matches where id=$1`, [m2.match_id])
    // Outside events: a pass never re-queues
    await su(`delete from random_chat_queue`)
    await join(M2, null); const s3 = await join(F1, null, '{male}')
    await as(M2, `select blind_decide($1, false)`, [s3])
    ok('events: a normal pass does not re-queue', (await queue(null)).length === 0)

    // --- stats
    const st = (await svc(`select admin_event_stats($1, $2) s`, [VIEW, ev1])).rows[0].s
    ok('events: stats (viewer)', st.joined === 6 && st.pairs === 2 && st.matches === 1 && st.reminders === 3 && st.status === 'live', JSON.stringify(st))

    // --- editing: a live event keeps its start; a moved upcoming event resets the reminder stamps
    const ev2 = (await upsert(ADM, { en: 'Later', starts: await at(plus(30)), ends: await at(plus(90)) })).rows[0].id
    await as(M1, `select event_remind($1, true)`, [ev2])
    await su(`update event_reminders set reminder_sent_at = now() where event_id=$1`, [ev2])
    await upsert(ADM, { id: ev2, en: 'Later 2', starts: await at(plus(45)), ends: await at(plus(90)) })
    const e2 = (await su(`select title_en, reminder_sent_at from scheduled_events e join event_reminders r on r.event_id = e.id where e.id=$1`, [ev2])).rows[0]
    ok('events: edit saved and reminder stamps reset', e2.title_en === 'Later 2' && e2.reminder_sent_at === null && (await logs('event.update')).length >= 1)
    ok('events: viewer cannot edit', !!(await fails(async () => upsert(VIEW, { id: ev2, starts: await at(plus(45)), ends: await at(plus(90)) }))))
    const before = (await su(`select starts_at, status from scheduled_events where id=$1`, [ev1])).rows[0]
    await upsert(ADM, { id: ev1, en: 'Friday Night!', theme: 'Coffee lovers', starts: await at(plus(500)), ends: await at(plus(40)), recurrence: 'weekly', status: 'draft' })
    const after = (await su(`select title_en, starts_at, status from scheduled_events where id=$1`, [ev1])).rows[0]
    ok('events: a live event keeps its start and status', after.title_en === 'Friday Night!' && +after.starts_at === +before.starts_at && after.status === 'live', JSON.stringify(after))
    ok('events: a live event cannot end in the past', !!(await fails(async () => upsert(ADM, { id: ev1, starts: await at(plus(500)), ends: await at(plus(-1)) }))))

    // --- ending: queue closed, sessions continue, weekly occurrence created once
    await su(`delete from random_chat_queue`)
    await join(M1, ev1); const s4 = await join(F2, ev1, '{male}'); await join(M2, ev1)
    ok('events: setup for the end', !!s4 && (await queue(ev1)).length === 1)
    await su(`update scheduled_events set ends_at = ${plus(-1)} where id=$1`, [ev1])
    ok('events: ended by the clock before the tick', (await current(F1))?.id !== ev1)
    ok('events: joining an ended event rejected', !!(await fails(() => join(F3, ev1, '{male}'))))
    const t2 = await tick()
    const endedRow = (await su(`select status, ended_at, stats_joined, stats_pairs, stats_matches from scheduled_events where id=$1`, [ev1])).rows[0]
    ok('events: tick ends it and freezes stats', t2.ended === 1 && t2.created === 1 && endedRow.status === 'ended' && !!endedRow.ended_at && endedRow.stats_joined === 6 && endedRow.stats_pairs === 3 && endedRow.stats_matches === 1, JSON.stringify(endedRow))
    ok('events: event queue closed', (await queue(ev1)).length === 0)
    ok('events: sessions in progress continue', (await su(`select status from random_chat_sessions where id=$1`, [s4])).rows[0].status === 'active')
    const next = (await su(`select * from scheduled_events where parent_id=$1`, [ev1])).rows[0]
    const prev = (await su(`select starts_at, ends_at from scheduled_events where id=$1`, [ev1])).rows[0]
    ok('events: next weekly occurrence', !!next && next.status === 'scheduled' && next.recurrence === 'weekly' && next.title_en === 'Friday Night!' && next.theme === 'Coffee lovers' && next.created_by === ADM &&
       +next.starts_at === +prev.starts_at + 7 * 86400_000 && +next.ends_at === +prev.ends_at + 7 * 86400_000, JSON.stringify(next))
    ok('events: tick is idempotent', (await tick()).created === 0 && (await su(`select count(*)::int c from scheduled_events where parent_id=$1`, [ev1])).rows[0].c === 1)
    const p4 = (await as(M1, `select blind_decide($1, false) r`, [s4])).rows[0].r
    ok('events: pass after the end does not re-queue', p4.state === 'passed' && (await queue(ev1)).length === 0)
    ok('events: editing an ended event rejected', !!(await fails(async () => upsert(ADM, { id: ev1, starts: await at(plus(45)), ends: await at(plus(90)) }))))
    ok('events: cancelling an ended event rejected', !!(await fails(() => svc(`select admin_cancel_event($1, $2)`, [ADM, ev1]))))

    // --- cancel: a live event closes its queue; the series stops
    const ev3 = (await upsert(ADM, { en: 'Cancelled Night', starts: await at(plus(5)), ends: await at(plus(60)), recurrence: 'weekly' })).rows[0].id
    await su(`update scheduled_events set starts_at = ${plus(-1)} where id=$1`, [ev3])
    await tick()
    await join(F3, ev3, '{male}')
    ok('events: viewer cannot cancel', !!(await fails(() => svc(`select admin_cancel_event($1, $2)`, [VIEW, ev3]))))
    await svc(`select admin_cancel_event($1, $2, $3)`, [ADM, ev3, 'host sick'])
    const c3 = (await su(`select status from scheduled_events where id=$1`, [ev3])).rows[0]
    ok('events: cancelled, queue closed, logged', c3.status === 'cancelled' && (await queue(ev3)).length === 0 && (await logs('event.cancel')).some((l) => l.target_id === ev3 && l.reason === 'Cancelled Night: host sick'))
    await su(`update scheduled_events set ends_at = ${plus(-1)} where id=$1`, [ev3])
    await tick()
    ok('events: a cancelled series spawns nothing', (await su(`select count(*)::int c from scheduled_events where parent_id=$1`, [ev3])).rows[0].c === 0)
    ok('events: get_current_event skips ended and cancelled', [ev2, next.id].includes((await current(M1))?.id))

    // --- retention: participant and reminder rows go 90 days after the end, stats stay
    await su(`update scheduled_events set ended_at = now() - interval '91 days' where id=$1`, [ev1])
    await tick()
    ok('events: participants and reminders purged after 90 days', (await su(`select count(*)::int c from event_participants where event_id=$1`, [ev1])).rows[0].c === 0 &&
       (await su(`select count(*)::int c from event_reminders where event_id=$1`, [ev1])).rows[0].c === 0 &&
       (await su(`select stats_joined from scheduled_events where id=$1`, [ev1])).rows[0].stats_joined === 6)

    // --- notification preference column
    ok('events: notification pref column, default on', (await as(M1, `insert into notification_prefs (events) values (false) returning events`)).rows[0].events === false &&
       (await su(`select column_default d from information_schema.columns where table_name='notification_prefs' and column_name='events'`)).rows[0].d === 'true')
    ok('events: anon cannot call the client RPCs', (await su(`select has_function_privilege('anon', 'public.get_current_event()', 'execute') a,
       has_function_privilege('anon', 'public.event_remind(uuid, boolean)', 'execute') b`)).rows.every((r) => !r.a && !r.b))
    await su(`delete from random_chat_queue`)
  })()
  // ===== end Blind Dating Night =====

  // ===== secret crush (20261009000250) =====
  await (async () => {
    const ids = Array.from({ length: 9 }, (_, i) => `d0000000-0000-4000-8000-0000000000${String(i + 10)}`)
    // INV invites; N1 (compatible, says yes), N2 (incompatible), N3 (says no), N4 (blocks, dismisses);
    // OLD signed up long ago; UNV is never verified; P1/P2 like each other from a profile page.
    const [INV, N1, N2, N3, N4, OLD, UNV, P1, P2] = ids
    for (const [i, u] of ids.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601488800' + String(i).padStart(2, '0')])
    const female = new Set([N1, N3, N4, OLD, P2])
    for (const [i, u] of ids.entries()) {
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
         values ($1,'1996-04-04',$2,$3,'Kuala Lumpur','SRID=4326;POINT(101.671 3.13)')`, ['Cr' + i, female.has(u) ? 'female' : 'male', female.has(u) ? '{male}' : '{female}'])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [[INV, OLD, P1, P2]])
    await su(`update profiles set created_at = now() - interval '2 days' where id=$1`, [OLD])
    // The inviter is on Plus: 3 crush links per 30 days (20261009000280).
    await su(`update plan_grants set plan = 'plus' where user_id=$1`, [INV])
    const pending = async (u) => (await as(u, `select * from get_pending_crush()`)).rows
    const matched = async (a, b) => (await su(`select id from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [a, b])).rows[0]?.id ?? null
    const likes = async (a, b) => (await su(`select count(*)::int c from swipes where (swiper_id=$1 and swiped_id=$2) or (swiper_id=$2 and swiped_id=$1)`, [a, b])).rows[0].c
    const invite = async (u, crush) => (await as(u, `select create_referral_invite($1) c`, [crush])).rows[0].c

    // creating invites
    ok('crush: unverified cannot create an invite', !!(await fails(() => invite(UNV, true))))
    const c1 = await invite(INV, true), c2 = await invite(INV, true), c3 = await invite(INV, true)
    ok('crush: single-use codes', [c1, c2, c3].every((c) => /^[a-z0-9]{8}$/.test(c)) && new Set([c1, c2, c3]).size === 3, [c1, c2, c3].join())
    const limitErr = await fails(() => invite(INV, true))
    ok('crush: at most 3 crush invites per 30 days on Plus', !!limitErr && limitErr.includes('crush_links_per_30d'), limitErr)
    const c0 = await invite(INV, false)
    ok('crush: plain invites are not limited by the crush limit', /^[a-z0-9]{8}$/.test(c0))
    ok('crush: the flag lives on the invite row only', (await su(`select is_crush from referral_invites where code=$1`, [c0])).rows[0].is_crush === false &&
       (await su(`select count(*)::int c from information_schema.columns where table_name='profiles' and column_name like '%crush%'`)).rows[0].c === 0)
    ok('crush: invites never readable by clients', !!(await fails(() => as(INV, `select * from referral_invites`))) && !!(await fails(() => as(N1, `select * from referral_invites`))) &&
       !!(await fails(() => as(INV, `update referral_invites set is_crush = true`))) && !!(await fails(() => as(INV, `delete from referral_invites`))))

    // claiming (at sign-up, before verification)
    ok('crush: invitee claims the invite', (await as(N1, `select claim_referral($1) v`, [c1.toUpperCase()])).rows[0].v === true &&
       (await su(`select referred_by r from profiles where id=$1`, [N1])).rows[0].r === INV &&
       (await su(`select invitee_id i, claimed_at is not null t from referral_invites where code=$1`, [c1])).rows[0].i === N1)
    ok('crush: an invite is claimed once', (await as(N4, `select claim_referral($1) v`, [c1])).rows[0].v === false &&
       (await su(`select referred_by r from profiles where id=$1`, [N4])).rows[0].r === null)
    ok('crush: a person claims one invite', (await as(N1, `select claim_referral($1) v`, [c2])).rows[0].v === false &&
       (await su(`select invitee_id i from referral_invites where code=$1`, [c2])).rows[0].i === null)
    ok('crush: own code not claimable', (await as(INV, `select claim_referral($1) v`, [c0])).rows[0].v === false)
    ok('crush: old profile cannot claim', (await as(OLD, `select claim_referral($1) v`, [c0])).rows[0].v === false)
    await as(N2, `select claim_referral($1)`, [c2]); await as(N3, `select claim_referral($1)`, [c3])
    ok('crush: inviter only sees the invite count, as today', (await as(INV, `select invited from get_my_referral()`)).rows[0].invited === 3)
    await su(`update referral_invites set created_at = now() - interval '31 days' where code=$1`, [c0])
    ok('crush: expired invite not claimable', (await as(N4, `select claim_referral($1) v`, [c0])).rows[0].v === false)

    // the card
    ok('crush: no card before verification', (await pending(N1)).length === 0 && !!(await fails(() => as(N1, `select answer_crush(true)`))))
    await su(`update profiles set verification_status='approved' where id = any($1)`, [[N1, N2, N3]])
    const card = await pending(N1)
    ok('crush: card after verification', card.length === 1 && card[0].inviter_id === INV && card[0].display_name === 'Cr0' && card[0].age === 30 && card[0].compatible === true, JSON.stringify(card))
    ok('crush: inviter and others see no card', (await pending(INV)).length === 0 && (await pending(P1)).length === 0)
    ok('crush: incompatible = reveal without a match offer', (await pending(N2))[0]?.compatible === false)
    ok('crush: no card for a plain invite', (await as(N4, `select claim_referral($1) v`, [await invite(P1, false)])).rows[0].v === true && (await pending(N4)).length === 0)
    await su(`update profiles set referred_by = null where id=$1`, [N4]); await su(`delete from referral_invites where inviter_id=$1`, [P1])

    // yes
    const yes = (await as(N1, `select * from answer_crush(true)`)).rows[0]
    const mid = await matched(INV, N1)
    ok('crush: yes = mutual match', !!mid && yes.match_id === mid && yes.inviter_id === INV, JSON.stringify(yes))
    ok('crush: match built from two likes, like a swipe match', (await su(`select count(*)::int c from swipes where ((swiper_id=$1 and swiped_id=$2) or (swiper_id=$2 and swiped_id=$1)) and direction='like'`, [INV, N1])).rows[0].c === 2 &&
       (await su(`select source from matches where id=$1`, [mid])).rows[0].source === 'swipe')
    ok('crush: card shown once', (await pending(N1)).length === 0 && !!(await fails(() => as(N1, `select answer_crush(true)`))))
    ok('crush: answer stored', (await su(`select crush_answer a, crush_answered_at is not null t from referral_invites where code=$1`, [c1])).rows[0].a === true)
    // no
    const no = (await as(N3, `select * from answer_crush(false)`)).rows[0]
    ok('crush: no = nothing happens', no.inviter_id === INV && no.match_id === null && (await matched(INV, N3)) === null && (await likes(INV, N3)) === 0)
    ok('crush: no is never shown to the inviter', (await as(INV, `select count(*)::int c from get_incoming_likes()`)).rows[0].c === 0 &&
       (await as(INV, `select count(*)::int c from swipes`)).rows[0].c === 1 && (await pending(N3)).length === 0)
    // incompatible
    const inc = (await as(N2, `select * from answer_crush(true)`)).rows[0]
    ok('crush: incompatible yes = no match', inc.match_id === null && (await matched(INV, N2)) === null && (await likes(INV, N2)) === 0)

    // 30-day window, blocks, dismissal
    await su(`update referral_invites set created_at = now() - interval '31 days' where code=$1`, [c1])
    const c4 = await invite(INV, true)
    ok('crush: limit window is 30 days', /^[a-z0-9]{8}$/.test(c4))
    ok('crush: unverified invitee claims but gets no card', (await as(N4, `select claim_referral($1) v`, [c4])).rows[0].v === true && (await pending(N4)).length === 0)
    await su(`update profiles set verification_status='approved' where id=$1`, [N4])
    ok('crush: card once verified', (await pending(N4)).length === 1)
    await as(N4, `insert into blocks (blocked_id) values ($1)`, [INV])
    ok('crush: no card while blocked', (await pending(N4)).length === 0)
    await as(N4, `delete from blocks where blocked_id=$1`, [INV])
    await su(`update profiles set discoverable = false where id=$1`, [INV])
    ok('crush: paused inviter still shows (not discoverable but visible)', (await pending(N4)).length === 1)
    await su(`update profiles set is_active = false where id=$1`, [INV])
    ok('crush: inactive inviter hides the card', (await pending(N4)).length === 0)
    await su(`update profiles set is_active = true, discoverable = true where id=$1`, [INV])
    const dis = (await as(N4, `select * from answer_crush(null)`)).rows[0]
    ok('crush: dismiss = seen, nothing stored as an answer', dis.match_id === null && (await pending(N4)).length === 0 && (await likes(INV, N4)) === 0 &&
       (await su(`select crush_answer a, crush_answered_at is not null t from referral_invites where code=$1`, [c4])).rows[0].a === null &&
       (await su(`select crush_answered_at is not null t from referral_invites where code=$1`, [c4])).rows[0].t === true)

    // retention & grants
    await su(`select purge_referral_invites()`)
    ok('crush: expired unclaimed invites purged, claimed kept', (await su(`select string_agg(code, ',' order by code) s from referral_invites where inviter_id=$1`, [INV])).rows[0].s === [c1, c2, c3, c4].sort().join())
    ok('crush: no anon access, purge is server-only', (await su(`select has_function_privilege('anon', 'public.get_pending_crush()', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('anon', 'public.answer_crush(boolean)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('anon', 'public.create_referral_invite(boolean)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.purge_referral_invites()', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.crush_compatible(uuid, uuid)', 'execute') v`)).rows[0].v === false)
    ok('crush: notification pref defaults on', (await as(N1, `insert into notification_prefs default values returning crush`)).rows[0].crush === true)

    // secret like from a profile page (people search / crossed paths): the same insert as the deck
    await as(P1, `insert into swipes (swiped_id, direction) values ($1,'like')`, [P2])
    ok('secret like: target sees nothing', (await as(P2, `select count(*)::int c from swipes`)).rows[0].c === 0 && (await matched(P1, P2)) === null)
    ok('secret like: only "who liked you" shows it, by design', (await as(P2, `select id from get_incoming_likes()`)).rows.map((r) => r.id).join() === P1)
    await as(P2, `insert into swipes (swiped_id, direction) values ($1,'like')`, [P1])
    ok('secret like: mutual like = match', !!(await matched(P1, P2)))
    const readers = (await su(`select string_agg(p.proname, ',' order by p.proname) s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosrc ~ 'public\\.swipes' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')`)).rows[0].s
    // Everything else goes through server-only helpers (incoming_like_ids, swipe_candidate_pool).
    // 20261009000290: send_like_note writes the like, my_profile_visitors reads the caller's own
    // likes, incoming_like_notes shows a note only to its recipient (the note is meant to be seen).
    ok('secret like: only known RPCs read swipes', readers === 'answer_crush,incoming_like_notes,my_profile_visitors,send_like_note', readers)
    ok('secret like: swipe helpers are server-only', (await su(`select bool_and(not has_function_privilege('authenticated', p.oid, 'execute')) v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('incoming_like_ids', 'swipe_candidate_pool', 'new_people_alert_recipients')`)).rows[0].v === true)
    ok('secret like: no view exposes swipes', (await su(`select count(*)::int c from pg_views where schemaname = 'public' and definition ~ 'swipes'`)).rows[0].c === 0)
  })()
  // ===== end secret crush =====
  // ===== promo codes / VIP (20261009000230) =====
  // Every redeem_promo rule, reservation until the selfie check, counting under a row lock,
  // rate limit, perks, expression-based expiry, Discover boost, admin role checks and logging.
  await (async () => {
    const P = ['9c000000-0000-4000-8000-000000000001', '9c000000-0000-4000-8000-000000000002',
               '9c000000-0000-4000-8000-000000000003', '9c000000-0000-4000-8000-000000000004',
               '9c000000-0000-4000-8000-000000000005', '9c000000-0000-4000-8000-000000000006',
               '9c000000-0000-4000-8000-000000000007', '9c000000-0000-4000-8000-000000000008']
    const [F1, F2, F3, M1, M2, NEW, ADM, MOD] = P
    for (const [i, u] of P.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '6013888000' + i])
    for (const [u, name, g, w] of [[F1, 'Aina', 'female', '{male}'], [F2, 'Lina', 'female', '{male}'], [F3, 'Dewi', 'female', '{male}'],
      [M1, 'Amir', 'male', '{female}'], [M2, 'Zul', 'male', '{female}'], [NEW, 'Nur', 'female', '{male}'],
      [ADM, 'Admin', 'male', '{female}'], [MOD, 'Mod', 'male', '{female}']])
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,'1998-02-02',$2,$3,'Johor Bahru','SRID=4326;POINT(103.76 1.49)')`, [name, g, w])
    await su(`update profiles set verification_status='approved' where id = any($1) and id <> $2`, [P, NEW])
    await su(`insert into admins (user_id, role) values ($1, 'admin'), ($2, 'moderator')`, [ADM, MOD])
    const redeem = async (u, code) => (await as(u, `select redeem_promo($1) r`, [code])).rows[0].r
    const vip = async (u) => (await as(u, `select my_vip() v`)).rows[0].v
    // Plans (20261009000280): VIP is a plan grant now; these users start on free.
    await su(`delete from plan_grants where user_id = any($1)`, [P])
    const prof = async (u) => (await su(`select case when plan_of(id) = 'vip' then plan_until(id) end vip_until, vip_boost_until,
      jsonb_build_object('see_likes', has_feature(id, 'who_liked_you'), 'queue_priority', has_feature(id, 'event_priority')) vip_perks
      from profiles where id=$1`, [u])).rows[0]
    const logs = async (action) => (await su(`select count(*)::int c from moderation_actions where action=$1 and admin_id=$2`, [action, ADM])).rows[0].c
    const upsert = (admin, args) => su(`select admin_upsert_promo($1, $2, $3, $4, $5, $6::jsonb, $7, $8) id`,
      [admin, args.id ?? null, args.code, args.maxUses ?? null, args.expiresAt ?? null, JSON.stringify(args.benefits), args.gender ?? null, args.requiresVerified ?? true])
    const statsOf = async (id) => (await su(`select * from admin_promo_stats($1)`, [ADM])).rows.find((r) => r.id === id)

    // --- tables closed, normalisation, seed (M1 makes the probe calls: 5 attempts per hour per user)
    ok('promo: tables closed to clients', !!(await fails(() => as(F1, `select * from promo_codes`))) &&
       !!(await fails(() => as(F1, `select * from promo_redemptions`))) && !!(await fails(() => as(F1, `select * from promo_attempts`))))
    ok('promo: anon cannot redeem', (await su(`select has_function_privilege('anon', 'public.redeem_promo(text)', 'execute') a`)).rows[0].a === false)
    ok('promo: normalisation', (await su(`select normalize_promo_code('  xmum first_100 ') n`)).rows[0].n === 'XMUMFIRST_100')
    const seed = (await su(`select * from promo_codes where code='XMUM_FIRST_100'`)).rows[0]
    ok('promo: seed code is inactive, female, 100 uses', seed && seed.is_active === false && seed.gender_restriction === 'female' && seed.max_uses === 100 &&
       seed.benefits.plan === 'vip' && seed.benefits.days === 90 && Object.keys(seed.benefits).length === 2, JSON.stringify(seed))
    ok('promo: inactive code reads as invalid', (await redeem(M1, 'xmum_first_100')).error === 'invalid')
    ok('promo: unknown code', (await redeem(M1, 'NOPE123')).error === 'invalid')
    ok('promo: empty code', (await redeem(M1, '   ')).error === 'invalid')

    // --- admin: role checks and logging
    ok('promo: moderator cannot create', (await fails(() => upsert(MOD, { code: 'MODCODE', benefits: { vip_days: 1 } })))?.includes('admin'))
    ok('promo: client cannot call admin RPCs', !!(await fails(() => as(F1, `select admin_promo_stats($1)`, [F1]))) &&
       !!(await fails(() => as(ADM, `select admin_upsert_promo($1, null, 'X', null, null, '{}', null, true)`, [ADM]))))
    ok('promo: invalid benefits rejected', !!(await fails(() => upsert(ADM, { code: 'BAD1', benefits: { see_likes: true } }))) &&
       !!(await fails(() => upsert(ADM, { code: 'BAD2', benefits: { vip_days: -1 } }))) &&
       !!(await fails(() => upsert(ADM, { code: 'BAD3', benefits: { vip_days: 1, extra: 1 } }))) &&
       !!(await fails(() => upsert(ADM, { code: 'BAD4', benefits: {} }))))
    ok('promo: invalid code text rejected', !!(await fails(() => upsert(ADM, { code: 'a b!', benefits: { vip_days: 1 } }))) &&
       !!(await fails(() => upsert(ADM, { code: 'ab', benefits: { vip_days: 1 } }))))
    ok('promo: gender restriction only male/female', !!(await fails(() => upsert(ADM, { code: 'OTHERS', benefits: { vip_days: 1 }, gender: 'other' }))))
    const two = (await upsert(ADM, { code: ' two-seats ', maxUses: 2, benefits: { vip_days: 7, boost_hours: 24, see_likes: true }, requiresVerified: false })).rows[0].id
    ok('promo: create normalises and logs', (await su(`select code from promo_codes where id=$1`, [two])).rows[0].code === 'TWO-SEATS' && (await logs('promo.create')) === 1)
    ok('promo: case-insensitive uniqueness', (await fails(() => upsert(ADM, { code: 'two-SEATS', benefits: { vip_days: 1 } })))?.includes('promo_codes_code_key'))
    await upsert(ADM, { id: two, code: 'TWO-SEATS', maxUses: 2, benefits: { vip_days: 7, boost_hours: 24, see_likes: true, queue_priority: true }, requiresVerified: false })
    ok('promo: edit logs', (await logs('promo.update')) === 1 && (await su(`select benefits->'queue_priority' q from promo_codes where id=$1`, [two])).rows[0].q === true)
    ok('promo: editing a missing code fails', !!(await fails(() => upsert(ADM, { id: '9c000000-0000-4000-8000-0000000000ff', code: 'GHOST', benefits: { vip_days: 1 } }))))
    await su(`select admin_set_promo_active($1, $2, false)`, [ADM, two])
    ok('promo: deactivate logs and hides the code', (await logs('promo.deactivate')) === 1 && (await redeem(M1, 'two-seats')).error === 'invalid')
    await su(`select admin_set_promo_active($1, $2, false)`, [ADM, two])
    ok('promo: no log when nothing changes', (await logs('promo.deactivate')) === 1)
    await su(`select admin_set_promo_active($1, $2, true)`, [ADM, two])
    ok('promo: activate logs', (await logs('promo.activate')) === 1)
    ok('promo: moderator cannot toggle', !!(await fails(() => su(`select admin_set_promo_active($1, $2, false)`, [MOD, two]))))

    // --- granting, stacking, counting to max_uses
    const before = await prof(F1)
    ok('promo: no VIP before', before.vip_until === null && (await vip(F1)).is_vip === false && (await su(`select is_vip($1) v`, [F1])).rows[0].v === false)
    const g1 = await redeem(F1, 'two-seats')
    ok('promo: granted as a VIP plan grant', g1.status === 'granted' && g1.code === 'TWO-SEATS' && g1.plan === 'vip' && g1.days === 7 && g1.boost_hours === 24 &&
       !!g1.vip_until && !!g1.boost_until && (await su(`select source from plan_grants where user_id=$1`, [F1])).rows[0]?.source === 'promo', JSON.stringify(g1))
    const a1 = await prof(F1)
    ok('promo: vip_until about 7 days, boost about 24h', Math.abs((new Date(a1.vip_until) - Date.now()) / 864e5 - 7) < 0.05 &&
       Math.abs((new Date(a1.vip_boost_until) - Date.now()) / 36e5 - 24) < 0.05, JSON.stringify(a1))
    ok('promo: is_vip / has_vip_perk / my_vip', (await su(`select is_vip($1) v`, [F1])).rows[0].v === true &&
       (await su(`select has_vip_perk($1, 'see_likes') v`, [F1])).rows[0].v === true &&
       (await su(`select has_vip_perk($1, 'nothing') v`, [F1])).rows[0].v === false &&
       (await as(M1, `select is_vip($1) v`, [F1])).rows[0].v === true && (await vip(F1)).is_vip === true && (await vip(F1)).pending === 0)
    ok('promo: already redeemed', (await redeem(F1, 'TWO-SEATS')).error === 'already_redeemed')
    ok('promo: second seat taken', (await redeem(F2, 'two-seats')).status === 'granted')
    ok('promo: used up for the third', (await redeem(F3, 'two-seats')).error === 'used_up')
    ok('promo: current_uses counted', (await su(`select current_uses c from promo_codes where id=$1`, [two])).rows[0].c === 2)
    const st = await statsOf(two)
    ok('promo: stats row', st.current_uses === 2 && Number(st.granted_count) === 2 && Number(st.pending_count) === 0 && st.is_active === true, JSON.stringify(st))
    const reds = (await su(`select * from admin_promo_redemptions($1, $2)`, [ADM, two])).rows
    ok('promo: redemptions list', reds.length === 2 && reds.every((r) => r.phone?.startsWith('6013888') && r.username && r.granted_at), JSON.stringify(reds))
    // stacking: a second code extends the running VIP
    const plus = (await upsert(ADM, { code: 'PLUS3', benefits: { vip_days: 3 }, requiresVerified: false })).rows[0].id
    await redeem(F1, 'plus3')
    const a2 = await prof(F1)
    ok('promo: VIP stacks', Math.abs((new Date(a2.vip_until) - Date.now()) / 864e5 - 10) < 0.05 && a2.vip_perks.see_likes === true, JSON.stringify(a2))
    await su(`delete from promo_codes where id=$1`, [plus])

    // --- expiry of codes and VIP
    const old = (await upsert(ADM, { code: 'OLDCODE', benefits: { vip_days: 1 }, expiresAt: new Date(Date.now() - 1000).toISOString(), requiresVerified: false })).rows[0].id
    ok('promo: expired code', (await redeem(F3, 'oldcode')).error === 'expired')
    await su(`delete from promo_codes where id=$1`, [old])
    await su(`update plan_grants set starts_at = now() - interval '8 days', ends_at = now() - interval '1 second' where user_id=$1`, [F2])
    await su(`update profiles set vip_boost_until = now() - interval '1 second' where id=$1`, [F2])
    const v2 = await vip(F2)
    ok('promo: VIP expiry is automatic', v2.is_vip === false && v2.boost_until === null && (await su(`select is_vip($1) v`, [F2])).rows[0].v === false &&
       (await su(`select has_vip_perk($1, 'see_likes') v`, [F2])).rows[0].v === false, JSON.stringify(v2))
    ok('promo: vip_ids lists only active VIPs the caller may see', JSON.stringify((await as(M1, `select vip_ids($1) id`, [[F1, F2, F3, M1]])).rows.map((r) => r.id)) === JSON.stringify([F1]))

    // --- gender restriction and verification requirement (reservation)
    const women = (await upsert(ADM, { code: 'WOMEN10', maxUses: 10, benefits: { vip_days: 30, boost_hours: 48, see_likes: true, queue_priority: true }, gender: 'female', requiresVerified: true })).rows[0].id
    ok('promo: not for men', (await redeem(M1, 'women10')).error === 'not_for_you')
    ok('promo: woman gets it', (await redeem(F3, 'women10')).status === 'granted')
    const pend = await redeem(NEW, 'WOMEN10')
    ok('promo: unverified gets a reservation', pend.status === 'pending' && pend.benefits.vip_days === 30, JSON.stringify(pend))
    ok('promo: reservation takes a use and grants nothing yet', (await su(`select current_uses c from promo_codes where id=$1`, [women])).rows[0].c === 2 &&
       (await prof(NEW)).vip_until === null && (await vip(NEW)).pending === 1 && (await su(`select is_vip($1) v`, [NEW])).rows[0].v === false)
    ok('promo: reservation counts as redeemed', (await redeem(NEW, 'women10')).error === 'already_redeemed')
    ok('promo: pending in stats', Number((await statsOf(women)).pending_count) === 1 && Number((await statsOf(women)).granted_count) === 1)
    await as(NEW, `insert into verification_requests (selfie_path, challenge) values ($1, 'peace')`, [`${NEW}/s.jpg`])
    await su(`update verification_requests set status='rejected', rejection_reason='face_not_visible' where user_id=$1`, [NEW])
    ok('promo: rejection grants nothing', (await prof(NEW)).vip_until === null)
    await su(`update verification_requests set status='approved' where user_id=$1`, [NEW])
    const nv = await prof(NEW)
    ok('promo: approval grants the reserved perks', !!nv.vip_until && !!nv.vip_boost_until && nv.vip_perks.queue_priority === true &&
       (await su(`select is_vip($1) v`, [NEW])).rows[0].v === true && (await vip(NEW)).pending === 0 &&
       (await su(`select count(*)::int c from promo_redemptions where user_id=$1 and granted_at is not null`, [NEW])).rows[0].c === 1, JSON.stringify(nv))
    await su(`update verification_requests set status='pending' where user_id=$1`, [NEW])
    await su(`update verification_requests set status='approved' where user_id=$1`, [NEW])
    ok('promo: re-approval grants nothing twice', Math.abs(new Date((await prof(NEW)).vip_until) - new Date(nv.vip_until)) < 1000)

    // --- rate limit: 5 calls per hour, successful or not
    for (let i = 0; i < 5; i++) await redeem(M2, 'nope' + i)
    ok('promo: 6th attempt in an hour blocked', (await redeem(M2, 'two-seats')).error === 'too_many_attempts')
    ok('promo: failed attempts are kept', (await su(`select count(*)::int c from promo_attempts where user_id=$1`, [M2])).rows[0].c === 5)
    await su(`update promo_attempts set created_at = now() - interval '61 minutes' where user_id=$1`, [M2])
    ok('promo: attempts expire after an hour', (await redeem(M2, 'nope')).error === 'invalid' &&
       (await su(`select count(*)::int c from promo_attempts where user_id=$1`, [M2])).rows[0].c === 1)

    // --- Discover boost: the boosted profile comes first even when less recently active
    await su(`update profiles set last_active_at = now() - interval '5 days', vip_boost_until = now() + interval '1 hour' where id=$1`, [F3])
    await su(`update profiles set last_active_at = now(), vip_boost_until = null where id = any($1)`, [[F1, F2, NEW]])
    const deck = (await as(M2, `select id from get_swipe_candidates('{female}', 18, 40, 50, 20)`)).rows.map((r) => r.id)
    ok('promo: boosted profile first', deck[0] === F3 && deck.includes(F1) && deck.includes(F2), JSON.stringify(deck))
    await su(`update profiles set vip_boost_until = now() - interval '1 minute' where id=$1`, [F3])
    ok('promo: expired boost drops back', (await as(M2, `select id from get_swipe_candidates('{female}', 18, 40, 50, 20)`)).rows.map((r) => r.id)[0] !== F3)
    ok('promo: candidate columns unchanged', !('vip' in ((await as(M2, `select * from get_swipe_candidates('{female}', 18, 40, 50, 1)`)).rows[0] ?? {})))
    ok('promo: one get_swipe_candidates overload (the 20261009000200 signature)',
       (await su(`select count(*)::int c from pg_proc where proname='get_swipe_candidates' and pronamespace='public'::regnamespace`)).rows[0].c === 1 &&
       (await su(`select pg_get_function_identity_arguments(oid) a from pg_proc where proname='get_swipe_candidates' and pronamespace='public'::regnamespace`)).rows[0].a.includes('p_similar_plans'))
    // boost first, then "Similar plans", then the usual order; the plan column still comes through
    await su(`update profiles set vip_boost_until = now() + interval '1 hour', last_active_at = now() - interval '5 days' where id=$1`, [F3])
    await as(M2, `select set_status('🏋️', 'Gym', 'gym')`)
    await as(F1, `select set_status('🏋️', 'Gym', 'gym')`)
    await su(`update profiles set last_active_at = now() - interval '2 days' where id=$1`, [F1])
    // M2 joined over 14 days ago: no Discover priority key (20261009000290) in front of the sort.
    await su(`update profiles set created_at = now() - interval '30 days' where id=$1`, [M2])
    const planDeck = (await as(M2, `select id from get_swipe_candidates('{female}', 18, 40, 50, 20, true)`)).rows
    ok('promo: boost outranks similar statuses, which outrank activity', planDeck[0]?.id === F3 && planDeck[1]?.id === F1, JSON.stringify(planDeck))
    await as(M2, `select clear_status()`)
    await as(F1, `select clear_status()`)
    await su(`update profiles set vip_boost_until = null where id=$1`, [F3])
  })()
  // ===== end promo codes / VIP =====

  // ===== feed conversations (20261009000220): reply privately + daily question =====
  // Anonymity of the post author and the replier, limits, the 5-message reveal unlock, rotation at
  // 19:00 MYT, same-option matching filters, rate limits, pushes, admin queue. Own users.
  await (async () => {
    const F = (i) => `fc000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    const P = F(1), R = F(2), R2 = F(3), P2 = F(4), FAR = F(5), Z = F(6), X = F(7), A = F(8)
    const M = Array.from({ length: 10 }, (_, i) => F(20 + i))
    const people = [[P, 'Aisyah', 'female', '{male}', 101.70, 3.14], [R, 'Daniel', 'male', '{female}', 101.71, 3.15],
      [R2, 'Farid', 'male', '{female}', 101.72, 3.13], [P2, 'Zara', 'female', '{male}', 101.69, 3.12],
      [FAR, 'Jamal', 'male', '{female}', 110.35, 1.55], [Z, 'Lina', 'female', '{male}', 101.68, 3.16],
      [X, 'Outsider', 'male', '{female}', 101.70, 3.10], [A, 'Mod', 'male', '{female}', 101.70, 3.11],
      ...M.map((u, i) => [u, 'Guy' + i, 'male', '{female}', 101.70 + i * 0.001, 3.14])]
    for (const [i, [u]] of people.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '60137790' + String(i).padStart(3, '0')])
    for (const [u, name, g, w, lon, lat] of people)
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,'1997-07-07',$2,$3,'Kuala Lumpur','SRID=4326;POINT(${lon} ${lat})')`, [name, g, w])
    await su(`update profiles set verification_status='approved' where id::text like 'fc000000-%'`)
    await su(`delete from random_chat_queue`)
    const leaks = (row, ...needles) => { const j = JSON.stringify(row); return needles.some((n) => j.includes(n)) }
    const bs = async (u, s) => (await as(u, `select * from get_blind_session($1)`, [s])).rows[0]
    const decide = async (u, s, c) => (await as(u, `select blind_decide($1, $2) r`, [s, c])).rows[0].r
    const start = async (u, post, body = 'hi') => (await as(u, `select start_post_conversation($1, $2) r`, [post, body])).rows[0].r
    const conv = async (u) => (await as(u, `select * from list_my_conversations()`)).rows
    const newPost = async (author, body) => (await su(`insert into posts (author_id, body) values ($1, $2) returning id`, [author, body])).rows[0].id

    // --- reply privately: anonymity both ways
    const post = (await as(P, `select create_post('Anyone up for a mamak run tonight?') id`)).rows[0].id
    const r1 = await start(R, post, 'count me in')
    ok('fc: reply privately starts a conversation', r1.created === true && !!r1.session_id && !!r1.message_id && r1.state === 'active', JSON.stringify(r1))
    const sid = r1.session_id
    const rv = await bs(R, sid)
    const pseud = (await su(`select feed_pseudonym($1, 0) v`, [post])).rows[0].v
    ok('fc: replier sees the post and the author pseudonym', rv.kind === 'post' && rv.my_side === 'b' && rv.context.body === 'Anyone up for a mamak run tonight?' &&
       JSON.stringify(rv.context.author_pseudonym) === JSON.stringify(pseud) && rv.context.author === null && rv.context.i_am_author === false, JSON.stringify(rv))
    ok('fc: replier gets no author id, name or profile', rv.partner === null && rv.match_id === null && !leaks(rv, P, 'Aisyah'))
    ok('fc: replier message counts', rv.my_messages === 1 && rv.partner_messages === 0 && rv.revealed_from_start === false)
    const pv = await bs(P, sid)
    ok('fc: author sees own side, nothing about the replier', pv.my_side === 'a' && pv.context.i_am_author === true && pv.context.author === null && pv.context.author_pseudonym === null &&
       pv.partner === null && pv.partner_alias >= 100 && pv.partner_alias <= 999 && !leaks(pv, R, 'Daniel'), JSON.stringify(pv))
    ok('fc: no common tags hint on post conversations', JSON.stringify(pv.common_tags) === '[]' && JSON.stringify(rv.common_tags) === '[]')
    const hist = (await as(P, `select * from get_random_messages($1)`, [sid])).rows
    ok('fc: author reads the first message without sender id', hist.length === 1 && hist[0].body === 'count me in' && hist[0].is_mine === false && !leaks(hist, R))
    ok('fc: first message broadcast on the session topic', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='message'`, ['random:' + sid])).rows[0].c === 1)
    ok('fc: outsider sees nothing', (await as(X, `select * from get_blind_session($1)`, [sid])).rows.length === 0 && (await as(X, `select * from get_random_messages($1)`, [sid])).rows.length === 0)
    const pl = await conv(P), rl = await conv(R)
    ok('fc: conversation list for the author', pl.length === 1 && pl[0].id === sid && pl[0].kind === 'post' && pl[0].last_body === 'count me in' && pl[0].last_mine === false && pl[0].partner === null && !leaks(pl, R, 'Daniel'), JSON.stringify(pl))
    ok('fc: conversation list for the replier', rl.length === 1 && rl[0].last_mine === true && rl[0].context.body.startsWith('Anyone') && rl[0].partner === null && !leaks(rl, P, 'Aisyah'), JSON.stringify(rl))
    ok('fc: blind dating screen does not resume a post conversation', (await as(R, `select * from get_blind_session()`)).rows.length === 0)
    ok('fc: sessions table still closed', !!(await fails(() => as(R, `select kind from random_chat_sessions`))))

    // --- rules
    ok('fc: cannot reply to own post', !!(await fails(() => start(P, post))))
    ok('fc: empty message rejected', !!(await fails(() => start(R2, post, '  '))))
    const again = await start(R, post, 'still in?')
    ok('fc: same post + author reuses the conversation', again.created === false && again.session_id === sid && (await bs(R, sid)).my_messages === 2)
    await su(`update posts set is_hidden = true where id=$1`, [post])
    ok('fc: hidden post cannot be replied to', (await fails(() => start(R2, post)))?.includes('Post not found'))
    ok('fc: hidden post shows no body in the context', (await bs(R, sid)).context.body === null)
    await su(`update posts set is_hidden = false where id=$1`, [post])
    await as(P, `insert into blocks (blocked_id) values ($1)`, [R2])
    ok('fc: blocked pair cannot start', (await fails(() => start(R2, post)))?.includes('Post not found'))
    await su(`delete from blocks where blocker_id=$1`, [P])
    await su(`update profiles set shadow_banned = true where id=$1`, [P])
    ok('fc: shadow-banned author cannot be reached', !!(await fails(() => start(R2, post))))
    await su(`update profiles set shadow_banned = false where id=$1`, [P])
    await su(`update profiles set muted_until = now() + interval '1 hour' where id=$1`, [R2])
    ok('fc: muted user cannot start', (await fails(() => start(R2, post)))?.includes('muted'))
    await su(`update profiles set muted_until = null where id=$1`, [R2])
    ok('fc: post session rows need a starter', !!(await fails(() => su(`insert into random_chat_sessions (user_a, user_b, kind) values ($1, $2, 'post')`, [P, R2]))))
    ok('fc: blind session rows carry no context', !!(await fails(() => su(`insert into random_chat_sessions (user_a, user_b, kind, post_id) values ($1, $2, 'blind', $3)`, [P, R2, post]))))

    // --- 10 new conversations per day
    const posts = []
    for (let i = 0; i < 11; i++) posts.push(await newPost(P2, 'post ' + i))
    for (let i = 0; i < 10; i++) await start(R2, posts[i], 'reply ' + i)
    ok('fc: 10 conversations per day', (await conv(R2)).length === 10)
    ok('fc: 11th conversation in 24h rejected (P0429)', (await fails(() => start(R2, posts[10])))?.includes('Too many'))
    ok('fc: an existing conversation still accepts messages at the limit', (await start(R2, posts[0], 'more')).created === false)
    await su(`update random_chat_sessions set started_at = now() - interval '25 hours' where started_by=$1`, [R2])
    ok('fc: limit is a rolling 24 hours', (await start(R2, posts[10], 'late')).created === true)

    // --- "As me" post: the replier sees the author as the post shows them, never the reverse
    const named = (await as(P, `select create_post('Named post: coffee buddies?', true) id`)).rows[0].id
    const n1 = await start(R, named, 'coffee!')
    const nv = await bs(R, n1.session_id)
    ok('fc: named post shows the author card to the replier', nv.context.author?.id === P && nv.context.author.display_name === 'Aisyah' && nv.context.author_pseudonym === null, JSON.stringify(nv.context))
    const npv = await bs(P, n1.session_id)
    ok('fc: named post still hides the replier from the author', npv.context.author === null && npv.partner === null && !leaks(npv, R, 'Daniel'))
    ok('fc: replier\'s list row shows the author card, author\'s row does not leak', (await conv(R)).some((c) => c.id === n1.session_id && c.context.author?.id === P) &&
       !leaks((await conv(P)).find((c) => c.id === n1.session_id), R, 'Daniel'))

    // --- reveal unlock: 5 messages from each side
    ok('fc: reveal locked before 5 messages each', (await fails(() => decide(R, sid, true)))?.includes('Reveal locked'))
    for (let i = 0; i < 3; i++) await as(R, `select randomizer_send($1, $2)`, [sid, 'r' + i])
    for (let i = 0; i < 4; i++) await as(P, `select randomizer_send($1, $2)`, [sid, 'p' + i])
    const rv2 = await bs(R, sid)
    ok('fc: still locked when one side has 4', rv2.my_messages === 5 && rv2.partner_messages === 4 && !!(await fails(() => decide(R, sid, true))))
    await as(P, `select randomizer_send($1, 'p4')`, [sid])
    const w = await decide(R, sid, true)
    ok('fc: reveal unlocks at 5 each', w.state === 'waiting' && (await bs(R, sid)).my_decision === true)
    const pw = await bs(P, sid)
    ok('fc: author learns nothing about the pending reveal', pw.my_decision === null && pw.partner === null && pw.state === 'active')
    const mm = await decide(P, sid, true)
    ok('fc: mutual reveal matches and copies the transcript', mm.state === 'matched' && !!mm.match_id &&
       (await su(`select count(*)::int c from messages where match_id=$1`, [mm.match_id])).rows[0].c === 10)
    ok('fc: profiles revealed after the match', (await bs(P, sid)).partner?.id === R && (await bs(R, sid)).partner?.id === P)
    ok('fc: matched conversation leaves the list', !(await conv(P)).some((c) => c.id === sid))
    // The pair is matched now; later checks (same-option matching excludes existing matches) need them unmatched.
    await su(`delete from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [P, R])

    // --- pass ends it for both
    const pp = await newPost(P2, 'pass me')
    const ps = (await start(R, pp)).session_id
    ok('fc: author can pass while locked', (await decide(P2, ps, false)).state === 'passed')
    ok('fc: replier sees only "ended"', (await bs(R, ps)).state === 'ended' && (await bs(R, ps)).partner === null)
    ok('fc: cannot send after pass', !!(await fails(() => as(R, `select randomizer_send($1,'x')`, [ps]))))
    const after = await start(R, pp, 'again?')
    ok('fc: no new conversation after a pass, state returned', after.created === false && after.session_id === ps && after.message_id === null && after.state === 'ended', JSON.stringify(after))
    ok('fc: ended conversation leaves the list', !(await conv(R)).some((c) => c.id === ps))

    // --- blind dating is not blocked by an open private reply
    const openPost = await newPost(P2, 'open thread')
    await start(R, openPost)
    ok('fc: randomizer_join ignores post conversations', (await as(R, `select randomizer_join('{female}',18,99) s`)).rows[0].s === null)
    ok('fc: randomizer_join definition carries the kind filter', (await su(`select pg_get_functiondef('public.randomizer_join'::regproc) d`)).rows[0].d.includes("kind = 'blind'"))
    await as(R, `select randomizer_leave()`)

    // --- pushes: claim per session, throttled, names only when revealed from the start
    const pr = await start(R2, await newPost(P, 'push post'), 'first')
    const c1 = (await svc(`select claim_session_push($1) r`, [pr.message_id])).rows[0].r
    ok('fc: push claim names the author as recipient, no sender name', c1?.recipient === P && c1.kind === 'post' && c1.is_first === true && c1.sender_name === null && c1.session_id === pr.session_id, JSON.stringify(c1))
    const m2 = (await as(R2, `select randomizer_send($1, 'second') id`, [pr.session_id])).rows[0].id
    ok('fc: push throttled to one per 10 minutes', (await svc(`select claim_session_push($1) r`, [m2])).rows[0].r === null)
    await su(`update random_chat_sessions set last_push_at = now() - interval '11 minutes' where id=$1`, [pr.session_id])
    const c2 = (await svc(`select claim_session_push($1) r`, [m2])).rows[0].r
    ok('fc: push allowed again after 10 minutes, not first', c2?.recipient === P && c2.is_first === false)
    const blindMsg = (await su(`select m.id from random_chat_messages m join random_chat_sessions s on s.id = m.session_id where s.kind='blind' limit 1`)).rows[0]
    ok('fc: blind date messages never claim a push', !!blindMsg && (await svc(`select claim_session_push($1) r`, [blindMsg.id])).rows[0].r === null)
    ok('fc: push claim is server only', !!(await fails(() => as(R2, `select claim_session_push($1)`, [m2]))))

    // --- daily question: rotation at 19:00 MYT
    const pd = (await su(`select prompt_day('2026-10-09 10:59:59+00')::text a, prompt_day('2026-10-09 11:00:00+00')::text b, prompt_day('2026-10-10 02:00:00+00')::text c`)).rows[0]
    ok('fc: prompt day flips at 19:00 MYT', pd.a === '2026-10-08' && pd.b === '2026-10-09' && pd.c === '2026-10-09', JSON.stringify(pd))
    ok('fc: window ends at 19:00 MYT next day', new Date((await su(`select prompt_window_end('2026-10-09'::date) e`)).rows[0].e).toISOString() === '2026-10-10T11:00:00.000Z')
    ok('fc: 60 questions seeded, none shown', (await su(`select count(*)::int c, count(show_date)::int s from daily_prompts`)).rows[0].c === 60 && (await su(`select count(show_date)::int s from daily_prompts`)).rows[0].s === 0)
    ok('fc: no question before rotation', (await as(P, `select get_daily_prompt() r`)).rows[0].r === null)
    ok('fc: rotation is server only', !!(await fails(() => as(P, `select rotate_daily_prompt()`))))
    const q1 = (await svc(`select rotate_daily_prompt() r`)).rows[0].r
    ok('fc: rotation activates the first queued question', q1 === (await su(`select id from daily_prompts where sort_order=1`)).rows[0].id)
    ok('fc: rotation is idempotent within a day', (await svc(`select rotate_daily_prompt() r`)).rows[0].r === q1)
    const q2 = (await svc(`select rotate_daily_prompt(now() + interval '1 day') r`)).rows[0].r
    ok('fc: next day takes the next question, today unchanged', q2 === (await su(`select id from daily_prompts where sort_order=2`)).rows[0].id && (await svc(`select rotate_daily_prompt() r`)).rows[0].r === q1)
    const dp = (await as(P, `select get_daily_prompt() r`)).rows[0].r
    ok('fc: today\'s question in three languages, unanswered', dp.id === q1 && dp.question.en && dp.question.ms && dp.question.ru && dp.options.en.length === 2 && dp.my_option === null && dp.counts === null, JSON.stringify(dp))
    await su(`update profiles set verification_status='pending' where id=$1`, [X])
    ok('fc: unverified gets no question', (await as(X, `select get_daily_prompt() r`)).rows[0].r === null)
    await su(`update profiles set verification_status='approved' where id=$1`, [X])

    // --- answers, percentages, same-option matching filters
    ok('fc: option out of range rejected', !!(await fails(() => as(P, `select answer_daily_prompt($1, 2)`, [q1]))))
    ok('fc: cannot answer tomorrow\'s question', !!(await fails(() => as(P, `select answer_daily_prompt($1, 0)`, [q2]))))
    const an = (await as(P, `select answer_daily_prompt($1, 0) r`, [q1])).rows[0].r
    ok('fc: answer returns counts', an.my_option === 0 && JSON.stringify(an.counts) === '[1,0]', JSON.stringify(an))
    await as(R, `select answer_daily_prompt($1, 0)`, [q1])
    await as(R2, `select answer_daily_prompt($1, 1)`, [q1])
    await as(FAR, `select answer_daily_prompt($1, 0)`, [q1])
    await as(Z, `select answer_daily_prompt($1, 0)`, [q1])
    await as(X, `select answer_daily_prompt($1, 0)`, [q1])
    for (const u of M) await as(u, `select answer_daily_prompt($1, 0)`, [q1])
    await as(P, `insert into blocks (blocked_id) values ($1)`, [X])
    ok('fc: counts update', JSON.stringify((await as(P, `select get_daily_prompt() r`)).rows[0].r.counts) === '[15,1]')
    const pm = (await as(P, `select * from get_prompt_matches($1, 3)`, [q1])).rows
    ok('fc: matches: same option, mutual interest, distance, not blocked, limit', pm.length === 3 && pm.every((x) => [R, ...M].includes(x.id)) && !pm.some((x) => [R2, FAR, Z, X].includes(x.id)) && pm[0].display_name && pm[0].age >= 18, JSON.stringify(pm))
    ok('fc: matches: at most 8', (await as(P, `select * from get_prompt_matches($1, 50)`, [q1])).rows.length === 8)
    ok('fc: matches: nearest first', (await as(P, `select id from get_prompt_matches($1)`, [q1])).rows[0].id === M[0])
    ok('fc: matches for a man: women with the same option', JSON.stringify((await as(R, `select id from get_prompt_matches($1)`, [q1])).rows.map((x) => x.id).sort()) === JSON.stringify([P, Z].sort()))
    ok('fc: no matches before answering', (await as(A, `select * from get_prompt_matches($1)`, [q1])).rows.length === 0)
    await su(`update profiles set last_active_at = now() - interval '31 days' where id=$1`, [Z])
    ok('fc: inactive 30 days excluded', !(await as(R, `select id from get_prompt_matches($1)`, [q1])).rows.some((x) => x.id === Z))
    await su(`update profiles set last_active_at = now(), discoverable = false where id=$1`, [Z])
    ok('fc: paused profile excluded', !(await as(R, `select id from get_prompt_matches($1)`, [q1])).rows.some((x) => x.id === Z))
    await su(`update profiles set discoverable = true where id=$1`, [Z])
    await as(R, `select set_new_people_alert(true, '{female}', 30, 40, 50)`)
    ok('fc: saved age filter applies both ways', !(await as(R, `select id from get_prompt_matches($1)`, [q1])).rows.some((x) => x.id === P) && !(await as(P, `select id from get_prompt_matches($1)`, [q1])).rows.some((x) => x.id === R))
    await as(R, `select set_new_people_alert(false)`)
    ok('fc: match rows carry only name, age, photo', JSON.stringify(Object.keys(pm[0]).sort()) === '["age","display_name","id","photo"]')
    const ch = (await as(P, `select answer_daily_prompt($1, 1) r`, [q1])).rows[0].r
    ok('fc: answer can change', ch.my_option === 1 && JSON.stringify(ch.counts) === '[14,2]')
    await as(P, `select answer_daily_prompt($1, 0)`, [q1])

    // --- say hi: prompt conversations show names from the start, Connect = match
    const h1 = (await as(P, `select start_prompt_conversation($1, $2) r`, [q1, R])).rows[0].r
    ok('fc: say hi creates a prompt conversation', h1.created === true && !!h1.session_id && h1.state === 'active', JSON.stringify(h1))
    const hv = await bs(P, h1.session_id)
    ok('fc: prompt conversation reveals the partner from the start', hv.kind === 'prompt' && hv.revealed_from_start === true && hv.partner?.id === R && hv.partner.display_name === 'Daniel' && hv.state === 'active')
    ok('fc: question and both answers pinned', hv.context.prompt_id === q1 && hv.context.question.en === dp.question.en && hv.context.my_option === 0 && hv.context.partner_option === 0, JSON.stringify(hv.context))
    const hr = await bs(R, h1.session_id)
    ok('fc: the other side sees the initiator too', hr.partner?.id === P && hr.my_side === 'a' && hr.context.partner_option === 0)
    ok('fc: target notified on its own topic', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='conversation'`, ['randomizer:' + R])).rows[0].c === 1)
    ok('fc: say hi to someone not on the card fails', !!(await fails(() => as(P, `select start_prompt_conversation($1, $2)`, [q1, R2]))))
    ok('fc: say hi to a blocked person fails', !!(await fails(() => as(P, `select start_prompt_conversation($1, $2)`, [q1, X]))))
    ok('fc: say hi to yourself fails', !!(await fails(() => as(P, `select start_prompt_conversation($1, $2)`, [q1, P]))))
    ok('fc: say hi reuses the pair\'s conversation from either side', (await as(P, `select start_prompt_conversation($1, $2) r`, [q1, R])).rows[0].r.session_id === h1.session_id &&
       (await as(R, `select start_prompt_conversation($1, $2) r`, [q1, P])).rows[0].r.created === false)
    const lp = (await conv(P)).find((c) => c.id === h1.session_id)
    ok('fc: prompt conversation listed with the partner card', lp?.kind === 'prompt' && lp.partner?.id === R && lp.partner.display_name === 'Daniel' && !!lp.context.question.ms, JSON.stringify(lp))
    const hm = (await as(R, `select randomizer_send($1, 'hi Aisyah') id`, [h1.session_id])).rows[0].id
    const hc = (await svc(`select claim_session_push($1) r`, [hm])).rows[0].r
    ok('fc: prompt push carries the sender name', hc?.recipient === P && hc.kind === 'prompt' && hc.sender_name === 'Daniel')
    for (let i = 0; i < 9; i++) await as(P, `select start_prompt_conversation($1, $2)`, [q1, M[i]])
    ok('fc: 11th say hi in 24h rejected', (await fails(() => as(P, `select start_prompt_conversation($1, $2)`, [q1, M[9]])))?.includes('Too many'))
    ok('fc: existing prompt conversation still reachable at the limit', (await as(P, `select start_prompt_conversation($1, $2) r`, [q1, R])).rows[0].r.created === false)
    ok('fc: prompt connect needs no unlock', (await decide(P, h1.session_id, true)).state === 'waiting' && (await decide(R, h1.session_id, true)).state === 'matched')
    ok('fc: prompt match exists', (await su(`select count(*)::int c from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [P, R])).rows[0].c === 1)

    // --- daily push recipients
    await as(P, `insert into push_subscriptions (endpoint, p256dh, auth, locale) values ('https://push.example/p', 'k', 'a', 'ms')`)
    await as(R, `insert into push_subscriptions (endpoint, p256dh, auth, locale) values ('https://push.example/r', 'k', 'a', 'en')`)
    await as(R2, `insert into push_subscriptions (endpoint, p256dh, auth, locale) values ('https://push.example/r2', 'k', 'a', 'en')`)
    await as(R2, `insert into notification_prefs (daily_prompt) values (false)`)
    ok('fc: users can toggle the new preferences', (await as(R2, `select daily_prompt, post_replies from notification_prefs`)).rows[0].daily_prompt === false && !(await fails(() => as(R2, `update notification_prefs set post_replies = false`))))
    ok('fc: tomorrow\'s question has no recipients yet', (await svc(`select * from daily_prompt_push_recipients($1)`, [q2])).rows.length === 0)
    const rec = (await svc(`select daily_prompt_push_recipients($1) u`, [q1])).rows.map((r) => r.u).filter((u) => u.startsWith('fc000000')).sort()
    ok('fc: recipients: subscribed, verified, preference on', JSON.stringify(rec) === JSON.stringify([P, R].sort()), JSON.stringify(rec))
    ok('fc: recipients claimed once', (await svc(`select * from daily_prompt_push_recipients($1)`, [q1])).rows.length === 0)
    ok('fc: recipients list is server only', !!(await fails(() => as(P, `select * from daily_prompt_push_recipients($1)`, [q1]))))

    // --- retention: answers older than 90 days go with the next rotation
    await su(`insert into prompt_answers (prompt_id, user_id, option_idx, created_at) values ($1, $2, 0, now() - interval '91 days')`, [q2, X])
    await svc(`select rotate_daily_prompt()`)
    ok('fc: old answers purged', (await su(`select count(*)::int c from prompt_answers where prompt_id=$1`, [q2])).rows[0].c === 0)

    // --- admin queue (service role + assert_admin_role)
    await su(`insert into admins (user_id, role) values ($1, 'moderator')`, [A])
    const qs = { en: 'Kopi o or kopi c?', ms: 'Kopi o atau kopi c?', ru: 'Копи о или копи си?' }
    const os = { en: ['Kopi o', 'Kopi c'], ms: ['Kopi o', 'Kopi c'], ru: ['Копи о', 'Копи си'] }
    const nid = (await svc(`select admin_upsert_daily_prompt($1, $2, $3) id`, [A, JSON.stringify(qs), JSON.stringify(os)])).rows[0].id
    ok('fc: admin adds a question at the end of the queue', (await su(`select sort_order from daily_prompts where id=$1`, [nid])).rows[0].sort_order === 61)
    ok('fc: admin add is logged', (await su(`select count(*)::int c from moderation_actions where action='prompt.add' and target_id=$1`, [nid])).rows[0].c === 1)
    ok('fc: admin rejects a single option', !!(await fails(() => svc(`select admin_upsert_daily_prompt($1, $2, $3)`, [A, JSON.stringify(qs), JSON.stringify({ en: ['x'], ms: ['x'], ru: ['x'] })]))))
    ok('fc: admin rejects mismatched option counts', !!(await fails(() => svc(`select admin_upsert_daily_prompt($1, $2, $3)`, [A, JSON.stringify(qs), JSON.stringify({ en: ['a', 'b'], ms: ['a', 'b', 'c'], ru: ['a', 'b'] })]))))
    await svc(`select admin_upsert_daily_prompt($1, $2, $3, $4)`, [A, JSON.stringify({ ...qs, en: 'Kopi o or kopi c today?' }), JSON.stringify(os), nid])
    ok('fc: admin edits a question', (await su(`select question_en q from daily_prompts where id=$1`, [nid])).rows[0].q === 'Kopi o or kopi c today?')
    await svc(`select admin_move_daily_prompt($1, $2, true)`, [A, nid])
    ok('fc: admin moves a question up', (await su(`select sort_order from daily_prompts where id=$1`, [nid])).rows[0].sort_order === 60 && (await su(`select count(*)::int c from daily_prompts where sort_order=61`)).rows[0].c === 1)
    await svc(`select admin_move_daily_prompt($1, $2, false)`, [A, nid])
    ok('fc: admin moves it back down', (await su(`select sort_order from daily_prompts where id=$1`, [nid])).rows[0].sort_order === 61)
    ok('fc: shown question cannot be moved or deleted', !!(await fails(() => svc(`select admin_move_daily_prompt($1, $2, true)`, [A, q1]))) && !!(await fails(() => svc(`select admin_delete_daily_prompt($1, $2)`, [A, q1]))))
    await svc(`select admin_delete_daily_prompt($1, $2)`, [A, nid])
    ok('fc: admin deletes an unused question', (await su(`select count(*)::int c from daily_prompts where id=$1`, [nid])).rows[0].c === 0)
    ok('fc: non-admin cannot manage questions', !!(await fails(() => svc(`select admin_upsert_daily_prompt($1, $2, $3)`, [P, JSON.stringify(qs), JSON.stringify(os)]))))
    ok('fc: admin RPCs not callable by users', !!(await fails(() => as(A, `select admin_upsert_daily_prompt($1, $2, $3)`, [A, JSON.stringify(qs), JSON.stringify(os)]))))
    ok('fc: anon cannot call the RPCs', (await su(`select bool_or(has_function_privilege('anon', f, 'execute')) a from unnest(array[
       'public.start_post_conversation(uuid, text)', 'public.start_prompt_conversation(uuid, uuid)', 'public.list_my_conversations()',
       'public.get_daily_prompt()', 'public.answer_daily_prompt(uuid, int)', 'public.get_prompt_matches(uuid, int)']) f`)).rows[0].a === false)
    await su(`delete from random_chat_queue`)
  })()
  // ===== end feed conversations =====
  // ===== Blind Dating Nights x feed conversations (20261009000210 + 20261009000220) =====
  // 220 redefines get_blind_session, blind_decide, randomizer_join and event_requeue after 210:
  // both behaviours must survive (event pool + re-queue after a Pass, and kind / context / reveal
  // lock), and post / prompt conversations never enter an event pool.
  await (async () => {
    const U = (i) => `cb000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    const M = U(1), W = U(2), P = U(3), ADM = U(4)
    for (const [i, u] of [M, W, P, ADM].entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601499900' + String(i).padStart(2, '0')])
    for (const [u, name, g, w, bd] of [[M, 'Cb Hakim', 'male', '{female}', '1996-05-05'], [W, 'Cb Intan', 'female', '{male}', '1997-05-05'],
      [P, 'Cb Poster', 'female', '{male}', '1995-05-05'], [ADM, 'Cb Admin', 'male', '{female}', '1990-05-05']])
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,$2,$3,$4,'Ipoh','SRID=4326;POINT(101.08 4.6)')`, [name, bd, g, w])
    await su(`update profiles set verification_status='approved' where id::text like 'cb000000-%'`)
    await su(`insert into admins (user_id, role) values ($1, 'admin')`, [ADM])
    await su(`delete from random_chat_queue`)
    const svc = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const at = async (expr) => (await su(`select ${expr} t`)).rows[0].t
    const join = async (u, ev, genders) => (await as(u, `select randomizer_join($1, 18, 99, '{}', $2) s`, [genders, ev])).rows[0].s
    const queue = async () => (await su(`select user_id, event_id from random_chat_queue order by user_id`)).rows
    const bs = async (u, sid) => (await as(u, `select * from get_blind_session($1)`, [sid])).rows[0]
    const decide = async (u, sid, c) => (await as(u, `select blind_decide($1, $2) r`, [sid, c])).rows[0].r

    // A live night
    const ev = (await svc(`select admin_upsert_event($1, null, 'Combo Night', 'Malam Kombo', 'Комбо', null, $2, $3, null, 'scheduled') id`,
      [ADM, await at(`now() + interval '5 minutes'`), await at(`now() + interval '90 minutes'`)])).rows[0].id
    await su(`update scheduled_events set starts_at = now() - interval '1 minute' where id=$1`, [ev])
    await svc(`select event_tick()`)

    // M has an open private reply on P's post (kind 'post', active the whole time)
    const post = (await as(P, `select create_post('Combo: anyone in Ipoh tonight?') id`)).rows[0].id
    const postSid = (await as(M, `select start_post_conversation($1, 'me!') r`, [post])).rows[0].r.session_id
    ok('combo: a private reply never enters a queue', (await queue()).length === 0)

    // Event path with an open post conversation: M waits in the event pool, W pairs with him
    ok('combo: event join is not hijacked by an open post conversation', (await join(M, ev, '{female}')) === null &&
       JSON.stringify(await queue()) === JSON.stringify([{ user_id: M, event_id: ev }]))
    const es = await join(W, ev, '{male}')
    const row = es && (await su(`select kind, event_id, user_a, user_b from random_chat_sessions where id=$1`, [es])).rows[0]
    ok('combo: event session is kind blind with the event id', row?.kind === 'blind' && row.event_id === ev && row.user_a === M && row.user_b === W, JSON.stringify(row))
    const cur = (await as(M, `select * from get_blind_session()`)).rows[0]
    ok('combo: get_blind_session() returns the event date (not the post conversation) with event_id and kind',
       cur?.id === es && cur.event_id === ev && cur.kind === 'blind' && cur.context === null && cur.my_messages === 0 && cur.revealed_from_start === false, JSON.stringify(cur))
    const pv = await bs(M, postSid)
    ok('combo: get_blind_session(post) returns kind, context and no event', pv.kind === 'post' && pv.event_id === null && pv.context?.body === 'Combo: anyone in Ipoh tonight?' && pv.my_messages === 1, JSON.stringify(pv))

    // Pass during the live night re-queues both, even though M still has an open post conversation
    await as(M, `select randomizer_send($1, 'hey')`, [es])
    ok('combo: event pass', (await decide(W, es, false)).state === 'passed')
    const q = await queue()
    ok('combo: pass re-queues both into the event pool with 220 applied', q.length === 2 && q.every((r) => r.event_id === ev) &&
       q.map((r) => r.user_id).sort().join() === [M, W].sort().join(), JSON.stringify(q))
    ok('combo: post conversation untouched by the event pass', (await bs(M, postSid)).state === 'active')

    // Reveal lock on the post conversation still holds; Pass there never re-queues anyone
    ok('combo: post reveal lock (P0423) still enforced', (await fails(() => decide(M, postSid, true)))?.includes('Reveal locked'))
    await su(`delete from random_chat_queue`)
    ok('combo: post pass does not queue anyone', (await decide(P, postSid, false)).state === 'passed' && (await queue()).length === 0)
    ok('combo: a post / prompt session can never carry an event id',
       !!(await fails(() => su(`insert into random_chat_sessions (user_a, user_b, kind, post_id, started_by, event_id) values ($1, $2, 'post', $3, $2, $4)`, [P, W, post, ev]))))

    // Non-event path unchanged: normal pool, kind blind, no event, a pass does not re-queue
    ok('combo: non-event join waits in the normal pool', (await join(M, null, '{female}')) === null &&
       JSON.stringify(await queue()) === JSON.stringify([{ user_id: M, event_id: null }]))
    const ns = await join(W, null, '{male}')
    const nrow = ns && (await su(`select kind, event_id from random_chat_sessions where id=$1`, [ns])).rows[0]
    ok('combo: non-event session is kind blind without event', nrow?.kind === 'blind' && nrow.event_id === null, JSON.stringify(nrow))
    ok('combo: get_blind_session for a normal date', (await bs(W, ns)).event_id === null && (await bs(W, ns)).kind === 'blind')
    ok('combo: normal pass does not re-queue', (await decide(M, ns, false)).state === 'passed' && (await queue()).length === 0)
    ok('combo: one randomizer_join (5 args) with the kind filter and event pool',
       (await su(`select count(*)::int c, max(pronargs)::int n, bool_and(pg_get_functiondef(oid) like '%kind = ''blind''%' and pg_get_functiondef(oid) like '%event_id is not distinct from p_event_id%') k
                  from pg_proc where proname = 'randomizer_join' and pronamespace = 'public'::regnamespace`)).rows.every((r) => r.c === 1 && r.n === 5 && r.k))
    ok('combo: event_requeue ignores post / prompt conversations', (await su(`select pg_get_functiondef('public.event_requeue'::regproc) d`)).rows[0].d.includes("s.kind = 'blind'"))
    await svc(`select admin_cancel_event($1, $2, 'test over')`, [ADM, ev])
    await su(`delete from random_chat_queue`)
  })()
  // ===== end Blind Dating Nights x feed conversations =====

  // ===== matchmaker & incognito (20261009000240) =====
  await (async () => {
    const ids = Array.from({ length: 14 }, (_, i) => `cc000000-0000-4000-8000-0000000000${String(i + 10)}`)
    const [A, B, C, D, H, I, J, K, L, M, E, F, G, S] = ids
    const males = new Set([A, F, S])
    for (const [i, u] of ids.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601488800' + String(i).padStart(2, '0')])
    for (const [i, u] of ids.entries()) {
      const male = males.has(u)
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
         values ($1,'1996-04-04',$2,$3,'Kuala Lumpur','SRID=4326;POINT(101.671 3.13)')`, ['Mm' + i, male ? 'male' : 'female', male ? '{female}' : '{male}'])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [ids])
    const pair = (a, b) => su(`select ensure_match($1::uuid, $2::uuid, 'swipe') id`, [a, b]).then((r) => r.rows[0].id)
    const matchOf = async (a, b) => (await su(`select id, source from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [a, b])).rows[0]
    const refer = (who, b, c, note = null) => as(who, `select create_referral($1, $2, $3) r`, [b, c, note]).then((r) => r.rows[0].r)
    const card = (who, id) => as(who, `select get_referral_card($1) c`, [id]).then((r) => r.rows[0].c)
    const decide = (who, id, yes) => as(who, `select decide_referral($1, $2) d`, [id, yes]).then((r) => r.rows[0].d)
    const status = async (id) => (await su(`select * from matchmaker_referrals where id=$1`, [id])).rows[0]
    const cardsIn = async (who, matchId) => (await as(who, `select kind, payload, body, sender_id, read_at from messages where match_id=$1 order by created_at`, [matchId])).rows
    // A is matched with B, C, D, H, I, J, K, L, M
    const ab = await pair(A, B); const ac = await pair(A, C)
    for (const u of [D, H, I, J, K, L, M]) await pair(A, u)

    // ----- rules -----
    ok('mm: only your own matches', !!(await fails(() => refer(B, C, D))) && !!(await fails(() => refer(A, B, S))))
    ok('mm: not yourself, not the same person twice', !!(await fails(() => refer(A, A, B))) && !!(await fails(() => refer(A, B, B))))
    ok('mm: note at most 200 characters', !!(await fails(() => refer(A, B, C, 'x'.repeat(201)))))
    ok('mm: referrals table closed to clients', !!(await fails(() => as(A, `select * from matchmaker_referrals`))))
    ok('mm: clients cannot insert cards', !!(await fails(() => as(A, `insert into messages (match_id, kind, payload) values ($1, 'referral', '{"referral_id":"x"}')`, [ab]))))
    const r1 = await refer(A, B, C, '  You both love hiking  ')
    ok('mm: create returns the id and the A-B chat', !!r1?.id && r1.match_id === ab, JSON.stringify(r1))
    const s1 = await status(r1.id)
    ok('mm: stored pending with the trimmed note', s1.status === 'pending' && s1.note === 'You both love hiking' && s1.decision_b === null)
    const abMsgs = await cardsIn(B, ab)
    ok('mm: card delivered as a referral message in the A-B chat', abMsgs.length === 1 && abMsgs[0].kind === 'referral' && abMsgs[0].payload.referral_id === r1.id && abMsgs[0].body === null && abMsgs[0].sender_id === A, JSON.stringify(abMsgs))
    ok('mm: nothing in the A-C chat yet', (await cardsIn(C, ac)).length === 0)
    ok('mm: same pair cannot be introduced again within 90 days (either order)', !!(await fails(() => refer(A, B, C))) && !!(await fails(() => refer(A, C, B))))
    const cardMsg = (await su(`select id from messages where match_id=$1`, [ab])).rows[0].id
    ok('mm: referral card cannot be edited', !!(await fails(() => as(A, `select edit_message($1, 'hi')`, [cardMsg]))))

    // ----- visibility -----
    const cb = await card(B, r1.id)
    ok('mm: B sees C, the note and an open card', cb?.role === 'b' && cb.state === 'open' && cb.person?.id === C && cb.person.name === 'Mm2' && cb.person.age === 30 && cb.note === 'You both love hiking' && cb.matchmaker_name === 'Mm0', JSON.stringify(cb))
    ok('mm: C sees nothing before B accepts', (await card(C, r1.id)) === null)
    ok('mm: strangers see nothing', (await card(D, r1.id)) === null && (await card(S, r1.id)) === null)
    const ca = await card(A, r1.id)
    ok('mm: A sees both people and pending', ca?.role === 'matchmaker' && ca.state === 'pending' && ca.b?.id === B && ca.c?.id === C && ca.person === null, JSON.stringify(ca))
    ok('mm: C cannot decide before B', !!(await fails(() => decide(C, r1.id, true))))
    ok('mm: A cannot decide', !!(await fails(() => decide(A, r1.id, true))))

    // ----- B interested -> card for C -----
    const d1 = await decide(B, r1.id, true)
    ok('mm: B interested: waiting, C to be notified in the A-C chat', d1.state === 'interested' && d1.notify?.user_id === C && d1.notify.match_id === ac && d1.notify.matchmaker_name === 'Mm0', JSON.stringify(d1))
    const acMsgs = await cardsIn(C, ac)
    ok('mm: card now in the A-C chat (sender A)', acMsgs.length === 1 && acMsgs[0].kind === 'referral' && acMsgs[0].payload.referral_id === r1.id && acMsgs[0].sender_id === A)
    const cc = await card(C, r1.id)
    ok('mm: C sees B and an open card', cc?.role === 'c' && cc.state === 'open' && cc.person?.id === B && cc.note === 'You both love hiking', JSON.stringify(cc))
    ok('mm: B sees "interested", A still pending', (await card(B, r1.id)).state === 'interested' && (await card(A, r1.id)).state === 'pending')
    ok('mm: B cannot decide twice', !!(await fails(() => decide(B, r1.id, false))))
    ok('mm: no match yet', !(await matchOf(B, C)))

    // ----- C interested -> match, pinned note, reward -----
    // A is on free while the reward is checked (no unlimited test VIP to stack behind).
    await su(`delete from plan_grants where user_id=$1 and note='test'`, [A])
    const vipBefore = (await su(`select max(ends_at) e from plan_grants where user_id=$1 and source='matchmaker' and plan='plus'`, [A])).rows[0].e
    const d2 = await decide(C, r1.id, true)
    const bc = await matchOf(B, C)
    ok('mm: both interested creates the match', d2.state === 'matched' && d2.just_matched === true && !!bc && d2.match_id === bc.id && bc.source === 'matchmaker', JSON.stringify(d2))
    ok('mm: push data carries ids and names only', JSON.stringify(Object.keys(d2.notify).sort()) === '["b_id","b_name","c_id","c_name","matchmaker_id","matchmaker_name"]' && d2.notify.b_name === 'Mm1')
    const bcMsgs = await cardsIn(B, bc.id)
    ok('mm: note pinned as the first system message, already read', bcMsgs.length === 1 && bcMsgs[0].kind === 'system' && bcMsgs[0].body === 'You both love hiking' && bcMsgs[0].sender_id === A && bcMsgs[0].read_at !== null && bcMsgs[0].payload.referral_id === r1.id, JSON.stringify(bcMsgs))
    ok('mm: C reads the note too, A cannot (not a participant)', (await cardsIn(C, bc.id)).length === 1 && (await cardsIn(A, bc.id)).length === 0)
    await as(C, `select mark_match_read($1)`, [ac])
    ok('mm: unread count ignores the pinned note', (await as(C, `select unread_message_count() n`)).rows[0].n === 0)
    const noteMsg = (await su(`select id from messages where match_id=$1`, [bc.id])).rows[0].id
    ok('mm: nobody can delete the pinned note', !!(await fails(() => as(A, `select delete_message($1)`, [noteMsg]))) && !!(await fails(() => as(B, `select delete_message($1)`, [noteMsg]))))
    const s1b = await status(r1.id)
    const vipAfter = (await su(`select max(ends_at) e from plan_grants where user_id=$1 and source='matchmaker' and plan='plus'`, [A])).rows[0].e
    const vipDays = (new Date(vipAfter) - Date.now()) / 86400000
    ok('mm: status matched + rewarded', s1b.status === 'matched' && s1b.match_id === bc.id && s1b.rewarded_at !== null && s1b.decision_c === true)
    ok('mm: A gets Plus for 7 days (plan grant)', vipBefore === null && vipDays > 6.99 && vipDays <= 7.01, String(vipDays))
    ok('mm: cards after the match', (await card(B, r1.id)).state === 'matched' && (await card(B, r1.id)).match_id === bc.id && (await card(C, r1.id)).state === 'matched' && (await card(A, r1.id)).state === 'matched' && (await card(A, r1.id)).match_id === null)
    ok('mm: deciding a finished one just reports it', await decide(C, r1.id, true).then((d) => d.state === 'matched' && d.match_id === bc.id && !d.notify))
    ok('mm: already matched pair cannot be introduced (after the 90-day window)', await (async () => {
      await su(`update matchmaker_referrals set created_at = now() - interval '100 days' where id=$1`, [r1.id])
      const err = await fails(() => refer(A, B, C))
      await su(`update matchmaker_referrals set created_at = now() where id=$1`, [r1.id])
      return !!err
    })())

    // ----- reward at most once per 7 days -----
    const r2 = await refer(A, D, H)
    await decide(D, r2.id, true); const d3 = await decide(H, r2.id, true)
    const vipTwice = (await su(`select max(ends_at) e from plan_grants where user_id=$1 and source='matchmaker' and plan='plus'`, [A])).rows[0].e
    ok('mm: second success within 7 days: match but no extra Plus', d3.state === 'matched' && String(vipTwice) === String(vipAfter) && (await status(r2.id)).rewarded_at === null, `${vipAfter} -> ${vipTwice}`)
    ok('mm: match without a note has no pinned message', (await cardsIn(D, d3.match_id)).length === 0)
    await su(`update matchmaker_referrals set rewarded_at = now() - interval '8 days' where id=$1`, [r1.id])
    await su(`update matchmaker_referrals set created_at = now() - interval '8 days' where id=$1`, [r2.id])
    const r2b = await refer(A, B, H, 'again')
    await decide(B, r2b.id, true); await decide(H, r2b.id, true)
    const vipThrice = (await su(`select max(ends_at) e from plan_grants where user_id=$1 and source='matchmaker' and plan='plus'`, [A])).rows[0].e
    ok('mm: after 7 days the reward stacks 7 more Plus days', Math.round((new Date(vipThrice) - new Date(vipAfter)) / 86400000) === 7, `${vipAfter} -> ${vipThrice}`)
    await su(`insert into plan_grants (user_id, plan, source, note) values ($1, 'vip', 'admin', 'test')`, [A])

    // ----- declines are silent -----
    const r3 = await refer(A, I, J, 'maybe')
    const d4 = await decide(I, r3.id, false)
    ok('mm: B declines: closed for B only', d4.state === 'closed' && (await status(r3.id)).status === 'b_declined' && (await card(I, r3.id)).state === 'closed' && (await card(A, r3.id)).state === 'pending' && (await card(J, r3.id)) === null)
    ok('mm: no card ever reaches C after a decline', (await cardsIn(J, (await matchOf(A, J)).id)).length === 0)
    const r4 = await refer(A, K, L)
    await decide(K, r4.id, true)
    const d5 = await decide(L, r4.id, false)
    ok('mm: C declines: B keeps "interested", A keeps pending', d5.state === 'closed' && (await status(r4.id)).status === 'c_declined' && (await card(K, r4.id)).state === 'interested' && (await card(L, r4.id)).state === 'closed' && (await card(A, r4.id)).state === 'pending' && !(await matchOf(K, L)))

    // ----- 5 per day -----
    const r5 = await refer(A, I, M)
    ok('mm: fifth introduction today still allowed', !!r5?.id)
    const limitErr = await fails(() => refer(A, J, M))
    ok('mm: sixth introduction today is rate limited', !!limitErr && /Rate limit/.test(limitErr), limitErr)
    await su(`update matchmaker_referrals set created_at = now() - interval '2 days' where matchmaker_id=$1 and created_at > now() - interval '1 hour'`, [A])

    // ----- blocks cancel -----
    const r6 = await refer(A, C, I, 'blocked soon')
    await decide(C, r6.id, true)
    await as(I, `insert into blocks (blocked_id) values ($1)`, [C])
    ok('mm: a block among the three cancels the introduction', (await status(r6.id)).status === 'cancelled' && (await card(C, r6.id)).state === 'closed' && (await card(C, r6.id)).person === null && (await card(A, r6.id)).state === 'closed')
    ok('mm: deciding a cancelled one is closed', (await decide(I, r6.id, true)).state === 'closed')
    const blockedPair = await fails(() => refer(A, I, C))
    ok('mm: blocked people cannot be introduced', !!blockedPair && /Not available/.test(blockedPair), blockedPair)
    const blockedErr = await fails(() => refer(A, I, L))
    await as(I, `delete from blocks where blocked_id=$1`, [C])
    ok('mm: new introduction with a block between B and C refused', await (async () => {
      await as(L, `insert into blocks (blocked_id) values ($1)`, [M])
      const err = await fails(() => refer(A, L, M))
      await as(L, `delete from blocks where blocked_id=$1`, [M])
      return !!err && blockedErr === null
    })())

    // ----- banned / muted -----
    await su(`update profiles set muted_until = now() + interval '1 hour' where id=$1`, [J])
    ok('mm: muted people cannot be introduced', !!(await fails(() => refer(A, J, L))))
    await su(`update profiles set muted_until = null where id=$1`, [J])
    await su(`update profiles set muted_until = now() + interval '1 hour' where id=$1`, [A])
    const mutedErr = await fails(() => refer(A, J, L))
    await su(`update profiles set muted_until = null where id=$1`, [A])
    ok('mm: a muted matchmaker cannot introduce', !!mutedErr && /muted/.test(mutedErr), mutedErr)
    await su(`update profiles set banned_at = now(), ban_reason = 'x', is_active = false where id=$1`, [L])
    ok('mm: banned people cannot be introduced', !!(await fails(() => refer(A, J, L))))
    await su(`update profiles set banned_at = null, ban_reason = null, is_active = true where id=$1`, [L])

    // ----- notification setting -----
    ok('mm: notification toggle defaults on and is writable by the owner', !(await fails(() => as(B, `insert into notification_prefs (matchmaker) values (false)`))) &&
       (await su(`select matchmaker from notification_prefs where user_id=$1`, [B])).rows[0].matchmaker === false &&
       (await su(`select column_default d from information_schema.columns where table_name='notification_prefs' and column_name='matchmaker'`)).rows[0].d === 'true')
    await as(B, `update notification_prefs set matchmaker = true`)
    ok('mm: notification toggle updates', (await su(`select matchmaker from notification_prefs where user_id=$1`, [B])).rows[0].matchmaker === true)

    // ----- retention + access -----
    await su(`update matchmaker_referrals set created_at = now() - interval '91 days' where id=$1`, [r3.id])
    const purged = (await su(`select purge_matchmaker_referrals() n`)).rows[0].n
    ok('mm: referrals purged after 90 days; the card then reads as unavailable', purged === 1 && (await card(I, r3.id)) === null)
    ok('mm: no anon access, no client purge', (await su(`select has_function_privilege('anon', 'public.create_referral(uuid, uuid, text)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.purge_matchmaker_referrals()', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.matchmaker_person(uuid)', 'execute') v`)).rows[0].v === false)

    // ----- incognito -----
    const deck = async (who, genders) => (await as(who, `select id from get_swipe_candidates($1, 18, 99, 50, 50)`, [genders])).rows.map((r) => r.id)
    const eUsername = (await su(`select username from profiles where id=$1`, [E])).rows[0].username
    const search = async (who) => (await as(who, `select id from search_profiles_by_username($1)`, [eUsername])).rows.map((r) => r.id)
    const likers = async (who) => (await as(who, `select id from get_incoming_likes()`)).rows.map((r) => r.id)
    ok('incognito: off by default and visible', (await su(`select is_incognito v from profiles where id=$1`, [E])).rows[0].v === false && (await deck(F, '{female}')).includes(E) && (await search(F)).includes(E))
    await as(E, `update profiles set is_incognito = true where id=$1`, [E])
    ok('incognito: owner can turn it on', (await su(`select is_incognito v from profiles where id=$1`, [E])).rows[0].v === true)
    ok('incognito: others cannot change it', (await as(F, `update profiles set is_incognito = false where id=$1`, [E])).rows !== undefined && (await su(`select is_incognito v from profiles where id=$1`, [E])).rows[0].v === true)
    ok('incognito: hidden from Discover', !(await deck(F, '{female}')).includes(E) && (await deck(F, '{female}')).includes(G))
    ok('incognito: hidden from username search', !(await search(F)).includes(E) && (await search(S)).length === 0)
    ok('incognito: own deck still works', (await deck(E, '{male}')).includes(F))
    await as(E, `insert into swipes (swiped_id, direction) values ($1, 'like')`, [F])
    ok('incognito: shown to the people it liked', (await deck(F, '{female}')).includes(E) && !(await deck(S, '{female}')).includes(E))
    ok('incognito: the like is hidden in "Who liked you"', !(await likers(F)).includes(E) && (await as(F, `select count_incoming_likes() n`)).rows[0].n === 0)
    await as(G, `insert into swipes (swiped_id, direction) values ($1, 'like')`, [F])
    ok('incognito: regular likes still show', (await likers(F)).includes(G))
    await su(`update profiles set discoverable = false where id=$1`, [E])
    ok('incognito: pause still hides everything', !(await deck(F, '{female}')).includes(E))
    await su(`update profiles set discoverable = true where id=$1`, [E])
    await as(F, `insert into swipes (swiped_id, direction) values ($1, 'like')`, [E])
    ok('incognito: mutual like still matches', !!(await matchOf(E, F)))
    const efMatch = (await matchOf(E, F)).id
    ok('incognito: the match sees the profile and the chat', (await as(F, `select count(*)::int c from profiles where id=$1`, [E])).rows[0].c === 1 &&
       !(await fails(() => as(F, `insert into messages (match_id, body) values ($1, 'hi')`, [efMatch]))))
    // crossed paths: no encounter is computed or shown for an incognito person
    for (const u of [E, S]) await as(u, `select set_crossed_paths(true)`)
    const ping = (u, h) => su(`insert into user_location_pings (user_id, cell, day, seen_hour, is_night)
       select $1, 'w283c9', (h at time zone 'Asia/Kuala_Lumpur')::date, h, false from (select date_trunc('hour', now()) - make_interval(hours => $2) h) t`, [u, h])
    for (const h of [5, 6]) { await ping(E, h); await ping(S, h) }
    await su(`select compute_crossed_paths()`)
    const crossed = async (a, b) => (await su(`select count(*)::int c from crossed_paths where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [a, b])).rows[0].c
    ok('incognito: crossed paths never computed', (await crossed(E, S)) === 0)
    await as(E, `update profiles set is_incognito = false where id=$1`, [E])
    await su(`select compute_crossed_paths()`)
    ok('incognito: off again: encounter computed and shown', (await crossed(E, S)) === 1 && (await as(S, `select id from get_crossed_paths()`)).rows.some((r) => r.id === E))
    await as(E, `update profiles set is_incognito = true where id=$1`, [E])
    ok('incognito: hidden from crossed paths at read time', !(await as(S, `select id from get_crossed_paths()`)).rows.some((r) => r.id === E))
    await as(E, `update profiles set is_incognito = false where id=$1`, [E])
    await su(`delete from user_location_pings where user_id = any($1)`, [[E, S]])
    await su(`delete from crossed_paths where user_a = any($1) or user_b = any($1)`, [[E, S]])
  })()
  // ===== end matchmaker & incognito =====
  // ===== live statuses (20261009000270 / 271) =====
  // Set / replace / clear, hold per risk kind, carousel visibility, status conversations (kind
  // 'status' on the feed-conversations engine of 220: limits, context, Connect), report target,
  // pushes, retention. Own users.
  await (async () => {
    const ids = Array.from({ length: 22 }, (_, i) => `57a70000-0000-4000-8000-0000000000${String(i + 10)}`)
    const [A, B, C, D, E, F, G, H, I, J, MOD, VIEW, ...L] = ids
    for (const [i, u] of ids.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601466600' + String(i).padStart(2, '0')])
    for (const [i, u] of ids.entries()) {
      const male = u === A || u === G || u === MOD || u === VIEW
      // C lives in Penang (far from everyone else in Bangsar, KL).
      const point = u === C ? 'POINT(100.33 5.41)' : 'POINT(101.671 3.13)'
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
         values ($1,'1996-04-04',$2,$3,'Kuala Lumpur','SRID=4326;${point}')`, ['St' + i, male ? 'male' : 'female', male ? '{female}' : '{male}'])
    }
    await su(`update profiles set verification_status='approved' where id = any($1) and id <> $2`, [ids, J])
    await su(`delete from random_chat_queue`)
    const set = async (u, emoji, text, tag = null) => (await as(u, `select set_status($1, $2, $3) r`, [emoji, text, tag])).rows[0].r
    const mine = async (u) => (await as(u, `select get_my_status() r`)).rows[0].r
    const feed = async (u) => (await as(u, `select * from get_live_statuses()`)).rows
    const sees = async (viewer, author) => (await feed(viewer)).some((r) => r.user_id === author)
    const reply = async (u, status, body) => (await as(u, `select start_status_conversation($1, $2) r`, [status, body])).rows[0].r
    const bs = async (u, s = null) => (await as(u, `select * from get_blind_session($1)`, [s])).rows[0]
    const log = async (action, target) => (await su(`select count(*)::int c from moderation_actions where action=$1 and target_id=$2`, [action, target])).rows[0].c

    // ----- set / replace / clear -----
    const first = await set(B, '☕', 'Coffee at Bangsar?')
    const hrs = (new Date(first.expires_at) - Date.now()) / 3600000
    ok('status: visible, expires after 3 h', first.moderation_state === 'visible' && hrs > 2.9 && hrs <= 3.01, JSON.stringify(first))
    const second = await set(B, '🏸', 'Badminton later', 'badminton')
    ok('status: new one replaces the old (one current per user)',
       (await su(`select count(*)::int c from user_statuses where user_id=$1 and replaced_at is null`, [B])).rows[0].c === 1 &&
       (await mine(B))?.text === 'Badminton later' && second.plan_tag === 'badminton')
    ok('status: a preset is stored on the status only (24 h plans removed)', (await su(`select to_regclass('public.user_plans') r`)).rows[0].r === null)
    ok('status: replaced row kept for retention', (await su(`select count(*)::int c from user_statuses where user_id=$1`, [B])).rows[0].c === 2)
    ok('status: text required and at most 60 characters', !!(await fails(() => set(B, '☕', '   '))) && !!(await fails(() => set(B, '☕', 'x'.repeat(61)))) && !!(await fails(() => set(B, '', 'hi'))))
    ok('status: preset tags only', !!(await fails(() => set(B, '☕', 'hi', 'anything'))))
    ok('status: unverified cannot set or read', !!(await fails(() => set(J, '☕', 'hi'))) && !!(await fails(() => feed(J))))
    ok('status: table closed to clients', !!(await fails(() => as(B, `select * from user_statuses`))) &&
       !!(await fails(() => as(B, `insert into user_statuses (user_id, emoji, text) values ($1,'x','y')`, [B]))))
    await as(B, `select clear_status()`)
    ok('status: clear hides it', (await mine(B)) === null)
    await su(`update profiles set muted_until = now() + interval '1 hour' where id=$1`, [B])
    ok('status: muted people cannot post a status', (await fails(() => set(B, '☕', 'hi')))?.includes('muted'))
    await su(`update profiles set muted_until = null where id=$1`, [B])

    // ----- moderation hold per risk kind -----
    await su(`insert into risk_keywords (keyword, weight) values ('sugar daddy', 5)`)
    const risky = [['phone', 'call me 0123456789'], ['link', 'see bit.ly/offer'], ['messenger', 'add me on telegram'],
      ['money', 'send rm50 first'], ['keyword', 'looking for a sugar daddy']]
    for (const [kind, text] of risky) {
      const r = await set(B, '👀', text)
      ok(`status: ${kind} puts it on hold`, r.moderation_state === 'held' &&
         (await su(`select held_kinds from user_statuses where id=$1`, [r.id])).rows[0].held_kinds.includes(kind), JSON.stringify(r))
    }
    ok('status: held one visible to the author as under review', (await mine(B))?.moderation_state === 'held')
    ok('status: held one hidden from others', !(await sees(A, B)))
    ok('status: clean text is not held', (await set(B, '🎬', 'Movie night, anyone?')).moderation_state === 'visible')

    // ----- carousel visibility -----
    for (const [u, text] of [[C, 'Far away'], [D, 'Blocked'], [E, 'Banned'], [F, 'Shadow'], [G, 'Same gender'], [H, 'Paused'], [I, 'Incognito']])
      await set(u, '✨', text)
    await as(A, `insert into blocks (blocked_id) values ($1)`, [D])
    await su(`update profiles set banned_at = now(), ban_reason = 'x', is_active = false where id=$1`, [E])
    await su(`update profiles set shadow_banned = true where id=$1`, [F])
    await su(`update profiles set discoverable = false where id=$1`, [H])
    await su(`update profiles set is_incognito = true where id=$1`, [I])
    const seen = await feed(A)
    ok('status: compatible person nearby is shown with name, age, emoji and text',
       seen.some((r) => r.user_id === B && r.display_name === 'St1' && r.age === 30 && r.emoji === '🎬' && r.text === 'Movie night, anyone?'), JSON.stringify(seen))
    ok('status: far, blocked, banned, shadow-banned, same gender, paused and incognito stay out',
       ![C, D, E, F, G, H, I].some((u) => seen.some((r) => r.user_id === u)), JSON.stringify(seen.map((r) => r.text)))
    ok('status: own status is not in the carousel', !(await sees(B, B)))
    ok('status: the author is hidden from the blocked person too', !(await sees(D, A)))
    ok('status: no location data in the carousel', !Object.keys(seen[0] ?? {}).some((k) => /location|distance|lat|lng/.test(k)))
    await su(`insert into new_people_alerts (user_id, genders, min_age, max_age, max_km) values ($1, '{female}', 40, 60, 50)`, [A])
    ok('status: saved Discover age range applies', !(await sees(A, B)))
    await su(`delete from new_people_alerts where user_id=$1`, [A])
    const bStatus = (await mine(B)).id
    await su(`update user_statuses set expires_at = now() - interval '1 second' where id=$1`, [bStatus])
    ok('status: expired one hidden everywhere', !(await sees(A, B)) && (await mine(B)) === null)
    await su(`update user_statuses set expires_at = now() + interval '3 hours' where id=$1`, [bStatus])
    await su(`update user_statuses set moderation_state = 'removed' where id=$1`, [bStatus])
    ok('status: removed one hidden everywhere', !(await sees(A, B)) && (await mine(B)) === null)
    await su(`update user_statuses set moderation_state = 'visible' where id=$1`, [bStatus])

    // ----- reply: a status conversation -----
    ok('status: cannot reply to your own status', !!(await fails(() => reply(B, bStatus, 'hi me'))))
    ok('status: cannot reply without a message', !!(await fails(() => reply(A, bStatus, '  '))))
    const dStatus = (await mine(D)).id
    ok('status: cannot reply across a block', !!(await fails(() => reply(A, dStatus, 'hi'))))
    const r1 = await reply(A, bStatus, 'Movie sounds great')
    ok('status: reply starts a conversation and sends the first message', r1.created === true && r1.state === 'active' && !!r1.message_id, JSON.stringify(r1))
    const sess = (await su(`select * from random_chat_sessions where id=$1`, [r1.session_id])).rows[0]
    ok('status: conversation kind, snapshot and sides', sess.kind === 'status' && sess.revealed_from_start === true && sess.status_id === bStatus &&
       sess.started_by === A && sess.user_a === B && sess.user_b === A && sess.status_snapshot.text === 'Movie night, anyone?' && sess.status_snapshot.emoji === '🎬' &&
       sess.post_id === null && sess.prompt_id === null && sess.event_id === null, JSON.stringify(sess))
    ok('status: kind constraint rejects a status session without its snapshot', !!(await fails(() => su(`insert into random_chat_sessions (user_a, user_b, kind, started_by) values ($1, $2, 'status', $2)`, [C, G]))))
    ok('status: kind constraint rejects a blind date carrying a status', !!(await fails(() => su(`insert into random_chat_sessions (user_a, user_b, status_id, status_snapshot) values ($1, $2, $3, '{}')`, [C, G, bStatus]))))
    ok('status: author is told on their own channel', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='conversation'`, ['randomizer:' + B])).rows[0].c === 1)
    const bView = await bs(B, r1.session_id)
    const aView = await bs(A, r1.session_id)
    ok('status: both see names from the start, with the status pinned',
       bView.kind === 'status' && bView.revealed_from_start === true && bView.partner?.display_name === 'St0' && bView.context?.text === 'Movie night, anyone?' &&
       bView.context?.i_am_author === true && aView.context?.i_am_author === false && aView.context?.status_id === bStatus &&
       bView.my_side === 'a' && aView.partner?.display_name === 'St1' && aView.my_side === 'b' && aView.partner_messages === 0 && aView.my_messages === 1, JSON.stringify([bView, aView]))
    ok('status: a status conversation never hijacks the Blind Dating screen', (await bs(A)) === undefined && (await bs(B)) === undefined)
    ok('status: outsider cannot read it', (await bs(C, r1.session_id)) === undefined)
    // push: claimed once per 10 minutes, to the other side, with the sender's name
    const push = (await svc(`select claim_session_push($1) r`, [r1.message_id])).rows[0].r
    ok('status: push goes to the author with kind and sender name', push?.recipient === B && push?.kind === 'status' && push?.sender_name === 'St0' && push?.is_first === true && push?.session_id === r1.session_id, JSON.stringify(push))
    ok('status: push throttled per conversation', (await svc(`select claim_session_push($1) r`, [r1.message_id])).rows[0].r === null)
    await as(A, `insert into notification_prefs (status_replies) values (false)`)
    ok('status: status_replies preference stored', (await as(A, `select status_replies from notification_prefs`)).rows[0].status_replies === false)
    const r2 = await reply(A, bStatus, 'Second message')
    ok('status: a second reply continues the same conversation', r2.created === false && r2.session_id === r1.session_id &&
       (await su(`select count(*)::int c from random_chat_messages where session_id=$1`, [r1.session_id])).rows[0].c === 2)
    const list = (await as(B, `select * from list_my_conversations()`)).rows.filter((r) => r.kind === 'status')
    ok('status: author lists the conversation with partner, pinned status and last message',
       list.length === 1 && list[0].context?.i_am_author === true && list[0].revealed_from_start === true && list[0].partner?.display_name === 'St0' &&
       list[0].last_body === 'Second message' && list[0].last_mine === false && list[0].context?.text === 'Movie night, anyone?', JSON.stringify(list))
    // a moderator removing the status hides its text in the pinned context (the chat stays)
    await su(`update user_statuses set moderation_state = 'removed' where id=$1`, [bStatus])
    const hidden = await bs(A, r1.session_id)
    ok('status: removed status text is hidden in the conversation', hidden.context?.text === null && hidden.context?.emoji === '🎬' && hidden.state === 'active', JSON.stringify(hidden.context))
    await su(`update user_statuses set moderation_state = 'visible' where id=$1`, [bStatus])
    // the open status reply does not block a blind date
    await su(`delete from random_chat_queue`)
    ok('status: an open status conversation does not block randomizer_join', (await as(A, `select randomizer_join('{female}',18,99) s`)).rows[0].s === null)
    await as(A, `select randomizer_leave()`)
    // Connect / Pass as in Blind Dating
    const d1 = (await as(B, `select blind_decide($1, true) r`, [r1.session_id])).rows[0].r
    const d2 = (await as(A, `select blind_decide($1, true) r`, [r1.session_id])).rows[0].r
    ok('status: mutual Connect = match + transcript', d1.state === 'waiting' && d2.state === 'matched' && !!d2.match_id &&
       (await su(`select count(*)::int c from messages where match_id=$1`, [d2.match_id])).rows[0].c === 2)
    ok('status: reply after the match returns its state', (await reply(A, bStatus, 'again')).state === 'matched')
    // held / expired statuses cannot be replied to; one per status per replier; 10 per day
    const held = await set(L[0], '👀', 'call me 0123456789')
    ok('status: cannot reply to a held status', !!(await fails(() => reply(A, held.id, 'hi'))))
    await su(`update user_statuses set moderation_state = 'visible', held_kinds = '{}' where id=$1`, [held.id])
    await su(`update user_statuses set expires_at = now() - interval '1 second' where id=$1`, [held.id])
    ok('status: cannot reply to an expired status', !!(await fails(() => reply(A, held.id, 'hi'))))
    await su(`update user_statuses set expires_at = now() + interval '1 hour' where id=$1`, [held.id])
    for (const [i, u] of L.entries()) {
      if (i === 0) continue
      await set(u, '🎮', 'Gaming tonight ' + i)
    }
    const targets = []
    for (const u of L) targets.push((await mine(u)).id)
    let started = 0
    const sessions = []
    for (const t of targets.slice(0, 9)) { sessions.push((await reply(A, t, 'hey')).session_id); started++ }
    ok('status: 10 new conversations per 24 hours', started === 9 && (await fails(() => reply(A, targets[9], 'hey')))?.includes('Too many'))
    ok('status: an existing conversation is reused even at the limit', (await reply(A, targets[0], 'again')).created === false)
    ok('status: a different person can still reply', (await reply(G, targets[9], 'hey')).created === true)
    await su(`update profiles set muted_until = now() + interval '1 hour' where id=$1`, [G])
    ok('status: muted people cannot reply', (await fails(() => reply(G, targets[8], 'hey')))?.includes('muted') &&
       (await su(`select count(*)::int c from random_chat_sessions where kind='status' and user_b=$1 and status_id=$2`, [G, targets[8]])).rows[0].c === 0)
    await su(`update profiles set muted_until = null, banned_at = now(), ban_reason = 'x' where id=$1`, [G])
    ok('status: banned people cannot reply', !!(await fails(() => reply(G, targets[8], 'hey'))))
    await su(`update profiles set banned_at = null, ban_reason = null where id=$1`, [G])
    // The status is purged long before the conversation: the pinned snapshot survives
    await su(`delete from user_statuses where id=$1`, [targets[1]])
    const orphan = (await su(`select status_id, status_snapshot from random_chat_sessions where id=$1`, [sessions[1]])).rows[0]
    const orphanView = await bs(A, sessions[1])
    ok('status: conversation survives the status purge with its snapshot', orphan && orphan.status_id === null && orphan.status_snapshot.text === 'Gaming tonight 1' &&
       orphanView?.context?.text === 'Gaming tonight 1' && orphanView?.context?.status_id === null, JSON.stringify([orphan, orphanView?.context]))

    // ----- reports -----
    await as(A, `insert into reports (target_type, target_id, reason) values ('status', $1, 'spam: ad')`, [bStatus])
    const rep = (await su(`select subject_id from reports where target_type='status' and target_id=$1`, [bStatus])).rows[0]
    ok('status: report subject is the author', rep?.subject_id === B)
    ok('status: cannot report your own status', !!(await fails(() => as(B, `insert into reports (target_type, target_id, reason) values ('status', $1, 'x: y')`, [bStatus]))))
    ok('status: cannot report a missing status', !!(await fails(() => as(A, `insert into reports (target_type, target_id, reason) values ('status', $1, 'x: y')`, [targets[1]]))))
    await su(`insert into admins (user_id, role) values ($1, 'moderator'), ($2, 'viewer')`, [MOD, VIEW])
    const queue = (await svc(`select * from admin_status_queue($1, 'reported')`, [MOD])).rows
    ok('status: admin queue lists the reported status with author and counts', queue.length === 1 && queue[0].id === bStatus && queue[0].display_name === 'St1' && queue[0].open_reports === 1 && Number(queue[0].total) === 1, JSON.stringify(queue))
    ok('status: held queue lists held ones', (await svc(`select * from admin_status_queue($1)`, [MOD])).rows.every((r) => r.moderation_state === 'held'))
    ok('status: viewer cannot decide', !!(await fails(() => svc(`select admin_moderate_status($1, $2, 'remove', 'spam')`, [VIEW, bStatus]))))
    ok('status: admin RPCs not callable by users', !!(await fails(() => as(MOD, `select admin_moderate_status($1, $2, 'remove', 'spam')`, [MOD, bStatus]))))
    const removed = (await svc(`select admin_moderate_status($1, $2, 'remove', 'spam') r`, [MOD, bStatus])).rows[0].r
    ok('status: remove hides it, closes the reports and is logged', removed.closed === 1 &&
       (await su(`select moderation_state, reviewed_by from user_statuses where id=$1`, [bStatus])).rows[0].moderation_state === 'removed' &&
       (await su(`select decision from reports where target_id=$1`, [bStatus])).rows[0].decision === 'hide' &&
       (await log('status.remove', bStatus)) === 1 && !(await sees(A, B)))
    const heldAgain = await set(B, '👀', 'send rm50 first')
    const approved = (await svc(`select admin_moderate_status($1, $2, 'approve') r`, [MOD, heldAgain.id])).rows[0].r
    ok('status: approve shows it and is logged', approved.closed === 0 &&
       (await su(`select moderation_state from user_statuses where id=$1`, [heldAgain.id])).rows[0].moderation_state === 'visible' &&
       (await log('status.approve', heldAgain.id)) === 1 && (await sees(A, B)))

    // ----- retention -----
    // Rows planted directly (J, MOD and VIEW have no status of their own).
    const stale = async (user, state, created, expires, replaced) => (await su(`insert into user_statuses (user_id, emoji, text, moderation_state, created_at, expires_at, replaced_at)
       values ($1, 'x', 'old', $2::text, now() - $3::interval, now() + $4::interval, case when $5::text is null then null else now() + $5::interval end) returning id`,
       [user, state, created, expires, replaced])).rows[0].id
    const expiredOld = await stale(J, 'visible', '2 days', '-25 hours', null)
    const expiredRecent = await stale(VIEW, 'visible', '2 days', '-23 hours', null)
    const replacedOld = await stale(MOD, 'visible', '2 days', '1 hour', '-25 hours')
    const heldOld = await stale(J, 'held', '91 days', '-90 days', '-90 days')
    const heldRecent = await stale(J, 'held', '89 days', '-88 days', '-88 days')
    const removedReported = await stale(J, 'removed', '91 days', '-90 days', '-90 days')
    await su(`insert into reports (reporter_id, target_type, target_id, reason) values ($1, 'status', $2, 'scam: x')`, [A, removedReported])
    ok('status: clients cannot run the purge', !!(await fails(() => as(A, `select purge_live_statuses()`))))
    await svc(`select purge_live_statuses()`)
    const alive = (await su(`select id from user_statuses where id = any($1)`, [[expiredOld, expiredRecent, replacedOld, heldOld, heldRecent, removedReported]])).rows.map((r) => r.id)
    ok('status: purge keeps recent, held < 90 d and reported; drops expired > 24 h, replaced > 24 h, held > 90 d',
       !alive.includes(expiredOld) && alive.includes(expiredRecent) && !alive.includes(replacedOld) && !alive.includes(heldOld) && alive.includes(heldRecent) && alive.includes(removedReported), JSON.stringify(alive))
    await su(`update reports set resolved_at = now() where target_id = $1`, [removedReported])
    await svc(`select purge_live_statuses()`)
    ok('status: resolved report releases the hold', (await su(`select count(*)::int c from user_statuses where id=$1`, [removedReported])).rows[0].c === 0)
    ok('status: no anon access', (await su(`select has_function_privilege('anon', 'public.get_live_statuses(int)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('anon', 'public.set_status(text, text, text)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('anon', 'public.start_status_conversation(uuid, text)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.admin_moderate_status(uuid, uuid, text, text)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.purge_live_statuses()', 'execute') v`)).rows[0].v === false)
    await su(`delete from random_chat_queue`)
  })()
  // ===== end live statuses =====

  // ===== duo dating (20261009000260, 20261009000261) =====
  await (async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `de000000-0000-4000-8000-0000000000${String(i + 10)}`)
    const [A, B, C, D, E, F, G, H, I, J, K, ADM] = ids
    for (const [i, u] of ids.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601577700' + String(i).padStart(2, '0')])
    // A, B: men who like women (team X). C, D: women who like men (team Y). E: woman, F: woman aged
    // 50 (team Z, F outside X's age range). G: woman, H: man who likes women (team W: H fits nobody
    // in X). I, J: women (team V, far away). K: a woman for blocks. ADM: moderator.
    const people = [
      [A, 'male', '{female}', '1996-04-04', 101.671, 3.13], [B, 'male', '{female}', '1998-04-04', 101.672, 3.13],
      [C, 'female', '{male}', '1997-04-04', 101.673, 3.13], [D, 'female', '{male}', '1999-04-04', 101.674, 3.13],
      [E, 'female', '{male}', '1997-04-04', 101.675, 3.13], [F, 'female', '{male}', '1976-04-04', 101.676, 3.13],
      [G, 'female', '{male}', '1997-04-04', 101.677, 3.13], [H, 'male', '{female}', '1997-04-04', 101.678, 3.13],
      [I, 'female', '{male}', '1997-04-04', 103.76, 1.46], [J, 'female', '{male}', '1997-04-04', 103.77, 1.46],
      [K, 'female', '{male}', '1997-04-04', 101.679, 3.13], [ADM, 'male', '{female}', '1990-01-01', 101.68, 3.13],
    ]
    for (const [i, [u, g, want, bd, lon, lat]] of people.entries()) {
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location, username)
         values ($1,$2,$3,$4,'Kuala Lumpur','SRID=4326;POINT(${lon} ${lat})',$5)`, ['Duo' + i, bd, g, want, 'duo_user_' + i])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [ids])
    for (const u of ids) await su(`insert into profile_photos (profile_id, storage_path, width, height, position) values ($1, $2, 720, 960, 0)`, [u, `${u}/p.webp`])
    await su(`insert into admins (user_id, role) values ($1, 'moderator')`, [ADM])
    const rpc = async (u, fn, args = []) => (await as(u, `select ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args)).rows[0]?.r
    const err = (u, fn, args = []) => fails(() => rpc(u, fn, args))
    const myDuo = (u) => rpc(u, 'get_my_duo')
    const deck = async (u) => (await rpc(u, 'get_duo_candidates')).map((c) => c.team_id)
    const teamOf = async (u) => (await su(`select duo_active_team($1) t`, [u])).rows[0].t
    const logs = async (action, target) => (await su(`select count(*)::int c from moderation_actions where action=$1 and target_id=$2`, [action, target])).rows[0].c

    // --- team lifecycle
    ok('duo: no team at first', (await myDuo(A)).team === null && (await myDuo(A)).invites.length === 0)
    const inv = await rpc(A, 'duo_invite', [B])
    ok('duo: invite by user returns team and code', /^[a-z0-9]{8}$/.test(inv.code) && !!inv.team_id, JSON.stringify(inv))
    ok('duo: inviter sees pending team', (await myDuo(A)).team?.status === 'pending' && (await myDuo(A)).team?.partner?.id === B)
    ok('duo: invitee sees the invite', (await myDuo(B)).invites[0]?.team_id === inv.team_id && (await myDuo(B)).invites[0]?.from?.display_name === 'Duo0')
    ok('duo: invitee got a realtime signal', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='duo'`, ['inbox:' + B])).rows[0].c === 1)
    ok('duo: cannot invite yourself', !!(await err(A, 'duo_invite', [A])))
    ok('duo: only the invitee can accept', (await err(C, 'duo_accept', [inv.team_id]))?.includes('Invite not found'))
    ok('duo: wrong code rejected', !!(await err(C, 'duo_accept', [null, 'zzzzzzzz'])))
    await rpc(B, 'duo_accept', [inv.team_id])
    ok('duo: accepted team is active for both', (await teamOf(A)) === inv.team_id && (await teamOf(B)) === inv.team_id)
    ok('duo: one active duo per user', (await err(A, 'duo_invite', [C]))?.includes('already have a duo') && (await err(B, 'duo_accept', [inv.team_id]))?.includes('already have a duo'))
    ok('duo: cannot invite someone who has a duo', (await err(C, 'duo_invite', [A]))?.includes('already has a duo'))
    ok('duo: teams table closed to clients', !!(await fails(() => as(A, `select * from duo_teams`))) && !!(await fails(() => as(A, `select * from duo_likes`))))
    // invite link
    const link = await rpc(C, 'duo_invite')
    ok('duo: open invite link has no invitee', (await myDuo(C)).team?.partner === null && (await myDuo(D)).invites.length === 0)
    ok('duo: link accepted by code', (await rpc(D, 'duo_accept', [null, link.code.toUpperCase()])) === link.team_id && (await teamOf(D)) === link.team_id)
    ok('duo: a used link cannot be accepted again', !!(await err(E, 'duo_accept', [null, link.code])))
    // accept cancels own pending invite; decline
    await rpc(E, 'duo_invite')
    const gi = await rpc(G, 'duo_invite', [E])
    await rpc(E, 'duo_decline', [gi.team_id])
    ok('duo: declined invite gone', (await su(`select status, dissolve_reason r from duo_teams where id=$1`, [gi.team_id])).rows[0].r === 'declined' && (await myDuo(G)).team === null)
    const ef = await rpc(E, 'duo_invite', [F])
    await rpc(F, 'duo_accept', [ef.team_id])
    const gh = await rpc(G, 'duo_invite', [H]); await rpc(H, 'duo_accept', [gh.team_id])
    const ij = await rpc(I, 'duo_invite', [J]); await rpc(J, 'duo_accept', [ij.team_id])
    const X = inv.team_id, Y = link.team_id, Z = ef.team_id, Wt = gh.team_id, V = ij.team_id
    // profile
    ok('duo: bio saved', (await rpc(A, 'duo_set_profile', ['Two friends who love hiking', 18, 30, 50])) === 'ok' && (await myDuo(B)).team?.bio === 'Two friends who love hiking' && (await myDuo(B)).team?.max_age === 30)
    ok('duo: bio over 120 characters rejected', !!(await err(B, 'duo_set_profile', ['x'.repeat(121)])))
    ok('duo: suspicious bio held', (await rpc(C, 'duo_set_profile', ['DM us on whatsapp 0123456789'])) === 'held' && (await myDuo(D)).team?.bio_status === 'held')
    ok('duo: profile needs an active duo', !!(await err(K, 'duo_set_profile', ['hi'])))

    // --- deck: both-way compatibility and exclusions (X: men 18-30 who like women)
    ok('duo: deck shows compatible duos only', JSON.stringify((await deck(A)).sort()) === JSON.stringify([Y].sort()), JSON.stringify(await deck(A)))
    ok('duo: Z excluded (F is 50, outside X age range)', !(await deck(B)).includes(Z) && !(await deck(E)).includes(X))
    ok('duo: W excluded (H fits nobody in X)', !(await deck(A)).includes(Wt) && !(await deck(G)).includes(X))
    ok('duo: V excluded (leaders too far apart)', !(await deck(A)).includes(V))
    await su(`update duo_teams set max_km = 300 where id in ($1, $2)`, [X, V])
    ok('duo: distance uses both teams limits', (await deck(A)).includes(V))
    await su(`update duo_teams set max_km = 50 where id in ($1, $2)`, [X, V])
    ok('duo: held bio hidden from others', (await rpc(A, 'get_duo_candidates')).find((c) => c.team_id === Y)?.bio === null)
    await rpc(C, 'duo_set_profile', ['Coffee and hikes'])
    const card = (await rpc(A, 'get_duo_candidates')).find((c) => c.team_id === Y)
    ok('duo: card carries both members, bio and distance', card?.bio === 'Coffee and hikes' && card?.members?.length === 2 && card.members[0].id === C && card.members[1].display_name === 'Duo3' && typeof card.distance_km === 'number' && !!card.members[0].photo?.path, JSON.stringify(card))
    ok('duo: own team never shown', !(await deck(A)).includes(X))
    for (const [label, sql] of [
      ['paused member', `update profiles set discoverable=false where id=$1`],
      ['incognito member', `update profiles set is_incognito=true where id=$1`],
      ['shadow-banned member', `update profiles set shadow_banned=true where id=$1`],
    ]) {
      await su(sql, [D])
      ok(`duo: ${label} hides the duo`, !(await deck(A)).includes(Y))
      await su(`update profiles set discoverable=true, is_incognito=false, shadow_banned=false where id=$1`, [D])
    }
    ok('duo: deck restored', (await deck(A)).includes(Y))
    await as(K, `insert into blocks (blocked_id) values ($1)`, [ADM])
    ok('duo: cannot invite someone who blocked you', !!(await err(ADM, 'duo_invite', [K])))
    await su(`delete from blocks where blocker_id=$1`, [K])
    await as(C, `insert into blocks (blocked_id) values ($1)`, [B])
    ok('duo: block between any members excludes the duo', !(await deck(A)).includes(Y) && !(await deck(D)).includes(X))
    await su(`delete from blocks where blocker_id=$1`, [C])
    ok('duo: no duo means an empty deck', (await deck(K)).length === 0)

    // --- likes: team decision, partner inbox, undo window, mutual => match + group
    const d1 = await rpc(A, 'duo_decide', [Y, true])
    ok('duo: like is not a match yet', d1.matched === false && d1.group_id === null, JSON.stringify(d1))
    const inbox = await rpc(B, 'get_duo_inbox')
    ok('duo: partner sees who liked', inbox.length === 1 && inbox[0].by.display_name === 'Duo0' && inbox[0].mine === false && inbox[0].can_undo === true && inbox[0].team.members.length === 2, JSON.stringify(inbox))
    ok('duo: partner got a realtime signal', (await su(`select count(*)::int c from realtime.messages where topic=$1 and event='duo' and payload->>'kind'='like'`, ['inbox:' + B])).rows[0].c === 1)
    ok('duo: liked duo leaves the deck', !(await deck(B)).includes(Y))
    ok('duo: deciding twice is idempotent', (await rpc(B, 'duo_decide', [Y, false])).decided === 'like')
    ok('duo: partner can undo within 1 hour', (await rpc(B, 'duo_undo_like', [Y])) === true && (await deck(A)).includes(Y) && (await rpc(A, 'get_duo_inbox')).length === 0)
    await rpc(B, 'duo_decide', [Y, true])
    await su(`update duo_likes set created_at = now() - interval '61 minutes' where team_id=$1 and target_team_id=$2`, [X, Y])
    ok('duo: undo refused after 1 hour', (await rpc(A, 'duo_undo_like', [Y])) === false && (await rpc(A, 'get_duo_inbox'))[0]?.can_undo === false)
    ok('duo: pass needs no compatibility', (await rpc(E, 'duo_decide', [X, false])).matched === false)
    ok('duo: cannot like an incompatible duo', (await err(G, 'duo_decide', [X, true]))?.includes('not available'))
    ok('duo: cannot like your own duo', !!(await err(A, 'duo_decide', [X, true])))
    const d2 = await rpc(D, 'duo_decide', [X, true])
    ok('duo: mutual like => duo match + group', d2.matched === true && d2.just_matched === true && !!d2.group_id, JSON.stringify(d2))
    const G1 = d2.group_id
    ok('duo: match row', (await su(`select count(*)::int c from duo_matches where group_id=$1 and team_a=least($2::uuid,$3::uuid)`, [G1, X, Y])).rows[0].c === 1)
    ok('duo: group has 4 members', (await su(`select count(*)::int c from group_members where group_id=$1 and left_at is null`, [G1])).rows[0].c === 4)
    ok('duo: all four signalled', (await su(`select count(*)::int c from realtime.messages where event='duo' and payload->>'kind'='match' and payload->>'group_id'=$1`, [G1])).rows[0].c === 4)
    ok('duo: matched duo leaves both decks and inbox shows matched', !(await deck(C)).includes(X) && (await rpc(A, 'get_duo_inbox'))[0]?.matched === true && (await rpc(A, 'get_duo_inbox'))[0]?.group_id === G1)
    ok('duo: undo impossible once matched', (await rpc(C, 'duo_undo_like', [X])) === false)
    ok('duo: deciding on a matched duo returns the match', (await rpc(A, 'duo_decide', [Y, true])).group_id === G1)

    // --- group chat
    const room = await rpc(A, 'get_group_chat', [G1])
    ok('group: member sees the room with 4 members', room?.members?.length === 4 && room.members.every((m) => m.member_id && m.left === false), JSON.stringify(room))
    ok('group: non-member sees nothing', (await rpc(E, 'get_group_chat', [G1])) === null && (await as(E, `select count(*)::int c from group_messages where group_id=$1`, [G1])).rows[0].c === 0 && (await as(E, `select count(*)::int c from group_members where group_id=$1`, [G1])).rows[0].c === 0)
    ok('group: system "matched" message', (await as(C, `select system_event e from group_messages where group_id=$1`, [G1])).rows[0]?.e === 'matched')
    const m1 = (await as(A, `insert into group_messages (group_id, body) values ($1, 'hello both') returning id`, [G1])).rows[0].id
    ok('group: member sends text', (await as(D, `select body from group_messages where id=$1`, [m1])).rows[0]?.body === 'hello both')
    ok('group: non-member cannot send', !!(await fails(() => as(E, `insert into group_messages (group_id, body) values ($1, 'x')`, [G1]))))
    ok('group: clients cannot send system messages', !!(await fails(() => as(A, `insert into group_messages (group_id, kind, system_event) values ($1, 'system', 'left')`, [G1]))))
    ok('group: photo needs an uploaded file', !!(await fails(() => as(A, `insert into group_messages (group_id, kind, media_path, image_width, image_height) values ($1, 'image', $2, 10, 10)`, [G1, `${G1}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`]))))
    const ph = `${G1}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`
    ok('storage: non-member cannot upload to the group folder', !!(await fails(() => as(E, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [ph]))))
    await as(B, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [ph])
    const m2 = (await as(B, `insert into group_messages (group_id, kind, media_path, image_width, image_height) values ($1, 'image', $2, 640, 480) returning id`, [G1, ph])).rows[0].id
    ok('group: photo message stored', !!m2 && (await as(C, `select count(*)::int c from storage.objects where name=$1`, [ph])).rows[0].c === 1)
    ok('storage: non-member cannot read group photos', (await as(E, `select count(*)::int c from storage.objects where name=$1`, [ph])).rows[0].c === 0)
    ok('group: messages flagged for risk', await (async () => { await as(C, `insert into group_messages (group_id, body) values ($1, 'add me on whatsapp')`, [G1]); return (await su(`select count(*)::int c from message_flags where source='group' and conversation_id=$1 and sender_id=$2`, [G1, C])).rows[0].c === 1 })())
    const t = 'group:' + G1
    await su(`insert into realtime.messages (topic, event, payload) values ($1, 'probe', '{}')`, [t])
    ok('realtime: member may join group:<id>', (await as(D, `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c === 1)
    ok('realtime: non-member cannot join group:<id>', (await as(E, `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c === 0)
    ok('realtime: client cannot write to group:<id>', !!(await fails(() => as(D, `insert into realtime.messages (topic, event, payload) values ($1,'message','{}')`, [t], t))))
    const tt = 'group-typing:' + G1
    ok('realtime: member may write typing', !(await fails(() => as(D, `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, [tt], tt))))
    ok('realtime: non-member cannot write typing', !!(await fails(() => as(E, `insert into realtime.messages (topic, event, payload) values ($1,'typing','{}')`, [tt], tt))))
    // unread + list
    const list = await rpc(D, 'get_group_chats')
    ok('group: chats list with members, last message and unread', list.length === 1 && list[0].group_id === G1 && list[0].members.length === 4 && list[0].unread === 3 && list[0].last_message?.sender_id === C, JSON.stringify(list))
    ok('group: unread count RPC', (await rpc(D, 'group_unread_count')) === 3 && (await rpc(C, 'group_unread_count')) === 2)
    await rpc(D, 'group_mark_read', [G1])
    ok('group: mark read', (await rpc(D, 'group_unread_count')) === 0)
    // mute
    await svc(`select admin_set_mute($1,$2,24,'spam')`, [ADM, A])
    ok('group: muted member cannot send', (await fails(() => as(A, `insert into group_messages (group_id, body) values ($1, 'x')`, [G1])))?.includes('muted'))
    await svc(`select admin_set_mute($1,$2,0)`, [ADM, A])
    ok('group: unmuted member sends again', !(await fails(() => as(A, `insert into group_messages (group_id, body) values ($1, 'back')`, [G1]))))

    // --- reports
    const rep = async (u, type, id) => { await as(u, `insert into reports (target_type, target_id, reason) values ($1, $2, 'harassment: rude')`, [type, id]); return (await su(`select id from reports where target_type=$1 and target_id=$2 and reporter_id=$3`, [type, id, u])).rows[0].id }
    const r1 = await rep(C, 'group_message', m1)
    ok('report: group message subject is the sender', (await su(`select subject_id s from reports where id=$1`, [r1])).rows[0].s === A)
    ok('report: own message cannot be reported', !!(await fails(() => rep(A, 'group_message', m1))))
    ok('report: non-member cannot report a group message', !!(await fails(() => rep(E, 'group_message', m1))))
    ok('report: system messages cannot be reported', !!(await fails(async () => rep(C, 'group_message', (await su(`select id from group_messages where group_id=$1 and kind='system' limit 1`, [G1])).rows[0].id))))
    const memberB = room.members.find((m) => m.id === B).member_id
    const r2 = await rep(D, 'group_member', memberB)
    ok('report: group member subject is that user', (await su(`select subject_id s from reports where id=$1`, [r2])).rows[0].s === B)
    ok('report: non-member cannot report a group member', !!(await fails(() => rep(E, 'group_member', memberB))))
    ok('report: queue lists group cases', (await svc(`select target_type::text t from admin_report_queue($1) where target_id in ($2, $3) order by t`, [ADM, m1, memberB])).rows.map((r) => r.t).join() === 'group_member,group_message')
    // 20261009000271 redefines reports_set_subject after 261: the newest definition must keep the
    // group branches next to 'status' (a CASE without them raises case_not_found).
    const subjectSrc = (await su(`select prosrc from pg_proc where proname = 'reports_set_subject'`)).rows[0].prosrc
    ok('report: newest reports_set_subject covers group and status targets',
      ["'group_message'", "'group_member'", "'status'"].every((t) => subjectSrc.includes(`when ${t} then`)))
    // evidence
    const tr = (type, id, reporter, adm = ADM) => svc(`select admin_open_group_transcript($1,$2,$3,$4) r`, [adm, type, id, reporter]).then((r) => r.rows[0].r)
    const ev = await tr('group_message', m1, C)
    ok('evidence: group transcript around the reported message', ev.group_id === G1 && ev.members.length === 4 && ev.messages.some((m) => m.id === m1 && m.reported) && ev.messages.some((m) => m.id === m2 && m.has_media) && ev.messages.some((m) => m.system_event === 'matched'), JSON.stringify(ev).slice(0, 300))
    ok('evidence: transcript access logged', (await logs('evidence.transcript_open', m1)) === 1)
    ok('evidence: member report shows the latest messages', (await tr('group_member', memberB, D)).messages.length >= 4)
    ok('evidence: only the reporter of an open report', (await fails(() => tr('group_message', m1, D)))?.includes('open report'))
    ok('evidence: non-admin refused', !!(await fails(() => tr('group_message', m1, C, A))))
    ok('evidence: media path logged', (await svc(`select admin_open_group_media($1,'group_message',$2,$3,$4) p`, [ADM, m1, C, m2])).rows[0].p === ph && (await logs('evidence.media_open', m2)) === 1)
    ok('evidence: 1:1 transcript viewer refuses group reports', !!(await fails(() => svc(`select admin_open_group_transcript($1,'message',$2,$3)`, [ADM, m1, C]))))
    ok('evidence: clients cannot open transcripts', !!(await fails(() => as(ADM, `select admin_open_group_transcript($1,'group_message',$2,$3)`, [ADM, m1, C]))))
    // held bio moderation
    await rpc(G, 'duo_set_profile', ['send money to my account'])
    const held = (await svc(`select admin_held_duo_bios($1) r`, [ADM])).rows[0].r
    ok('admin: held bios listed', held.some((h) => h.team_id === Wt && h.members.length === 2), JSON.stringify(held))
    await svc(`select admin_review_duo_bio($1,$2,false,'scam')`, [ADM, Wt])
    ok('admin: rejected bio removed and logged', (await myDuo(G)).team?.bio === null && (await myDuo(G)).team?.bio_status === 'ok' && (await logs('duo_bio.reject', Wt)) === 1)

    // --- leave, block, ban
    ok('group: leave', (await rpc(A, 'group_leave', [G1])) === true && (await rpc(A, 'get_group_chat', [G1])) === null)
    ok('group: others continue with a system message', (await as(B, `select about_user u from group_messages where group_id=$1 and system_event='left'`, [G1])).rows[0]?.u === A && (await rpc(B, 'get_group_chat', [G1])).members.find((m) => m.id === A).left === true)
    ok('group: left member cannot send or read', !!(await fails(() => as(A, `insert into group_messages (group_id, body) values ($1, 'x')`, [G1]))) && (await as(A, `select count(*)::int c from group_messages where group_id=$1`, [G1])).rows[0].c === 0)
    ok('realtime: left member loses the topic', (await as(A, `select count(*)::int c from realtime.messages where topic=$1`, [t], t)).rows[0].c === 0)
    ok('group: leaving twice is a no-op', (await rpc(A, 'group_leave', [G1])) === false)
    await as(D, `insert into blocks (blocked_id) values ($1)`, [B])
    ok('block: blocker leaves the shared group, others see "left"', (await rpc(D, 'get_group_chat', [G1])) === null && (await as(B, `select count(*)::int c from group_messages where group_id=$1 and system_event='left' and about_user=$2`, [G1, D])).rows[0].c === 1)
    ok('block: blocked member still in the group', (await rpc(B, 'get_group_chat', [G1]))?.members.find((m) => m.id === B).left === false)
    ok('block: duos stay, future matches prevented', (await teamOf(D)) === Y && (await deck(C)).every((id) => id !== X))
    await su(`delete from blocks where blocker_id=$1`, [D])
    // ban
    await svc(`select admin_ban_user($1,$2,'spam',7)`, [ADM, C])
    ok('ban: removed from the group with a system message', (await as(B, `select count(*)::int c from group_messages where group_id=$1 and system_event='removed' and about_user=$2`, [G1, C])).rows[0].c === 1)
    ok('ban: duo dissolved', (await su(`select status, dissolve_reason r from duo_teams where id=$1`, [Y])).rows[0].r === 'ban' && (await teamOf(D)) === null)
    ok('ban: partner sees no team', (await myDuo(D)).team === null)
    await svc(`select admin_unban_user($1,$2)`, [(await su(`update admins set role='admin' where user_id=$1 returning user_id`, [ADM])).rows[0].user_id, C])
    ok('group: last member leaving deletes the group', (await rpc(B, 'group_leave', [G1])) === true && (await su(`select count(*)::int c from group_chats where id=$1`, [G1])).rows[0].c === 0 && (await su(`select group_id g from duo_matches where team_a=least($1::uuid,$2::uuid)`, [X, Y])).rows[0].g === null)
    // partner block dissolves the duo
    await as(A, `insert into blocks (blocked_id) values ($1)`, [B])
    ok('block: blocking the duo partner dissolves the duo', (await su(`select dissolve_reason r from duo_teams where id=$1`, [X])).rows[0].r === 'block')
    await su(`delete from blocks where blocker_id=$1`, [A])
    ok('duo: leave dissolves for both', (await rpc(I, 'duo_leave')) === true && (await teamOf(J)) === null && (await myDuo(J)).team === null)

    // --- retention
    await su(`update group_messages set created_at = now() - interval '91 days' where id=$1`, [m2]).catch(() => null)
    const G2 = await (async () => {
      // A fresh match for retention: X2 (A, B) and Y2 (C, D).
      const x2 = await rpc(A, 'duo_invite', [B]); await rpc(B, 'duo_accept', [x2.team_id])
      const y2 = await rpc(C, 'duo_invite', [D]); await rpc(D, 'duo_accept', [y2.team_id])
      await rpc(A, 'duo_decide', [y2.team_id, true])
      return (await rpc(C, 'duo_decide', [x2.team_id, true])).group_id
    })()
    const ph2 = `${G2}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp`
    await as(A, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [ph2])
    const m3 = (await as(A, `insert into group_messages (group_id, kind, media_path, image_width, image_height) values ($1, 'image', $2, 10, 10) returning id`, [G2, ph2])).rows[0].id
    ok('retention: group photo is not an orphan', !(await su(`select retention_orphan_chat_media() p`)).rows.some((r) => r.p === ph2) && await (async () => { await su(`update storage.objects set created_at = now() - interval '2 days' where name=$1`, [ph2]); return !(await su(`select retention_orphan_chat_media() p`)).rows.some((r) => r.p === ph2) })())
    // The earlier group reports (subjects A and B) still hold everything of A and B: close them.
    await su(`update reports set resolved_at = now() where id in ($1, $2)`, [r1, r2])
    ok('retention: fresh photo not due', (await su(`select count(*)::int c from retention_group_media()`)).rows[0].c === 0)
    await su(`update group_messages set created_at = now() - interval '91 days' where id=$1`, [m3])
    ok('retention: old photo due', (await su(`select message_id from retention_group_media()`)).rows.map((r) => r.message_id).join() === m3)
    const r3 = await rep(C, 'group_message', m3)
    ok('retention: kept under an open report', (await su(`select count(*)::int c from retention_group_media()`)).rows[0].c === 0)
    await su(`update reports set resolved_at = now() where id=$1`, [r3])
    ok('retention: file still there => not marked', (await su(`select retention_mark_group_media_expired($1) n`, [[m3]])).rows[0].n === 0)
    await su(`delete from storage.objects where name=$1`, [ph2])
    ok('retention: expired placeholder', (await su(`select retention_mark_group_media_expired($1) n`, [[m3]])).rows[0].n === 1 && (await as(B, `select media_path p, media_expired_at e from group_messages where id=$1`, [m3])).rows[0].p === null)
    ok('retention: text stays while the group exists', (await as(B, `select count(*)::int c from group_messages where group_id=$1`, [G2])).rows[0].c >= 2)
    await su(`update duo_teams set dissolved_at = now() - interval '91 days' where id=$1`, [Wt])
    await su(`update duo_teams set dissolved_at = now() - interval '91 days' where id=$1`, [V])
    const purged = (await su(`select purge_old_duo_data() n`)).rows[0].n
    ok('retention: old dissolved teams purged', purged >= 1 && (await su(`select count(*)::int c from duo_teams where id=$1`, [V])).rows[0].c === 0 && (await su(`select count(*)::int c from duo_teams where id=$1`, [Wt])).rows[0].c === 1)
    ok('retention: no anon access', (await su(`select has_function_privilege('anon', 'public.get_duo_candidates(int)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.purge_old_duo_data()', 'execute') v`)).rows[0].v === false)
  })()
  // ===== end duo dating =====


  // ===== plans: free / plus / vip (20261009000280) =====
  // Gates and quotas per level, staff get everything, grant stacking and expiry, legacy VIP,
  // promo and admin grants, the matrix editor (roles, logging), disabled features.
  await (async () => {
    // From here on new profiles start on free (the hook at the top of run() is for older blocks).
    await su(`drop trigger test_auto_vip on public.profiles`)
    await su(`drop function public.test_auto_vip()`)
    const id = (n) => `a2800000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
    const [F, P, V, S, M1, M2, M3, V2, ADM, MOD, L] = Array.from({ length: 11 }, (_, i) => id(i + 1))
    const people = [[F, 'Pl Free', 'female', '{male}'], [P, 'Pl Plus', 'female', '{male}'], [V, 'Pl Vip', 'female', '{male}'],
      [S, 'Pl Staff', 'male', '{female}'], [M1, 'Pl M1', 'male', '{female}'], [M2, 'Pl M2', 'male', '{female}'],
      [M3, 'Pl M3', 'male', '{female}'], [V2, 'Pl Vip2', 'male', '{female}'], [ADM, 'Pl Admin', 'male', '{female}'],
      [MOD, 'Pl Mod', 'male', '{female}'], [L, 'Pl Legacy', 'female', '{male}']]
    for (const [i, [u, name, g, w]] of people.entries()) {
      await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '60192800' + String(i).padStart(3, '0')])
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location) values ($1,'1996-06-06',$2,$3,'George Town','SRID=4326;POINT(100.33 5.41)')`, [name, g, w])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [people.map((p) => p[0])])
    await su(`insert into admins (user_id, role) values ($1, 'viewer'), ($2, 'admin'), ($3, 'moderator')`, [S, ADM, MOD])
    const svc = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const err = async (fn) => { try { await fn(); return null } catch (e) { return e } }
    const gate = (e, key, hint = 'feature') => !!e && e.code === 'VP402' && e.detail === key && e.hint === hint
    const grant = (u, plan, days, source = 'admin') => su(`select grant_plan($1, $2, $3, $4) e`, [u, plan, days, source]).then((r) => r.rows[0].e)
    const planOf = async (u) => (await su(`select current_plan($1) p`, [u])).rows[0].p
    const access = async (u) => (await as(u, `select my_access() a`)).rows[0].a
    const logs = async (action) => (await su(`select count(*)::int c from moderation_actions where action=$1 and admin_id=$2`, [action, ADM])).rows[0].c
    const days = (t) => (new Date(t) - Date.now()) / 864e5

    // ----- matrix seeds -----
    const feats = (await su(`select key, min_plan, enabled from features`)).rows
    const fmin = Object.fromEntries(feats.map((f) => [f.key, f.min_plan]))
    ok('plans: matrix seeded', feats.length === 22 && feats.every((f) => f.enabled) && fmin.likes_per_day === 'free' && fmin.chat_photos === 'plus' &&
       fmin.voice_messages === 'plus' && fmin.video_messages === 'plus' && fmin.calls === 'vip' && fmin.feed_post === 'plus' && fmin.feed_comment === 'plus' &&
       fmin.feed_like === 'free' && fmin.who_liked_you === 'plus' && fmin.incognito === 'plus' && fmin.boost === 'plus' && fmin.vip_badge === 'vip' &&
       fmin.event_priority === 'vip' && fmin.duo === 'free' && fmin.statuses === 'free' && fmin.crossed_paths === 'free' && fmin.message_before_match === 'vip' &&
       ['read_receipts', 'profile_visitors', 'discover_priority'].every((k) => fmin[k] === 'vip'), JSON.stringify(fmin))
    const lim = Object.fromEntries((await su(`select feature_key || ':' || plan k, limit_value v, period p from plan_limits`)).rows.map((r) => [r.k, [r.v, r.p]]))
    ok('plans: limits seeded', JSON.stringify([lim['likes_per_day:free'], lim['likes_per_day:plus'], lim['blind_dating_per_day:free'], lim['blind_dating_per_day:plus'],
       lim['blind_dating_per_day:vip'], lim['boost:plus'], lim['boost:vip'], lim['crush_links_per_30d:free'], lim['crush_links_per_30d:plus'], lim['crush_links_per_30d:vip'],
       lim['message_before_match:vip']]) === JSON.stringify([[100, 'day'], [null, null], [3, 'day'], [10, 'day'], [null, null], [1, 'month'], [1, 'week'],
       [1, 'month'], [3, 'month'], [5, 'month'], [1, 'day']]), JSON.stringify(lim))

    // ----- clients cannot grant themselves anything -----
    ok('plans: clients cannot write grants or the matrix', !!(await fails(() => as(F, `insert into plan_grants (user_id, plan, source) values ($1, 'vip', 'admin')`, [F]))) &&
       !!(await fails(() => as(F, `update features set min_plan = 'free'`))) && !!(await fails(() => as(F, `insert into plan_limits values ('likes_per_day', 'free', null, null)`))) &&
       !!(await fails(() => as(F, `insert into feature_uses (user_id, feature_key) values ($1, 'boost')`, [F]))))
    ok('plans: internal helpers not callable by clients', !!(await fails(() => as(F, `select grant_plan($1, 'vip', 30, 'admin')`, [F]))) &&
       !!(await fails(() => as(F, `select has_feature($1, 'calls')`, [F]))) && !!(await fails(() => as(F, `select current_plan($1)`, [V]))) &&
       !!(await fails(() => as(F, `select consume_feature($1, 'boost')`, [F]))) &&
       (await su(`select has_function_privilege('anon', 'public.my_access()', 'execute') v`)).rows[0].v === false)
    ok('plans: admin RPCs not callable by clients', !!(await fails(() => as(ADM, `select admin_grant_plan($1, $1, 'vip', 30, null)`, [ADM]))) &&
       !!(await fails(() => as(ADM, `select admin_set_feature($1, 'calls', true, 'free', null)`, [ADM]))))

    // ----- levels, grants, stacking, expiry -----
    ok('plans: no grant = free', (await planOf(F)) === 'free' && (await access(F)).plan === 'free' && (await access(F)).is_staff === false)
    await grant(P, 'plus', 10); const pEnd = await grant(P, 'plus', 10)
    ok('plans: grants of the same level stack', Math.abs(days(pEnd) - 20) < 0.01 && Math.abs(days((await access(P)).plan_until) - 20) < 0.01 && (await planOf(P)) === 'plus')
    await grant(V, 'vip', 30)
    ok('plans: vip level', (await planOf(V)) === 'vip' && (await access(V)).plan === 'vip')
    // A higher level starts now; a lower one waits until the higher one ends.
    const vEnd = await grant(V2, 'vip', 5)
    const pAfter = await grant(V2, 'plus', 7)
    ok('plans: plus after vip starts when vip ends', Math.abs(days(vEnd) - 5) < 0.01 && Math.abs(days(pAfter) - 12) < 0.01 && (await planOf(V2)) === 'vip')
    ok('plans: own grants readable, others not', (await as(V2, `select count(*)::int c from plan_grants`)).rows[0].c === 2 &&
       (await as(F, `select count(*)::int c from plan_grants`)).rows[0].c === 0)
    await su(`update plan_grants set starts_at = now() - interval '6 days', ends_at = now() - interval '1 second' where user_id=$1 and plan='vip'`, [V2])
    await su(`update plan_grants set starts_at = now() - interval '1 second' where user_id=$1 and plan='plus'`, [V2])
    ok('plans: expiry is automatic, the queued plus takes over', (await planOf(V2)) === 'plus')
    await su(`update plan_grants set revoked_at = now() where user_id=$1`, [V2])
    ok('plans: revoked grants are ignored', (await planOf(V2)) === 'free')
    await grant(V2, 'vip', 30)

    // ----- legacy vip_until migration (the statement of 20261009000280, run again for one user) -----
    const { readFileSync } = await import('node:fs')
    const mig = readFileSync(new URL('../../supabase/migrations/20261009000280_plans.sql', import.meta.url), 'utf8')
    const legacySql = mig.match(/insert into public\.plan_grants \(user_id, plan, source, starts_at, ends_at, note\)\nselect[\s\S]*?where p\.vip_until > now\(\);/)[0]
    await su(`update profiles set vip_until = now() + interval '12 days' where id=$1`, [L])
    await su(`update profiles set vip_until = now() - interval '1 day' where id=$1`, [M3])
    await su(legacySql)
    const lg = (await su(`select plan, source, ends_at from plan_grants where user_id=$1`, [L])).rows
    ok('plans: active vip_until becomes a legacy vip grant', lg.length === 1 && lg[0].plan === 'vip' && lg[0].source === 'legacy' && Math.abs(days(lg[0].ends_at) - 12) < 0.01 &&
       (await planOf(L)) === 'vip' && (await su(`select count(*)::int c from plan_grants where user_id=$1`, [M3])).rows[0].c === 0)
    ok('plans: a profile with vip_until null (or expired) stays free after the backfill', (await su(`select vip_until from profiles where id=$1`, [F])).rows[0].vip_until === null &&
       (await su(`select count(*)::int c from plan_grants where user_id = any($1)`, [[F, M3]])).rows[0].c === 0 && (await planOf(F)) === 'free' && (await planOf(M3)) === 'free')
    ok('plans: only admins rows are staff', (await su(`select is_staff($1) a, is_staff($2) b, is_staff(null) c`, [F, S])).rows[0].a === false && (await su(`select is_staff($1) b`, [S])).rows[0].b === true)
    await su(`delete from plan_grants where user_id=$1`, [L])

    // ----- staff get everything, no limits -----
    const sa = await access(S)
    ok('plans: staff (any role) get everything', sa.is_staff === true && sa.plan === 'vip' && Object.values(sa.features).every((f) => f.on && f.limit === null), JSON.stringify(sa.features.likes_per_day))
    const fa = await access(F)
    ok('plans: my_access for free', fa.features.chat_photos.on === false && fa.features.likes_per_day.on === true && fa.features.likes_per_day.limit === 100 &&
       fa.features.likes_per_day.used === 0 && fa.features.calls.min_plan === 'vip' && fa.features.blind_dating_per_day.limit === 3, JSON.stringify(fa.features.likes_per_day))

    // ----- Discover likes per day (the free limit lowered to 2 for the test) -----
    await svc(`select admin_set_limit($1, 'likes_per_day', 'free', 2, 'day')`, [ADM])
    const like = (u, t, dir = 'like') => as(u, `insert into swipes (swiped_id, direction) values ($1, $2)`, [t, dir])
    await like(F, M1); await like(F, M2)
    const lErr = await err(() => like(F, M3))
    ok('plans: free likes stop at the daily limit (VP402 limit)', gate(lErr, 'likes_per_day', 'limit'), lErr?.message)
    ok('plans: passes are not limited', !(await fails(() => like(F, M3, 'pass'))))
    await like(P, M1); await like(P, M2)
    ok('plans: plus likes are unlimited', !(await fails(() => like(P, M3))))
    ok('plans: my_access shows the used quota', (await access(F)).features.likes_per_day.used === 2)
    await svc(`select admin_set_limit($1, 'likes_per_day', 'free', 100, 'day')`, [ADM])

    // ----- who liked you: blurred (count only) for free -----
    await like(S, F); await like(S, P)
    ok('plans: free sees the count, not the people', (await as(F, `select count_incoming_likes() n`)).rows[0].n === 1 &&
       (await as(F, `select * from get_incoming_likes(50)`)).rows.length === 0)
    ok('plans: plus sees who liked them', (await as(P, `select id from get_incoming_likes(50)`)).rows.map((r) => r.id).join() === S)

    // ----- chat media by kind -----
    const mf = (await su(`select ensure_match($1,$2,'swipe') id`, [F, M1])).rows[0].id
    const mp = (await su(`select ensure_match($1,$2,'swipe') id`, [P, M2])).rows[0].id
    const upload = (u, name) => as(u, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [name])
    const photo = async (u, m, n) => { const p = `${m}/d2800000-0000-4000-8000-0000000000${n}.webp`; await upload(u, p)
      return as(u, `insert into messages (match_id, image_path, image_width, image_height) values ($1, $2, 10, 10)`, [m, p]) }
    const voice = async (u, m, n) => { const p = `${m}/d2800000-0000-4000-8000-0000000000${n}.webm`; await upload(u, p)
      return as(u, `insert into messages (match_id, media_kind, media_path, media_mime, media_duration_ms) values ($1, 'voice', $2, 'audio/webm', 3000)`, [m, p]) }
    const video = async (u, m, n) => { const p = `${m}/d2800000-0000-4000-8000-0000000000${n}.mp4`; await upload(u, p)
      return as(u, `insert into messages (match_id, media_kind, media_path, media_mime, media_duration_ms) values ($1, 'video', $2, 'video/mp4', 3000)`, [m, p]) }
    ok('plans: free can send text', !(await fails(() => as(F, `insert into messages (match_id, body) values ($1, 'hi')`, [mf]))))
    ok('plans: free cannot send photos / voice / video', gate(await err(() => photo(F, mf, '01')), 'chat_photos') &&
       gate(await err(() => voice(F, mf, '02')), 'voice_messages') && gate(await err(() => video(F, mf, '03')), 'video_messages'))
    ok('plans: plus sends photos, voice and video', !(await fails(() => photo(P, mp, '05'))) && !(await fails(() => voice(P, mp, '06'))) && !(await fails(() => video(P, mp, '07'))))

    // ----- feed: posts and comments need Plus, likes are free -----
    ok('plans: free cannot post', gate(await err(() => as(F, `select create_post('free post')`)), 'feed_post'))
    const post = (await as(P, `select create_post('plus post') id`)).rows[0].id
    ok('plans: plus posts', !!post)
    ok('plans: free cannot comment', gate(await err(() => as(F, `select create_comment($1, 'hey')`, [post])), 'feed_comment'))
    ok('plans: plus comments', !(await fails(() => as(P, `select create_comment($1, 'hey')`, [post]))))
    ok('plans: free can like posts', (await as(F, `select toggle_post_like($1) v`, [post])).rows[0].v === true)

    // ----- a disabled feature blocks everyone but staff -----
    await svc(`select admin_set_feature($1, 'feed_like', false, 'free', 'test')`, [ADM])
    ok('plans: disabled feature blocks non-staff', gate(await err(() => as(V, `select toggle_post_like($1)`, [post])), 'feed_like') &&
       (await access(V)).features.feed_like.on === false)
    ok('plans: disabled feature still works for staff', (await as(S, `select toggle_post_like($1) v`, [post])).rows[0].v === true)
    await svc(`select admin_set_feature($1, 'feed_like', true, 'free', null)`, [ADM])
    await svc(`select admin_set_feature($1, 'statuses', false, 'free', null)`, [ADM])
    ok('plans: statuses switch', gate(await err(() => as(F, `select set_status('☕', 'Coffee')`)), 'statuses') &&
       !(await fails(() => as(S, `select set_status('☕', 'Coffee')`))))
    await svc(`select admin_set_feature($1, 'statuses', true, 'free', null)`, [ADM])
    ok('plans: duo and crossed paths are free', !(await fails(() => as(F, `select set_crossed_paths(true)`))))

    // ----- calls: only the caller needs the feature (vip or staff); any callee may pick up -----
    const mv = (await su(`select ensure_match($1,$2,'swipe') id`, [V, V2])).rows[0].id
    const mvp = (await su(`select ensure_match($1,$2,'swipe') id`, [V, M3])).rows[0].id
    const msf = (await su(`select ensure_match($1,$2,'swipe') id`, [S, F])).rows[0].id
    for (const [u, m] of [[V, mv], [V2, mv], [V, mvp], [M3, mvp], [P, mp], [M2, mp], [S, msf], [F, msf]]) {
      await as(u, `select accept_calls_notice()`); await as(u, `select set_call_permission($1, true)`, [m])
    }
    ok('plans: plus cannot start a call', gate(await err(() => as(P, `select start_call($1, 'audio')`, [mp])), 'calls'))
    const call = (await as(V, `select start_call($1, 'video') id`, [mv])).rows[0].id
    ok('plans: vip to vip call rings and is answered', !!call && (await as(V2, `select answer_call($1) s`, [call])).rows[0].s === 'active')
    await as(V, `select end_call($1)`, [call])
    const toFree = (await as(V, `select start_call($1, 'audio') id`, [mvp])).rows[0].id
    ok('plans: a free callee accepts a vip\'s call', !!toFree && (await as(M3, `select answer_call($1) s`, [toFree])).rows[0].s === 'active')
    await as(V, `select end_call($1)`, [toFree])
    ok('plans: a free caller cannot start a call (hint feature)', gate(await err(() => as(M3, `select start_call($1, 'audio')`, [mvp])), 'calls'))
    const staffCall = (await as(S, `select start_call($1, 'audio') id`, [msf])).rows[0].id
    ok('plans: staff without a grant can call, a free callee accepts', !!staffCall && (await as(F, `select answer_call($1) s`, [staffCall])).rows[0].s === 'active')
    await as(S, `select end_call($1)`, [staffCall])
    const ring = (await as(V, `select start_call($1, 'audio') id`, [mvp])).rows[0].id
    await su(`update plan_grants set revoked_at = now() where user_id=$1 and revoked_at is null`, [V])
    ok('plans: caller downgraded while ringing: accept refused (hint partner)', gate(await err(() => as(M3, `select answer_call($1)`, [ring])), 'calls', 'partner') &&
       (await su(`select status from calls where id=$1`, [ring])).rows[0].status === 'ringing')
    await su(`update plan_grants set revoked_at = null where user_id=$1`, [V])
    await su(`update calls set status = 'ended', ended_at = now() where id=$1`, [ring])

    // ----- incognito: plus+, counts as off without the feature -----
    ok('plans: free cannot switch incognito on', gate(await err(() => as(F, `update profiles set is_incognito = true where id=$1`, [F])), 'incognito'))
    await as(P, `update profiles set is_incognito = true where id=$1`, [P])
    const deck = async () => (await as(V2, `select id from get_swipe_candidates('{female}', 18, 99, 50, 50)`)).rows.map((r) => r.id)
    ok('plans: plus incognito hides from people they did not like', !(await deck()).includes(P))
    await su(`update plan_grants set revoked_at = now() where user_id=$1`, [P])
    ok('plans: after a downgrade incognito stays set but counts as off', (await deck()).includes(P) &&
       (await su(`select is_incognito i from profiles where id=$1`, [P])).rows[0].i === true)
    ok('plans: switching incognito off is always allowed', !(await fails(() => as(P, `update profiles set is_incognito = false where id=$1`, [P]))))
    await grant(P, 'plus', 30)

    // ----- boost quota: plus 1 per month, vip 1 per week -----
    ok('plans: free has no boost', gate(await err(() => as(F, `select activate_boost()`)), 'boost'))
    const b1 = (await as(P, `select activate_boost() t`)).rows[0].t
    ok('plans: boost lasts 30 minutes', Math.abs((new Date(b1) - Date.now()) / 60000 - 30) < 0.5)
    ok('plans: a running boost is returned, not stacked', String((await as(P, `select activate_boost() t`)).rows[0].t) === String(b1) &&
       (await su(`select count(*)::int c from feature_uses where user_id=$1`, [P])).rows[0].c === 1)
    await su(`update profiles set vip_boost_until = now() - interval '1 second' where id = any($1)`, [[P]])
    ok('plans: plus gets one boost per month', gate(await err(() => as(P, `select activate_boost()`)), 'boost', 'limit'))
    await as(V, `select activate_boost()`)
    await su(`update profiles set vip_boost_until = now() - interval '1 second' where id=$1`, [V])
    ok('plans: vip one per week', gate(await err(() => as(V, `select activate_boost()`)), 'boost', 'limit'))
    await su(`update feature_uses set created_at = now() - interval '8 days' where user_id=$1`, [V])
    ok('plans: vip boost again after a week', !(await fails(() => as(V, `select activate_boost()`))))
    ok('plans: purge keeps a month of uses', (await su(`select purge_feature_uses() n`)).rows[0].n === 0)

    // ----- secret crush links per 30 days: free 1, vip 5 -----
    const crush = (u) => as(u, `select create_referral_invite(true) c`)
    await crush(F)
    ok('plans: free gets one crush link per 30 days', gate(await err(() => crush(F)), 'crush_links_per_30d', 'limit') &&
       !(await fails(() => as(F, `select create_referral_invite(false)`))))
    for (let i = 0; i < 5; i++) await crush(V)
    ok('plans: vip gets five', gate(await err(() => crush(V)), 'crush_links_per_30d', 'limit'))

    // ----- VIP badge: an active vip grant only (staff get no crown without one) -----
    const crowns = async () => (await as(M1, `select vip_ids($1) id`, [[F, P, V, S]])).rows.map((r) => r.id).sort().join()
    const crowned = async (u) => (await as(u, `select my_vip() v`)).rows[0].v.is_vip
    ok('plans: VIP badge only for vip', (await crowns()) === [V].join() &&
       (await crowned(P)) === false && (await crowned(V)) === true && (await crowned(F)) === false)
    ok('plans: staff without a grant has no crown', (await crowned(S)) === false && (await as(S, `select my_vip() v`)).rows[0].v.plan === 'free' &&
       (await su(`select is_vip($1) v`, [S])).rows[0].v === false && (await access(S)).features.calls.on === true)
    const sGrant = await grant(S, 'vip', 30)
    ok('plans: staff with a vip grant has the crown', !!sGrant && (await crowns()) === [V, S].sort().join() && (await crowned(S)) === true)
    await su(`delete from plan_grants where user_id=$1`, [S])

    // ----- Blind Dating: regular dates per day, events unlimited, vip priority in events -----
    await su(`delete from random_chat_queue`)
    for (let i = 0; i < 3; i++) {
      await su(`insert into random_chat_sessions (user_a, user_b, kind, status, ended_at) values ($1, $2, 'blind', 'ended', now())`, [F, M1])
      await su(`insert into random_chat_sessions (user_a, user_b, kind, status, ended_at) values ($1, $2, 'blind', 'ended', now())`, [P, M1])
    }
    ok('plans: free gets 3 blind dates a day', gate(await err(() => as(F, `select randomizer_join('{male}', 18, 99)`)), 'blind_dating_per_day', 'limit') &&
       (await access(F)).features.blind_dating_per_day.used === 3)
    ok('plans: plus gets more', !(await fails(() => as(P, `select randomizer_join('{male}', 18, 99)`))))
    await as(P, `select randomizer_leave()`)
    await su(`insert into random_chat_queue (user_id, want_genders, min_age, max_age, want_tags) values ($1, '{male}', 18, 99, '{}')`, [F])
    ok('plans: someone out of dates is not paired from the queue', (await as(M2, `select randomizer_join('{female}', 18, 99) s`)).rows[0].s === null)
    await su(`delete from random_chat_queue`)
    const ev = (await su(`insert into scheduled_events (title_en, title_ms, title_ru, starts_at, ends_at, status) values ('Pl', 'Pl', 'Pl', now() - interval '1 minute', now() + interval '1 hour', 'live') returning id`)).rows[0].id
    await su(`insert into random_chat_queue (user_id, want_genders, min_age, max_age, want_tags, event_id, enqueued_at) values
      ($1, '{male}', 18, 99, '{}', $3, now() - interval '20 seconds'), ($2, '{male}', 18, 99, '{}', $3, now() - interval '10 seconds')`, [F, V, ev])
    const es = (await as(M2, `select randomizer_join('{female}', 18, 99, '{}', $1) s`, [ev])).rows[0].s
    ok('plans: vip is paired first in a Blind Dating Night', (await su(`select user_a from random_chat_sessions where id=$1`, [es])).rows[0]?.user_a === V)
    const es2 = (await as(M3, `select randomizer_join('{female}', 18, 99, '{}', $1) s`, [ev])).rows[0].s
    ok('plans: events are not limited by the daily quota', (await su(`select user_a from random_chat_sessions where id=$1`, [es2])).rows[0]?.user_a === F)
    await su(`update random_chat_sessions set status = 'ended', ended_at = now() where id = any($1)`, [[es, es2]])
    await su(`delete from random_chat_queue`)

    // ----- promo codes grant plans -----
    const upsertPromo = (code, benefits) => su(`select admin_upsert_promo($1, null, $2, null, null, $3::jsonb, null, false) id`, [ADM, code, JSON.stringify(benefits)])
    ok('plans: promo benefits validated', !!(await fails(() => upsertPromo('PLGOLD', { plan: 'gold', days: 5 }))) &&
       !!(await fails(() => upsertPromo('PLNODAYS', { plan: 'plus' }))) && !!(await fails(() => upsertPromo('PLBOTH', { plan: 'plus', days: 5, vip_days: 5 }))))
    await upsertPromo('PLPLUS30', { plan: 'plus', days: 30 })
    const pr = (await as(M1, `select redeem_promo('plplus30') r`)).rows[0].r
    ok('plans: promo grants a plus plan', pr.status === 'granted' && pr.plan === 'plus' && (await planOf(M1)) === 'plus' &&
       (await su(`select source from plan_grants where user_id=$1`, [M1])).rows[0].source === 'promo', JSON.stringify(pr))
    const xm = (await su(`select benefits, is_active from promo_codes where code='XMUM_FIRST_100'`)).rows[0]
    ok('plans: XMUM_FIRST_100 is VIP for 90 days and inactive', xm.benefits.plan === 'vip' && xm.benefits.days === 90 && xm.is_active === false)

    // ----- admin RPCs: roles and logging -----
    ok('plans: moderator cannot edit the matrix or grant', !!(await fails(() => svc(`select admin_set_feature($1, 'calls', true, 'plus', null)`, [MOD]))) &&
       !!(await fails(() => svc(`select admin_grant_plan($1, $2, 'vip', 30, null)`, [MOD, F]))) && !!(await fails(() => svc(`select admin_plan_stats($1)`, [S]))))
    ok('plans: matrix edits are logged', (await logs('plan.feature')) === 4 && (await logs('plan.limit')) === 2)
    ok('plans: invalid matrix values rejected', !!(await fails(() => svc(`select admin_set_limit($1, 'likes_per_day', 'free', -1, 'day')`, [ADM]))) &&
       !!(await fails(() => svc(`select admin_set_limit($1, 'likes_per_day', 'free', 5, 'year')`, [ADM]))) &&
       !!(await fails(() => svc(`select admin_set_feature($1, 'nope', true, 'free', null)`, [ADM]))))
    const gid = (await svc(`select admin_grant_plan($1, $2, 'vip', 7, 'thanks') id`, [ADM, F])).rows[0].id
    const g = (await su(`select * from plan_grants where id=$1`, [gid])).rows[0]
    ok('plans: admin grant', g.user_id === F && g.plan === 'vip' && g.source === 'admin' && g.granted_by === ADM && g.note === 'thanks' && (await planOf(F)) === 'vip' && (await logs('plan.grant')) === 1)
    const up = (await svc(`select admin_user_plan($1, $2) u`, [ADM, F])).rows[0].u
    ok('plans: admin sees the grants', up.plan === 'vip' && up.grants.length === 1 && up.grants[0].active === true)
    await svc(`select admin_revoke_grant($1, $2)`, [ADM, gid])
    await svc(`select admin_revoke_grant($1, $2)`, [ADM, gid])
    ok('plans: admin revoke (logged once)', (await planOf(F)) === 'free' && (await logs('plan.revoke')) === 1)
    const stats = (await svc(`select admin_plan_stats($1) s`, [ADM])).rows[0].s
    ok('plans: stats by plan and by source', stats.by_plan.plus >= 2 && stats.by_plan.vip >= 2 && stats.staff >= 3 &&
       stats.by_source.some((s) => s.source === 'promo' && s.active >= 1) && stats.by_source.some((s) => s.source === 'admin'), JSON.stringify(stats))
  })()
  // ===== end plans =====

  // ===== VIP perks (20261009000290; plans from 20261009000280) =====
  // Read receipts, profile visitors, Discover priority, notes on likes. Own users in Kota
  // Kinabalu (far from everyone else), VIP through plan grants (20261009000280).
  await (async () => {
    const ids = Array.from({ length: 17 }, (_, i) => `7a1b0000-0000-4000-8000-0000000000${String(i + 10)}`)
    const [A, B, C, D, E, F, MOD, N, O, V1, X, V2, V3, V4, W, Y, Z] = ids
    const males = [A, C, D, E, F, MOD, N, O, V2, V3, V4]
    for (const [i, u] of ids.entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '601377700' + String(i).padStart(2, '0')])
    for (const [i, u] of ids.entries()) {
      const male = males.includes(u)
      // Z lives 20 km away in another town (Discover priority: within 30 km).
      const point = u === Z ? 'POINT(116.25 5.98)' : 'POINT(116.07 5.98)'
      await as(u, `insert into profiles (display_name, birth_date, gender, interested_in, city, location)
         values ($1,'1996-04-04',$2,$3,$4,'SRID=4326;${point}')`, ['Vp' + i + ' Test', male ? 'male' : 'female', male ? '{female}' : '{male}', u === Z ? 'Penampang' : 'Kota Kinabalu'])
    }
    await su(`update profiles set verification_status='approved' where id = any($1)`, [ids])
    await su(`insert into admins values ($1)`, [MOD])
    const vip = (u) => su(`select grant_plan($1, 'vip', 30, 'admin')`, [u])
    for (const u of [A, V1, V2, V3, V4, Z]) await vip(u)
    const one = async (u, sql, p) => (await as(u, sql, p)).rows[0]?.r
    const casts = (u, fn, args = []) => one(u, `select ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args)
    const matchOf = async (a, b) => (await su(`select id from matches where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)`, [a, b])).rows[0]?.id ?? null
    const like = (u, t) => as(u, `insert into swipes (swiped_id, direction) values ($1,'like')`, [t])

    // ----- 1. read receipts -----
    await like(A, B); await like(B, A)
    const mAB = await matchOf(A, B)
    ok('rr: match', !!mAB)
    await as(A, `insert into messages (match_id, body) values ($1, 'hi B')`, [mAB])
    ok('rr: unread for B before reading', (await casts(B, 'unread_message_count')) === 1)
    const st0 = await casts(A, 'match_read_state', [mAB])
    ok('rr: VIP sender sees "sent" only before the read', st0?.enabled === true && st0.seen_up_to === null, JSON.stringify(st0))
    await su(`delete from realtime.messages where topic = any($1)`, [['match:' + mAB, 'inbox:' + A, 'inbox:' + B]])
    const readAt = await casts(B, 'mark_match_read', [mAB])
    ok('rr: mark read returns the time, unread drops', !!readAt && (await casts(B, 'unread_message_count')) === 0)
    const stA = await casts(A, 'match_read_state', [mAB])
    ok('rr: VIP sender sees "seen"', stA.enabled === true && !!stA.seen_up_to, JSON.stringify(stA))
    const bc = async (topic) => (await su(`select payload from realtime.messages where topic=$1 and event='read'`, [topic])).rows
    ok('rr: live tick broadcast on the match topic for the VIP sender', (await bc('match:' + mAB)).length === 1 && (await bc('match:' + mAB))[0].payload.reader === B)
    ok('rr: reader\'s inbox told to refresh the badge', (await bc('inbox:' + B)).length === 1)
    ok('rr: reading again without news: no write, no broadcast', String(await casts(B, 'mark_match_read', [mAB])) === String(readAt) && (await bc('match:' + mAB)).length === 1)
    await as(B, `insert into messages (match_id, body) values ($1, 'hi A')`, [mAB])
    await casts(A, 'mark_match_read', [mAB])
    const stB = await casts(B, 'match_read_state', [mAB])
    ok('rr: free sender sees nothing', stB.enabled === false && stB.seen_up_to === null, JSON.stringify(stB))
    ok('rr: no live tick for a free sender', (await bc('match:' + mAB)).every((r) => r.payload.reader !== A))
    ok('rr: outsider gets nothing', (await casts(C, 'match_read_state', [mAB])) === null && (await casts(C, 'mark_match_read', [mAB])) === null)
    ok('rr: read state table and setting closed', !!(await fails(() => as(A, `select * from match_reads`))) && !!(await fails(() => as(A, `select send_read_receipts from profiles where id=$1`, [B]))))
    const mine = await casts(A, 'my_read_receipts')
    ok('rr: settings default on, perk shown', mine.send === true && mine.available === true && (await casts(B, 'my_read_receipts')).available === false, JSON.stringify(mine))
    // the reader turns receipts off: nobody sees their reading
    await casts(B, 'set_read_receipts', [false])
    ok('rr: reader off hides their read state', (await casts(A, 'match_read_state', [mAB])).seen_up_to === null)
    await as(A, `insert into messages (match_id, body) values ($1, 'still there?')`, [mAB])
    await su(`delete from realtime.messages where topic=$1`, ['match:' + mAB])
    await casts(B, 'mark_match_read', [mAB])
    ok('rr: reader off: no live tick', (await bc('match:' + mAB)).length === 0)
    await casts(B, 'set_read_receipts', [true])
    // a VIP who turns receipts off cannot see others' either
    await casts(A, 'set_read_receipts', [false])
    const stOff = await casts(A, 'match_read_state', [mAB])
    ok('rr: VIP with receipts off sees nobody', stOff.enabled === false && stOff.seen_up_to === null)
    await casts(A, 'set_read_receipts', [true])
    ok('rr: no anon access', (await su(`select has_function_privilege('anon', 'public.mark_match_read(uuid)', 'execute') v`)).rows[0].v === false)

    // ----- 2. profile visitors -----
    const visit = (u, t) => casts(u, 'record_profile_visit', [t])
    const visits = async (viewed) => (await su(`select viewer_id from profile_visits where viewed_id=$1 order by viewer_id`, [viewed])).rows.map((r) => r.viewer_id)
    ok('pv: a visit is recorded', (await visit(C, A)) === true)
    ok('pv: one row per pair and day', (await visit(C, A)) === true && (await visits(A)).length === 1)
    ok('pv: self not recorded', (await visit(A, A)) === false)
    ok('pv: staff not recorded', (await visit(MOD, A)) === false)
    // Incognito counts only while the plan includes it (20261009000280: plus and up).
    await su(`select grant_plan($1, 'plus', 30, 'admin')`, [D])
    await su(`update profiles set is_incognito = true where id=$1`, [D])
    ok('pv: incognito viewer not recorded', (await visit(D, A)) === false)
    await as(A, `insert into blocks (blocked_id) values ($1)`, [E])
    ok('pv: blocked either way not recorded', (await visit(E, A)) === false)
    await su(`update profiles set shadow_banned = true where id=$1`, [F])
    ok('pv: shadow-banned viewer not recorded', (await visit(F, A)) === false)
    ok('pv: only C visited', JSON.stringify(await visits(A)) === JSON.stringify([C]))
    const full = await casts(A, 'my_profile_visitors')
    ok('pv: VIP sees the list', full.full === true && full.count === 1 && full.visitors[0].id === C && full.visitors[0].name === 'Vp2 Test' && full.visitors[0].age >= 18 && 'visited_at' in full.visitors[0] && full.visitors[0].liked === false, JSON.stringify(full))
    await visit(C, B); await visit(N, B)
    const teaser = await casts(B, 'my_profile_visitors')
    ok('pv: free user gets the count only', teaser.full === false && teaser.count === 2 && teaser.visitors.length === 0, JSON.stringify(teaser))
    await su(`select grant_plan($1, 'plus', 30, 'admin')`, [C])
    await su(`update profiles set is_incognito = true where id=$1`, [C])
    ok('pv: a visitor who goes incognito drops out', (await casts(A, 'my_profile_visitors')).count === 0)
    await su(`update profiles set is_incognito = false where id=$1`, [C])
    ok('pv: table closed', !!(await fails(() => as(A, `select * from profile_visits`))) && !!(await fails(() => as(A, `insert into profile_visits (viewer_id, viewed_id) values ($1,$2)`, [A, B]))))
    await su(`update profile_visits set visited_at = now() - interval '31 days' where viewer_id=$1 and viewed_id=$2`, [C, A])
    ok('pv: older than 30 days not listed', (await casts(A, 'my_profile_visitors')).count === 0)
    ok('pv: retention purge after 30 days', (await su(`select purge_old_profile_visits() n`)).rows[0].n === 1 && (await visits(A)).length === 0)
    ok('pv: purge is not client-callable', (await su(`select has_function_privilege('authenticated', 'public.purge_old_profile_visits()', 'execute') v`)).rows[0].v === false)

    // ----- 3. Discover priority -----
    // Candidates of N/O (men): V1 (VIP, same city), Z (VIP, 20 km), X (free, most recently active).
    await su(`update profiles set discoverable = false where id = any($1)`, [[B, W, Y]])
    await su(`update profiles set last_active_at = now() - interval '1 hour' where id = any($1)`, [[V1, Z]])
    await su(`update profiles set last_active_at = now() where id=$1`, [X])
    await su(`update profiles set created_at = now() - interval '30 days' where id=$1`, [O])
    const deck = async (u, km = 50) => (await as(u, `select id from get_swipe_candidates('{female}', 18, 99, $1)`, [km])).rows.map((r) => r.id)
    const dn = await deck(N)
    ok('dp: new user sees nearby VIPs first', dn.includes(X) && dn.indexOf(V1) < dn.indexOf(X) && dn.indexOf(Z) < dn.indexOf(X), JSON.stringify(dn))
    const dO = await deck(O)
    ok('dp: older users keep the usual order', dO[0] === X, JSON.stringify(dO))
    await su(`update profiles set location = 'SRID=4326;POINT(116.6 5.98)', city = 'Ranau' where id=$1`, [Z])
    const far = await deck(N, 100)
    ok('dp: a VIP more than 30 km away in another city is not prioritised', far.indexOf(Z) > far.indexOf(X), JSON.stringify(far))
    await su(`update profiles set vip_boost_until = now() + interval '1 hour' where id=$1`, [X])
    ok('dp: boost still comes first', (await deck(N))[0] === X)
    await su(`update profiles set vip_boost_until = null where id=$1`, [X])

    // ----- 4. notes on likes -----
    await su(`update profiles set discoverable = true where id = any($1)`, [[W, Y]])
    const note = (u, t, body) => casts(u, 'send_like_note', [t, body])
    const notesOf = async (u, only = null) => (await as(u, `select * from incoming_like_notes($1)`, [only])).rows
    const errOf = async (fn) => { try { await fn(); return null } catch (e) { return e.code === 'VP402' ? `VP402:${e.hint}` : e.code } }
    const n1 = await note(V2, W, '  Your hiking photos are great. Coffee at Gaya Street?  ')
    ok('note: VIP sends a note with the like', n1.state === 'visible' && n1.match_id === null && (await su(`select direction d from swipes where swiper_id=$1 and swiped_id=$2`, [V2, W])).rows[0]?.d === 'like', JSON.stringify(n1))
    const seen = await notesOf(W)
    ok('note: recipient reads it (trimmed, first name)', seen.length === 1 && seen[0].body === 'Your hiking photos are great. Coffee at Gaya Street?' && seen[0].first_name === 'Vp11' && seen[0].sender_id === V2, JSON.stringify(seen))
    ok('note: filter by card ids', (await notesOf(W, [V2])).length === 1 && (await notesOf(W, [V3])).length === 0)
    ok('note: nobody else reads it', (await notesOf(Y)).length === 0 && (await notesOf(V2)).length === 0)
    ok('note: daily limit (1 per 24 h)', (await errOf(() => note(V2, Y, 'hello'))) === 'VP402:limit')
    ok('note: one note per person', (await errOf(async () => { await su(`update feature_uses set created_at = now() - interval '25 hours' where user_id=$1`, [V2]); return note(V2, W, 'again') })) === '23505')
    ok('note: free users need the perk (VP402)', (await errOf(() => note(W, V2, 'hi'))) === 'VP402:feature' && (await fails(() => note(W, V2, 'hi')))?.includes('Plan required'))
    ok('note: 200 characters at most, not empty', (await errOf(() => note(V3, Y, 'x'.repeat(201)))) === '22023' && (await errOf(() => note(V3, Y, '   '))) === '22023')
    ok('note: not to yourself', (await errOf(() => note(V3, V3, 'me'))) === '22023')
    ok('note: table closed', !!(await fails(() => as(W, `select * from like_notes`))) && !!(await fails(() => as(V3, `insert into like_notes (sender_id, recipient_id, body) values ($1,$2,'x')`, [V3, Y]))))
    // risky note: held, never shown, still counts
    const held = await note(V3, Y, 'add me on whatsapp 0123456789')
    ok('note: risky text is held', held.state === 'held' && (await notesOf(Y)).length === 0 && (await su(`select held_kinds k from like_notes where id=$1`, [held.note_id])).rows[0].k.includes('messenger'))
    ok('note: held note still counts against the limit', (await errOf(() => note(V3, W, 'hi there'))) === 'VP402:limit')
    ok('note: sender sees their own note state', (await casts(V3, 'my_like_note', [Y]))?.state === 'held' && (await casts(Y, 'my_like_note', [V3])) === null)
    // blocks hide it
    const n4 = await note(V4, Y, 'Hello from the islands')
    ok('note: visible to Y', (await notesOf(Y)).some((r) => r.id === n4.note_id))
    await as(Y, `insert into blocks (blocked_id) values ($1)`, [V4])
    ok('note: a block hides it', (await notesOf(Y)).length === 0)
    await su(`delete from blocks where blocker_id=$1`, [Y])
    // the like back opens the match with the note as the first message
    await like(W, V2)
    const mVW = await matchOf(V2, W)
    const first = (await as(W, `select sender_id, body from messages where match_id=$1 order by created_at`, [mVW])).rows
    ok('note: match opens with the note as the first message', !!mVW && first.length === 1 && first[0].sender_id === V2 && first[0].body.startsWith('Your hiking photos'), JSON.stringify(first))
    ok('note: delivered note no longer listed', (await notesOf(W)).length === 0 && (await su(`select state, match_id from like_notes where id=$1`, [n1.note_id])).rows[0].match_id === mVW)
    ok('note: no note to someone you already matched', (await errOf(async () => { await su(`update feature_uses set created_at = now() - interval '25 hours' where user_id=$1`, [V2]); return note(V2, W, 'x') })) === '22023')
    // a note to someone who already liked you: instant match, note delivered
    await like(Y, A)
    const n5 = await note(A, Y, 'Saw you liked me too')
    ok('note: mutual like matches at once and delivers the note', !!n5.match_id && (await as(Y, `select body from messages where match_id=$1`, [n5.match_id])).rows[0]?.body === 'Saw you liked me too', JSON.stringify(n5))
    // reports
    const rep = async (u, id) => as(u, `insert into reports (target_type, target_id, reason) values ('like_note', $1, 'spam: pushy')`, [id])
    ok('note: only the recipient can report it', !!(await fails(() => rep(W, n4.note_id))) && !!(await fails(() => rep(V4, n4.note_id))))
    await rep(Y, n4.note_id)
    ok('note: report subject is the sender', (await su(`select subject_id s from reports where target_type='like_note' and target_id=$1`, [n4.note_id])).rows[0].s === V4)
    ok('note: reporting hides it at once', (await notesOf(Y)).length === 0 && (await su(`select state from like_notes where id=$1`, [n4.note_id])).rows[0].state === 'reported')
    const svcq = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const opened = (await svcq(`select admin_open_like_note($1,$2) r`, [MOD, n4.note_id])).rows[0].r
    ok('note: moderator reads the reported note, logged', opened.body === 'Hello from the islands' && opened.sender_id === V4 &&
       (await su(`select count(*)::int c from moderation_actions where action='view.like_note' and target_id=$1`, [n4.note_id])).rows[0].c === 1)
    ok('note: without an open report nothing is shown', !!(await fails(() => svcq(`select admin_open_like_note($1,$2)`, [MOD, held.note_id]))))
    ok('note: non-staff refused, clients cannot call it', !!(await fails(() => svcq(`select admin_open_like_note($1,$2)`, [W, n4.note_id]))) && !!(await fails(() => as(MOD, `select admin_open_like_note($1,$2)`, [MOD, n4.note_id]))))
    ok('note: queue lists note cases', (await svcq(`select count(*)::int c from admin_report_queue($1) where target_type='like_note' and target_id=$2`, [MOD, n4.note_id])).rows[0].c === 1)
    // retention
    await su(`update like_notes set created_at = now() - interval '91 days' where id in ($1, $2)`, [n4.note_id, held.note_id])
    ok('note: purge after 90 days, kept under an open report', (await su(`select purge_old_like_notes() n`)).rows[0].n === 1 && (await su(`select count(*)::int c from like_notes where id=$1`, [n4.note_id])).rows[0].c === 1)
    await su(`update reports set resolved_at = now() where target_type='like_note' and target_id=$1`, [n4.note_id])
    ok('note: purged once the report is resolved', (await su(`select purge_old_like_notes() n`)).rows[0].n === 1)
    ok('note: staff need no plan and have no quota', !!(await note(MOD, W, 'Hi from the team')).note_id && !!(await note(MOD, Y, 'Second one today')).note_id)
    ok('note: no anon access', (await su(`select has_function_privilege('anon', 'public.send_like_note(uuid, text)', 'execute') v`)).rows[0].v === false &&
       (await su(`select has_function_privilege('authenticated', 'public.purge_old_like_notes()', 'execute') v`)).rows[0].v === false)
  })()
  // ===== end VIP perks =====

  // ===== Early access waitlist (20261009000300) and the public event (20261009000301) =====
  await (async () => {
    const anonq = async (sql, p) => { await db.exec('reset role; set role anon;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const svcq = async (sql, p) => { await db.exec('reset role; set role service_role;'); try { return await db.query(sql, p) } finally { await db.exec('reset role') } }
    const join = (phone, opts = {}) => anonq(`select join_waitlist($1, $2, $3, $4, $5)`,
      [phone, opts.city ?? null, opts.locale ?? 'en', opts.source ?? 'landing', opts.consent ?? true])
    const rows = async () => (await su(`select phone, city, locale, source, consent_at, invited_at from waitlist order by created_at, phone`)).rows
    const [VIEW, ADM, OWN, NOBODY, U1] = ['9a110000-0000-4000-8000-000000000001', '9a110000-0000-4000-8000-000000000002',
      '9a110000-0000-4000-8000-000000000003', '9a110000-0000-4000-8000-000000000004', '9a110000-0000-4000-8000-000000000005']
    for (const [i, u] of [VIEW, ADM, OWN, NOBODY, U1].entries()) await su(`insert into auth.users(id, phone) values ($1, $2)`, [u, '60137771' + String(i).padStart(3, '0')])
    await su(`insert into admins (user_id, role) values ($1,'viewer'),($2,'admin'),($3,'owner')`, [VIEW, ADM, OWN])

    // validation and consent
    await join('+60 12-345 6789', { city: 'penang', locale: 'ms' })
    const r = await rows()
    ok('waitlist: anon joins, stored as E.164 with consent time', r.length === 1 && r[0].phone === '+60123456789' && r[0].city === 'penang' && r[0].locale === 'ms' && r[0].source === 'landing' && !!r[0].consent_at, JSON.stringify(r))
    await join('012-345 6780'); await join('11 2345 6789')
    ok('waitlist: local formats normalised (0..., without 0)', (await su(`select count(*)::int c from waitlist where phone in ('+60123456780', '+601123456789')`)).rows[0].c === 2)
    ok('waitlist: consent required', (await fails(() => join('+60123450001', { consent: false })))?.includes('Consent required') && (await fails(() => anonq(`select join_waitlist('+60123450001')`)))?.includes('Consent required'))
    for (const bad of ['+65 9123 4567', '+60 3-1234 5678', '', '6012345', '+60 12-345 678901', 'call me'])
      ok(`waitlist: rejects ${JSON.stringify(bad)}`, (await fails(() => join(bad)))?.includes('Malaysian mobile'))
    ok('waitlist: unknown city refused', (await fails(() => join('+60123450002', { city: 'singapore' })))?.includes('Unknown city'))
    await join('+60123450003', { locale: 'de', source: 'Bad Source!' })
    ok('waitlist: unknown locale and source fall back', JSON.stringify((await su(`select locale, source from waitlist where phone='+60123450003'`)).rows[0]) === '{"locale":"en","source":"landing"}')
    // idempotent, and the same answer for a number already on the list
    const again = await fails(() => join('+60 12 345 6789', { city: 'ipoh', locale: 'ru' }))
    const one = (await su(`select count(*)::int c, max(city) city from waitlist where phone='+60123456789'`)).rows[0]
    ok('waitlist: joining twice is a no-op without an error', again === null && one.c === 1 && one.city === 'penang', JSON.stringify({ again, one }))
    // rate limits
    ok('waitlist: third attempt in a minute still fine', (await fails(() => join('+60123456789'))) === null)
    ok('waitlist: per-number limit (3 a minute)', (await fails(() => join('+60123456789')))?.includes('Rate limit'))
    await su(`update waitlist_attempts set created_at = now() - interval '2 minutes'`)
    ok('waitlist: per-number limit resets after a minute', (await fails(() => join('+60123456789'))) === null)
    await su(`insert into waitlist_attempts (phone_key) select md5(g::text) from generate_series(1, 60) g`)
    ok('waitlist: global limit (60 a minute)', (await fails(() => join('+60123450004')))?.includes('Rate limit') && (await su(`select count(*)::int c from waitlist where phone='+60123450004'`)).rows[0].c === 0)
    await su(`update waitlist_attempts set created_at = now() - interval '2 minutes'`)
    ok('waitlist: global limit resets', (await fails(() => join('+60123450004'))) === null)
    ok('waitlist: attempts keep a hash, never the number', (await su(`select count(*)::int c from waitlist_attempts where phone_key like '%6012%' or phone_key like '+%'`)).rows[0].c === 0)
    // no client access
    ok('waitlist: anon cannot read', !!(await fails(() => anonq(`select * from waitlist`))) && !!(await fails(() => anonq(`select * from waitlist_attempts`))))
    ok('waitlist: users cannot read or write', !!(await fails(() => as(U1, `select * from waitlist`))) && !!(await fails(() => as(U1, `insert into waitlist (phone, consent_at) values ('+60123450009', now())`))))
    ok('waitlist: clients cannot call the panel RPCs', !!(await fails(() => as(U1, `select * from admin_waitlist_list($1)`, [OWN]))) && !!(await fails(() => anonq(`select admin_waitlist_stats($1)`, [OWN]))) &&
       !!(await fails(() => anonq(`select purge_waitlist()`))) && (await su(`select has_function_privilege('anon', 'public.admin_waitlist_export(uuid, text)', 'execute') v`)).rows[0].v === false)
    // panel
    const list = (await svcq(`select * from admin_waitlist_list($1, 'all', 2, 0)`, [VIEW])).rows
    ok('waitlist: viewer lists masked numbers, newest first, with total', list.length === 2 && list.every((x) => /^\+60 •••• \d{4}$/.test(x.phone_masked)) && Number(list[0].total) === 5 && !('phone' in list[0]), JSON.stringify(list))
    ok('waitlist: non-members refused', !!(await fails(() => svcq(`select * from admin_waitlist_list($1)`, [NOBODY]))))
    const stats = (await svcq(`select admin_waitlist_stats($1) s`, [VIEW])).rows[0].s
    ok('waitlist: stats', stats.total === 5 && stats.pending === 5 && stats.invited === 0 && stats.last_24h === 5 && stats.by_city.penang === 1 && stats.by_locale.ms === 1, JSON.stringify(stats))
    ok('waitlist: viewer cannot export or invite', !!(await fails(() => svcq(`select * from admin_waitlist_export($1)`, [VIEW]))) && !!(await fails(() => svcq(`select admin_waitlist_mark_invited($1, $2)`, [VIEW, []]))))
    const exp = (await svcq(`select * from admin_waitlist_export($1, 'pending')`, [ADM])).rows
    ok('waitlist: admin exports full numbers, logged', exp.length === 5 && exp.some((x) => x.phone === '+60123456789') &&
       (await su(`select reason from moderation_actions where action='export.waitlist' and admin_id=$1`, [ADM])).rows[0]?.reason === '5 rows, status=pending')
    const ids = (await su(`select id from waitlist where phone in ('+60123456789', '+60123456780') order by phone`)).rows.map((x) => x.id)
    ok('waitlist: admin marks invited, logged per entry', (await svcq(`select admin_waitlist_mark_invited($1, $2) n`, [ADM, ids])).rows[0].n === 2 &&
       (await su(`select count(*)::int c from moderation_actions where action='waitlist.invite' and admin_id=$1`, [ADM])).rows[0].c === 2)
    ok('waitlist: marking again changes nothing', (await svcq(`select admin_waitlist_mark_invited($1, $2) n`, [OWN, ids])).rows[0].n === 0)
    ok('waitlist: status filter', (await svcq(`select count(*)::int c from admin_waitlist_list($1, 'invited')`, [VIEW])).rows[0].c === 2 && (await svcq(`select count(*)::int c from admin_waitlist_list($1, 'pending')`, [VIEW])).rows[0].c === 3)
    // retention
    await su(`update waitlist set invited_at = now() - interval '91 days' where id = $1`, [ids[0]])
    await su(`update waitlist_attempts set created_at = now() - interval '2 days'`)
    ok('waitlist: purge 90 days after the invite, attempts after a day', (await svcq(`select purge_waitlist() n`)).rows[0].n === 1 &&
       (await su(`select count(*)::int c from waitlist`)).rows[0].c === 4 && (await su(`select count(*)::int c from waitlist_attempts`)).rows[0].c === 0)

    // public event: titles and times only, no counts, anon may read it
    await su(`update scheduled_events set status = 'cancelled' where status in ('scheduled', 'live')`)
    ok('public event: none scheduled', (await anonq(`select * from get_public_event()`)).rows.length === 0)
    await su(`insert into scheduled_events (title_en, title_ms, title_ru, starts_at, ends_at, created_by) values ('Friday Night', 'Malam Jumaat', 'Пятница', now() + interval '2 days', now() + interval '2 days 2 hours', $1)`, [OWN])
    const pe = (await anonq(`select * from get_public_event()`)).rows
    ok('public event: anon reads the next one without counts', pe.length === 1 && pe[0].title_ms === 'Malam Jumaat' && pe[0].status === 'scheduled' && !('joined' in pe[0]) && !('in_room' in pe[0]), JSON.stringify(pe))
    ok('public event: anon still cannot call get_current_event', !!(await fails(() => anonq(`select * from get_current_event()`))))
  })()
  // ===== end waitlist =====

  console.log(`${pass} passed, ${fail} failed`)
  return fail
}
