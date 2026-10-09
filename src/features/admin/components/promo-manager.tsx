'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Power, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { setPromoActive, upsertPromo } from '../promo-actions'
import type { PromoBenefits, UpsertPromoInput } from '../promo-schemas'
import type { PromoCode } from '../queries/promo'
import { Badge, formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

type Draft = {
  id: string | null
  code: string
  maxUses: string
  expiresAt: string // datetime-local value or ''
  benefits: PromoBenefits
  gender: 'male' | 'female' | null
  requiresVerified: boolean
}

const EMPTY: Draft = {
  id: null,
  code: '',
  maxUses: '',
  expiresAt: '',
  benefits: { vipDays: 30, boostHours: 0, seeLikes: false, queuePriority: false },
  gender: null,
  requiresVerified: true,
}

const GENDER_LABEL = { male: 'Мужчины', female: 'Женщины' } as const

// ISO → value for <input type="datetime-local"> in the admin's local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const draftOf = (c: PromoCode): Draft => ({
  id: c.id,
  code: c.code,
  maxUses: c.maxUses === null ? '' : String(c.maxUses),
  expiresAt: toLocalInput(c.expiresAt),
  benefits: c.benefits,
  gender: c.gender,
  requiresVerified: c.requiresVerified,
})

export function perksSummary(b: PromoBenefits): string {
  const parts: string[] = []
  if (b.vipDays > 0) parts.push(`VIP ${b.vipDays} дн.`)
  if (b.boostHours > 0) parts.push(`буст ${b.boostHours} ч`)
  if (b.seeLikes) parts.push('кто лайкнул')
  if (b.queuePriority) parts.push('приоритет в очереди')
  return parts.join(', ')
}

// List of codes with usage, create / edit form, activate / deactivate, link to the redemptions.
export function PromoManager({ codes }: { codes: PromoCode[] }) {
  const { pending, error, setError, run } = useAdminAction()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<string>()

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const input: UpsertPromoInput = {
      id: draft.id,
      code: draft.code,
      maxUses: draft.maxUses.trim() === '' ? null : Number(draft.maxUses),
      expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
      benefits: draft.benefits,
      gender: draft.gender,
      requiresVerified: draft.requiresVerified,
    }
    const result = await run(() => upsertPromo(input))
    if (result.ok) {
      setNotice(draft.id ? 'Промокод изменён' : 'Промокод создан (выключен до активации)')
      setDraft(null)
    }
  }

  const toggle = (c: PromoCode) => {
    const question = c.isActive
      ? `Выключить код ${c.code}? Новые погашения прекратятся, выданные бонусы останутся.`
      : `Включить код ${c.code}?`
    if (!confirm(question)) return
    setNotice(undefined)
    void run(() => setPromoActive({ id: c.id, active: !c.isActive }))
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const setB = (patch: Partial<PromoBenefits>) =>
    setDraft((d) => (d ? { ...d, benefits: { ...d.benefits, ...patch } } : d))

  return (
    <div className="flex flex-col gap-5">
      {draft ? (
        <form onSubmit={save} className="bg-surface flex flex-col gap-4 rounded-2xl p-4" noValidate>
          <h2 className="font-semibold">
            {draft.id ? `Изменить ${draft.code}` : 'Новый промокод'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Код"
              htmlFor="promo-code"
              hint="Латинские буквы, цифры, _ и -. Регистр не важен."
            >
              <Input
                id="promo-code"
                value={draft.code}
                onChange={(e) => set({ code: e.target.value })}
                placeholder="XMUM_FIRST_100"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={40}
                className="font-mono uppercase"
                required
              />
            </Field>
            <Field label="Лимит использований" htmlFor="promo-max" hint="Пусто: без лимита">
              <Input
                id="promo-max"
                type="number"
                inputMode="numeric"
                min={1}
                value={draft.maxUses}
                onChange={(e) => set({ maxUses: e.target.value })}
                placeholder="100"
              />
            </Field>
            <Field label="Действует до" htmlFor="promo-expires" hint="Пусто: бессрочно">
              <Input
                id="promo-expires"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(e) => set({ expiresAt: e.target.value })}
              />
            </Field>
            <Field label="Для кого" hint="Пол подтверждён проверкой селфи">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Ограничение по полу">
                {([null, 'female', 'male'] as const).map((g) => (
                  <Chip
                    key={g ?? 'any'}
                    selected={draft.gender === g}
                    onClick={() => set({ gender: g })}
                  >
                    {g ? GENDER_LABEL[g] : 'Все'}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="VIP-дни" htmlFor="promo-vip" hint="Значок VIP рядом с именем">
              <Input
                id="promo-vip"
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                value={draft.benefits.vipDays}
                onChange={(e) =>
                  setB({ vipDays: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                }
              />
            </Field>
            <Field label="Буст, часов" htmlFor="promo-boost" hint="Показ первым в Discover">
              <Input
                id="promo-boost"
                type="number"
                inputMode="numeric"
                min={0}
                max={8760}
                value={draft.benefits.boostHours}
                onChange={(e) =>
                  setB({ boostHours: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                }
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <CheckRow
              label="«Кто лайкнул» на время VIP"
              checked={draft.benefits.seeLikes}
              onChange={(v) => setB({ seeLikes: v })}
            />
            <CheckRow
              label="Приоритет в очереди блайнд-дейта на время VIP"
              checked={draft.benefits.queuePriority}
              onChange={(v) => setB({ queuePriority: v })}
            />
            <CheckRow
              label="Нужно одобренное селфи (иначе бонусы включатся после проверки)"
              checked={draft.requiresVerified}
              onChange={(v) => set({ requiresVerified: v })}
            />
          </div>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending}>
              {draft.id ? 'Сохранить' : 'Создать'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setDraft(null)
                setError(undefined)
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            className="self-start"
            onClick={() => {
              setNotice(undefined)
              setDraft(EMPTY)
            }}
          >
            <Plus className="size-4" /> Создать промокод
          </Button>
          <FormError message={error} />
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
        </div>
      )}

      {codes.length === 0 ? (
        <p className="text-muted">Промокодов пока нет</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {codes.map((c) => (
            <li key={c.id} className="bg-surface flex flex-col gap-2 rounded-2xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-lg font-semibold">{c.code}</span>
                <Badge
                  className={
                    c.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-border text-muted'
                  }
                >
                  {c.isActive ? 'Активен' : 'Выключен'}
                </Badge>
                {c.expiresAt && new Date(c.expiresAt) < new Date() && (
                  <Badge className="bg-red-500/15 text-red-400">Истёк</Badge>
                )}
                {c.maxUses !== null && c.currentUses >= c.maxUses && (
                  <Badge className="bg-amber-500/15 text-amber-400">Исчерпан</Badge>
                )}
                <span className="text-muted ml-auto text-xs">создан {formatDate(c.createdAt)}</span>
              </div>
              <p className="text-sm">
                {perksSummary(c.benefits)}
                {c.gender && ` · только ${GENDER_LABEL[c.gender].toLowerCase()}`}
                {c.requiresVerified ? ' · нужно селфи' : ' · без селфи'}
              </p>
              <p className="text-muted text-sm">
                Использовано {c.currentUses}
                {c.maxUses !== null ? ` из ${c.maxUses}` : ' (без лимита)'}: выдано {c.grantedCount}
                {c.pendingCount > 0 && `, ждут селфи ${c.pendingCount}`}
                {c.expiresAt ? ` · до ${formatDate(c.expiresAt)}` : ' · бессрочно'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setNotice(undefined)
                    setError(undefined)
                    setDraft(draftOf(c))
                  }}
                >
                  <Pencil className="size-4" /> Изменить
                </Button>
                <Button
                  variant={c.isActive ? 'ghost' : 'primary'}
                  size="sm"
                  disabled={pending}
                  onClick={() => toggle(c)}
                >
                  <Power className="size-4" /> {c.isActive ? 'Выключить' : 'Включить'}
                </Button>
                <Link
                  href={`/admin/promo/${c.id}`}
                  className="text-accent flex h-10 items-center gap-1 px-2 text-sm font-medium"
                >
                  <Users className="size-4" aria-hidden /> Погашения
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent size-5"
      />
      {label}
    </label>
  )
}
