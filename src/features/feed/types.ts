import type { Pseudonym } from './pseudonym'

export const FEED_TABS = ['new', 'top', 'city'] as const
export type FeedTab = (typeof FEED_TABS)[number]

// "As me" author, only present when the database lets the viewer see that profile.
export type FeedAuthor = {
  id: string
  name: string
  username: string | null
  age: number | null
  verified: boolean
  photoUrl: string | null
}

// Who a post or comment shows: a named author, or an anonymous pseudonym (null on old rows).
export type FeedIdentity =
  { kind: 'named'; author: FeedAuthor } | { kind: 'anonymous'; pseudonym: Pseudonym | null }

export type FeedPost = {
  id: string
  body: string
  likes: number
  comments: number
  createdAt: string
  isMine: boolean
  likedByMe: boolean
  identity: FeedIdentity
}

export type FeedComment = {
  id: string
  body: string
  aliasNo: number | null
  isOp: boolean
  isMine: boolean
  createdAt: string
  identity: FeedIdentity
}

export type FeedPage = { posts: FeedPost[]; nextCursor: string | null }

// Read-only card opened from a named author. Never includes location or city.
export type AuthorCard = {
  id: string
  name: string
  username: string
  age: number | null
  verified: boolean
  bio: string
  photos: { url: string; width: number; height: number }[]
}
