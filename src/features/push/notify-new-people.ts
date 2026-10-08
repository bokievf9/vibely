import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPushEnv } from '@/lib/env.server'
import { localePath } from '@/i18n/config'
import { sendToUser } from './send'

// A moderator just approved `profileId`: tell up to 50 opted-in users whose saved Discover
// filters include them (matching and the 12-hour throttle live in SQL:
// new_people_alert_recipients, 20261008000091). Runs after the response; never fails the review.
// The push never names the new person: it only says someone new is there.
export function notifyNewPeople(profileId: string) {
  if (!getPushEnv()) return
  after(async () => {
    try {
      const { data, error } = await createAdminClient().rpc('new_people_alert_recipients', {
        p_profile: profileId,
      })
      if (error) throw new Error(error.message)
      await Promise.all(
        data.map((userId) =>
          sendToUser(userId, 'new_people', (dict, locale) => ({
            title: dict.discover.pushTitle,
            body: dict.discover.pushBody,
            url: localePath(locale, '/swipe'),
            tag: 'new-people',
          })),
        ),
      )
    } catch (e) {
      console.error('[push] new people', e)
    }
  })
}
