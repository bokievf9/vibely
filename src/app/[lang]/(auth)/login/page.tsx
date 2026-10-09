import type { Metadata } from 'next'
import { LoginTabs } from '@/features/auth/components/login-tabs'
import { getDictionary } from '@/i18n/server'
import { StepHeader } from '../step-header'

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return { title: dict.auth.phoneLabel, description: dict.meta.description }
}

export default async function LoginPage() {
  const dict = await getDictionary()
  return (
    <section>
      <StepHeader title={dict.auth.title} subtitle={dict.auth.subtitle} />
      <LoginTabs />
    </section>
  )
}
