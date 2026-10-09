// Live statuses ("What's your vibe?"): the carousel, the viewer, the composer sheet, status
// conversations and their pushes. Kept apart from en.ts so the main dictionary stays small.
export const statusesEn = {
  title: 'Live statuses',
  vibe: "What's your vibe?",
  you: 'You',
  add: 'Add a status',
  hint: 'An emoji and a few words. People nearby see it for 3 hours.',
  emptyHint: 'Share your vibe. People nearby see it for 3 hours.',
  textLabel: 'Your status',
  textPlaceholder: 'Coffee at Bangsar, anyone?',
  emojiLabel: 'Pick an emoji',
  quickPicks: 'Quick picks',
  quickPicksHint:
    'People with the same quick pick show up first when you turn on Similar statuses in Discover.',
  post: 'Share',
  update: 'Update',
  clear: 'Clear status',
  change: 'Change',
  posted: 'Your status is live for 3 hours.',
  underReview: 'Under review',
  underReviewHint: 'Our team is checking your status. Only you can see it for now.',
  timeLeft: '{h} h {m} min left',
  minutesLeft: '{m} min left',
  open: 'Open the status of {name}',
  viewer: 'Status of {name}',
  previous: 'Previous status',
  next: 'Next status',
  replyPlaceholder: 'Reply to {name}',
  replyHint:
    'They will see your name and photo. If you both press Connect, it becomes a match and the chat moves to Chats.',
  replySent: 'Sent! The conversation is in Chats.',
  openChat: 'Open the conversation',
  report: 'Report this status',
  reportNote: 'Moderators will see this status and the profile.',
  pinned: 'Status',
  theirStatus: 'Their status',
  yourStatusPinned: 'Your status',
  statusRemoved: 'This status was removed.',
  chatHint: 'Replied to a status. Connect when you like the vibe.',
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
