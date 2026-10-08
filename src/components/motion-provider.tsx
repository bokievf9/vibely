'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

// Users with "reduce motion" get fades instead of movement in every framer-motion animation.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
