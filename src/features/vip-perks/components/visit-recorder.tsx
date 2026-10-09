'use client'

import { useEffect } from 'react'
import { recordProfileVisit } from '../actions'

// Records one profile visit when the profile view mounts (the database keeps one row per viewer,
// profile and day, and skips self, staff, incognito and blocked viewers).
export function VisitRecorder({ userId }: { userId: string }) {
  useEffect(() => {
    void recordProfileVisit(userId).catch(() => undefined)
  }, [userId])
  return null
}
