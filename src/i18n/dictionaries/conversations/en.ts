// "Reply privately" on feed posts, the private-replies list and the question of the day
// (20261009000220). Kept apart from en.ts so the main dictionary stays small.
export const conversationsEn = {
  // Reply privately (post card + thread)
  replyPrivately: 'Reply privately',
  replyTitle: 'Reply privately',
  replyHint:
    'Only the author reads this. You stay anonymous as "Partner #123" and they keep their post name. If you both want, you can reveal who you are later.',
  replyPlaceholder: 'Write your reply…',
  replySent: 'Sent. The conversation is in Chats.',
  // Conversation page
  postAuthor: 'Post author',
  postUnavailable: 'This post is no longer available.',
  pinnedPost: 'Replying to this post',
  pinnedPrompt: 'Question of the day',
  bothChose: 'You both chose: {answer}',
  youChose: 'You: {answer}',
  theyChose: 'They: {answer}',
  authorHint: 'Someone replied privately to your post. They only see your post name.',
  replierHint: 'The author sees you as {alias}.',
  promptHint: 'You both picked the same answer. Connect when it clicks.',
  revealIdentity: 'Reveal identity',
  revealLocked: '{n} messages each to unlock',
  revealLockedProgress: 'You {mine}/{n} · them {theirs}/{n}',
  revealWaiting: 'You asked to reveal. Waiting for them…',
  revealConfirmHint:
    'If you both press it, your profiles open and it becomes a match. Nothing is shown before that.',
  endedTitle: 'This conversation has ended',
  endedHint: 'Nothing more can be sent here.',
  backToChats: 'Back to chats',
  // Chats list section
  privateReplies: 'Private replies',
  privateRepliesHint: 'Anonymous conversations from the feed and the question of the day.',
  noMessagesYet: 'Say hi to start',
  // Pushes
  pushReply: 'Someone replied privately to your post',
  pushReplyBody: 'Open Vibely to read it. You stay anonymous.',
  pushReplyMessage: 'New message in a private reply',
  pushReplyMessageBody: 'Open Vibely to read it.',
  // Question of the day (feed card)
  promptTitle: 'Question of the day',
  promptNewAt: 'New question every day at 7 pm',
  promptAnswered: '{count} answered',
  promptSame: 'They chose the same',
  promptSameHint: 'People near you who picked your answer. Say hi to start a chat.',
  promptNobody: 'Nobody near you with your answer yet. Check back later.',
  sayHi: 'Say hi',
  promptPush: 'Question of the day: {question}',
  promptPushBody: 'Answer it and see who picked the same.',
}

export const conversationErrorsEn = {
  revealLocked: 'Reveal unlocks after 5 messages from each side.',
  conversationUnavailable: 'This conversation is not available.',
  conversationLimit: 'You have started 10 conversations today. Try again tomorrow.',
}

export type ConversationsDictionary = typeof conversationsEn
