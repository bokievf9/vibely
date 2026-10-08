// Like and comment counters: exact below 1000, compact above ("1.2K", "1,2 тыс.") so a viral post
// does not push the footer around. The exact number stays in the accessible label.
export function formatCount(n: number, locale: string) {
  if (n < 1000) return String(Math.max(0, n))
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
