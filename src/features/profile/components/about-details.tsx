import {
  Baby,
  Briefcase,
  Cigarette,
  GraduationCap,
  HeartHandshake,
  Languages,
  PawPrint,
  Ruler,
  Sparkles,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import { fmt } from '@/i18n/config'
import type { AboutDictionary } from '@/i18n/dictionaries/about/en'
import { cn } from '@/lib/utils'
import type { AboutInput, ProfilePrompt } from '../about-schemas'

type Row = { icon: LucideIcon; label: string; value: string }

// Display rows for whatever the person filled in (works in Server and Client Components).
export function aboutRows(a: AboutInput, t: AboutDictionary): Row[] {
  const rows: (Row | null)[] = [
    a.relationshipGoal && {
      icon: HeartHandshake,
      label: t.goal.label,
      value: t.goal.options[a.relationshipGoal],
    },
    a.heightCm
      ? { icon: Ruler, label: t.height.label, value: fmt(t.height.value, { cm: a.heightCm }) }
      : null,
    a.jobTitle ? { icon: Briefcase, label: t.job.label, value: a.jobTitle } : null,
    a.education && {
      icon: GraduationCap,
      label: t.education.label,
      value: t.education.options[a.education],
    },
    a.languages.length
      ? {
          icon: Languages,
          label: t.languages.short,
          value: a.languages.map((l) => t.languages.options[l]).join(', '),
        }
      : null,
    a.smoking && { icon: Cigarette, label: t.smoking.label, value: t.smoking.options[a.smoking] },
    a.drinking && { icon: Wine, label: t.drinking.label, value: t.drinking.options[a.drinking] },
    a.pets && { icon: PawPrint, label: t.pets.label, value: t.pets.options[a.pets] },
    a.children && { icon: Baby, label: t.children.label, value: t.children.options[a.children] },
    // PDPA: shown only when the person chose to share it ("prefer not to say" is not shown).
    a.religion && a.religion !== 'prefer_not_to_say'
      ? { icon: Sparkles, label: t.religion.short, value: t.religion.options[a.religion] }
      : null,
  ]
  return rows.filter((r): r is Row => Boolean(r))
}

const BADGE_ICONS: LucideIcon[] = [HeartHandshake, Ruler, Briefcase]

// Compact badges for the swipe card: goal, height and job only.
export function aboutBadges(a: AboutInput, t: AboutDictionary): Row[] {
  return aboutRows(a, t).filter((r) => BADGE_ICONS.includes(r.icon))
}

type Props = { about: AboutInput; t: AboutDictionary; tone?: 'surface' | 'dark'; title?: string }

export function AboutDetails({ about, t, tone = 'surface', title }: Props) {
  const rows = aboutRows(about, t)
  if (!rows.length) return null
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="text-muted text-sm font-medium">{title}</h2>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <li
            key={label}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3 py-2',
              tone === 'dark' ? 'bg-white/10' : 'bg-surface',
            )}
          >
            <Icon className="size-5 shrink-0 opacity-70" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="text-xs opacity-60">{label}</span>
              <span className="text-sm font-medium [overflow-wrap:anywhere]">{value}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

type PromptsProps = {
  prompts: ProfilePrompt[]
  t: AboutDictionary
  tone?: 'surface' | 'dark'
}

export function PromptCards({ prompts, t, tone = 'surface' }: PromptsProps) {
  if (!prompts.length) return null
  return (
    <ul className="flex flex-col gap-3">
      {prompts.map((p) => (
        <li
          key={p.key}
          className={cn(
            'flex flex-col gap-1 rounded-2xl p-4',
            tone === 'dark' ? 'bg-white/10' : 'bg-surface border-border border',
          )}
        >
          <span className="text-sm font-semibold opacity-70">{t.prompts.keys[p.key]}</span>
          <span className="text-lg leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap">
            {p.answer}
          </span>
        </li>
      ))}
    </ul>
  )
}
