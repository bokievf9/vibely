import type { Metadata } from 'next'
import { LegalPage, legalMetadata } from '@/features/legal/components/legal-page'

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata('terms')
}

export default function TermsPage() {
  return <LegalPage id="terms" />
}
