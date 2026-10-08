import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { formatDate } from '@/features/admin/components/badges'
import { getModerationLog } from '@/features/admin/queries/log'

export const metadata: Metadata = { title: 'Журнал' }

const ACTIONS: Record<string, string> = {
  'verification.approve': 'Одобрил селфи',
  'verification.reject': 'Отклонил селфи',
  'user.ban': 'Заблокировал',
  'user.unban': 'Разблокировал',
  'user.revoke_verification': 'Снял верификацию',
  'post.hide': 'Скрыл пост',
  'post.unhide': 'Вернул пост',
  'comment.hide': 'Скрыл комментарий',
  'comment.unhide': 'Вернул комментарий',
  'reports.resolve': 'Закрыл жалобы',
  'photo.delete': 'Удалил фото',
  'auto.hide': 'Автоскрытие: 3+ жалобы',
}

export default function LogPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Журнал действий</h1>
      <Suspense fallback={<PageSpinner />}>
        <Log />
      </Suspense>
    </>
  )
}

async function Log() {
  const entries = await getModerationLog()
  if (!entries.length) return <p className="text-muted">Пока пусто</p>
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e) => (
        <li key={e.id} className="bg-surface flex flex-col gap-0.5 rounded-2xl px-4 py-3 text-sm">
          <span>
            <span className="font-medium">{e.adminName}</span> · {ACTIONS[e.action] ?? e.action}{' '}
            <span className="text-muted">
              ({e.targetType} {e.targetId.slice(0, 8)})
            </span>
          </span>
          {e.reason && <span className="text-muted">Причина: {e.reason}</span>}
          <time className="text-muted text-xs" dateTime={e.createdAt}>
            {formatDate(e.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  )
}
