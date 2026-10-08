// Shared by the server (src/features/push/send.ts) and the service worker (src/worker/push.ts).
// Only what is safe to show on a lock screen: never message bodies.
export type PushPayload = {
  title: string
  body: string
  // Same-origin path to open on click, e.g. /en/chats/<matchId>.
  url: string
  // Notifications with the same tag replace each other (one per chat instead of one per message).
  tag: string
}
