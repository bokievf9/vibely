'use client'

import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import { Constants } from '@/types/database.types'
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM, JOB_MAX_LENGTH, MAX_LANGUAGES } from '../about-schemas'
import type { NewProfileInput } from '../schemas'
import { MultiOptionChips, OptionChips } from './option-chips'

const enums = Constants.public.Enums
const HEIGHTS = Array.from(
  { length: HEIGHT_MAX_CM - HEIGHT_MIN_CM + 1 },
  (_, i) => HEIGHT_MIN_CM + i,
)

type Props = {
  control: Control<NewProfileInput>
  register: UseFormRegister<NewProfileInput>
  errors: FieldErrors<NewProfileInput>
}

// Optional "about me" fields on the edit page. Each choice can be cleared by tapping it again.
export function AboutFields({ control, register, errors }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const t = dict.about
  const choices = [
    ['relationshipGoal', t.goal.label, enums.relationship_goal, t.goal.options],
    ['education', t.education.label, enums.education_level, t.education.options],
    ['smoking', t.smoking.label, enums.habit_frequency, t.smoking.options],
    ['drinking', t.drinking.label, enums.habit_frequency, t.drinking.options],
    ['pets', t.pets.label, enums.pets_status, t.pets.options],
    ['children', t.children.label, enums.children_plan, t.children.options],
  ] as const
  const renderChoice = ([name, label, options, labels]: (typeof choices)[number]) => (
    <Field key={name} label={label}>
      <Controller
        control={control}
        name={`about.${name}`}
        render={({ field }) => (
          <OptionChips
            options={options}
            labels={labels}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </Field>
  )

  return (
    <div className="flex flex-col gap-6">
      {renderChoice(choices[0])}
      <Field label={t.height.label} htmlFor="heightCm">
        <Controller
          control={control}
          name="about.heightCm"
          render={({ field }) => (
            <select
              id="heightCm"
              className="bg-surface-raised border-border focus:border-accent/70 h-[3.25rem] w-full rounded-2xl border px-4 text-base shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] outline-none"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t.clear}</option>
              {HEIGHTS.map((cm) => (
                <option key={cm} value={cm}>
                  {fmt(t.height.value, { cm })}
                </option>
              ))}
            </select>
          )}
        />
      </Field>
      <Field
        label={t.job.label}
        htmlFor="jobTitle"
        error={errorText(errors.about?.jobTitle?.message)}
      >
        <Input
          id="jobTitle"
          maxLength={JOB_MAX_LENGTH}
          autoComplete="organization-title"
          placeholder={t.job.placeholder}
          {...register('about.jobTitle')}
        />
      </Field>
      {choices.slice(1).map(renderChoice)}
      <Field
        label={fmt(t.languages.label, { max: MAX_LANGUAGES })}
        error={errorText(errors.about?.languages?.message)}
      >
        <Controller
          control={control}
          name="about.languages"
          render={({ field }) => (
            <MultiOptionChips
              options={enums.spoken_language}
              labels={t.languages.options}
              value={field.value}
              max={MAX_LANGUAGES}
              onChange={field.onChange}
            />
          )}
        />
      </Field>
      <Field label={t.religion.label} hint={t.religion.note}>
        <Controller
          control={control}
          name="about.religion"
          render={({ field }) => (
            <OptionChips
              options={enums.religion}
              labels={t.religion.options}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Field>
    </div>
  )
}
