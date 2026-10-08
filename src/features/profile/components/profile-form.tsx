'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import { track } from '@/lib/analytics'
import { createProfile, updateProfile } from '../actions'
import type { OwnProfile, Tag } from '../queries'
import { TermsConsent } from '@/features/legal/components/terms-consent'
import { suggestUsername } from '@/features/username/actions'
import { UsernameField } from '@/features/username/components/username-field'
import { MAX_TAGS, newProfileSchema, profileFormSchema, type NewProfileInput } from '../schemas'
import { GenderPicker } from './gender-picker'
import { LocationButton } from './location-button'
import { MoreAboutSection } from './more-about-section'
import { TagPicker } from './tag-picker'

type Props = { tags: Tag[]; initial?: OwnProfile }

// Onboarding (no `initial`) and profile editing. Birth date and gender are set once.
export function ProfileForm({ tags, initial }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [serverError, setServerError] = useState<string>()
  const { register, control, handleSubmit, setError, setValue, formState } =
    useForm<NewProfileInput>({
      resolver: zodResolver(initial ? profileFormSchema : newProfileSchema),
      defaultValues: {
        interestedIn: [],
        bio: '',
        city: '',
        tagIds: [],
        location: null,
        displayName: '',
        username: '',
        birthDate: '',
        acceptTerms: false,
        ...initial,
      },
    })
  const { errors, isSubmitting } = formState
  const err = (message?: string) => errorText(message)

  // Onboarding: prefill the username from the name until the user edits it themselves.
  const [usernameEdited, setUsernameEdited] = useState(false)
  const displayName = useWatch({ control, name: 'displayName' })
  useEffect(() => {
    const name = displayName.trim()
    if (initial || usernameEdited || name.length < 2) return
    let alive = true
    const timer = setTimeout(() => {
      void suggestUsername(name).then((r) => {
        if (alive && r.ok) setValue('username', r.data)
      })
    }, 500)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [displayName, initial, usernameEdited, setValue])

  const onSubmit = handleSubmit(async (values) => {
    const result = initial ? await updateProfile(values) : await createProfile(values)
    if (result.ok && !initial) track('profile_created')
    if (result.ok) return initial ? router.push('/profile') : router.refresh()
    setServerError(result.error)
    Object.entries(result.fieldErrors ?? {}).forEach(([field, messages]) =>
      setError(field as keyof NewProfileInput, { message: messages[0] }),
    )
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Field
        label={dict.onboarding.name}
        htmlFor="displayName"
        error={err(errors.displayName?.message)}
      >
        <Input
          id="displayName"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          aria-invalid={Boolean(errors.displayName) || undefined}
          {...register('displayName')}
        />
      </Field>
      {!initial && (
        <Field
          label={dict.username.label}
          htmlFor="username"
          hint={usernameEdited ? dict.username.rules : dict.username.suggested}
        >
          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <UsernameField
                id="username"
                value={field.value}
                onChange={(v) => {
                  setUsernameEdited(true)
                  field.onChange(v)
                }}
                onBlur={field.onBlur}
                error={err(errors.username?.message)}
              />
            )}
          />
        </Field>
      )}
      {!initial && (
        <>
          <Field
            label={dict.onboarding.birthDate}
            htmlFor="birthDate"
            error={err(errors.birthDate?.message)}
          >
            <Input
              id="birthDate"
              type="date"
              autoComplete="bday"
              aria-invalid={Boolean(errors.birthDate) || undefined}
              {...register('birthDate')}
            />
          </Field>
          <Field label={dict.onboarding.iAm} error={err(errors.gender?.message)}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => <GenderPicker value={field.value} onChange={field.onChange} />}
            />
          </Field>
        </>
      )}
      <Field label={dict.onboarding.interestedIn} error={err(errors.interestedIn?.message)}>
        <Controller
          control={control}
          name="interestedIn"
          render={({ field }) => (
            <GenderPicker multiple value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>
      <Field label={dict.onboarding.city} htmlFor="city" error={err(errors.city?.message)}>
        <Input
          id="city"
          autoComplete="address-level2"
          autoCapitalize="words"
          enterKeyHint={initial ? 'done' : 'next'}
          {...register('city')}
        />
      </Field>
      <Controller
        control={control}
        name="location"
        render={({ field }) => <LocationButton value={field.value} onChange={field.onChange} />}
      />
      <Field label={dict.onboarding.bio} htmlFor="bio" error={err(errors.bio?.message)}>
        <Textarea id="bio" maxLength={500} {...register('bio')} />
      </Field>
      <Field
        label={fmt(dict.onboarding.tags, { max: MAX_TAGS })}
        error={err(errors.tagIds?.message)}
      >
        <Controller
          control={control}
          name="tagIds"
          render={({ field }) => (
            <TagPicker tags={tags} value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>
      {initial && <MoreAboutSection control={control} register={register} errors={errors} />}
      {!initial && (
        <TermsConsent error={err(errors.acceptTerms?.message)} {...register('acceptTerms')} />
      )}
      {initial ? (
        // Editing: Save stays in reach above the tab bar instead of waiting at the end of a long
        // form. It rests in place once the end of the form scrolls into view.
        <div className="bg-background/90 border-border sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 -mb-6 flex flex-col gap-2 border-t px-4 py-3 backdrop-blur">
          <FormError message={errorText(serverError)} />
          <Button type="submit" loading={isSubmitting} fullWidth>
            {dict.common.save}
          </Button>
        </div>
      ) : (
        <>
          <FormError message={errorText(serverError)} />
          <Button type="submit" loading={isSubmitting} fullWidth>
            {dict.common.continue}
          </Button>
        </>
      )}
    </form>
  )
}
