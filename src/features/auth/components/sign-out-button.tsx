'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { resetBrowserToken } from '@/lib/supabase/client'
import { signOut } from '../actions'

export function SignOutButton() {
  const { dict } = useI18n()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          resetBrowserToken()
          await signOut()
        })
      }
    >
      <LogOut className="size-5" /> {dict.common.signOut}
    </Button>
  )
}
