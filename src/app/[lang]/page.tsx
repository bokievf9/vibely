import { redirect } from 'next/navigation'
import { getLocale } from '@/i18n/server'
import { localePath } from '@/i18n/config'

// Signed-out users are sent to /login by src/proxy.ts before reaching this.
export default async function Home() {
  redirect(localePath(await getLocale(), '/swipe'))
}
