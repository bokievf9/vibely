'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getActionLocale } from '@/i18n/server'
import { getViewer } from '@/features/auth/session'
import { endpointSchema, subscriptionSchema, type SubscriptionInput } from './schemas'

// Saves (or refreshes, e.g. after a language change) this device's subscription.
export async function savePushSubscription(input: SubscriptionInput): Promise<UserResult> {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')

  const { endpoint, keys } = parsed.data
  const row = { endpoint, p256dh: keys.p256dh, auth: keys.auth, locale: await getActionLocale() }
  const supabase = await createClient()
  // No UPDATE grant: replace our own row. RLS limits the delete to the caller's rows.
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  const { error } = await supabase.from('push_subscriptions').insert(row)
  if (!error) return ok(undefined)
  if (error.code !== '23505') return fail('generic')

  // The endpoint still belongs to an account that used this browser before and did not sign out.
  // Holding the endpoint (an unguessable URL issued to this browser) proves it is this device,
  // so hand it over; otherwise the previous account would keep receiving this device's pushes.
  try {
    const admin = createAdminClient()
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
    const retry = await supabase.from('push_subscriptions').insert(row)
    return retry.error ? fail('generic') : ok(undefined)
  } catch (e) {
    console.error('[push] could not take over subscription', e)
    return fail('generic')
  }
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const parsed = endpointSchema.safeParse(endpoint)
  if (!parsed.success) return
  const supabase = await createClient()
  await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data)
}
