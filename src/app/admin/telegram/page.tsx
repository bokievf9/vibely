import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { requireAdmin } from '@/features/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTelegramEnv } from '@/features/telegram/env'
import { TelegramLink } from '@/features/telegram/components/telegram-link'

export const metadata: Metadata = { title: 'Telegram' }

export default function TelegramPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Telegram-бот</h1>
      <Suspense fallback={<PageSpinner />}>
        <Status />
      </Suspense>
    </>
  )
}

async function Status() {
  const adminId = await requireAdmin()
  const { data } = await createAdminClient()
    .from('admins')
    .select('telegram_user_id, telegram_linked_at')
    .eq('user_id', adminId)
    .maybeSingle()
  const env = getTelegramEnv()
  const linkedAt = data?.telegram_linked_at
    ? new Date(data.telegram_linked_at).toLocaleString('ru-RU', { timeZone: 'Asia/Kuala_Lumpur' })
    : null

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-surface flex flex-col gap-1 rounded-2xl p-4 text-sm">
        <p>
          Бот: <b>{env ? 'подключён' : 'не настроен'}</b>
          {env && (
            <>
              {' · '}вебхук: <b>{env.webhookSecret ? 'включён' : 'выключен'}</b>
              {' · '}селфи в чат: <b>{env.sendSelfies ? 'да' : 'нет'}</b>
            </>
          )}
        </p>
        <p className="text-muted">
          Кнопки и команды бота работают только для привязанных модераторов. Каждое действие
          записывается в журнал от вашего имени.
        </p>
      </section>
      <TelegramLink linked={data?.telegram_user_id != null} linkedAt={linkedAt} />
    </div>
  )
}
