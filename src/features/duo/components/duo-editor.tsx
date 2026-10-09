'use client'

import { useState, useTransition } from 'react'
import { Check, LogOut, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RangeSlider } from '@/components/ui/range-slider'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { AGE_MAX, AGE_MIN, DISTANCE_MAX_KM } from '@/features/swipe/schemas'
import { leaveDuo, saveDuoProfile } from '../actions'
import { DUO_BIO_MAX } from '../errors'
import type { DuoPerson, DuoTeam } from '../types'
import { DuoPhotos } from './duo-photos'

type Props = { team: DuoTeam; me: DuoPerson }

// The active duo's profile as other duos see it (both main photos, names, ages), the bio (risk
// checked: a suspicious one is held for review) and the team's preferences. Either member edits.
export function DuoEditor({ team, me }: Props) {
  const { dict } = useI18n()
  const t = dict.duo
  const d = dict.discoverui
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [bio, setBio] = useState(team.bio)
  const [ages, setAges] = useState([team.minAge, team.maxAge])
  const [km, setKm] = useState(team.maxKm)
  const [held, setHeld] = useState(team.bioHeld)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pending, startTransition] = useTransition()
  const partner = team.partner
  const members = [me, ...(partner ? [partner] : [])]
  const tooLong = bio.trim().length > DUO_BIO_MAX

  const save = () =>
    startTransition(async () => {
      const result = await saveDuoProfile({
        bio,
        minAge: ages[0] ?? AGE_MIN,
        maxAge: ages[1] ?? AGE_MAX,
        maxKm: km,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(undefined)
      setHeld(result.data.held)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })

  const leave = () =>
    startTransition(async () => {
      const result = await leaveDuo()
      if (!result.ok) return setError(result.error)
      setConfirmLeave(false)
      router.replace('/swipe?mode=duo')
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <DuoPhotos
          members={members}
          className="aspect-[4/3] overflow-hidden rounded-3xl shadow-xl shadow-black/40"
          priority
        />
        {partner && (
          <p className="text-muted px-1 text-center text-sm">
            {fmt(t.withName, { name: partner.name })}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="duo-bio" className="flex items-baseline justify-between px-1">
          <span className="text-headline">{t.bioLabel}</span>
          <span
            className={
              tooLong ? 'text-danger text-sm tabular-nums' : 'text-muted text-sm tabular-nums'
            }
          >
            {bio.trim().length}/{DUO_BIO_MAX}
          </span>
        </label>
        <Textarea
          id="duo-bio"
          rows={3}
          maxLength={DUO_BIO_MAX + 20}
          placeholder={t.bioPlaceholder}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        {held && (
          <p className="flex gap-2 rounded-xl bg-amber-400/10 px-3 py-2.5 text-sm text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.bioHeld}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 px-1">
          <h2 className="text-headline">{t.prefs}</h2>
          <p className="text-muted text-sm">{t.prefsHint}</p>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 flex w-full justify-between text-sm font-medium">
            <span className="text-muted">{t.ageRange}</span>
            <span className="tabular-nums">
              {ages[0]}-{ages[1]}
            </span>
          </legend>
          <RangeSlider
            min={AGE_MIN}
            max={AGE_MAX}
            values={ages}
            onChange={setAges}
            labels={[d.minAge, d.maxAge]}
            valueText={(age) => fmt(d.ageValue, { age })}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 flex w-full justify-between text-sm font-medium">
            <span className="text-muted">{t.maxDistance}</span>
            <span className="tabular-nums">{fmt(d.kmValue, { km })}</span>
          </legend>
          <RangeSlider
            min={1}
            max={DISTANCE_MAX_KM}
            values={[km]}
            onChange={([v]) => setKm(v ?? km)}
            labels={[t.maxDistance]}
            valueText={(v) => fmt(d.kmValue, { km: v })}
          />
        </fieldset>
      </section>

      <FormError message={errorText(error)} />
      <Button fullWidth loading={pending} disabled={tooLong} onClick={save}>
        {saved ? (
          <>
            <Check className="size-5" aria-hidden /> {t.saved}
          </>
        ) : (
          t.save
        )}
      </Button>
      <Button
        variant="ghost"
        fullWidth
        className="text-danger"
        onClick={() => setConfirmLeave(true)}
      >
        <LogOut className="size-5" aria-hidden /> {t.leaveDuo}
      </Button>

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title={t.leaveDuo}>
        <div className="flex flex-col gap-4">
          <p className="text-muted">{fmt(t.leaveConfirm, { name: partner?.name ?? '' })}</p>
          <Button variant="danger" fullWidth loading={pending} onClick={leave}>
            {t.leaveDuo}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setConfirmLeave(false)}>
            {dict.common.cancel}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
