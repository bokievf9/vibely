import { Crown, Heart, Sparkles, type LucideIcon } from 'lucide-react'
import type { PlanLevel } from '../access'

// Plain module (no 'use client') so server components can use it too.
export const PLAN_ICONS: Record<PlanLevel, LucideIcon> = { free: Heart, plus: Sparkles, vip: Crown }
