export type FeedPost = {
  id: string
  body: string
  likes: number
  comments: number
  createdAt: string
  isMine: boolean
  likedByMe: boolean
}

export type FeedComment = {
  id: string
  body: string
  aliasNo: number
  isOp: boolean
  isMine: boolean
  createdAt: string
}

export type FeedPage = { posts: FeedPost[]; nextCursor: string | null }
