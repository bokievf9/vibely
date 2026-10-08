// Pure helpers for the photo order (position 0 is the main photo). Unit-tested.

// Moves one item to a new index, shifting the others. Out-of-range indexes return the input.
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items]
  }
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

// Puts one item first (the "Make main" button), keeping the others in order.
export const makeFirst = <T>(items: readonly T[], index: number): T[] => moveItem(items, index, 0)
