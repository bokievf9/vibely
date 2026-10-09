// Secret crush: the invite option, the invitee's one-time card and the inviter's push.
// Kept apart from en.ts so the main dictionary stays small.
export const crushEn = {
  inviteOption: 'I have a crush on this person',
  inviteOptionHint:
    'They get a private one-time link. Once they join and are verified, they see that you have a crush on them and can answer yes or no. You only hear about it if they say yes.',
  inviteLimit: 'Up to 3 crush links every 30 days. Each link works once.',
  inviteLimitReached: 'You have used your 3 crush links for this month.',
  inviteFailed: 'Could not create the link. Try again.',
  shareCrush: 'Share crush link',
  crushMessage:
    'Join me on Vibely: verified people only, made for Malaysia. This link is just for you.',
  cardTitle: 'Someone has a crush on you',
  cardText: '{name}, who invited you to Vibely, has a crush on you. Do you feel the same?',
  cardPrivate: 'Your answer stays private. They only find out if you say yes.',
  cardIncompatibleText: '{name}, who invited you to Vibely, has a crush on you.',
  cardIncompatibleHint:
    'You are each looking for different people, so this is just a nice thing to know. Nobody is told what you think.',
  yes: 'Yes, I feel the same',
  no: 'No, not for me',
  gotIt: 'Got it',
  pushTitle: 'Your crush likes you back! 💘',
  pushBody: '{name} said yes. Say hi!',
}

export type CrushDictionary = typeof crushEn
