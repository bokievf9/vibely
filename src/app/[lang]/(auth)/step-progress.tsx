'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'

export const SIGNUP_STEPS = 3

// Sign-up progress. Each screen mounts fresh, so the bar starts where the previous step left it
// and fills to this one: the move reads as progress instead of a redraw.
export function StepProgress({ step }: { step: number }) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  const from = (step - 1) / SIGNUP_STEPS
  const to = step / SIGNUP_STEPS
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={SIGNUP_STEPS}
      aria-valuenow={step}
      aria-label={fmt(dict.flows.step, { n: step, total: SIGNUP_STEPS })}
      className="bg-surface h-1 w-full overflow-hidden rounded-full"
    >
      <motion.div
        className="bg-accent h-full origin-left rounded-full"
        initial={{ transform: `scaleX(${reduce ? to : from})` }}
        animate={{ transform: `scaleX(${to})` }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
      />
    </div>
  )
}
