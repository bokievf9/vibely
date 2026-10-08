'use client'

import { revokeWarning } from '../sanction-actions'
import { useAdminAction } from './use-admin-action'

export function RevokeWarningButton({ warningId }: { warningId: string }) {
  const { pending, error, run } = useAdminAction()
  return (
    <button
      type="button"
      className="text-accent text-xs hover:underline disabled:opacity-50"
      disabled={pending}
      title={error}
      onClick={() => run(() => revokeWarning({ warningId }))}
    >
      {error ? 'Ошибка, ещё раз' : 'Отменить'}
    </button>
  )
}
