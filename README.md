# Vibely

Mobile-first PWA для знакомств: свайпы, анонимная лента, анонимный рандом-чат.
Стек: Next.js 16 (App Router, Cache Components) · Supabase · Tailwind 4 · Zod.

## Запуск

```bash
npm install
cp .env.example .env.local     # заполнить ключи Supabase
npx supabase start             # локальный стек (нужен Docker)
npm run db:reset               # миграции + seed
npm run db:types               # сгенерировать src/types/database.types.ts
npm run dev
```

Для удалённого проекта: `npx supabase link --project-ref <id>` → `npx supabase db push`.
В Dashboard → Auth → Phone включить провайдер Twilio; Realtime → Settings → отключить «Allow public access».

Локально SMS не отправляются: тестовые номера и коды заданы в `supabase/config.toml` (`[auth.sms.test_otp]`).

## Только Малайзия

Регистрация возможна только с мобильным номером Малайзии (`+60 1x…`). Правило проверяется в трёх местах:
форма (Zod + libphonenumber), Supabase Auth hook `hook_before_user_created` и триггер на `profiles`.
На проде включите hook: Dashboard → Authentication → Hooks → Before User Created → `public.hook_before_user_created`.

## Админка модерации — `/admin`

Доступ только для пользователей из таблицы `public.admins` (остальные получают 404).
Модератор входит по своему номеру как обычный пользователь, затем его добавляют в SQL Editor:

```sql
insert into public.admins (user_id)
select id from auth.users where phone = '60123456789';
```

Разделы: обзор, очередь селфи-верификации, жалобы (профили, посты, комментарии, рандом-чаты с перепиской),
пользователи (поиск, бан/разбан, снятие верификации), контент ленты (скрыть/вернуть), журнал всех действий.

## Языки

Интерфейс пользователя на трёх языках: английский (по умолчанию), малайский, русский. URL содержит язык (`/en/swipe`,
`/ms/swipe`, `/ru/swipe`). Без префикса proxy выбирает язык по cookie `vibely_locale`, затем по `Accept-Language`.
Словари: `src/i18n/dictionaries/*.ts` (тип берётся из `en.ts`, поэтому пропущенный ключ — ошибка компиляции).
Server Actions возвращают ключ ошибки (`ErrorKey`), текст подставляет клиент.

Админка `/admin` — только на русском. Причины отказов и банов видны пользователю как есть,
поэтому модераторам лучше писать их по-английски или по-малайски.
