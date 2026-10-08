// Admin nav entries of the reports area (batch-4 admin reports & evidence), to be wired into
// admin-nav.tsx by its owner. "/admin/reports" (queue) and "/admin/photos" already exist there.
export const REPORT_NAV_LINKS = [
  { href: '/admin/reports/history', label: 'История жалоб' },
  { href: '/admin/reports/flagged', label: 'Флаги' },
] as const satisfies readonly { href: string; label: string }[]
