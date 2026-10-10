// Public landing page (/[lang]). Kept apart from en.ts so the main dictionary stays small.
// Copy rules (tests/unit/landing.test.mjs): no em or en dashes, one CTA label per intent,
// hero subtitle 20 words at most, 6 to 8 FAQ entries.
export const landingEn = {
  metaTitle: 'Vibely: dating in Malaysia with selfie-checked profiles',
  metaDescription:
    'Meet real people near you in Malaysia. Our team checks every selfie. Blind Dating, Discover, Duo and an anonymous feed. Join early access.',
  ogTagline: 'Meet real people, close to home',
  header: {
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
  },
  // One label per intent: every primary button on the page uses the same one.
  cta: {
    waitlist: 'Join early access',
    open: 'Join Vibely',
  },
  hero: {
    title: 'Meet real people, close to home',
    subtitle:
      'Vibely is dating for Malaysia. Someone on our team checks every selfie before a profile goes live.',
    videoLabel: 'Short preview of the Vibely app: Discover, a blind date, a match and a chat',
    posterAlt: 'The Discover screen of the Vibely app',
  },
  trust: {
    label: 'Vibely in three facts',
    selfie: 'Every selfie checked by a person',
    phone: 'Malaysian mobile numbers only',
    adults: 'Adults only, 18+',
  },
  ways: {
    title: 'Five ways to meet',
    blind: {
      title: 'Blind Dating',
      text: 'Chat first, with no photos or names. You see each other only when you both press Connect.',
      alt: 'A blind date chat: two people talk as Partner #631 with Connect and Pass buttons',
    },
    discover: {
      title: 'Discover',
      text: 'Browse verified people near you. Like someone, and if they like you back, you can chat.',
      alt: 'A profile card in Discover with interests and distance',
    },
    feed: {
      title: 'Anonymous feed',
      text: 'Post under a random nickname or as yourself. Nobody can see who wrote an anonymous post.',
      alt: 'The feed with the question of the day and an anonymous post',
    },
    duo: {
      title: 'Duo',
      text: 'Team up with a friend and meet another pair. A mutual like opens one chat for all four of you.',
      alt: 'A duo profile of two friends with a shared bio',
    },
    statuses: {
      title: 'Live statuses',
      text: 'Say what you are up to, like “Teh tarik at Bangsar later?”. People nearby see it for 3 hours.',
      alt: 'A live status that reads “Teh tarik at Bangsar later?”',
    },
  },
  story: {
    title: 'How Blind Dating works',
    steps: [
      {
        title: 'Talk before you see',
        text: 'Vibely pairs you with a verified person whose preferences fit yours. You both show up as an alias, with no photos.',
        alt: 'A blind date chat with no photos',
      },
      {
        title: 'Connect or pass',
        text: 'Like the vibe? Press Connect. Not feeling it? Press Pass, and the chat ends quietly for both of you.',
        alt: 'The match screen after both people pressed Connect',
      },
      {
        title: 'Meet properly',
        text: 'When you both press Connect, your profiles appear, it is a match, and your conversation moves to Chats.',
        alt: 'A chat between two matched people',
      },
    ],
  },
  safety: {
    title: 'How we keep it safe',
    intro: 'The short, honest version. The details are in our',
    introLink: 'Privacy Policy',
    imageAlt: 'Chat options: introduce to a friend, unmatch, report, report a call and block',
    selfie: {
      title: 'A person checks every selfie',
      text: 'You take a live selfie with a gesture and a moderator compares it with your photos. Other users never see it.',
    },
    reports: {
      title: 'Reports go to real moderators',
      text: 'Block anyone in one tap. A moderator reviews every report, and the person never learns who reported them.',
    },
    incognito: {
      title: 'Incognito when you want it',
      text: 'With Plus, only people you have liked can see you in Discover.',
    },
    recorded: {
      title: 'Chats and calls are recorded',
      text: 'We keep messages, media and call recordings for up to 90 days, then delete them. Every call shows “This call is recorded”. Moderators open recordings only for a report, and we log each access.',
    },
  },
  event: {
    kicker: 'Blind Dating Night',
    live: 'Live now',
    when: '{date}, {time}',
    timeZone: 'Malaysia time',
    text: 'One evening when everyone is online at once. You meet one person after another, blind.',
  },
  plans: {
    title: 'Free, Plus and VIP',
    intro: 'Free covers dating on Vibely. Plus and VIP add extras on top.',
    caption: 'What each plan includes',
    feature: 'Feature',
    free: 'Free',
    plus: 'Plus',
    vip: 'VIP',
    rows: {
      likes: 'Likes in Discover',
      blindDates: 'New blind dates',
      whoLiked: 'See who liked you',
      media: 'Photos, voice and video in chat',
      feedPost: 'Post and comment in the feed',
      boost: 'Profile boost',
      calls: 'Start audio and video calls',
    },
    perDay: '{n} a day',
    perWeek: '{n} a week',
    perMonth: '{n} a month',
    unlimited: 'Unlimited',
    included: 'Included',
    notIncluded: 'Not included',
    footnote:
      'Discover, Blind Dating, Duo, live statuses and reading the feed are open to everyone. There are no prices yet: for now, Plus and VIP come from promo codes and rewards.',
  },
  faqTitle: 'Questions people ask',
  faq: [
    {
      q: 'When can I start using Vibely?',
      a: 'We are opening in stages. Join early access with your Malaysian mobile number and we will text you when your invite is ready.',
    },
    {
      q: 'Is Vibely free?',
      a: 'Yes. Discover, Blind Dating, chat and Duo are free. Plus and VIP add extras, such as unlimited likes and seeing who liked you. We have not set prices yet.',
    },
    {
      q: 'Who checks my selfie?',
      a: 'A moderator on our team compares your live selfie, taken with a gesture, with your profile photos. Other users never see it, and we delete the selfie after 90 days.',
    },
    {
      q: 'Are my chats and calls recorded?',
      a: 'Yes, for safety. We keep messages, photos, voice and video messages and call recordings for up to 90 days, then delete them. You see “This call is recorded” during every call. Moderators open them only while handling a report, and every access is logged.',
    },
    {
      q: 'Why only Malaysian numbers?',
      a: 'Vibely is built for people in Malaysia. Asking for a local mobile number (+60) keeps out most bots and overseas scammers.',
    },
    {
      q: 'Can people see where I live?',
      a: 'No. Other people see a rounded distance, such as “2 km away”, never your exact location.',
    },
    {
      q: 'Is the feed anonymous?',
      a: 'Posts are anonymous unless you choose to post as yourself. An anonymous post shows a random nickname, and other users cannot find out who wrote it. Moderators can, to deal with abuse.',
    },
  ],
  final: {
    title: 'Be one of the first in your city',
    text: 'Leave your number now. We will text you when your invite is ready.',
    textOpen: 'Sign up with your Malaysian mobile number. It takes about a minute.',
    note: 'Free to join. 18+ only. Malaysian mobile numbers.',
  },
  waitlist: {
    title: 'Join early access',
    text: 'We are opening Vibely city by city. Leave your number and we will send you one SMS when it is your turn.',
    phoneLabel: 'Mobile number',
    phoneHint: 'Malaysian mobile numbers only. One SMS with your invite, no marketing.',
    phonePlaceholder: '12-345 6789',
    cityLabel: 'City (optional)',
    cityPlaceholder: 'Choose your city',
    cities: {
      'kuala-lumpur': 'Kuala Lumpur',
      selangor: 'Selangor',
      penang: 'Penang',
      'johor-bahru': 'Johor Bahru',
      ipoh: 'Ipoh',
      melaka: 'Melaka',
      seremban: 'Seremban',
      'kota-kinabalu': 'Kota Kinabalu',
      kuching: 'Kuching',
      kuantan: 'Kuantan',
      other: 'Somewhere else',
    },
    consentBefore: 'I agree that Vibely keeps my number to send me an invite, as described in the ',
    consentLink: 'Privacy Policy',
    consentAfter: '.',
    sending: 'Sending',
    successTitle: 'You are on the list',
    successText: 'We will text {phone} when your invite is ready.',
    done: 'Done',
    errors: {
      phoneInvalid: 'Check the number. It should look like 12-345 6789.',
      phoneNotMalaysia: 'Vibely is for Malaysian numbers (+60) only.',
      phoneNotMobile: 'Use a mobile number. We send the invite by SMS.',
      cityInvalid: 'Choose a city from the list.',
      consentRequired: 'Tick the box so we can keep your number.',
      captchaFailed: 'The security check did not pass. Try again.',
      rateLimited: 'Too many tries. Wait a minute and try again.',
      unavailable: 'Early access sign-up is not open yet. Please try again later.',
      generic: 'Something went wrong. Try again in a moment.',
    },
  },
  footer: {
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    language: 'Language',
    tagline: 'Vibely · Made in Malaysia',
  },
}

export type LandingDictionary = typeof landingEn
