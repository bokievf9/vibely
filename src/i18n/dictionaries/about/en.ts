// Optional "about me" fields and prompts. Kept apart from en.ts so the main dictionary stays small.
import type { PromptKey } from '@/features/profile/about-schemas'
import type { Enums } from '@/types/database.types'

type Options<E extends string> = Record<E, string>

export const aboutEn = {
  section: 'More about you',
  sectionHint: 'All optional. Helps people start a conversation with you.',
  about: 'About',
  more: 'More',
  less: 'Less',
  choose: 'Choose…',
  clear: 'Not set',
  goal: {
    label: 'Looking for',
    options: {
      serious: 'Something serious',
      long_term_open: 'Long-term, open to short',
      casual: 'Something casual',
      friends: 'New friends',
      not_sure: 'Still figuring it out',
    } satisfies Options<Enums<'relationship_goal'>>,
  },
  height: { label: 'Height', value: '{cm} cm' },
  job: { label: 'Job title', placeholder: 'e.g. Nurse, Engineer, Student' },
  education: {
    label: 'Education',
    options: {
      secondary: 'Secondary school (SPM)',
      diploma: 'Diploma / STPM',
      bachelor: "Bachelor's degree",
      master: "Master's degree",
      phd: 'PhD',
      other: 'Other',
    } satisfies Options<Enums<'education_level'>>,
  },
  languages: {
    label: 'Languages (up to {max})',
    short: 'Languages',
    options: {
      malay: 'Malay',
      english: 'English',
      mandarin: 'Mandarin',
      cantonese: 'Cantonese',
      hokkien: 'Hokkien',
      tamil: 'Tamil',
      hindi: 'Hindi',
      arabic: 'Arabic',
      korean: 'Korean',
      japanese: 'Japanese',
      russian: 'Russian',
      other: 'Other',
    } satisfies Options<Enums<'spoken_language'>>,
  },
  religion: {
    label: 'Religion (optional)',
    short: 'Religion',
    note: 'Completely optional. If you choose one, it is shown on your profile and used for nothing else.',
    options: {
      islam: 'Islam',
      buddhism: 'Buddhism',
      christianity: 'Christianity',
      hinduism: 'Hinduism',
      taoism: 'Taoism',
      sikhism: 'Sikhism',
      other: 'Other',
      none: 'Not religious',
      prefer_not_to_say: 'Prefer not to say',
    } satisfies Options<Enums<'religion'>>,
  },
  smoking: {
    label: 'Smoking',
    options: { never: 'Never', sometimes: 'Sometimes', often: 'Often' } satisfies Options<
      Enums<'habit_frequency'>
    >,
  },
  drinking: {
    label: 'Drinking',
    options: { never: 'Never', sometimes: 'Sometimes', often: 'Often' } satisfies Options<
      Enums<'habit_frequency'>
    >,
  },
  pets: {
    label: 'Pets',
    options: {
      none: 'No pets',
      cat: 'Cat',
      dog: 'Dog',
      both: 'Cats and dogs',
      other: 'Other pets',
    } satisfies Options<Enums<'pets_status'>>,
  },
  children: {
    label: 'Children',
    options: {
      have: 'Have children',
      want: 'Want children',
      dont_want: "Don't want children",
      not_sure: 'Not sure yet',
    } satisfies Options<Enums<'children_plan'>>,
  },
  prompts: {
    title: 'Prompts',
    hint: 'Answer up to {max}. They are great conversation starters.',
    add: 'Add a prompt',
    remove: 'Remove prompt',
    question: 'Prompt',
    answer: 'Your answer',
    keys: {
      ideal_weekend: 'My ideal weekend in KL…',
      way_to_heart: 'The way to my heart is…',
      mamak_order: 'Best mamak order:',
      weirdly_good_at: "I'm weirdly good at…",
      two_truths_lie: 'Two truths and a lie',
      simple_pleasures: 'My simple pleasures',
      lets_debate: "Let's debate:",
      perfect_first_date: 'A perfect first date',
      looking_for: "I'm looking for",
      karaoke_song: 'My go-to karaoke song',
      travel_story: 'Travel story',
      green_flags: 'Green flags I look for',
    } satisfies Options<PromptKey>,
  },
  completeness: {
    title: 'Your profile is {pct}% complete',
    photos: 'Add more photos to get more matches',
    bio: 'Write a short bio to get more matches',
    prompts: 'Add prompts to get more matches',
    about: 'Add a few details about you to get more matches',
    cta: 'Complete profile',
  },
}

export type AboutDictionary = typeof aboutEn
