// Settings screen and "Who liked you". Kept apart from en.ts so the main dictionary stays small.
export const settingsEn = {
  title: 'Settings',
  open: 'Settings',
  notifications: 'Notifications',
  notifyTypesHint: 'What we notify you about (when push notifications are on).',
  notifyTypes: {
    new_matches: 'New matches',
    messages: 'Messages',
    likes: 'Someone liked you',
    feed_replies: 'Replies in the feed',
    random_reveal: 'Blind date matches',
    new_people: 'New people nearby',
    status_replies: 'Replies to your status',
    calls: 'Incoming calls',
    post_replies: 'Private replies to your posts',
    daily_prompt: 'Question of the day',
  },
  privacy: 'Privacy',
  pause: 'Pause my profile',
  pauseHint:
    'You won’t appear in Discover or in “Who liked you”. Your matches and chats stay. Blind dates pair you only when you search yourself.',
  blocked: 'Blocked users',
  blockedEmpty: 'You haven’t blocked anyone.',
  blockedEmptyHint: 'When you block someone from a chat or a profile, they show up here.',
  unblock: 'Unblock',
  unblockConfirm:
    'Unblock {name}? You will be able to see each other again. A removed match is not restored.',
  feedReplyPush: 'New reply to your post',
  feedReplyPushBody: 'Open the feed to read it.',
  account: 'Account',
}

export const likesEn = {
  title: 'Who liked you',
  open: 'Who liked you: {count}',
  hint: 'They already like you. Like back for an instant match.',
  empty: 'No new likes yet',
  emptyHint: 'When someone likes you, they appear here. Keep swiping!',
  likeBack: 'Like back',
  pass: 'Pass',
  view: 'View {name}',
  lockedTitle: '{count} people like you',
  lockedHint: 'Keep swiping: when you like them too, it’s a match.',
  pushTitle: 'Someone liked you on Vibely 💘',
  pushBody: 'Open Vibely to see who it is.',
  pushBodyLocked: 'Keep swiping: it might be a match!',
}

export type SettingsDictionary = typeof settingsEn
export type LikesDictionary = typeof likesEn
