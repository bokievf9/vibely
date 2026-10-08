'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { notifyNewComment } from './notify'
import { getAuthorCard, getFeedPage } from './queries'
import { FEED_TABS, type AuthorCard, type FeedPage } from './types'

const uuid = z.uuid()
const tabSchema = z.enum(FEED_TABS)
const named = z.boolean()
const cursorSchema = z
  .union([z.string().regex(/^[\d\-T:.+Z ]+\|[0-9a-f-]{36}$/), z.string().regex(/^o:\d{1,5}$/)])
  .nullable()

// Postgres errors raised by the feed RPCs.
function rpcError(code: string | undefined): ErrorKey {
  if (code === 'P0429') return 'rateLimited'
  if (code === 'VS001') return 'muted'
  if (code === '42501') return 'unauthorized'
  if (code === 'P0002') return 'notFound'
  return 'generic'
}

function cleanBody(raw: string, max: number): string | ErrorKey {
  const body = sanitizeText(raw)
  if (!body) return 'messageEmpty'
  return body.length > max ? 'messageTooLong' : body
}

export async function loadFeedPage(
  tab: string,
  cursor: string | null,
): Promise<UserResult<FeedPage>> {
  const t = tabSchema.safeParse(tab)
  const c = cursorSchema.safeParse(cursor)
  if (!t.success || !c.success) return fail('invalidInput')
  return ok(await getFeedPage(t.data, c.data))
}

export async function createPost(raw: string, asMe: boolean): Promise<UserResult<string>> {
  if (!named.safeParse(asMe).success) return fail('invalidInput')
  const body = cleanBody(z.string().parse(raw), 1000)
  if (body === 'messageEmpty' || body === 'messageTooLong') return fail(body)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_post', { p_body: body, p_named: asMe })
  return error ? fail(rpcError(error.code)) : ok(data)
}

export async function createComment(
  postId: string,
  raw: string,
  asMe: boolean,
): Promise<UserResult<string>> {
  if (!uuid.safeParse(postId).success || !named.safeParse(asMe).success) {
    return fail('invalidInput')
  }
  const body = cleanBody(z.string().parse(raw), 500)
  if (body === 'messageEmpty' || body === 'messageTooLong') return fail(body)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_comment', {
    p_post_id: postId,
    p_body: body,
    p_named: asMe,
  })
  if (error) return fail(rpcError(error.code))
  notifyNewComment(data, postId)
  return ok(data)
}

export async function toggleLike(postId: string): Promise<UserResult<boolean>> {
  if (!uuid.safeParse(postId).success) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('toggle_post_like', { p_post_id: postId })
  return error ? fail(rpcError(error.code)) : ok(data)
}

export async function deletePost(postId: string): Promise<UserResult> {
  if (!uuid.safeParse(postId).success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_post', { p_post_id: postId })
  return error ? fail('generic') : ok(undefined)
}

export async function deleteComment(commentId: string): Promise<UserResult> {
  if (!uuid.safeParse(commentId).success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId })
  return error ? fail('generic') : ok(undefined)
}

export async function loadAuthorCard(userId: string): Promise<UserResult<AuthorCard>> {
  if (!uuid.safeParse(userId).success) return fail('invalidInput')
  const card = await getAuthorCard(userId)
  return card ? ok(card) : fail('notFound')
}
