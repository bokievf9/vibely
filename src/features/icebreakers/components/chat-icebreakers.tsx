'use client'

import { useEffect, useRef } from 'react'
import { takeIcebreaker } from '../stash'
import { IcebreakerList } from './icebreaker-list'

type Props = { matchId: string; onPick: (text: string) => void }

// Empty match chat: suggestions above the composer, plus the one picked in the match modal.
export function ChatIcebreakers({ matchId, onPick }: Props) {
  const pickRef = useRef(onPick)
  useEffect(() => {
    pickRef.current = onPick
  })
  useEffect(() => {
    const stashed = takeIcebreaker(matchId)
    if (stashed) pickRef.current(stashed)
  }, [matchId])

  return <IcebreakerList matchId={matchId} onPick={onPick} className="px-4 pb-3" />
}
