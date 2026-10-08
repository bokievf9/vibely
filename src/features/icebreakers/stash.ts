// Hands an icebreaker picked in the match modal over to the chat composer (same tab only).
const key = (matchId: string) => `vibely.icebreaker.${matchId}`

export function stashIcebreaker(matchId: string, text: string) {
  try {
    sessionStorage.setItem(key(matchId), text)
  } catch {
    // Storage unavailable: the chat still shows the suggestions.
  }
}

export function takeIcebreaker(matchId: string): string | null {
  try {
    const text = sessionStorage.getItem(key(matchId))
    sessionStorage.removeItem(key(matchId))
    return text
  } catch {
    return null
  }
}
