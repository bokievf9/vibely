'use client'

import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { useErrorText, useI18n } from '@/i18n/client'
import type { NewProfileInput } from '../schemas'
import { AboutFields } from './about-fields'
import { PromptsEditor } from './prompts-editor'

type Props = {
  control: Control<NewProfileInput>
  register: UseFormRegister<NewProfileInput>
  errors: FieldErrors<NewProfileInput>
}

// Edit page only: onboarding stays short, these are filled in later.
export function MoreAboutSection({ control, register, errors }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const t = dict.about

  return (
    <>
      <section id="prompts" className="flex scroll-mt-16 flex-col gap-3">
        <h2 className="text-lg font-bold">{t.prompts.title}</h2>
        <Controller
          control={control}
          name="prompts"
          render={({ field }) => (
            <PromptsEditor
              value={field.value}
              onChange={field.onChange}
              errorFor={(i) => errorText(errors.prompts?.[i]?.answer?.message)}
            />
          )}
        />
        {errors.prompts?.root?.message || errors.prompts?.message ? (
          <p role="alert" className="text-sm text-red-400">
            {errorText(errors.prompts.root?.message ?? errors.prompts.message)}
          </p>
        ) : null}
      </section>
      <section id="about" className="flex scroll-mt-16 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">{t.section}</h2>
          <p className="text-muted text-sm">{t.sectionHint}</p>
        </div>
        <AboutFields control={control} register={register} errors={errors} />
      </section>
    </>
  )
}
