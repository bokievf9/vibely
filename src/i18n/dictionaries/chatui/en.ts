// Chat UI strings added with the chat polish pass (list, optimistic send, typing bubble).
// Kept apart from en.ts so the main dictionary stays small.
export const chatUiEn = {
  previewPhoto: '📷 {text}',
  newMatches: 'New matches',
  messages: 'Messages',
  onlyNewMatches: 'Tap a new match to say hi.',
  goDiscover: 'Go to Discover',
  sending: 'Sending',
  notSent: 'Not sent',
  retry: 'Retry',
  discard: 'Remove',
  typing: '{name} is typing',
  loadingChats: 'Loading chats',
}

export type ChatUiDictionary = typeof chatUiEn
