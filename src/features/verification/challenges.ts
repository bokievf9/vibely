// Gestures a user must show on the selfie (Russian text is for moderators; users see the dictionary). A fresh random one per attempt makes
// old photos and stolen pictures useless; the moderator checks the gesture matches.
export const CHALLENGES = {
  peace: 'Покажите «победу» ✌️ у лица',
  thumbs_up: 'Поднимите большой палец 👍',
  palm: 'Покажите открытую ладонь ✋ у щеки',
  ok: 'Покажите жест «ОК» 👌',
  point_up: 'Укажите пальцем вверх ☝️',
  chin: 'Подоприте подбородок кулаком',
} as const

export type ChallengeId = keyof typeof CHALLENGES

export const CHALLENGE_IDS = Object.keys(CHALLENGES) as ChallengeId[]

export function isChallengeId(value: string | undefined): value is ChallengeId {
  return value !== undefined && value in CHALLENGES
}
