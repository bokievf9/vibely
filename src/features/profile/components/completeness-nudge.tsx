import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { fmt, localePath, type Locale } from '@/i18n/config'
import type { AboutDictionary } from '@/i18n/dictionaries/about/en'
import type { OwnProfile } from '../queries'
import { profileCompleteness } from '../completeness'

type Props = { profile: OwnProfile; photoCount: number; locale: Locale; t: AboutDictionary }

// "Your profile is 60% complete": shown on the own profile page until everything is filled in.
export function CompletenessNudge({ profile, photoCount, locale, t }: Props) {
  const { about } = profile
  const { percent, hint } = profileCompleteness({
    photoCount,
    bio: profile.bio,
    promptCount: profile.prompts.length,
    // Religion is intentionally left out (PDPA sensitive data: never nudge for it).
    aboutFilled: [
      about.relationshipGoal,
      about.heightCm,
      about.jobTitle,
      about.education,
      about.languages.length,
      about.smoking,
      about.drinking,
      about.pets,
      about.children,
    ].map(Boolean),
  })
  if (!hint) return null

  const anchor = hint === 'prompts' ? '#prompts' : hint === 'about' ? '#about' : ''
  return (
    <section className="bg-accent/10 flex flex-col gap-2 rounded-2xl p-4">
      <p className="font-semibold">{fmt(t.completeness.title, { pct: percent })}</p>
      <div
        className="bg-border h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bg-accent h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-muted text-sm">{t.completeness[hint]}</p>
      {hint !== 'photos' && (
        <Link
          href={localePath(locale, `/profile/edit${anchor}`)}
          className="text-accent flex items-center gap-1 self-start text-sm font-semibold"
        >
          {t.completeness.cta} <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </section>
  )
}
