// Discover when the deck runs out, invites and icebreakers. Kept apart from en.ts.
import type { PromptKey } from '@/features/profile/about-schemas'
import type { Enums } from '@/types/database.types'

export const discoverEn = {
  emptyTitle: "You've seen everyone nearby",
  emptyText: 'New people join every day. Meanwhile, try one of these:',
  widen: 'See more people',
  widerKm: '+{km} km → {count} more people',
  widerAge: 'Age {min}-{max} → {count} more',
  secondChance: 'Second chance',
  secondChanceHint: 'People you passed more than 2 weeks ago come back here.',
  random: 'Blind date',
  randomCount: '{count} people searching now',
  randomIdle: 'Chat first, see each other later',
  feed: 'Anonymous feed',
  feedNewest: 'Newest post: {time}',
  feedEmpty: 'Be the first to post',
  notify: 'Notify me about new people',
  notifyHint: 'A notification when someone new who fits your filters joins.',
  invite: 'Invite friends',
  inviteText: 'More friends on Vibely means more people to meet.',
  inviteShare: 'Share invite link',
  inviteMessage: 'Join me on Vibely: verified people only, made for Malaysia.',
  copied: 'Link copied',
  invited: 'You invited {count} friends',
  pushTitle: 'New people on Vibely ✨',
  pushBody: 'Someone new who fits your filters just joined. Take a look!',
  icebreakers: {
    title: 'Break the ice',
    hint: 'Tap one to put it in the message box',
    commonTag: [
      'We both love {tag}! How did you get into it?',
      'Another {tag} fan 🙌 What do you like most about it?',
    ],
    theirTag: 'I saw {tag} on your profile. What is the story there?',
    prompt: {
      default: 'Your answer to “{question}” caught my eye: “{answer}”. Tell me more?',
      ideal_weekend: '“{answer}” sounds like a perfect weekend. Can I come along next time?',
      mamak_order: '“{answer}” at the mamak? Respect. Which mamak is your go-to?',
      two_truths_lie: 'Two truths and a lie… my guess is the last one is the lie. Am I right?',
      lets_debate: 'Okay, let’s debate: “{answer}”. I’m ready 😄',
      karaoke_song: '“{answer}” at karaoke? I need to hear this 🎤',
      perfect_first_date: '“{answer}” as a first date? That sounds like a plan 😉',
      travel_story: 'Your travel story got me curious: “{answer}”. What happened next?',
    } satisfies Partial<Record<PromptKey, string>> & { default: string },
    job: 'How is life as a {job}? What is the best part of it?',
    pets: {
      cat: 'A cat person! 🐱 Do I get to see photos?',
      dog: 'A dog person! 🐶 What is their name?',
      both: 'Cats and dogs? Your home must be fun 😄 Who is the boss?',
      other: 'What pets do you have? I’m curious!',
    } satisfies Partial<Record<Enums<'pets_status'>, string>>,
    fallback: [
      'Hi {name}! Teh tarik or kopi ais?',
      'Hey {name} 👋 What is the best thing you ate this week?',
      'Hi {name}! If you could be anywhere in Malaysia this weekend, where would it be?',
      'Hi {name}! Nasi lemak for breakfast, lunch or dinner?',
    ],
  },
}

export type DiscoverDictionary = typeof discoverEn
