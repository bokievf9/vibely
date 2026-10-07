export type Profile = {
  id: string
  phone: string | null
  full_name: string | null
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  bio: string | null
  avatar_url: string | null
  is_verified: boolean
  location_lat: number | null
  location_lng: number | null
  created_at: string
}

export type Post = {
  id: string
  author_id: string
  content: string
  likes_count: number
  created_at: string
}

export type RandomChatSession = {
  id: string
  user1_id: string
  user2_id: string
  status: 'active' | 'ended'
  revealed_by_user1: boolean
  revealed_by_user2: boolean
  created_at: string
}
