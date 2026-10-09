import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Spinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { JoinDuo } from '@/features/duo/components/join-duo'
import { INVITE_CODE_RE } from '@/features/duo/errors'
import { getMyDuo } from '@/features/duo/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).duo.setupTitle }
}

export default async function JoinDuoPage({ params }: PageProps<'/[lang]/duo/join/[code]'>) {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.duo.title} back={{ href: '/swipe', label: dict.common.back }} />
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        }
      >
        <Join params={params} />
      </Suspense>
    </>
  )
}

// An invite link: confirm, then accept by code (duo_accept checks everything).
async function Join({ params }: Pick<PageProps<'/[lang]/duo/join/[code]'>, 'params'>) {
  const [{ code }, viewer] = await Promise.all([params, getViewer()])
  const duo = viewer ? await getMyDuo() : undefined
  if (!viewer || !duo) notFound()
  const valid = INVITE_CODE_RE.test(code.toLowerCase())
  return (
    <div className="px-4 pt-2 pb-8">
      <JoinDuo code={valid ? code.toLowerCase() : null} hasDuo={duo.team?.status === 'active'} />
    </div>
  )
}
