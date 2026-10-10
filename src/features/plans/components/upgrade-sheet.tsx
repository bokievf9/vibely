'use client'

import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { Upgrade } from '../errors'
import { UpgradeCard } from './upgrade-card'

// The one sheet every gated control opens (AccessProvider), e.g. after a Server Action returned
// VP402 or a locked button was tapped. Closing is always one tap away: the X, a drag down, the
// backdrop and "Not now" all leave the user where they were.
export function UpgradeSheet({
  upgrade,
  onClose,
}: {
  upgrade: Upgrade | null
  onClose: () => void
}) {
  const { dict } = useI18n()
  const t = dict.plans
  return (
    <Modal
      open={upgrade !== null}
      onClose={onClose}
      title={t.entry.settingsTitle}
      footer={
        <div className="flex flex-col gap-1">
          <LocaleLink
            href="/plans"
            onClick={onClose}
            className={cn(
              'btn-accent relative inline-flex h-[3.25rem] w-full items-center justify-center rounded-2xl',
              'text-[1.0625rem] font-semibold tracking-[-0.012em] select-none',
              'transition-[scale,filter] duration-150 ease-out active:scale-[0.97] active:brightness-95',
            )}
          >
            {t.sheet.seeAll}
          </LocaleLink>
          <Button variant="ghost" fullWidth onClick={onClose} className="text-muted">
            {t.sheet.notNow}
          </Button>
        </div>
      }
    >
      {upgrade && (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <UpgradeCard feature={upgrade.feature} reason={upgrade.reason} className="pb-1" />
        </Suspense>
      )}
    </Modal>
  )
}
