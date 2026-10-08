'use client'

import { useState } from 'react'
import { Phone } from 'lucide-react'
import { revealPhone } from '../sanction-actions'
import { useAdminAction } from './use-admin-action'

// The phone number is shown only on demand; every reveal is logged (view.phone).
export function PhoneReveal({ userId, canReveal }: { userId: string; canReveal: boolean }) {
  const { pending, error, run } = useAdminAction()
  const [phone, setPhone] = useState<string>()

  if (phone) return <span className="tabular-nums">{phone}</span>
  if (!canReveal) return <span>телефон скрыт</span>
  return (
    <button
      type="button"
      className="text-accent inline-flex items-center gap-1 hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={async () => {
        const result = await run(() => revealPhone({ userId }))
        if (result.ok) setPhone(result.data)
      }}
      title={error}
    >
      <Phone className="size-3.5" aria-hidden />
      {error ? 'Не удалось показать номер' : 'Показать номер (запишется в журнал)'}
    </button>
  )
}
