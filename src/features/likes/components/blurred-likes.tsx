import { Heart, Lock } from 'lucide-react'
import { UpgradeCard } from '@/features/plans/components/upgrade-card'
import { fmt } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'

// "Who liked you" on the free plan: only the count reaches the browser (get_incoming_likes
// returns no rows without who_liked_you), shown as blurred placeholder tiles that carry no
// photo, plus the Plus card.
export function BlurredLikes({ count, dict }: { count: number; dict: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 px-4 pb-6">
      <p className="text-muted text-callout px-1">{fmt(dict.likes.lockedTitle, { count })}</p>
      <UpgradeCard feature="who_liked_you" compact text={dict.plans.likesBlurredBody} />
      <ul className="grid grid-cols-2 gap-3" aria-hidden>
        {Array.from({ length: Math.min(count, 6) }, (_, i) => (
          <li
            key={i}
            className="bg-surface-raised relative aspect-[3/4] overflow-hidden rounded-[1.375rem]"
          >
            <span
              className="absolute inset-0 scale-125 blur-2xl"
              style={{
                background: `radial-gradient(circle at ${30 + ((i * 23) % 40)}% ${35 + ((i * 17) % 30)}%, var(--color-accent) 0%, transparent 60%), radial-gradient(circle at 70% 80%, var(--color-vip) 0%, transparent 55%)`,
                opacity: 0.45,
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="glass flex size-11 items-center justify-center rounded-full">
                {i === 0 ? (
                  <Heart className="text-accent size-5" aria-hidden />
                ) : (
                  <Lock className="size-5 text-white/80" aria-hidden />
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
