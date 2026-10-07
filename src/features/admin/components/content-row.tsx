'use client'

import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setContentHidden } from '../actions'
import type { ContentItem } from '../queries/content'
import { Badge, formatDate } from './badges'
import { useModeration } from './use-moderation'

export function ContentRow({ item }: { item: ContentItem }) {
  const { pending, error, run } = useModeration()

  return (
    <article className="bg-surface flex flex-col gap-3 rounded-2xl p-4">
      <header className="text-muted flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/admin/users/${item.authorId}`}
          className="text-foreground font-medium hover:underline"
        >
          {item.authorName}
        </Link>
        <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        {item.hidden && <Badge className="bg-red-500/15 text-red-400">Скрыт</Badge>}
      </header>
      <p className="break-words whitespace-pre-wrap">{item.body}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button
        size="sm"
        variant={item.hidden ? 'secondary' : 'danger'}
        loading={pending}
        className="self-start"
        onClick={() =>
          run(() => setContentHidden({ type: item.type, id: item.id, hidden: !item.hidden }))
        }
      >
        {item.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {item.hidden ? 'Вернуть' : 'Скрыть'}
      </Button>
    </article>
  )
}
