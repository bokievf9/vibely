import Link from 'next/link'
import { Suspense } from 'react'
import { CalendarHeart, Check, EyeOff, Flag, Minus, Radio, ScanFace, Video } from 'lucide-react'
import { fmt, localePath, TIME_ZONE, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { signupOpen } from '@/lib/env.optional'
import { PLAN_LEVELS } from '@/features/plans/access'
import { PLAN_ROWS, planCellText } from '../plan-highlights'
import { getLandingEvent } from '../queries'
import { CtaButton } from './cta'
import { FaqTracker } from './faq-tracker'
import { container } from './landing-hero'
import { PhoneScreen } from './phone-screen'

type Props = { locale: Locale; t: LandingDictionary }

const h2 = 'text-3xl font-bold tracking-[-0.03em] text-balance md:text-[2.5rem]'

// Split: copy and a 2x2 list on the left, the real safety menu on the right. Honest about
// recording and retention (CLAUDE.md "Safety recording & data retention").
export function SafetySection({ locale, t }: Props) {
  const items = [
    { icon: ScanFace, ...t.safety.selfie },
    { icon: Flag, ...t.safety.reports },
    { icon: EyeOff, ...t.safety.incognito },
    { icon: Video, ...t.safety.recorded },
  ]
  return (
    <section
      aria-labelledby="safety-title"
      className={`${container} grid items-center gap-12 py-20 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16 md:py-28`}
    >
      <div>
        <h2 id="safety-title" className={h2}>
          {t.safety.title}
        </h2>
        <p className="text-muted text-body mt-4 max-w-[52ch]">
          {t.safety.intro}{' '}
          <Link
            href={localePath(locale, '/privacy')}
            className="text-foreground decoration-accent font-medium underline underline-offset-4"
          >
            {t.safety.introLink}
          </Link>
          .
        </p>
        <ul className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, text }) => (
            <li key={title} className="landing-reveal">
              <Icon className="text-accent size-6" aria-hidden />
              <h3 className="text-headline mt-3">{title}</h3>
              <p className="text-muted text-callout mt-1.5 text-pretty">{text}</p>
            </li>
          ))}
        </ul>
      </div>
      {/* Phones show only the lower half, where the safety menu is. */}
      <div className="relative mx-auto h-[17rem] w-[min(64vw,250px)] overflow-hidden [mask-image:linear-gradient(to_top,black_75%,transparent)] md:h-auto md:w-[260px] md:overflow-visible md:[mask-image:none] lg:w-[280px]">
        <PhoneScreen
          src="/landing/screens/safety.webp"
          alt={t.safety.imageAlt}
          sizes="(min-width: 1024px) 280px, 260px"
          className="max-md:absolute max-md:inset-x-0 max-md:bottom-0"
        />
      </div>
    </section>
  )
}

// Next Blind Dating Night; renders nothing when none is scheduled (or the RPC is not live yet).
export function EventBlock({ locale, t }: Props) {
  return (
    <Suspense fallback={null}>
      <EventBlockInner locale={locale} t={t} />
    </Suspense>
  )
}

async function EventBlockInner({ locale, t }: Props) {
  const event = await getLandingEvent()
  if (!event) return null
  const start = new Date(event.startsAt)
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(start)
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(start)
  return (
    <section aria-labelledby="event-title" className={`${container} py-6 md:py-10`}>
      <div className="landing-reveal rounded-card border-accent/30 bg-surface relative overflow-hidden border bg-[radial-gradient(60%_120%_at_100%_0%,rgb(255_77_125/0.22),transparent_70%)] p-6 md:flex md:items-center md:justify-between md:gap-10 md:p-10">
        <div>
          <p className="text-accent text-footnote font-semibold tracking-[0.08em] uppercase">
            {t.event.kicker}
          </p>
          <h2 id="event-title" className="text-title mt-2 md:text-[2.25rem]">
            {event.title[locale]}
          </h2>
          {event.theme && <p className="text-foreground/85 text-body mt-1">{event.theme}</p>}
          <p className="text-muted text-body mt-4 max-w-[52ch]">{t.event.text}</p>
        </div>
        <p className="bg-surface-raised border-border text-headline mt-6 inline-flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-3 md:mt-0">
          {event.status === 'live' ? (
            <>
              <Radio className="text-accent size-5" aria-hidden />
              {t.event.live}
            </>
          ) : (
            <>
              <CalendarHeart className="text-accent size-5" aria-hidden />
              <span>
                {fmt(t.event.when, { date, time })}
                <span className="text-muted text-footnote block font-normal">
                  {t.event.timeZone}
                </span>
              </span>
            </>
          )}
        </p>
      </div>
    </section>
  )
}

// Free / Plus / VIP without prices: a real table (comparison data), zebra rows, no hairlines.
export function PlansSection({ t }: { t: LandingDictionary }) {
  const p = t.plans
  return (
    <section
      aria-labelledby="plans-title"
      className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8 md:py-28"
    >
      <h2 id="plans-title" className={h2}>
        {p.title}
      </h2>
      <p className="text-muted text-body mt-4 max-w-[52ch]">{p.intro}</p>
      <div className="rounded-card border-border bg-surface mt-8 overflow-hidden border">
        <table className="text-callout w-full border-collapse text-left max-sm:text-[0.8125rem]">
          <caption className="sr-only">{p.caption}</caption>
          <thead>
            <tr className="bg-surface-raised">
              <th scope="col" className="text-muted px-3 py-3.5 font-medium sm:px-6">
                {p.feature}
              </th>
              {PLAN_LEVELS.map((level) => (
                <th
                  key={level}
                  scope="col"
                  className="text-headline w-[20%] px-1 py-3.5 text-center sm:w-[18%] sm:px-2"
                >
                  {p[level]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map(({ row, cells }) => (
              <tr key={row} className="even:bg-white/[0.025]">
                <th scope="row" className="px-3 py-3.5 font-normal sm:px-6">
                  {p.rows[row]}
                </th>
                {PLAN_LEVELS.map((level) => {
                  const cell = cells[level]
                  const text = planCellText(cell, p)
                  return (
                    <td key={level} className="px-1 py-3.5 text-center sm:px-2">
                      {text ? (
                        <span className="font-medium">{text}</span>
                      ) : cell.kind === 'yes' ? (
                        <>
                          <Check className="text-accent mx-auto size-5" aria-hidden />
                          <span className="sr-only">{p.included}</span>
                        </>
                      ) : (
                        <>
                          <Minus className="text-muted/60 mx-auto size-5" aria-hidden />
                          <span className="sr-only">{p.notIncluded}</span>
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-footnote mt-4 max-w-[70ch]">{p.footnote}</p>
    </section>
  )
}

export function FaqSection({ t }: { t: LandingDictionary }) {
  return (
    <section
      aria-labelledby="faq-title"
      className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8 md:py-28"
    >
      <h2 id="faq-title" className={`${h2} mb-8`}>
        {t.faqTitle}
      </h2>
      <FaqTracker>
        {t.faq.map(({ q, a }, i) => (
          <details key={q} data-faq={i} className="group card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold select-none [&::-webkit-details-marker]:hidden">
              {q}
              <span
                aria-hidden
                className="text-muted relative size-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded-full before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-current after:transition-transform after:duration-200 after:ease-out group-open:after:scale-y-0"
              />
            </summary>
            <p className="text-muted text-body px-5 pb-5 text-pretty">{a}</p>
          </details>
        ))}
      </FaqTracker>
    </section>
  )
}

// Same label as the hero CTA (one label per intent).
export function FinalCta({ t }: { t: LandingDictionary }) {
  return (
    <section aria-labelledby="final-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-40 -z-10 mx-auto h-[28rem] max-w-3xl bg-[radial-gradient(closest-side,rgb(255_77_125/0.2),transparent)]"
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-5 py-24 text-center md:py-32">
        <h2 id="final-title" className={h2}>
          {t.final.title}
        </h2>
        <p className="text-muted text-body max-w-[44ch] md:text-lg">
          {signupOpen ? t.final.textOpen : t.final.text}
        </p>
        <CtaButton location="final" className="mt-2 w-full sm:w-auto" />
        <p className="text-muted text-footnote">{t.final.note}</p>
      </div>
    </section>
  )
}
