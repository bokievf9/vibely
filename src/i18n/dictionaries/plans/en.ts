// Plans: free, Plus and VIP (20261009000280). Upgrade cards, limits, boost and the plan row.
// No prices: plans come from promo codes and rewards for now.
export const plansEn = {
  names: { free: 'Free', plus: 'Plus', vip: 'VIP' },
  availableIn: 'Available in {plan}',
  limitTitle: 'Limit reached',
  limitBody: 'You have used all {limit} for this {period}. {plan} gives you more.',
  limitBodyShort: 'You have used everything for now. {plan} gives you more.',
  partnerTitle: 'Calls are not available',
  partnerBody: 'Calls need VIP on both sides. This person cannot take calls right now.',
  periods: { day: 'day', week: 'week', month: '30 days' },
  unlocks: '{plan} also unlocks',
  howToGet: 'Plus and VIP come with promo codes and rewards, for example the matchmaker reward.',
  enterCode: 'Enter a promo code',
  gotIt: 'Got it',
  // Settings row
  row: 'Your plan',
  rowUntil: '{plan} until {date}',
  staff: 'Team: everything unlocked',
  // Remaining counters
  leftToday: '{count} left today',
  // Boost
  boost: 'Boost',
  boostHint: 'Be shown first in Discover for 30 minutes.',
  boostActive: 'Boosted until {time}',
  boostLeft: '{count} left this {period}',
  boostDone: 'Boost is on for 30 minutes.',
  // What a plan unlocks
  features: {
    likes_per_day: 'Unlimited likes in Discover',
    who_liked_you: 'See who liked you',
    chat_photos: 'Send photos in chats',
    voice_messages: 'Send voice messages',
    video_messages: 'Send video messages',
    calls: 'Audio and video calls',
    feed_post: 'Write posts in the feed',
    feed_comment: 'Comment in the feed',
    feed_like: 'Like posts in the feed',
    blind_dating_per_day: 'More Blind Dates every day',
    event_priority: 'Priority in Blind Dating Nights',
    incognito: 'Incognito mode',
    boost: 'Boost your profile',
    crush_links_per_30d: 'More Secret crush links',
    duo: 'Duo',
    statuses: 'Statuses',
    crossed_paths: 'Crossed paths',
    vip_badge: 'VIP badge next to your name',
    read_receipts: 'Read receipts',
    profile_visitors: 'See who viewed your profile',
    discover_priority: 'Priority in Discover',
    message_before_match: 'Message before a match',
  },
  // Compact cards in place of a gated control
  feedPostLocked: 'Posting is available in Plus. You can still read and like posts.',
  feedCommentLocked: 'Commenting is available in Plus.',
  likesBlurredTitle: 'See who liked you',
  likesBlurredBody: 'Their profiles are hidden on the free plan. Plus shows them.',
  blindLeft: '{count} of {limit} Blind Dates left today',
  crushLeft: '{count} of {limit} crush links left for 30 days',
}

export const planErrorsEn = {
  planRequired: 'This is available in Plus or VIP.',
  planLimit: 'You have reached the limit for now.',
  planPartner: 'This person cannot take calls on their plan.',
}

export type PlansDictionary = typeof plansEn
