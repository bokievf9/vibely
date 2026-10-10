import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { PlansGrants } from '@/features/admin/components/plans-grants'
import { PlansMatrix } from '@/features/admin/components/plans-matrix'
import { PaymentOrders, PaymentPrices } from '@/features/admin/components/payments-panel'
import { getAdmin, requireAdmin } from '@/features/admin/guard'
import { hasRole } from '@/features/admin/roles'
import { PLAN_LABELS, sourceLabel } from '@/features/admin/plans-labels'
import { PLAN_LEVELS } from '@/features/admin/plans-schemas'
import { getPlanMatrix, getPlanStats, type PlanStats } from '@/features/admin/queries/plans'
import {
  getAdminPrices,
  getPaymentStats,
  getRecentOrders,
  type PaymentStats,
} from '@/features/admin/queries/payments'
import { formatSen, PAYMENTS_ENABLED } from '@/features/plans/pricing'

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
  const [matrix, stats, payments, orders, prices, admin] = await Promise.all([
    getPlanMatrix(),
    getPlanStats(),
    getPaymentStats(),
    getRecentOrders(),
    getAdminPrices(),
    getAdmin(),
  ])
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
      <Payments
        stats={payments}
        orders={orders}
        prices={prices}
        canEditPrices={hasRole(admin.role, 'owner')}
      />
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

// Orders, totals, prices and refunds (20261011000100). Before the migration: a notice only.
function Payments({
  stats,
  orders,
  prices,
  canEditPrices,
}: {
  stats: PaymentStats | null
  orders: Awaited<ReturnType<typeof getRecentOrders>>
  prices: Awaited<ReturnType<typeof getAdminPrices>>
  canEditPrices: boolean
}) {
  if (!stats) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Оплата</h2>
        <p className="bg-surface rounded-2xl px-4 py-3 text-sm text-amber-400">
          Раздел недоступен: миграция 20261011000100_payments ещё не применена к базе.
        </p>
      </section>
    )
  }
  const tiles = [
    {
      label: 'Оплачено, всего',
      value: formatSen(stats.paid.sen),
      hint: `${stats.paid.count} заказов`,
    },
    {
      label: 'За 30 дней',
      value: formatSen(stats.paid30d.sen),
      hint: `${stats.paid30d.count} заказов`,
    },
    {
      label: 'Возвраты',
      value: formatSen(stats.refunded.sen),
      hint: `${stats.refunded.count} заказов`,
    },
    {
      label: 'Ожидают / ошибки',
      value: `${stats.pending} / ${stats.failed}`,
      hint: `тестовых: ${stats.test}`,
    },
  ]
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Оплата</h2>
      <p className="text-muted -mt-1 text-sm">
        {PAYMENTS_ENABLED
          ? 'Оплата включена. Суммы без тестовых заказов.'
          : 'Оплата для пользователей выключена (PAYMENTS_ENABLED = false): кнопки «Скоро». Команда может проверить весь путь тестовой оплатой, если включён тестовый режим. Суммы без тестовых заказов.'}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-surface flex flex-col rounded-2xl px-4 py-3">
            <span className="text-muted text-xs">{t.label}</span>
            <span className="text-xl font-bold tabular-nums">{t.value}</span>
            <span className="text-muted text-xs">{t.hint}</span>
          </div>
        ))}
      </div>
      {stats.eventsWithErrors > 0 && (
        <p className="bg-surface rounded-2xl px-4 py-3 text-sm text-amber-400">
          Уведомлений платёжной системы с ошибкой за 30 дней: {stats.eventsWithErrors}. Например,
          сумма не совпала с заказом: такой заказ не оплачивается автоматически, проверьте его в
          кабинете платёжной системы.
        </p>
      )}
      <h3 className="text-sm font-semibold">Цены</h3>
      <p className="text-muted -mt-2 text-xs">
        {canEditPrices
          ? 'Меняет только владелец. Черновик виден и работает только в тестовой оплате. Заказ запоминает цену в момент создания.'
          : 'Цены меняет только владелец.'}
      </p>
      <PaymentPrices initial={prices} canEdit={canEditPrices} />
      <h3 className="text-sm font-semibold">Заказы</h3>
      <PaymentOrders initial={orders} />
    </section>
  )
}
