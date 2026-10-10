import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { PlansGrants } from '@/features/admin/components/plans-grants'
import { PlansMatrix } from '@/features/admin/components/plans-matrix'
import { requireAdmin } from '@/features/admin/guard'
import { PLAN_LABELS, sourceLabel } from '@/features/admin/plans-labels'
import { PLAN_LEVELS } from '@/features/admin/plans-schemas'
import { getPlanMatrix, getPlanStats, type PlanStats } from '@/features/admin/queries/plans'

export const metadata: Metadata = { title: 'Планы' }

// Admin and owner only (404 for everyone else). Every change is logged in the journal.
export default function PlansPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Планы</h1>
      <p className="text-muted -mt-2 text-sm">
        Уровни Free, Plus и VIP. Здесь видно, что открывает каждый план, и задаются лимиты. Команда
        модерации получает всё без лимитов. Выключенная функция недоступна никому, кроме команды.
        Лимиты действуют только на новые действия: уже отправленное остаётся.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <Plans />
      </Suspense>
    </>
  )
}

async function Plans() {
  await requireAdmin({ min: 'admin' })
  const [matrix, stats] = await Promise.all([getPlanMatrix(), getPlanStats()])
  if (!matrix) {
    return (
      <p className="bg-surface rounded-2xl px-4 py-3 text-sm text-amber-400">
        Раздел недоступен: миграция 20261009000280_plans ещё не применена к базе.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {stats && <Stats stats={stats} />}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Выдать или отозвать план</h2>
        <PlansGrants />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Функции и лимиты</h2>
        <p className="text-muted -mt-1 text-sm">
          Пустой лимит: без ограничений. Периоды скользящие: день = 24 часа, неделя = 7 дней, месяц
          = 30 дней.
        </p>
        <PlansMatrix features={matrix} />
      </section>
    </div>
  )
}

function Stats({ stats }: { stats: PlanStats }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Статистика</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PLAN_LEVELS.map((p) => (
          <div key={p} className="bg-surface flex flex-col rounded-2xl px-4 py-3">
            <span className="text-muted text-xs">{PLAN_LABELS[p]}</span>
            <span className="text-2xl font-bold">{stats.byPlan[p]}</span>
          </div>
        ))}
        <div className="bg-surface flex flex-col rounded-2xl px-4 py-3">
          <span className="text-muted text-xs">Команда (всё открыто)</span>
          <span className="text-2xl font-bold">{stats.staff}</span>
        </div>
      </div>
      {stats.interest && (
        <div className="bg-surface flex flex-col gap-2 rounded-2xl px-4 py-3">
          <span className="text-sm font-medium">Ждут запуска подписки (кнопка «Сообщить»)</span>
          <div className="grid grid-cols-2 gap-2">
            {(['plus', 'vip'] as const).map((p) => (
              <div key={p} className="flex flex-col">
                <span className="text-muted text-xs">{PLAN_LABELS[p]}</span>
                <span className="text-2xl font-bold">{stats.interest?.[p].total ?? 0}</span>
                <span className="text-muted text-xs">
                  за 7 дней: {stats.interest?.[p].last7d ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.bySource.length > 0 && (
        <ul className="bg-surface flex flex-col rounded-2xl px-4 py-2 text-sm">
          {stats.bySource.map((s) => (
            <li
              key={s.source}
              className="border-border flex flex-wrap items-center gap-x-3 border-b py-2 last:border-b-0"
            >
              <span className="font-medium">{sourceLabel(s.source)}</span>
              <span className="text-muted ml-auto">
                действует {s.active} · всего {s.total} · за 30 дней {s.last30d}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
