'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { exportUserData } from '../sanction-actions'
import { downloadText, useAdminAction } from './use-admin-action'

// Owner only: JSON with everything about the user for a legal request (police, MCMC, court).
// The request reference is required and stored in the journal.
export function LegalExport({ userId }: { userId: string }) {
  const { pending, error, run } = useAdminAction()
  const [reference, setReference] = useState('')

  const download = async () => {
    const result = await run(() => exportUserData({ userId, reference }))
    if (result.ok) downloadText(result.data.filename, result.data.json, 'application/json')
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Юридический запрос</h2>
      <p className="text-muted text-sm">
        Выгрузка профиля, жалоб, санкций и метаданных переписки (без текста сообщений). Номер
        запроса попадёт в журнал.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={200}
          placeholder="Номер запроса, например PDRM 12/2026"
          aria-label="Номер запроса"
        />
        <Button
          variant="secondary"
          disabled={reference.trim().length < 3}
          loading={pending}
          onClick={download}
          className="shrink-0"
        >
          <FileDown className="size-5" /> Выгрузить JSON
        </Button>
      </div>
      <FormError message={error} />
    </section>
  )
}
