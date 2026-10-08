'use client'

import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { exportAuditLog } from '../log-actions'
import type { LogFilters } from '../queries/log'
import { downloadText, useAdminAction } from './use-admin-action'

// CSV of the journal with the current filters (admin and owner; the export is logged).
export function LogExportButton({ filters }: { filters: LogFilters }) {
  const { pending, error, run } = useAdminAction()
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        loading={pending}
        onClick={async () => {
          const result = await run(() => exportAuditLog(filters))
          if (result.ok)
            downloadText(result.data.filename, result.data.csv, 'text/csv;charset=utf-8')
        }}
      >
        <FileDown className="size-4" /> Скачать CSV
      </Button>
      <FormError message={error} />
    </div>
  )
}
