// Public landing page (/[lang]). Kept apart from en.ts so the main dictionary stays small.
export const landingEn = {
  metaTitle: 'Vibely: dating with real, verified people in Malaysia',
  metaDescription:
    'Swipes, an anonymous feed and random chats with mutual reveal. Every profile passes a selfie check by a human moderator. Malaysian numbers only.',
  ogTagline: 'Dating with real, verified people in Malaysia',
  signIn: 'Sign in',
  hero: {
    title: 'Dating with real, verified people in Malaysia',
    subtitle:
      'Every profile is checked by a human moderator with a live selfie. No bots, no catfish, no endless fakes.',
    cta: 'Get started',
    note: 'Free during beta · 18+ · Malaysian numbers only',
  },
  featuresTitle: 'Three ways to meet',
  features: {
    swipe: {
      title: 'Swipes',
      text: 'Browse people nearby, like the ones you vibe with and chat when it is mutual.',
    },
    feed: {
      title: 'Anonymous feed',
      text: 'Share thoughts and questions without your name. Nobody sees who wrote a post.',
    },
    random: {
      title: 'Random chat',
      text: 'Talk to a random verified person. Profiles are revealed only if you both agree.',
    },
  },
  safetyTitle: 'Why it is safe',
  safety: {
    selfie: {
      title: 'Selfie verification by humans',
      text: 'A moderator compares a live selfie with a gesture to your photos before you get in.',
    },
    phone: {
      title: 'Malaysian numbers only',
      text: 'Sign-up needs a Malaysian mobile number (+60), which keeps spam accounts out.',
    },
    report: {
      title: 'Report and block',
      text: 'Block anyone in one tap. Reports go to our moderators, who act on them quickly.',
    },
  },
  faqTitle: 'Questions',
  faq: [
    {
      q: 'Is Vibely free?',
      a: 'Yes. Everything is free while Vibely is in beta.',
    },
    {
      q: 'Who sees my location?',
      a: 'Nobody. Others only see a rough distance, like "5 km away", never your exact location.',
    },
    {
      q: 'Is the feed really anonymous?',
      a: 'Yes. Posts and comments show no name or photo. Other users cannot find out who wrote them; only moderators can, to deal with abuse.',
    },
  ],
  ctaTitle: 'Ready to meet someone real?',
  ctaButton: 'Sign up with your phone',
  footer: {
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    language: 'Language',
    tagline: 'Vibely · Made in Malaysia',
  },
}

export type LandingDictionary = typeof landingEn
