// The single switch for "Who liked you". true: everyone sees who liked them (free for now).
// false: only the count is shown (Discover badge and a teaser screen) and like pushes don't link
// to the list; the owner decides later what becomes premium. The list itself is only ever loaded
// server-side, so flipping this hides it completely.
export const LIKES_VISIBLE_FREE = true
