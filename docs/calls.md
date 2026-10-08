# Звонки (аудио/видео) и их запись

Звонки между пользователями с совпадением: самостоятельно размещённый **LiveKit** (SFU + встроенный
TURN) и **LiveKit Egress** для записи. По протоколу безопасности (CLAUDE.md) **каждый звонок
записывается на сервере**, хранится **до 90 дней**, пользователь предупреждён до включения звонков и
видит индикатор «● Запись» во время звонка, записи открывают только модераторы при разборе жалобы,
каждый доступ логируется.

Фича выключена, пока в окружении приложения не заданы `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET` (кнопки звонка, слой звонков, вебхук и плеер в админке скрыты; сборка проходит
без них).

## Как это устроено

```
браузер ──wss/https──► rtc.vibelydate.com:443 ─► Caddy ─► livekit-server :7880 (127.0.0.1)
браузер ──UDP 50000-60000 / TCP 7881──► livekit-server (медиа)
браузер ──TURN UDP 443 / TURN TLS 443 (turn.vibelydate.com)──► livekit (за NAT/у операторов)
livekit ─► egress (Chrome-шаблон, микширует оба потока) ─► S3-бакет calls/<match_id>/<call_id>.(ogg|mp4)
livekit ──вебхуки (подписаны API secret)──► https://vibelydate.com/api/livekit/webhook
приложение (Server Actions) ──API (https://rtc…)──► livekit: комнаты, токены, egress
```

1. Оба собеседника включают «Разрешить звонки в этом чате» (таблица `call_permissions`). Первое
   включение показывает уведомление «Звонки записываются и хранятся до 90 дней» — без принятия
   (`profiles.calls_consent_at`) включить нельзя.
2. `startCall` → RPC `start_call` (участник, оба верифицированы, нет блокировки, оба разрешили, никто
   не занят) → строка `calls` (`ringing`) → Realtime-событие `incoming` в приватный топик
   `call:<user id>` + push «Входящий звонок от …» → комната `call_<id>` в LiveKit → токен (TTL 2 мин,
   identity = user id, публикация только микрофона / микрофона+камеры).
3. `answerCall` → `active` → **запуск room composite egress**. Если запись не стартовала, звонок не
   соединяется (оба получают «завершён»).
4. Через 30 с без ответа — `missed`. `endCall` / выход участника (вебхук) → `ended`, комната
   удаляется, egress дописывает файл и шлёт `egress_ended` → `recording_status = ready`.
5. В чате: «Пропущенный звонок», «Видеозвонок · 5:12».

Аудиозвонки пишутся в OGG/Opus 32 кбит/с (~15 МБ/час), видео — MP4 H.264 960×540, 20 к/с, ~700 кбит/с

- AAC 64 кбит/с (~350 МБ/час), раскладка «grid» (оба участника).

## Размер сервера и стоимость (оценка, проверить цены DigitalOcean)

Текущий VPS (1 ГБ) не подходит: egress запускает Chrome. Нужен отдельный дроплет **vibely-media**,
Singapore (SGP1), Ubuntu 24.04, Docker.

| Конфигурация                                  | ~$/мес | Сколько тянет                                              |
| --------------------------------------------- | ------ | ---------------------------------------------------------- |
| Basic 2 vCPU / 4 ГБ (минимум)                 | ~24    | ~1 записываемый видеозвонок + несколько аудио одновременно |
| Basic 4 vCPU / 8 ГБ (рекомендуется к запуску) | ~48    | ~2 видео + ~6–8 аудио одновременно                         |
| CPU-Optimized 4 vCPU / 8 ГБ                   | ~84    | стабильнее под нагрузкой                                   |
| Spaces (250 ГБ + 1 ТБ трафика)                | 5      | + $0.02/ГБ хранения сверх лимита                           |

Трафик: видеозвонок ≈ 0.9 ГБ исходящего на час, аудио ≈ 25 МБ/час; трафик дроплета (4–5 ТБ/мес)
покрывает это с запасом. Хранение: 1000 минут видео в день ≈ 5.8 ГБ/день ≈ 525 ГБ за 90 дней ≈ $10/мес
в Spaces. Бесплатный 1 ГБ Supabase заполнится за часы — **для записей используйте Spaces**.
Если egress перегружен, он отказывает в новой записи (`cpu_cost` в `egress.yaml`), и звонок не
соединяется — масштабировать дроплет или вынести egress на второй.

## Развёртывание (делает владелец)

1. **Дроплет**: Create → Droplet → Singapore, Ubuntu 24.04, ≥ 4 ГБ RAM, SSH-ключ, имя `vibely-media`.
   Включить мониторинг. Зарезервировать Reserved IP (чтобы DNS не менялся при пересоздании).
2. **DNS** (в зоне vibelydate.com):

   | Тип | Имя    | Значение        |
   | --- | ------ | --------------- |
   | A   | `rtc`  | IP vibely-media |
   | A   | `turn` | IP vibely-media |

   Без прокси Cloudflare (оранжевое облако выключено): WebRTC/TURN не проходят через HTTP-прокси.

3. **Firewall**: `infra/livekit/firewall.sh` (ufw) и такие же правила в DO Cloud Firewall:
   22/tcp (лучше только ваш IP), 80/tcp (Let's Encrypt), 443/tcp (HTTPS/WSS + TURN/TLS), 443/udp
   (TURN/UDP), 7881/tcp (ICE/TCP), 50000–60000/udp (медиа). 7880, 5349, 6379, 9090 — только localhost.
4. **Docker**: `apt install docker.io docker-compose-v2`, затем
   `mkdir -p /opt/vibely-media && cp infra/livekit/{docker-compose.yml,livekit.yaml,egress.yaml,caddy.yaml} /opt/vibely-media/`.
5. **Ключи**: `openssl rand -base64 48 | tr -d '/+=' | cut -c1-48` → секрет. Ключ (id) — `vibely-1`
   (совпадает с `webhook.api_key` в `livekit.yaml`). Заполнить `/opt/vibely-media/.env` по
   `infra/livekit/.env.example`, `chmod 600`.
6. **Бакет** (вариант A, рекомендуется): Spaces → Create → SGP1, имя `vibely-call-recordings`,
   **File Listing: Restricted**, CDN выключен. Spaces Keys → ключ с доступом только к этому бакету
   (read/write) → в `.env` (`RECORDINGS_S3_*`). Lifecycle-правило (см. «Хранение»):
   `aws s3api put-bucket-lifecycle-configuration --endpoint-url https://sgp1.digitaloceanspaces.com --bucket vibely-call-recordings --lifecycle-configuration file://infra/livekit/spaces-lifecycle.json`.
   Вариант B — Supabase Storage: бакет `call-recordings` создаёт миграция; Storage → S3 Connection →
   включить, создать S3 access key, в `egress.yaml` раскомментировать блок Supabase. Минусы: 1 ГБ на
   бесплатном тарифе, S3-ключ Supabase даёт доступ ко всем бакетам, нет lifecycle-правил.
7. **Запуск**: `cd /opt/vibely-media && docker compose up -d && docker compose logs -f`.
   Проверка: `curl https://rtc.vibelydate.com` → `OK`; тест соединения —
   https://livekit.io/connection-test (URL `wss://rtc.vibelydate.com`, токен из `lk token create`).
8. **Приложение** (`/var/www/vibely/shared/.env.production` на web-VPS, затем `pm2 restart vibely`):

   ```
   LIVEKIT_URL=wss://rtc.vibelydate.com
   LIVEKIT_API_KEY=vibely-1
   LIVEKIT_API_SECRET=<секрет>
   CALLS_PURGE_SECRET=<openssl rand -hex 32>
   # Вариант A (Spaces); без них используется Supabase-бакет call-recordings:
   RECORDINGS_S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
   RECORDINGS_S3_REGION=sgp1
   RECORDINGS_S3_BUCKET=vibely-call-recordings
   RECORDINGS_S3_ACCESS_KEY_ID=<ключ только на чтение+удаление, можно тот же>
   RECORDINGS_S3_SECRET_ACCESS_KEY=<…>
   RECORDINGS_S3_FORCE_PATH_STYLE=true
   ```

   CSP (`connect-src`) по умолчанию разрешает `wss://rtc.vibelydate.com` и `https://rtc.vibelydate.com`.
   Если домен другой — добавить GitHub-переменную `LIVEKIT_URL` и прокинуть её в шаг сборки
   `deploy.yml` (заголовки фиксируются при сборке).

9. **БД**: `supabase db push` (миграции `20261008000120…123`). В Supabase должен быть включён
   pg_cron (ежедневная `purge_old_calls`).
10. **Cron ретеншна** на vibely-media: `cp infra/livekit/purge-recordings.cron /etc/cron.d/vibely-calls-purge`.

## Хранение 90 дней

- **Наш purge (основной, ровно 90 дней)**: `POST /api/calls/purge` (Bearer `CALLS_PURGE_SECRET`,
  cron раз в сутки) → `call_recordings_to_purge()` (записи старше 90 дней, **кроме** звонков, по паре
  участников которых есть открытая жалоба) → удаление объектов из бакета → `mark_call_recordings_purged`
  → `purge_old_calls()` удаляет строки истории старше 90 дней (тоже кроме доказательств). pg_cron
  дополнительно запускает `purge_old_calls()` в 03:47 MYT.
- **Lifecycle-правило бакета (страховка)**: `calls/` удаляются через **120 дней**
  (`infra/livekit/spaces-lifecycle.json`), даже если cron сломался. Почему не 90: правило бакета не
  знает про открытые жалобы и удалило бы доказательства. Если жалоба открыта дольше ~110 дней,
  модератору нужно скачать запись заранее. Если нужен строгий потолок 90 дней на уровне бакета —
  поставить `Days: 90` (тогда доказательства по жалобам старше 90 дней будут потеряны).
- Supabase Storage lifecycle-правил не имеет: там удаляет только наш purge.
- Удаление аккаунта: строки звонков остаются с `caller_id/callee_id = null` и удаляются по общему
  правилу 90 дней.

## Ротация ключей LiveKit (без простоя)

1. Сгенерировать новый секрет, id `vibely-2`.
2. На vibely-media: `LIVEKIT_KEYS={vibely-1: старый, vibely-2: новый}`, в `livekit.yaml`
   `webhook.api_key: vibely-2`, `LIVEKIT_API_KEY/SECRET` для egress — новые;
   `docker compose up -d` (идущие звонки переподключатся).
3. На web-VPS: `LIVEKIT_API_KEY=vibely-2`, `LIVEKIT_API_SECRET=новый`, `pm2 restart vibely`.
   Между шагами 2 и 3 вебхуки отклоняются (401) — делать в тихое время; зависшие звонки закроет
   `expire_stale_calls` (ринг 30 с, активные через 6 ч).
4. Через 10 минут убрать `vibely-1` из `LIVEKIT_KEYS`, `docker compose up -d`.

Ключи бакета: создать новый Spaces-ключ → обновить `.env` на обоих серверах → перезапустить →
удалить старый ключ. `CALLS_PURGE_SECRET`: обновить в обоих `.env`.

## Модерация

Админка → Жалобы → карточка жалобы на профиль → «Звонки (N)»: звонки между нарушителем и
пожаловавшимися. «Получить ссылку» → RPC `admin_open_call_recording` проверяет модератора и **открытую
жалобу по этой паре**, пишет `moderation_actions` (`call.recording_open`), затем подписывается ссылка
на 5 минут (Spaces — presigned URL, Supabase — signed URL). Ссылка открывается в новой вкладке
(встроенный плеер браузера; CSP приложения не нужно расширять).

## Ограничения

- **iOS PWA**: когда приложение свёрнуто/экран заблокирован, входящий звонок приходит только как
  push «Входящий звонок от …» (без рингтона и полноэкранного экрана). Нет CallKit/ConnectionService —
  это возможно только в нативном приложении. Push на iOS работает лишь для PWA, добавленной на экран
  «Домой» (iOS 16.4+).
- iOS Safari блокирует звук без жеста: если LiveKit не может воспроизвести звук, показывается кнопка
  «Нажмите, чтобы включить звук». Вибрация вызова на iOS не работает.
- Выбор динамика/наушника браузер на телефоне почти не поддерживает: кнопка смены вывода видна только
  там, где есть `setSinkId` и больше одного устройства (десктоп, часть Android).
- При сворачивании вкладки на мобильном браузер может приостановить камеру; аудио обычно продолжается.
- Звонок, который нельзя записать, не соединяется (так требует протокол).
- Записи не шифруются отдельным ключом приложения (только шифрование провайдера хранилища).
- Теги образов в `docker-compose.yml` надо сверить с актуальными релизами LiveKit перед первым запуском
  (`livekit/caddyl4` без версий — закрепить по digest после первого `pull`).
