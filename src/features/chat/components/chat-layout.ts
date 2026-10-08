// Shared by the chat room shell and its loading skeleton (plain module: usable on the server).
// The room is a fixed, full-height column (header over the message scroller, composer at the
// bottom) instead of a scrolling page, so the keyboard, the safe areas and the scroll anchor are
// all handled inside it. `--chat-header-h` is the header height including the notch inset.
// TODO(integration): switch --chat-header-h to the shell's --header-h once it lands.
export const CHAT_SHELL_CLASS =
  'group/chat bg-background fixed inset-x-0 top-0 z-20 mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden overscroll-none [--chat-header-h:calc(3.5rem+env(safe-area-inset-top,0px))]'

export const CHAT_HEADER_CLASS =
  'absolute inset-x-0 top-0 z-30 flex min-h-[var(--chat-header-h)] items-end pt-[env(safe-area-inset-top)]'

// The translucent material lives on its own layer: backdrop-filter on the header itself would make
// it the containing block of the fixed sheets opened from its buttons (they would be clipped to it).
export const CHAT_BAR_MATERIAL_CLASS =
  'bg-background/80 border-border/60 pointer-events-none absolute inset-0 backdrop-blur-xl'
