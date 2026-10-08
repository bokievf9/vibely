'use client'

import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { approvePhotos, deletePhotos } from '../photo-review-actions'
import type { QueuePhoto } from '../queries/photos'
import { DELETE_PRESETS, PhotoCard } from './photo-card'
import { ReasonDialog } from './reason-dialog'
import { useModeration } from './use-moderation'

// Photo review grid with multi-select: approve or delete several photos at once (each photo is
// logged on its own).
export function PhotoGrid({ photos }: { photos: QueuePhoto[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string>()
  const { pending, error, run } = useModeration()
  const chosen = photos.filter((p) => selected.has(p.id)).map((p) => p.id)

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const approve = () =>
    run(async () => {
      const result = await approvePhotos({ photoIds: chosen })
      if (!result.ok) return result
      setSelected(new Set())
      setNotice(`Одобрено: ${result.data.approved}`)
      return { ok: true, data: undefined }
    })

  const remove = async (reason: string) => {
    const ok = await run(async () => {
      const result = await deletePhotos({ photoIds: chosen, reason })
      if (!result.ok) return result
      setNotice(`Удалено: ${result.data.deleted}`)
      return { ok: true, data: undefined }
    })
    if (ok) {
      setSelected(new Set())
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent size-5"
            checked={chosen.length > 0 && chosen.length === photos.length}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(photos.map((p) => p.id)) : new Set())
            }
          />
          Выбрать все на странице
        </label>
        {notice && <span className="text-muted">{notice}</span>}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id}>
            <PhotoCard
              photo={p}
              selected={selected.has(p.id)}
              onSelect={(on) => toggle(p.id, on)}
            />
          </li>
        ))}
      </ul>
      {chosen.length > 0 && (
        <div className="bg-background/95 border-border sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <span className="text-sm font-medium">Выбрано: {chosen.length}</span>
          <Button size="sm" variant="secondary" loading={pending && !deleting} onClick={approve}>
            <Check className="size-4" /> Одобрить
          </Button>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => setDeleting(true)}>
            <Trash2 className="size-4" /> Удалить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setSelected(new Set())}
          >
            Снять выбор
          </Button>
          <FormError message={deleting ? undefined : error} />
        </div>
      )}
      <ReasonDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Удалить фото: ${chosen.length}`}
        confirmLabel="Удалить"
        presets={DELETE_PRESETS}
        danger
        pending={pending}
        error={error}
        onConfirm={remove}
      />
    </>
  )
}
