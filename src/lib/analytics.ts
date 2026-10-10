// Funnel events for the optional, cookieless analytics script (Umami or Plausible).
// Every call is a no-op when no script is configured or it was blocked.

export type AnalyticsEvent =
  | 'signup_otp_sent'
  | 'profile_created'
  | 'selfie_submitted'
  | 'first_match'
  // Landing page (src/features/landing): CTA clicks carry `location` (header, hero, final...).
  | 'cta_click'
  | 'waitlist_open'
  | 'waitlist_submit'
  | 'waitlist_success'
  | 'faq_open'
  | 'video_play'
  | 'scroll_depth'
  // Guided tour (src/features/tour): tour_step carries `n` (1-based, as shown) and `step` (id),
  // tour_skip the step it was skipped at, tip_seen the tip `key`.
  | 'tour_start'
  | 'tour_step'
  | 'tour_complete'
  | 'tour_skip'
  | 'tip_seen'

type Props = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Props) => void }
    plausible?: (event: string, options?: { props?: Props }) => void
  }
}

export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === 'undefined') return
  try {
    if (window.umami) window.umami.track(event, props)
    else if (window.plausible) window.plausible(event, props ? { props } : undefined)
  } catch {
    // Analytics must never break the app.
  }
}

// Once per device, e.g. the first match.
export function trackOnce(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === 'undefined') return
  const key = `vibely_tracked_${event}`
  try {
    if (window.localStorage.getItem(key)) return
    window.localStorage.setItem(key, '1')
  } catch {
    // Storage unavailable (private mode): track anyway.
  }
  track(event, props)
}
