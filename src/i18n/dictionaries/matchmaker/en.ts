// Matchmaker (introduce two of your matches) and Incognito mode. Kept apart from en.ts so the
// main dictionary stays small.
export const matchmakerEn = {
  preview: 'An introduction',
  introduce: 'Introduce to a friend',
  sheetTitle: 'Introduce {name}',
  sheetHint:
    'Pick one of your other matches. They only see each other if both are interested. A "No thanks" is never shown to anyone.',
  search: 'Search your matches',
  loading: 'Loading your matches',
  noMatches: 'You need at least one more match to make an introduction.',
  nothingFound: 'Nothing found',
  noteLabel: 'A note for both (optional)',
  notePlaceholder: 'Why would they get along?',
  noteCount: '{count}/{max}',
  send: 'Send introduction',
  sent: 'Introduction sent',
  sentHint: '{name} sees it in your chat first. If they are interested, {other} is next.',
  done: 'Done',
  reward: 'When it works, you get 7 VIP days.',
  cardTitle: '{name} wants to introduce you',
  cardTitleMine: 'You introduced {name} to {other}',
  cardLoading: 'Loading the introduction',
  noteFrom: 'Note from {name}',
  interested: 'Interested',
  noThanks: 'No thanks',
  waiting: 'You said yes. If {name} is interested too, a chat opens for you both.',
  matched: 'It is a match! You and {name} are connected now.',
  openChat: 'Open chat',
  closed: 'You passed on this introduction.',
  pending: 'Waiting for their answer.',
  matchedMine: 'They matched. Thank you for the introduction!',
  unavailable: 'This introduction is no longer available.',
  pinnedTitle: 'Introduced by {name}',
  pinnedTitleAnon: 'Introduced by a friend',
  pinnedHint: 'A friend matched with both of you brought you together.',
  pushIntro: '{name} wants to introduce you to someone',
  pushIntroBody: 'Open the chat to see who it is.',
  pushWorked: 'Your introduction worked',
  pushWorkedBody: '{b} and {c} are a match now. You got 7 VIP days.',
}

export const matchmakerErrorsEn = {
  referralExists: 'These two were already introduced recently.',
  referralUnavailable: 'This introduction is not possible right now.',
  noteTooLong: 'The note is too long (200 characters max)',
}

export const incognitoEn = {
  setting: 'Incognito mode',
  settingHint: 'Only people you like can see you in Discover.',
  sheetTitle: 'Incognito mode',
  sheetIntro: 'Only people you like can see you.',
  sheetPoints: [
    'In Discover you appear only to people you have liked.',
    'You are hidden from username search, crossed paths and "Who liked you".',
    'When someone you liked likes you back, it is a match as usual.',
  ],
  sheetNote:
    'Your matches, chats, feed posts and blind dates work as usual. Turn it off at any time.',
  turnOn: 'Turn on Incognito',
  notNow: 'Not now',
}

export type MatchmakerDictionary = typeof matchmakerEn
export type MatchmakerErrorsDictionary = typeof matchmakerErrorsEn
export type IncognitoDictionary = typeof incognitoEn
