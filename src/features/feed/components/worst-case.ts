import type { FeedPage, FeedPost } from '../types'

// Dev-only stress data for the feed (break-ui): /feed?data=worst or ?data=empty, never in
// production (the page ignores the param there). Each card carries a different realistic worst case.
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

const named = (
  id: string,
  name: string,
  username: string | null,
  age: number | null,
): FeedPost['identity'] => ({
  kind: 'named',
  author: { id, name, username, age, verified: true, photoUrl: null },
})

const posts: FeedPost[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    body: 'Siapa nak join hiking Bukit Tabur Sabtu ni? Link group: https://chat.whatsapp.com/KxQ7v2mLsT4kPq9ZrW8yBn?utm_source=vibely_feed_share_android hahahahahahahahahahahahahahahahahahahaha',
    likes: 12_847,
    comments: 1_093,
    createdAt: at(3),
    isMine: false,
    likedByMe: true,
    identity: named(
      '00000000-0000-4000-8000-0000000000a1',
      'Nurul Aisyah binti Mohd Khairuddin Abdullah',
      'nurulaisyah.khairuddin_official',
      27,
    ),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    body: 'Кто-нибудь знает, где в Куала-Лумпуре нормальный борщ? 🥲🍲\n\nПробовала в трёх местах, везде что-то не то. Достопримечательности посмотрела, теперь хочу домашней еды.',
    likes: 999,
    comments: 1,
    createdAt: at(60 * 26),
    isMine: true,
    likedByMe: false,
    identity: { kind: 'anonymous', pseudonym: { adj: 22, noun: 9, color: 3 } },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    body: 'ok',
    likes: 1,
    comments: 0,
    createdAt: at(60 * 24 * 9),
    isMine: false,
    likedByMe: false,
    identity: named('00000000-0000-4000-8000-0000000000a2', 'Jo', null, null),
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    body: 'Old anonymous post without a pseudonym (before the pseudonym migration).',
    likes: 0,
    comments: 0,
    createdAt: at(60 * 24 * 40),
    isMine: false,
    likedByMe: false,
    identity: { kind: 'anonymous', pseudonym: null },
  },
]

export function feedFixture(kind: string | undefined): FeedPage | null {
  if (process.env.NODE_ENV === 'production') return null
  if (kind === 'worst') return { posts, nextCursor: null }
  if (kind === 'empty') return { posts: [], nextCursor: null }
  return null
}
