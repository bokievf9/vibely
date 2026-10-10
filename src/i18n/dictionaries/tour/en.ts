// Guided tour, welcome card and one-time feature tips. Kept apart from en.ts so the main
// dictionary stays small. No em or en dashes (tests/unit/tour.test.mjs).
export const tourEn = {
  welcome: {
    title: 'Welcome to Vibely, {name}',
    text: 'Everyone you meet here passed the same selfie check you did. Want a quick look around? It takes about a minute.',
    start: 'Show me around',
    skip: 'Skip',
  },
  label: 'App tour',
  stepOf: '{n} of {total}',
  live: 'Step {n} of {total}. {title}. {text}',
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  skipLabel: 'Skip the tour',
  done: 'Start exploring',
  steps: {
    deck: {
      title: 'Swipe to say hi',
      text: 'Swipe right or tap the heart to like, left to pass. Like each other and it’s a match.',
    },
    filters: {
      title: 'Your filters',
      text: 'Choose the age, distance and people you want to see.',
    },
    statuses: {
      title: 'Live statuses',
      text: 'Share your vibe in a few words. People nearby see it for 3 hours and can reply.',
    },
    event: {
      title: 'Blind Dating Night',
      text: 'Everyone goes on blind dates at the same time. Turn on the reminder so you don’t miss it.',
    },
    crossed: {
      title: 'Crossed paths',
      text: 'People you were near today. Only you see this list, and you can hide anyone.',
    },
    mode: {
      title: 'Solo or Duo',
      text: 'Switch to Duo to team up with a friend and meet other pairs.',
    },
    people: {
      title: 'Likes and search',
      text: 'The heart shows who already liked you. Search finds anyone by @username.',
    },
    blind: {
      title: 'Blind date',
      text: 'Chat first with no photos or names. If you both tap Connect, you see each other.',
    },
    feed: {
      title: 'Anonymous feed',
      text: 'Post here, anonymously if you like. Like a post, or reply in private to start a chat.',
      textLocked:
        'Read what people share, often anonymously. Like a post, or reply in private to start a chat. Posting comes with Plus.',
    },
    chats: {
      title: 'Chats',
      text: 'Your matches and messages live here. In any chat, tap ⋮ to report or block someone.',
    },
    profile: {
      title: 'Your profile',
      text: 'The blue tick means you passed the selfie check. Tap Edit profile to add photos and more about you.',
    },
    settings: {
      title: 'Privacy and safety',
      text: 'Go incognito, pause your profile or manage the people you blocked.',
    },
    plans: {
      title: 'Free, Plus and VIP',
      text: 'See what Plus and VIP add, side by side. The basics stay free.',
    },
  },
  settings: {
    section: 'Help',
    replay: 'Replay the tour',
    replayHint: 'A one-minute look at what Vibely can do',
  },
  tip: {
    label: 'Tip',
    gotIt: 'Got it',
    statuses: {
      title: 'Share your vibe',
      text: 'Tap your bubble, pick an emoji and add a few words. It disappears after 3 hours.',
    },
    crossed_paths: {
      title: 'You crossed paths',
      text: 'These people were near you today. Tap one to see their profile, or hide them.',
    },
    event: {
      title: 'Blind Dating Night',
      text: 'Turn on the reminder and we’ll let you know when it starts.',
    },
    duo: {
      title: 'Duo mode',
      text: 'You and a friend like other duos together. A mutual like opens one group chat for all four of you.',
    },
    visitors: {
      title: 'Who viewed you',
      text: 'People who opened your profile show up here for 30 days. Like them back if you’re curious.',
    },
    crush: {
      title: 'Got a crush?',
      text: 'Turn on the crush option before you share. They answer in private, and you only hear back if it’s a yes.',
    },
    matchmaker: {
      title: 'Play matchmaker',
      text: 'Know someone who’d click with this person? Tap ⋮ and pick Introduce to a friend.',
    },
  },
}

export type TourDictionary = typeof tourEn
