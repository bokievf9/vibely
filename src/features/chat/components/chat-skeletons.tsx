import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CHAT_BAR_MATERIAL_CLASS, CHAT_HEADER_CLASS, CHAT_SHELL_CLASS } from './chat-layout'
import { Immersive } from '@/components/layout/immersive'

// Server-safe placeholders shaped like the final content, so nothing jumps when it streams in.

const ROW_WIDTHS = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-2/5', 'w-1/2']

export function ChatListSkeleton({ label }: { label: string }) {
  return (
    <ul className="flex flex-col" aria-busy="true" aria-label={label}>
      {ROW_WIDTHS.map((w, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className={cn('h-4 rounded-full', w)} />
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-4/5 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}

const BUBBLES: { mine: boolean; w: string; h: string }[] = [
  { mine: false, w: 'w-40', h: 'h-9' },
  { mine: false, w: 'w-56', h: 'h-14' },
  { mine: true, w: 'w-36', h: 'h-9' },
  { mine: false, w: 'w-28', h: 'h-9' },
  { mine: true, w: 'w-52', h: 'h-14' },
  { mine: true, w: 'w-24', h: 'h-9' },
]

// Full chat room placeholder: immersive like the real room, so the tab bar never flashes.
export function ChatRoomSkeleton() {
  return (
    <div data-immersive aria-busy="true" className={CHAT_SHELL_CLASS}>
      <Immersive />
      <div className={CHAT_HEADER_CLASS}>
        <div aria-hidden className={`${CHAT_BAR_MATERIAL_CLASS} border-b`} />
        <div className="relative flex h-14 w-full items-center gap-2 px-2">
          <span className="size-11 shrink-0" />
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1.5 px-4 pt-[var(--header-h)] pb-3">
        {BUBBLES.map((b, i) => (
          <Skeleton key={i} className={cn(b.w, b.h, b.mine ? 'self-end' : 'self-start')} />
        ))}
      </div>
      <div className="border-border flex items-end gap-1.5 border-t px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <Skeleton className="h-11 flex-1 rounded-2xl" />
        <Skeleton className="size-11 shrink-0 rounded-full" />
      </div>
    </div>
  )
}
