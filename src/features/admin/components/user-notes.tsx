'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { addNote, deleteNote } from '../note-actions'
import { hasRole, type AdminRole } from '../roles'
import { formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

type Note = { id: string; body: string; authorId: string | null; author: string; createdAt: string }

// Internal notes on /admin/users/[id]: moderators add, authors delete their own, admins any.
export function UserNotes({
  userId,
  notes,
  me,
  role,
}: {
  userId: string
  notes: Note[]
  me: string
  role: AdminRole
}) {
  const { pending, error, run } = useAdminAction()
  const [body, setBody] = useState('')
  const canWrite = hasRole(role, 'moderator')

  const add = async () => {
    const result = await run(() => addNote({ userId, body }))
    if (result.ok) setBody('')
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Заметки модераторов ({notes.length})</h2>
      {!notes.length && <p className="text-muted text-sm">Заметок нет</p>}
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <li
            key={n.id}
            className="bg-surface flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
          >
            <div className="flex flex-1 flex-col gap-1">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <span className="text-muted text-xs">
                {n.author} · {formatDate(n.createdAt)}
              </span>
            </div>
            {canWrite && (n.authorId === me || hasRole(role, 'admin')) && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Удалить заметку"
                disabled={pending}
                onClick={() => run(() => deleteNote({ noteId: n.id }))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder="Заметка для других модераторов"
            aria-label="Новая заметка"
            className="min-h-20"
          />
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={!body.trim()}
            loading={pending}
            onClick={add}
          >
            Добавить заметку
          </Button>
        </div>
      )}
      <FormError message={error} />
    </section>
  )
}
