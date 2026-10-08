// Usernames (@handle) and people search. Kept apart from en.ts so the main dictionary stays small.
export const usernameEn = {
  label: 'Username',
  rules: '3-20 characters: letters a-z, numbers, dots and underscores.',
  suggested: 'We picked one from your name. You can change it now or later.',
  checking: 'Checking…',
  available: '@{username} is available',
  current: 'This is your username',
  taken: '@{username} is already taken',
  invalid:
    'Use 3-20 characters: a-z, 0-9, dot or underscore. No dot at the start or end, no two dots in a row.',
  reserved: 'This username is reserved',
  checkFailed: 'Could not check this username. Try again.',
  section: 'Username',
  change: 'Change',
  changeTitle: 'Change username',
  save: 'Save',
  saved: 'Username saved',
  onceIn30Days: 'You can change your username once every 30 days.',
  nextChange: 'You can change it again on {date}.',
  findMe: 'Find me by username',
  findMeHint:
    'People can find you by your @username or name in search. A paused profile never shows up.',
  searchTitle: 'Search',
  searchOpen: 'Search people',
  searchLabel: 'Search by @username or name',
  searchPlaceholder: '@username or name',
  searchHint: 'Type at least 2 characters to search verified people by @username or name.',
  searchEmpty: 'No one found',
  searchEmptyHint: 'Check the spelling. Some people turn off search by username.',
  searchFailed: 'Search is not available right now.',
  retry: 'Try again',
  clear: 'Clear search',
  results: 'Search results',
  openProfile: 'Open the profile of {name}',
  backToSearch: 'Back to search',
  like: 'Like',
  liked: 'Liked',
  likedHint: 'If they like you too, it’s a match and a chat opens.',
}

export const usernameErrorsEn = {
  usernameInvalid:
    'Use 3-20 characters: a-z, 0-9, dot or underscore. No dot at the start or end, no two dots in a row.',
  usernameReserved: 'This username is reserved',
  usernameTaken: 'This username is already taken',
  usernameCooldown: 'You can change your username once every 30 days',
}

export type UsernameDictionary = typeof usernameEn
