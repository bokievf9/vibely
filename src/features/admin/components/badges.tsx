import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

const VERIFICATION: Record<Enums<'verification_status'>, { label: string; className: string }> = {
  unverified: { label: 'Не верифицирован', className: 'bg-border text-muted' },
  pending: { label: 'На проверке', className: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Верифицирован', className: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: 'Отклонён', className: 'bg-red-500/15 text-red-400' },
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

export function VerificationBadge({ status }: { status: Enums<'verification_status'> }) {
  const { label, className } = VERIFICATION[status]
  return <Badge className={className}>{label}</Badge>
}

export function BannedBadge() {
  return <Badge className="bg-red-600 text-white">Заблокирован</Badge>
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(iso))
}
