// Live statuses ("What's your vibe?"): the carousel, the viewer, the composer sheet, status
// conversations and their pushes. Kept apart from en.ts so the main dictionary stays small.
export const statusesEn = {
  title: 'Live statuses',
  vibe: "What's your vibe?",
  yourStatus: 'Your status',
  you: 'You',
  add: 'Add a status',
  edit: 'Change your status',
  hint: 'An emoji and a few words. People nearby see it for 3 hours.',
  textPlaceholder: 'Coffee at Bangsar, anyone?',
  emojiLabel: 'Pick an emoji',
  quickPicks: 'Quick picks',
  quickPicksHint: 'A quick pick also becomes your plan for 24 hours (shown on your profile).',
  post: 'Share',
  update: 'Update',
  clear: 'Clear status',
  posted: 'Your status is live for 3 hours.',
  underReview: 'Under review',
  underReviewHint: 'Our team is checking your status. Only you can see it for now.',
  timeLeft: '{h} h {m} min left',
  minutesLeft: '{m} min left',
  expired: 'Expired',
  open: 'Open the status of {name}',
  viewer: 'Status of {name}',
  reply: 'Reply',
  replyTitle: 'Reply to {name}',
  replyPlaceholder: 'Say something about their status',
  replyHint:
    'They will see your name and photo. If you both press Connect, it becomes a match and the chat moves to Chats.',
  replySent: 'Sent! {name} will see it in Chats.',
  openChat: 'Open the conversation',
  reportNote: 'Moderators will see this status and the profile.',
  conversations: 'Status replies',
  conversationsEmpty: 'Replies to statuses show up here.',
  repliedTo: 'Replying to: {emoji} {text}',
  theirStatus: 'Their status',
  yourStatusPinned: 'Your status',
  chatIntro: 'You can see each other. Press Connect when you like the vibe, or Pass to move on.',
  ended: 'This conversation has ended',
  youReplied: 'You replied',
  theyReplied: 'Replied to your status',
  matched: 'Matched',
  pushReply: '{name} replied to your status',
  pushMessage: 'New message from {name}',
  pushBody: 'Open Vibely to read it.',
}

export const statusErrorsEn = {
  statusTooLong: 'At most 60 characters',
  statusEmojiRequired: 'Pick an emoji',
  statusGone: 'This status is no longer available.',
  statusReplyLimit: 'You reached today’s limit of 10 replies. Try again tomorrow.',
}

export type StatusesDictionary = typeof statusesEn
export type StatusErrorsDictionary = typeof statusErrorsEn
