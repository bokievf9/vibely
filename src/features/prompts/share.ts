// Pure helpers for the question of the day card; also used by unit tests.

// Whole percentages that add up to 100 (largest remainder), or all zeros when nobody answered.
export function percentages(counts: number[]): number[] {
  const safe = counts.map((n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0))
  const total = safe.reduce((a, b) => a + b, 0)
  if (total === 0) return safe.map(() => 0)
  const exact = safe.map((n) => (n * 100) / total)
  const floors = exact.map(Math.floor)
  let left = 100 - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] = (floors[i] ?? 0) + 1
    left -= 1
  }
  return floors
}

export const totalAnswers = (counts: number[]) =>
  counts.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? Math.floor(b) : 0), 0)
