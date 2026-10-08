// Crossed paths and Plans. Kept apart from en.ts so the main dictionary stays small.
// Plural forms follow Intl.PluralRules categories (one, few, many, other).
export const crossedEn = {
  title: 'You crossed paths',
  dismiss: 'Hide this section',
  hide: 'Hide',
  hideLabel: 'Hide {name} from crossed paths',
  open: 'Open the profile of {name}',
  today: {
    one: 'Crossed paths today {place}',
    few: 'Crossed paths {count} times today {place}',
    many: 'Crossed paths {count} times today {place}',
    other: 'Crossed paths {count} times today {place}',
  },
  yesterday: {
    one: 'Crossed paths yesterday {place}',
    few: 'Crossed paths {count} times yesterday {place}',
    many: 'Crossed paths {count} times yesterday {place}',
    other: 'Crossed paths {count} times yesterday {place}',
  },
  near: 'near {area}',
  nearby: 'nearby',
  promoTitle: 'Crossed paths',
  promoText: 'See people you passed by today. Off until you turn it on.',
  promoAction: 'Learn more',
  setting: 'Crossed paths',
  settingHint:
    'Shows people who were in the same area as you, if they turned it on too. Turning it off deletes your history.',
  noPermission:
    'Location access is off for Vibely, so nothing is sent. Allow it with "Detect my location" in Edit profile.',
  sheetTitle: 'Crossed paths',
  sheetIntro:
    'See people you crossed paths with, for example at the same cafe area twice today. Only people who turned it on too can see you, and you can see them.',
  sheetPoints: [
    'While Vibely is open, your phone sends your location at most every 10 minutes. It is never sent in the background.',
    'We immediately reduce it to an area of about 1 km and the day. Exact places and coordinates are never stored.',
    'Areas where you spend the night or most of your time (home, work) are ignored.',
    'Others only see "crossed paths 2 times today near Bangsar". Never the time or the exact place, and only a few hours later.',
    'History is deleted after 48 hours, and at once when you turn this off.',
  ],
  sheetBlocked: 'Blocked, hidden and paused people never appear.',
  turnOn: 'Turn on',
  turnOff: 'Turn off',
  notNow: 'Not now',
}

export const plansEn = {
  title: 'Your plan',
  pick: 'What are you up to?',
  hint: 'Pick one plan. It shows on your profile for 24 hours.',
  set: 'Set a plan',
  change: 'Change plan',
  clear: 'Clear plan',
  active: 'Plan: {plan}',
  until: 'Shows until {time}',
  open: 'Your plan',
  filter: 'Similar plans first',
  filterHint: 'People with the same plan as yours show up first, within your distance.',
  filterNoPlan: 'Set a plan first to use this.',
  tags: {
    coffee: 'Coffee buddy',
    football: 'Going to a football match',
    mamak: 'Mamak tonight',
    'morning-run': 'Morning run',
    gym: 'Gym session',
    movie: 'Movie night',
    karaoke: 'Karaoke',
    hiking: 'Hiking this weekend',
    study: 'Study session',
    'new-cafe': 'Exploring a new cafe',
    'night-market': 'Night market',
    badminton: 'Badminton',
    beach: 'Beach trip',
    gaming: 'Gaming',
    concert: 'Concert',
    'art-gallery': 'Art gallery',
    'food-hunt': 'Food hunting',
    chatting: 'Just chatting',
  },
}

export type CrossedDictionary = typeof crossedEn
export type PlansDictionary = typeof plansEn
