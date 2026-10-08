import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import { BannedBadge, VerificationBadge, formatDate } from '@/features/admin/components/badges'
import { PhotoStrip } from '@/features/admin/components/photo-strip'
import { UserActions } from '@/features/admin/components/user-actions'
import { getUserDetail } from '@/features/admin/queries/users'
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
  const user = /^[0-9a-f-]{36}$/.test(id) ? await getUserDetail(id) : null
  if (!user) notFound()

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
            {user.phone ?? 'нет телефона'}
          </span>
        </div>
        <p className="text-muted text-xs">
          Регистрация {formatDate(user.createdAt)} · активность {formatDate(user.lastActiveAt)} ·
          постов: {user.postCount}
        </p>
        {user.banReason && (
          <p className="text-sm text-red-400">Причина блокировки: {readableBan(user.banReason)}</p>
        )}
      </header>

      <UserActions
        userId={user.id}
        banned={Boolean(user.bannedAt)}
        verificationStatus={user.verificationStatus}
      />

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
      </section>
    </article>
  )
}
