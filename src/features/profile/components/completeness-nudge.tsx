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
    <section className="card relative flex items-center gap-4 overflow-hidden p-4">
      {/* Faint accent wash from the ring side. */}
      <span
        aria-hidden
        className="from-accent/[0.14] pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent to-60%"
      />
      <Ring percent={percent} />
      <div className="relative flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-headline">{fmt(t.completeness.title, { pct: percent })}</p>
        <p className="text-muted text-callout">{t.completeness[hint]}</p>
        {hint !== 'photos' && (
          <Link
            href={localePath(locale, `/profile/edit${anchor}`)}
            className="text-accent relative -mb-1 flex min-h-9 items-center gap-0.5 self-start text-[15px] font-semibold transition-opacity active:opacity-60"
          >
            {t.completeness.cta} <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}

const R = 26
const C = 2 * Math.PI * R

// Circular progress with the percentage in the middle.
function Ring({ percent }: { percent: number }) {
  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-accent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b93" />
            <stop offset="100%" stopColor="#d42a63" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="url(#ring-accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - percent / 100)}
        />
      </svg>
      <span className="text-[15px] font-bold tabular-nums">{percent}%</span>
    </div>
  )
}
