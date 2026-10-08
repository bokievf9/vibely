'use client'

import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RetryButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.location.reload()}>
      <RotateCw className="size-5" aria-hidden /> {label}
    </Button>
  )
}
