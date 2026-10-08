export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          telegram_linked_at: string | null
          telegram_user_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          telegram_linked_at?: string | null
          telegram_user_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          telegram_linked_at?: string | null
          telegram_user_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey'
            columns: ['blocked_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey'
            columns: ['blocker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      call_permissions: {
        Row: {
          allowed_at: string
          match_id: string
          user_id: string
        }
        Insert: {
          allowed_at?: string
          match_id: string
          user_id: string
        }
        Update: {
          allowed_at?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'call_permissions_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'call_permissions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          callee_id: string | null
          caller_id: string | null
          egress_id: string | null
          ended_at: string | null
          id: string
          kind: Database['public']['Enums']['call_kind']
          match_id: string | null
          recording_bytes: number | null
          recording_path: string | null
          recording_status: Database['public']['Enums']['call_recording_status']
          started_at: string
          status: Database['public']['Enums']['call_status']
        }
        Insert: {
          answered_at?: string | null
          callee_id?: string | null
          caller_id?: string | null
          egress_id?: string | null
          ended_at?: string | null
          id?: string
          kind: Database['public']['Enums']['call_kind']
          match_id?: string | null
          recording_bytes?: number | null
          recording_path?: string | null
          recording_status?: Database['public']['Enums']['call_recording_status']
          started_at?: string
          status?: Database['public']['Enums']['call_status']
        }
        Update: {
          answered_at?: string | null
          callee_id?: string | null
          caller_id?: string | null
          egress_id?: string | null
          ended_at?: string | null
          id?: string
          kind?: Database['public']['Enums']['call_kind']
          match_id?: string | null
          recording_bytes?: number | null
          recording_path?: string | null
          recording_status?: Database['public']['Enums']['call_recording_status']
          started_at?: string
          status?: Database['public']['Enums']['call_status']
        }
        Relationships: [
          {
            foreignKeyName: 'calls_callee_id_fkey'
            columns: ['callee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calls_caller_id_fkey'
            columns: ['caller_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calls_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
        ]
      }
      comments: {
        Row: {
          alias_no: number
          author_id: string
          body: string
          created_at: string
          id: string
          is_hidden: boolean
          is_named: boolean
          post_id: string
        }
        Insert: {
          alias_no: number
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_named?: boolean
          post_id: string
        }
        Update: {
          alias_no?: number
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_named?: boolean
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'feed_posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          source: Database['public']['Enums']['match_source']
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          source: Database['public']['Enums']['match_source']
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          source?: Database['public']['Enums']['match_source']
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: 'matches_user_a_fkey'
            columns: ['user_a']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_user_b_fkey'
            columns: ['user_b']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      message_deletions: {
        Row: {
          body: string | null
          deleted_at: string
          match_id: string
          media_kind: string | null
          media_mime: string | null
          media_path: string | null
          message_id: string
          sender_id: string
          sent_at: string
        }
        Insert: {
          body?: string | null
          deleted_at?: string
          match_id: string
          media_kind?: string | null
          media_mime?: string | null
          media_path?: string | null
          message_id: string
          sender_id: string
          sent_at: string
        }
        Update: {
          body?: string | null
          deleted_at?: string
          match_id?: string
          media_kind?: string | null
          media_mime?: string | null
          media_path?: string | null
          message_id?: string
          sender_id?: string
          sent_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          match_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          match_id: string
          message_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          match_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'message_reactions_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_reactions_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_reactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          image_height: number | null
          image_path: string | null
          image_width: number | null
          match_id: string
          media_duration_ms: number | null
          media_expired_at: string | null
          media_kind: string | null
          media_mime: string | null
          media_path: string | null
          read_at: string | null
          reply_to: string | null
          sender_id: string
          waveform: number[] | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_height?: number | null
          image_path?: string | null
          image_width?: number | null
          match_id: string
          media_duration_ms?: number | null
          media_expired_at?: string | null
          media_kind?: string | null
          media_mime?: string | null
          media_path?: string | null
          read_at?: string | null
          reply_to?: string | null
          sender_id?: string
          waveform?: number[] | null
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_height?: number | null
          image_path?: string | null
          image_width?: number | null
          match_id?: string
          media_duration_ms?: number | null
          media_expired_at?: string | null
          media_kind?: string | null
          media_mime?: string | null
          media_path?: string | null
          read_at?: string | null
          reply_to?: string | null
          sender_id?: string
          waveform?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'messages_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_reply_to_fkey'
            columns: ['reply_to']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      new_people_alerts: {
        Row: {
          created_at: string
          genders: Database['public']['Enums']['gender'][]
          last_notified_at: string | null
          max_age: number
          max_km: number
          min_age: number
          user_id: string
        }
        Insert: {
          created_at?: string
          genders: Database['public']['Enums']['gender'][]
          last_notified_at?: string | null
          max_age: number
          max_km: number
          min_age: number
          user_id?: string
        }
        Update: {
          created_at?: string
          genders?: Database['public']['Enums']['gender'][]
          last_notified_at?: string | null
          max_age?: number
          max_km?: number
          min_age?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'new_people_alerts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notification_prefs: {
        Row: {
          calls: boolean
          feed_replies: boolean
          likes: boolean
          messages: boolean
          new_matches: boolean
          new_people: boolean
          random_reveal: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          calls?: boolean
          feed_replies?: boolean
          likes?: boolean
          messages?: boolean
          new_matches?: boolean
          new_people?: boolean
          random_reveal?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          calls?: boolean
          feed_replies?: boolean
          likes?: boolean
          messages?: boolean
          new_matches?: boolean
          new_people?: boolean
          random_reveal?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_prefs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      post_aliases: {
        Row: {
          alias_no: number
          post_id: string
          user_id: string
        }
        Insert: {
          alias_no: number
          post_id: string
          user_id: string
        }
        Update: {
          alias_no?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'post_aliases_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'feed_posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'post_aliases_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'post_aliases_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'post_likes_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'feed_posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'post_likes_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'post_likes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          comments_count: number
          created_at: string
          id: string
          is_hidden: boolean
          is_named: boolean
          last_comment_push_at: string | null
          likes_count: number
        }
        Insert: {
          author_id: string
          body: string
          comments_count?: number
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_named?: boolean
          last_comment_push_at?: string | null
          likes_count?: number
        }
        Update: {
          author_id?: string
          body?: string
          comments_count?: number
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_named?: boolean
          last_comment_push_at?: string | null
          likes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profile_photos: {
        Row: {
          created_at: string
          height: number
          id: string
          position: number
          profile_id: string
          storage_path: string
          width: number
        }
        Insert: {
          created_at?: string
          height: number
          id?: string
          position: number
          profile_id?: string
          storage_path: string
          width: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          position?: number
          profile_id?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: 'profile_photos_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profile_prompts: {
        Row: {
          answer: string
          created_at: string
          id: string
          position: number
          profile_id: string
          prompt_key: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          position: number
          profile_id?: string
          prompt_key: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          position?: number
          profile_id?: string
          prompt_key?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profile_prompts_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profile_tags: {
        Row: {
          profile_id: string
          tag_id: number
        }
        Insert: {
          profile_id?: string
          tag_id: number
        }
        Update: {
          profile_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'profile_tags_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profile_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          birth_date: string
          calls_consent_at: string | null
          children: Database['public']['Enums']['children_plan'] | null
          city: string | null
          created_at: string
          discoverable: boolean
          display_name: string
          drinking: Database['public']['Enums']['habit_frequency'] | null
          education: Database['public']['Enums']['education_level'] | null
          gender: Database['public']['Enums']['gender']
          height_cm: number | null
          id: string
          interested_in: Database['public']['Enums']['gender'][]
          is_active: boolean
          job_title: string | null
          languages: Database['public']['Enums']['spoken_language'][] | null
          last_active_at: string
          location: unknown
          pets: Database['public']['Enums']['pets_status'] | null
          referred_by: string | null
          relationship_goal: Database['public']['Enums']['relationship_goal'] | null
          religion: Database['public']['Enums']['religion'] | null
          searchable_by_username: boolean
          show_last_seen: boolean
          smoking: Database['public']['Enums']['habit_frequency'] | null
          terms_accepted_at: string | null
          updated_at: string
          username: string
          username_changed_at: string | null
          verification_status: Database['public']['Enums']['verification_status']
        }
        Insert: {
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          birth_date: string
          calls_consent_at?: string | null
          children?: Database['public']['Enums']['children_plan'] | null
          city?: string | null
          created_at?: string
          discoverable?: boolean
          display_name: string
          drinking?: Database['public']['Enums']['habit_frequency'] | null
          education?: Database['public']['Enums']['education_level'] | null
          gender: Database['public']['Enums']['gender']
          height_cm?: number | null
          id?: string
          interested_in: Database['public']['Enums']['gender'][]
          is_active?: boolean
          job_title?: string | null
          languages?: Database['public']['Enums']['spoken_language'][] | null
          last_active_at?: string
          location?: unknown
          pets?: Database['public']['Enums']['pets_status'] | null
          referred_by?: string | null
          relationship_goal?: Database['public']['Enums']['relationship_goal'] | null
          religion?: Database['public']['Enums']['religion'] | null
          searchable_by_username?: boolean
          show_last_seen?: boolean
          smoking?: Database['public']['Enums']['habit_frequency'] | null
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
          username_changed_at?: string | null
          verification_status?: Database['public']['Enums']['verification_status']
        }
        Update: {
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          birth_date?: string
          calls_consent_at?: string | null
          children?: Database['public']['Enums']['children_plan'] | null
          city?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string
          drinking?: Database['public']['Enums']['habit_frequency'] | null
          education?: Database['public']['Enums']['education_level'] | null
          gender?: Database['public']['Enums']['gender']
          height_cm?: number | null
          id?: string
          interested_in?: Database['public']['Enums']['gender'][]
          is_active?: boolean
          job_title?: string | null
          languages?: Database['public']['Enums']['spoken_language'][] | null
          last_active_at?: string
          location?: unknown
          pets?: Database['public']['Enums']['pets_status'] | null
          referred_by?: string | null
          relationship_goal?: Database['public']['Enums']['relationship_goal'] | null
          religion?: Database['public']['Enums']['religion'] | null
          searchable_by_username?: boolean
          show_last_seen?: boolean
          smoking?: Database['public']['Enums']['habit_frequency'] | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
          username_changed_at?: string | null
          verification_status?: Database['public']['Enums']['verification_status']
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_referred_by_fkey'
            columns: ['referred_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          locale: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          locale?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          locale?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      random_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'random_chat_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'random_chat_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'random_chat_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      random_chat_queue: {
        Row: {
          enqueued_at: string
          last_seen_at: string
          max_age: number
          min_age: number
          user_id: string
          want_genders: Database['public']['Enums']['gender'][]
          want_tags: number[]
        }
        Insert: {
          enqueued_at?: string
          last_seen_at?: string
          max_age: number
          min_age: number
          user_id: string
          want_genders: Database['public']['Enums']['gender'][]
          want_tags?: number[]
        }
        Update: {
          enqueued_at?: string
          last_seen_at?: string
          max_age?: number
          min_age?: number
          user_id?: string
          want_genders?: Database['public']['Enums']['gender'][]
          want_tags?: number[]
        }
        Relationships: [
          {
            foreignKeyName: 'random_chat_queue_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      random_chat_sessions: {
        Row: {
          a_revealed: boolean
          b_revealed: boolean
          ended_at: string | null
          id: string
          match_id: string | null
          revealed_at: string | null
          started_at: string
          status: Database['public']['Enums']['random_session_status']
          user_a: string
          user_b: string
        }
        Insert: {
          a_revealed?: boolean
          b_revealed?: boolean
          ended_at?: string | null
          id?: string
          match_id?: string | null
          revealed_at?: string | null
          started_at?: string
          status?: Database['public']['Enums']['random_session_status']
          user_a: string
          user_b: string
        }
        Update: {
          a_revealed?: boolean
          b_revealed?: boolean
          ended_at?: string | null
          id?: string
          match_id?: string | null
          revealed_at?: string | null
          started_at?: string
          status?: Database['public']['Enums']['random_session_status']
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: 'random_chat_sessions_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'random_chat_sessions_user_a_fkey'
            columns: ['user_a']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'random_chat_sessions_user_b_fkey'
            columns: ['user_b']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'referral_codes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          target_id: string
          target_type: Database['public']['Enums']['report_target']
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_id: string
          target_type: Database['public']['Enums']['report_target']
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_id?: string
          target_type?: Database['public']['Enums']['report_target']
        }
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey'
            columns: ['reporter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string
          direction: Database['public']['Enums']['swipe_direction']
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          created_at?: string
          direction: Database['public']['Enums']['swipe_direction']
          swiped_id: string
          swiper_id?: string
        }
        Update: {
          created_at?: string
          direction?: Database['public']['Enums']['swipe_direction']
          swiped_id?: string
          swiper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'swipes_swiped_id_fkey'
            columns: ['swiped_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'swipes_swiper_id_fkey'
            columns: ['swiper_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      tags: {
        Row: {
          category: string
          id: number
          label: string
          slug: string
          sort: number
        }
        Insert: {
          category: string
          id?: never
          label: string
          slug: string
          sort?: number
        }
        Update: {
          category?: string
          id?: never
          label?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      telegram_audit: {
        Row: {
          chat_id: number | null
          created_at: string
          detail: string | null
          event: string
          id: number
          telegram_user_id: number | null
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          detail?: string | null
          event: string
          id?: never
          telegram_user_id?: number | null
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          detail?: string | null
          event?: string
          id?: never
          telegram_user_id?: number | null
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          admin_id: string
          code_hash: string
          created_at: string
          expires_at: string
        }
        Insert: {
          admin_id: string
          code_hash: string
          created_at?: string
          expires_at: string
        }
        Update: {
          admin_id?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'telegram_link_codes_admin_id_fkey'
            columns: ['admin_id']
            isOneToOne: false
            referencedRelation: 'admins'
            referencedColumns: ['user_id']
          },
        ]
      }
      telegram_messages: {
        Row: {
          chat_id: number
          closed_at: string | null
          control_message_id: number | null
          created_at: string
          id: string
          kind: string
          photo_message_ids: number[]
          photos_deleted_at: string | null
          ref_id: string
          ref_type: string
        }
        Insert: {
          chat_id: number
          closed_at?: string | null
          control_message_id?: number | null
          created_at?: string
          id?: string
          kind: string
          photo_message_ids?: number[]
          photos_deleted_at?: string | null
          ref_id: string
          ref_type: string
        }
        Update: {
          chat_id?: number
          closed_at?: string | null
          control_message_id?: number | null
          created_at?: string
          id?: string
          kind?: string
          photo_message_ids?: number[]
          photos_deleted_at?: string | null
          ref_id?: string
          ref_type?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          challenge: string
          created_at: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          selfie_path: string
          status: Database['public']['Enums']['verification_status']
          user_id: string
        }
        Insert: {
          challenge: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_path: string
          status?: Database['public']['Enums']['verification_status']
          user_id?: string
        }
        Update: {
          challenge?: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_path?: string
          status?: Database['public']['Enums']['verification_status']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'verification_requests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      feed_posts: {
        Row: {
          anon_adj: number | null
          anon_color: number | null
          anon_noun: number | null
          author_age: number | null
          author_id: string | null
          author_name: string | null
          author_photo_path: string | null
          author_username: string | null
          author_verified: boolean | null
          body: string | null
          comments_count: number | null
          created_at: string | null
          engagement: number | null
          id: string | null
          is_liked_by_me: boolean | null
          is_mine: boolean | null
          is_named: boolean | null
          likes_count: number | null
          same_city: boolean | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          alias_no: number | null
          anon_adj: number | null
          anon_color: number | null
          anon_noun: number | null
          author_age: number | null
          author_id: string | null
          author_name: string | null
          author_photo_path: string | null
          author_username: string | null
          author_verified: boolean | null
          body: string | null
          created_at: string | null
          id: string | null
          is_mine: boolean | null
          is_named: boolean | null
          is_op: boolean | null
          post_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'feed_posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      accept_calls_notice: { Args: never; Returns: string }
      admin_delete_photo: {
        Args: { p_admin: string; p_photo: string; p_reason: string }
        Returns: string
      }
      admin_find_users: {
        Args: { p_admin: string; p_limit?: number; p_query?: string }
        Returns: {
          banned_at: string
          created_at: string
          display_name: string
          id: string
          open_reports: number
          phone: string
          username: string
          verification_status: Database['public']['Enums']['verification_status']
        }[]
      }
      admin_open_call_recording: {
        Args: { p_admin: string; p_call: string; p_reason?: string }
        Returns: string
      }
      admin_resolve_reports: {
        Args: {
          p_admin: string
          p_resolution: string
          p_target: string
          p_type: Database['public']['Enums']['report_target']
        }
        Returns: number
      }
      admin_review_verification: {
        Args: {
          p_admin: string
          p_approve: boolean
          p_reason?: string
          p_request: string
        }
        Returns: undefined
      }
      admin_revoke_verification: {
        Args: { p_admin: string; p_reason: string; p_user: string }
        Returns: undefined
      }
      admin_set_ban: {
        Args: {
          p_admin: string
          p_banned: boolean
          p_reason?: string
          p_user: string
        }
        Returns: undefined
      }
      admin_set_content_hidden: {
        Args: {
          p_admin: string
          p_hidden: boolean
          p_id: string
          p_reason?: string
          p_type: Database['public']['Enums']['report_target']
        }
        Returns: undefined
      }
      age_in_years: { Args: { birth_date: string }; Returns: number }
      admin_telegram_issue_code: {
        Args: {
          p_admin: string
          p_code: string
        }
        Returns: string
      }
      admin_telegram_unlink: {
        Args: {
          p_admin: string
        }
        Returns: undefined
      }
      answer_call: {
        Args: { p_call: string }
        Returns: Database['public']['Enums']['call_status']
      }
      array_is_distinct: { Args: { arr: unknown }; Returns: boolean }
      assert_admin: { Args: { p_admin: string }; Returns: undefined }
      call_notify: {
        Args: {
          p_call: Database['public']['Tables']['calls']['Row']
          p_event: string
          p_user: string
        }
        Returns: undefined
      }
      call_recordings_to_purge: {
        Args: { p_limit?: number }
        Returns: {
          call_id: string
          recording_path: string
        }[]
      }
      call_settings: {
        Args: { p_match: string }
        Returns: {
          consented: boolean
          me_allowed: boolean
          partner_allowed: boolean
        }[]
      }
      call_under_open_report: {
        Args: { a: string; b: string }
        Returns: boolean
      }
      can_view_profile: { Args: { target: string }; Returns: boolean }
      chat_media_match: { Args: { object_name: string }; Returns: string }
      claim_comment_push: { Args: { p_comment_id: string }; Returns: string }
      claim_referral: { Args: { p_code: string }; Returns: boolean }
      count_incoming_likes: { Args: never; Returns: number }
      count_swipe_candidates: {
        Args: {
          p_genders: Database['public']['Enums']['gender'][]
          p_max_age?: number
          p_max_km?: number
          p_min_age?: number
        }
        Returns: number
      }
      create_comment: {
        Args: { p_body: string; p_named?: boolean; p_post_id: string }
        Returns: string
      }
      create_post: {
        Args: { p_body: string; p_named?: boolean }
        Returns: string
      }
      delete_comment: { Args: { p_comment_id: string }; Returns: undefined }
      delete_message: { Args: { p_id: string }; Returns: string }
      delete_post: { Args: { p_post_id: string }; Returns: undefined }
      edit_message: { Args: { p_body: string; p_id: string }; Returns: string }
      end_call: {
        Args: { p_call: string }
        Returns: Database['public']['Enums']['call_status']
      }
      ensure_match: {
        Args: {
          a: string
          b: string
          src: Database['public']['Enums']['match_source']
        }
        Returns: string
      }
      expire_stale_calls: { Args: never; Returns: undefined }
      feed_pseudonym: {
        Args: { p_alias: number; p_post: string }
        Returns: number[]
      }
      feed_viewer_city: { Args: never; Returns: string }
      finish_call: {
        Args: { p_call: string }
        Returns: Database['public']['Enums']['call_status']
      }
      generate_username: { Args: { p_name: string }; Returns: string }
      get_blocked_users: {
        Args: never
        Returns: {
          blocked_at: string
          display_name: string
          id: string
          photo: Json
        }[]
      }
      get_incoming_likes: {
        Args: { p_limit?: number }
        Returns: {
          age: number
          bio: string
          children: Database['public']['Enums']['children_plan']
          city: string
          display_name: string
          distance_km: number
          drinking: Database['public']['Enums']['habit_frequency']
          education: Database['public']['Enums']['education_level']
          height_cm: number
          id: string
          job_title: string
          languages: Database['public']['Enums']['spoken_language'][]
          liked_at: string
          pets: Database['public']['Enums']['pets_status']
          photos: Json
          prompts: Json
          relationship_goal: Database['public']['Enums']['relationship_goal']
          religion: Database['public']['Enums']['religion']
          smoking: Database['public']['Enums']['habit_frequency']
          tags: string[]
        }[]
      }
      get_my_referral: {
        Args: never
        Returns: {
          code: string
          invited: number
        }[]
      }
      get_random_messages: {
        Args: { p_before?: string; p_limit?: number; p_session_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          is_mine: boolean
        }[]
      }
      get_random_session: {
        Args: never
        Returns: {
          common_tags: string[]
          id: string
          match_id: string
          my_revealed: boolean
          my_side: string
          partner: Json
          partner_revealed: boolean
          started_at: string
        }[]
      }
      get_swipe_candidates: {
        Args: {
          p_genders: Database['public']['Enums']['gender'][]
          p_limit?: number
          p_max_age?: number
          p_max_km?: number
          p_min_age?: number
        }
        Returns: {
          age: number
          bio: string
          children: Database['public']['Enums']['children_plan']
          city: string
          display_name: string
          distance_km: number
          drinking: Database['public']['Enums']['habit_frequency']
          education: Database['public']['Enums']['education_level']
          height_cm: number
          id: string
          job_title: string
          languages: Database['public']['Enums']['spoken_language'][]
          pets: Database['public']['Enums']['pets_status']
          photos: Json
          prompts: Json
          relationship_goal: Database['public']['Enums']['relationship_goal']
          religion: Database['public']['Enums']['religion']
          second_chance: boolean
          smoking: Database['public']['Enums']['habit_frequency']
          tags: string[]
        }[]
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      incoming_like_ids: {
        Args: never
        Returns: {
          id: string
          liked_at: string
        }[]
      }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_malaysian_mobile: { Args: { phone: string }; Returns: boolean }
      is_match_participant: { Args: { m: string }; Returns: boolean }
      is_verified: { Args: never; Returns: boolean }
      log_moderation: {
        Args: {
          p_action: string
          p_admin: string
          p_reason: string
          p_target: string
          p_type: string
        }
        Returns: undefined
      }
      mark_call_recordings_purged: {
        Args: { p_ids: string[] }
        Returns: number
      }
      match_partner_last_seen: { Args: { p_match: string }; Returns: string }
      match_under_open_report: { Args: { p_match: string }; Returns: boolean }
      my_username: {
        Args: never
        Returns: {
          changed_at: string
          next_change_at: string
          searchable: boolean
          username: string
        }[]
      }
      new_people_alert_recipients: {
        Args: { p_profile: string }
        Returns: string[]
      }
      normalize_username: { Args: { u: string }; Returns: string }
      purge_old_calls: { Args: never; Returns: number }
      purge_old_feed_content: { Args: never; Returns: number }
      purge_old_random_messages: { Args: never; Returns: number }
      random_session_side: { Args: { s: string }; Returns: string }
      randomizer_end: { Args: { p_session_id: string }; Returns: undefined }
      randomizer_join: {
        Args: {
          p_genders: Database['public']['Enums']['gender'][]
          p_max_age: number
          p_min_age: number
          p_tags?: number[]
        }
        Returns: string
      }
      randomizer_leave: { Args: never; Returns: undefined }
      randomizer_ping: { Args: never; Returns: undefined }
      randomizer_reveal: { Args: { p_session_id: string }; Returns: boolean }
      randomizer_send: {
        Args: { p_body: string; p_session_id: string }
        Returns: string
      }
      randomizer_stats: { Args: never; Returns: number }
      reorder_profile_photos: { Args: { p_ids: string[] }; Returns: undefined }
      retention_chat_media: {
        Args: { p_limit?: number }
        Returns: {
          message_id: string
          path: string
        }[]
      }
      retention_drop_message_deletions: {
        Args: { p_ids: string[] }
        Returns: number
      }
      retention_mark_chat_media_expired: {
        Args: { p_ids: string[] }
        Returns: number
      }
      retention_message_deletions: {
        Args: { p_limit?: number }
        Returns: {
          media_path: string
          message_id: string
        }[]
      }
      retention_orphan_chat_media: {
        Args: { p_limit?: number }
        Returns: string[]
      }
      retention_selfies: { Args: { p_limit?: number }; Returns: string[] }
      search_profiles_by_username: {
        Args: { lim?: number; q: string }
        Returns: {
          age: number
          city: string
          display_name: string
          id: string
          photo: Json
          username: string
        }[]
      }
      set_call_permission: {
        Args: { p_allowed: boolean; p_match: string }
        Returns: undefined
      }
      set_message_reaction: {
        Args: { p_emoji: string; p_message: string }
        Returns: undefined
      }
      set_new_people_alert: {
        Args: {
          p_enabled: boolean
          p_genders?: Database['public']['Enums']['gender'][]
          p_max_age?: number
          p_max_km?: number
          p_min_age?: number
        }
        Returns: boolean
      }
      set_username: { Args: { p_username: string }; Returns: string }
      start_call: {
        Args: {
          p_kind: Database['public']['Enums']['call_kind']
          p_match: string
        }
        Returns: string
      }
      suggest_username: { Args: { p_name: string }; Returns: string }
      swipe_candidate_pool: {
        Args: {
          p_genders: Database['public']['Enums']['gender'][]
          p_max_age: number
          p_max_km: number
          p_me: string
          p_min_age: number
        }
        Returns: {
          id: string
          second_chance: boolean
        }[]
      }
      toggle_post_like: { Args: { p_post_id: string }; Returns: boolean }
      touch_last_active: { Args: never; Returns: undefined }
      unread_message_count: { Args: never; Returns: number }
      username_base: { Args: { p_name: string }; Returns: string }
      username_error: { Args: { u: string }; Returns: string }
      username_status: { Args: { p_username: string }; Returns: string }
      telegram_code_hash: {
        Args: {
          p_code: string
        }
        Returns: string
      }
      telegram_link_admin: {
        Args: {
          p_code: string
          p_telegram_user_id: number
        }
        Returns: {
          result: string
          linked_admin: string
        }[]
      }
      telegram_mark_photos_deleted: {
        Args: {
          p_id: string
          p_cause: string
        }
        Returns: boolean
      }
      telegram_photos_to_delete: {
        Args: {
          p_max_age: unknown
          p_limit?: number
        }
        Returns: {
          id: string
          chat_id: number
          photo_message_ids: number[]
          control_message_id: number
          ref_id: string
          expired: boolean
          created_at: string
        }[]
      }
      telegram_record_message: {
        Args: {
          p_kind: string
          p_ref_type: string
          p_ref_id: string
          p_chat: number
          p_photos: number[]
          p_control: number
        }
        Returns: string
      }
      telegram_report_summary: {
        Args: {
          p_type: Database['public']['Enums']['report_target']
          p_target: string
        }
        Returns: {
          open_reports: number
          offender_id: string
          offender_reports_1h: number
          underage: boolean
          auto_hidden: boolean
          latest_reason: string
        }[]
      }
      telegram_stats: {
        Args: {
          p_since: string
        }
        Returns: Json
      }
    }
    Enums: {
      call_kind: 'audio' | 'video'
      call_recording_status: 'none' | 'pending' | 'recording' | 'ready' | 'failed' | 'purged'
      call_status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined'
      children_plan: 'have' | 'want' | 'dont_want' | 'not_sure'
      education_level: 'secondary' | 'diploma' | 'bachelor' | 'master' | 'phd' | 'other'
      gender: 'male' | 'female' | 'other'
      habit_frequency: 'never' | 'sometimes' | 'often'
      match_source: 'swipe' | 'randomizer'
      pets_status: 'none' | 'cat' | 'dog' | 'both' | 'other'
      random_session_status: 'active' | 'ended'
      relationship_goal: 'serious' | 'long_term_open' | 'casual' | 'friends' | 'not_sure'
      religion:
        | 'islam'
        | 'buddhism'
        | 'christianity'
        | 'hinduism'
        | 'taoism'
        | 'sikhism'
        | 'other'
        | 'none'
        | 'prefer_not_to_say'
      report_target: 'user' | 'post' | 'comment' | 'random_session'
      spoken_language:
        | 'malay'
        | 'english'
        | 'mandarin'
        | 'cantonese'
        | 'hokkien'
        | 'tamil'
        | 'hindi'
        | 'arabic'
        | 'korean'
        | 'japanese'
        | 'russian'
        | 'other'
      swipe_direction: 'like' | 'pass'
      verification_status: 'unverified' | 'pending' | 'approved' | 'rejected'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      call_kind: ['audio', 'video'],
      call_recording_status: ['none', 'pending', 'recording', 'ready', 'failed', 'purged'],
      call_status: ['ringing', 'active', 'ended', 'missed', 'declined'],
      children_plan: ['have', 'want', 'dont_want', 'not_sure'],
      education_level: ['secondary', 'diploma', 'bachelor', 'master', 'phd', 'other'],
      gender: ['male', 'female', 'other'],
      habit_frequency: ['never', 'sometimes', 'often'],
      match_source: ['swipe', 'randomizer'],
      pets_status: ['none', 'cat', 'dog', 'both', 'other'],
      random_session_status: ['active', 'ended'],
      relationship_goal: ['serious', 'long_term_open', 'casual', 'friends', 'not_sure'],
      religion: [
        'islam',
        'buddhism',
        'christianity',
        'hinduism',
        'taoism',
        'sikhism',
        'other',
        'none',
        'prefer_not_to_say',
      ],
      report_target: ['user', 'post', 'comment', 'random_session'],
      spoken_language: [
        'malay',
        'english',
        'mandarin',
        'cantonese',
        'hokkien',
        'tamil',
        'hindi',
        'arabic',
        'korean',
        'japanese',
        'russian',
        'other',
      ],
      swipe_direction: ['like', 'pass'],
      verification_status: ['unverified', 'pending', 'approved', 'rejected'],
    },
  },
} as const
