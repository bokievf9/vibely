'use client'

import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useI18n } from '@/i18n/client'
import type { Upgrade } from '../errors'
import { UpgradeCard } from './upgrade-card'

// The one sheet every gated control opens (AccessProvider), e.g. after a Server Action returned
// VP402 or a locked button was tapped.
export function UpgradeSheet({
  upgrade,
  onClose,
}: {
  upgrade: Upgrade | null
  onClose: () => void
}) {
  const { dict } = useI18n()
  return (
    <Modal
      open={upgrade !== null}
      onClose={onClose}
      title={dict.plans.row}
      footer={
        <Button fullWidth onClick={onClose}>
          {dict.plans.gotIt}
        </Button>
      }
    >
      {upgrade && (
        <Suspense fallback={null}>
          <UpgradeCard feature={upgrade.feature} reason={upgrade.reason} className="pb-1" />
        </Suspense>
      )}
    </Modal>
  )
}
