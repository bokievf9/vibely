import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import {
  Badge,
  BannedBadge,
  VerificationBadge,
  formatDate,
} from '@/features/admin/components/badges'
import { PhotoStrip } from '@/features/admin/components/photo-strip'
import { LegalExport } from '@/features/admin/components/legal-export'
import { PhoneReveal } from '@/features/admin/components/phone-reveal'
import { RevokeWarningButton } from '@/features/admin/components/revoke-warning-button'
import { UserActions } from '@/features/admin/components/user-actions'
import { UserNotes } from '@/features/admin/components/user-notes'
import { getAdmin } from '@/features/admin/guard'
import { getUserSanctions, type UserSanctions } from '@/features/admin/queries/sanctions'
import { getUserDetail } from '@/features/admin/queries/users'
import { hasRole } from '@/features/admin/roles'
import { readableBan, readableRejection, readableReportReason } from '@/features/admin/labels'
import { AboutDetails, aboutRows, PromptCards } from '@/features/profile/components/about-details'
import { GENDER_LABELS } from '@/features/profile/schemas'
import { aboutRu } from '@/i18n/dictionaries/about/ru'

export const metadata: Metadata = { title: 'Пользователь' }

export default function UserPage({ params }: PageProps<'/admin/users/[id]'>) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <UserDetailView params={params} />
    </Suspense>
  )
}

async function UserDetailView({ params }: Pick<PageProps<'/admin/users/[id]'>, 'params'>) {
  const { id } = await params
  const valid = /^[0-9a-f-]{36}$/.test(id)
  const [user, sanctions, admin] = await Promise.all([
    valid ? getUserDetail(id) : null,
    valid ? getUserSanctions(id) : null,
    getAdmin(),
  ])
  if (!user || !sanctions) notFound()

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          {user.displayName}, {user.age}
        </h1>
        <p className="text-muted -mt-1">@{user.username}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <VerificationBadge status={user.verificationStatus} />
          {user.bannedAt && <BannedBadge />}
          <span className="text-muted">
            {GENDER_LABELS[user.gender]} · {user.city ?? 'город не указан'} ·{' '}
            <PhoneReveal userId={user.id} canReveal={hasRole(admin.role, 'moderator')} />
          </span>
        </div>
        <p className="text-muted text-xs">
          Регистрация {formatDate(user.createdAt)} · активность {formatDate(user.lastActiveAt)} ·
          постов: {user.postCount}
        </p>
        {user.banReason && (
          <p className="text-sm text-red-400">
            Причина блокировки: {readableBan(user.banReason)}
            {sanctions.bannedUntil
              ? ` · до ${formatDate(sanctions.bannedUntil)}`
              : user.bannedAt && ' · бессрочно'}
          </p>
        )}
        <SanctionFlags sanctions={sanctions} />
      </header>

      <UserActions
        userId={user.id}
        role={admin.role}
        banned={Boolean(user.bannedAt)}
        verificationStatus={user.verificationStatus}
        muted={Boolean(sanctions.mutedUntil)}
        shadowBanned={sanctions.shadowBanned}
        evidenceHold={Boolean(sanctions.evidenceHold)}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Предупреждения ({sanctions.warnings.length})</h2>
        {!sanctions.warnings.length && <p className="text-muted text-sm">Не было</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {sanctions.warnings.map((w) => {
            const active = w.active
            return (
              <li key={w.id} className="flex flex-wrap items-center gap-x-2">
                <span className="text-muted">{formatDate(w.createdAt)} ·</span>
                {readableBan(w.reason)}
                {w.note && <span className="text-muted">({w.note})</span>}
                <span className="text-muted text-xs">
                  {w.by} ·{' '}
                  {w.revokedAt
                    ? 'отменено'
                    : active
                      ? `до ${formatDate(w.expiresAt)}${w.acknowledgedAt ? ', прочитано' : ', не прочитано'}`
                      : 'истекло'}
                </span>
                {active && hasRole(admin.role, 'moderator') && (
                  <RevokeWarningButton warningId={w.id} />
                )}
              </li>
            )
          })}
        </ul>
        {sanctions.appeals.length > 0 && (
          <Link
            href="/admin/appeals?status=decided"
            className="text-accent text-sm hover:underline"
          >
            Апелляции: {sanctions.appeals.length} (последняя:{' '}
            {APPEAL_STATUS[sanctions.appeals[0]!.status] ?? sanctions.appeals[0]!.status}) →
          </Link>
        )}
      </section>

      <UserNotes userId={user.id} notes={sanctions.notes} me={admin.id} role={admin.role} />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Фото профиля</h2>
        <PhotoStrip photos={user.photos} label="Фото профиля" />
        {user.bio && <p className="text-muted text-sm whitespace-pre-wrap">{user.bio}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">О себе и вопросы</h2>
        {!user.prompts.length && !aboutRows(user.about, aboutRu).length && (
          <p className="text-muted text-sm">Не заполнено</p>
        )}
        <AboutDetails about={user.about} t={aboutRu} />
        <PromptCards prompts={user.prompts} t={aboutRu} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Верификации</h2>
        {!user.verifications.length && <p className="text-muted text-sm">Заявок не было</p>}
        <ul className="flex flex-wrap gap-3">
          {user.verifications.map((v) => (
            <li
              key={v.id}
              className="bg-surface flex w-40 flex-col gap-1.5 rounded-2xl p-2 text-xs"
            >
              {v.selfieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.selfieUrl}
                  alt="Селфи"
                  width={144}
                  height={192}
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
              ) : (
                <p className="bg-background text-muted flex aspect-[3/4] w-full items-center justify-center rounded-xl p-2 text-center">
                  {v.status === 'pending' ? 'Селфи не найдено' : 'Удалено после проверки'}
                </p>
              )}
              <VerificationBadge status={v.status} />
              <span className="text-muted">{formatDate(v.createdAt)}</span>
              {v.rejectionReason && (
                <span className="text-red-400">{readableRejection(v.rejectionReason)}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Жалобы на профиль ({user.reportsAgainst.length})</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {user.reportsAgainst.map((r, i) => (
            <li key={i}>
              <span className="text-muted">{formatDate(r.createdAt)} · </span>
              {readableReportReason(r.reason)}{' '}
              {r.resolvedAt ? (
                <span className="text-muted">(закрыта)</span>
              ) : (
                <span className="text-amber-400">(открыта)</span>
              )}
            </li>
          ))}
        </ul>
        <Link
          href={`/admin/content?author=${user.id}`}
          className="text-accent text-sm hover:underline"
        >
          Посты и комментарии пользователя →
        </Link>
        <Link href={`/admin/log?target=${user.id}`} className="text-accent text-sm hover:underline">
          Журнал действий по пользователю →
        </Link>
      </section>

      {hasRole(admin.role, 'owner') && <LegalExport userId={user.id} />}
    </article>
  )
}

const APPEAL_STATUS: Record<string, string> = {
  open: 'ждёт решения',
  accepted: 'принята',
  rejected: 'отклонена',
}

function SanctionFlags({ sanctions: s }: { sanctions: UserSanctions }) {
  const flags = [
    s.mutedUntil && `Мут до ${formatDate(s.mutedUntil)}`,
    s.shadowBanned && 'Теневой бан',
    s.evidenceHold &&
      `Удержание данных с ${formatDate(s.evidenceHold.at)}${s.evidenceHold.reason ? ` (${s.evidenceHold.reason})` : ''}`,
    s.phoneBlocked && 'Номер в блок-листе',
  ].filter((f): f is string => Boolean(f))
  if (!flags.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((f) => (
        <Badge key={f} className="bg-amber-500/15 text-amber-400">
          {f}
        </Badge>
      ))}
    </div>
  )
}
