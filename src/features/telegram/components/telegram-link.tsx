'use client'

import { useState } from 'react'
import { KeyRound, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useModeration } from '@/features/admin/components/use-moderation'
import { issueTelegramLinkCode, unlinkTelegram } from '../link-actions'

type Props = { linked: boolean; linkedAt: string | null }

export function TelegramLink({ linked, linkedAt }: Props) {
  const { pending, error, run } = useModeration()
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)

  const issue = () =>
    run(async () => {
      const result = await issueTelegramLinkCode()
      if (result.ok) setCode(result.data)
      return result.ok ? { ok: true, data: undefined } : result
    })

  const expires = code
    ? new Date(code.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section className="bg-surface flex flex-col gap-3 rounded-2xl p-4">
      {linked ? (
        <>
          <p>
            Ваш Telegram привязан{linkedAt ? ` (${linkedAt})` : ''}. Чтобы привязать другой аккаунт,
            сначала отвяжите этот.
          </p>
          <div>
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => {
                setCode(null)
                void run(unlinkTelegram)
              }}
            >
              <Unlink className="size-5" aria-hidden /> Отвязать Telegram
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            Получите одноразовый код и отправьте его боту <b>в личные сообщения</b> (не в группу):
          </p>
          {code ? (
            <div className="flex flex-col gap-1">
              <code className="bg-background rounded-xl p-3 text-center text-2xl font-bold tracking-widest select-all">
                /link {code.code}
              </code>
              <span className="text-muted text-sm">
                Действует до {expires}. Код показывается один раз; новый код отменяет старый.
              </span>
            </div>
          ) : null}
          <div>
            <Button loading={pending} onClick={() => void issue()}>
              <KeyRound className="size-5" aria-hidden /> {code ? 'Новый код' : 'Получить код'}
            </Button>
          </div>
        </>
      )}
      <FormError message={error} />
    </section>
  )
}
