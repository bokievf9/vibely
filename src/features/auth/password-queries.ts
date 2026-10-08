import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Whether the signed-in user has a sign-in password (my_has_password, 20261009000180).
export async function getHasPassword(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_has_password')
  return data === true
}
