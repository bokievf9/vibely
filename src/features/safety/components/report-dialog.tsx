'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { report } from '../actions'
import { REPORT_REASONS, type ReportInput } from '../schemas'

type Props = {
  open: boolean
  onClose: () => void
  targetType: ReportInput['targetType']
  targetId: string
  // Defaults to the generic "What is wrong?"; messages, photos and calls pass their own.
  title?: string
  // Shown above the reasons, e.g. that moderators will see the conversation.
  note?: string
  // Closed after a successful report (e.g. a reported like note disappears).
  onReported?: () => void
}

// Reusable for profiles, chats, messages, photos, calls, posts, comments and blind dates.
export function ReportDialog({
  open,
  onClose: close,
  targetType,
  targetId,
  title,
  note,
  onReported,
}: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [reason, setReason] = useState<ReportInput['reason']>()
  const [details, setDetails] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()
  const onClose = () => {
    close()
    if (sent) onReported?.()
  }

  const submit = () =>
    startTransition(async () => {
      if (!reason) return
      const result = await report({ targetType, targetId, reason, details })
      if (result.ok) setSent(true)
      else setError(result.error)
    })

  return (
    <Modal open={open} onClose={onClose} title={title ?? dict.safety.reportTitle}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-14 text-emerald-400" aria-hidden />
          <p>{dict.safety.reportSent}</p>
          <Button fullWidth onClick={onClose}>
            {dict.common.close}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {note && <p className="text-muted text-sm">{note}</p>}
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
                {dict.safety.reasons[r]}
              </Chip>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            placeholder={dict.safety.details}
            aria-label={dict.safety.details}
          />
          <FormError message={errorText(error)} />
          <Button variant="danger" fullWidth disabled={!reason} loading={pending} onClick={submit}>
            {dict.safety.report}
          </Button>
        </div>
      )}
    </Modal>
  )
}
