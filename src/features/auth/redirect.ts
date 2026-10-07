import { redirect } from 'next/navigation'
import { localePath } from '@/i18n/config'
import { getLocale } from '@/i18n/server'

// Server Components: redirect within the current language.
export async function localeRedirect(path: string): Promise<never> {
  redirect(localePath(await getLocale(), path))
}
