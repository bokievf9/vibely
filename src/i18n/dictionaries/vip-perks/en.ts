// VIP perks (20261009000290): read receipts, profile visitors, notes on likes. Kept apart from
// en.ts so the main dictionary stays small. No em or en dashes in the copy.
export const vipPerksEn = {
  vip: 'VIP',
  upsellCta: 'Get VIP',
  receipts: {
    setting: 'Send read receipts',
    hint: 'When this is off, nobody sees when you read their messages, and you do not see when they read yours.',
    vipHint: 'VIP shows you when your messages are read.',
  },
  visitors: {
    title: 'Who viewed you',
    entry: 'Who viewed your profile',
    entryHint: 'Last 30 days',
    countOne: '1 person viewed your profile in the last 30 days',
    countMany: '{count} people viewed your profile in the last 30 days',
    empty: 'No visits yet',
    emptyHint: 'When someone opens your profile, they show up here for 30 days.',
    lockedTitle: 'See who viewed your profile',
    lockedText:
      'VIP shows everyone who opened your profile in the last 30 days, so you can like them back.',
    viewedToday: 'Viewed today',
    viewedYesterday: 'Viewed yesterday',
    viewedDaysAgo: 'Viewed {days} days ago',
    liked: 'You liked them',
    incognitoHint: 'Your own visits are recorded too. Incognito mode keeps them private.',
  },
  note: {
    button: 'Like with a note',
    title: 'Like with a note',
    intro: 'Say hi before you match. Your note arrives together with your like.',
    placeholder: 'Write something kind and specific',
    counter: '{count}/200',
    quota: 'One note a day',
    riskHint: 'Notes with phone numbers, links, other apps or money talk are held and not shown.',
    send: 'Send like',
    sentTitle: 'Like sent with your note',
    sentHint: 'If they like you back, your note opens the chat.',
    heldHint: 'Your like was sent. The note is being checked and will not be shown for now.',
    yours: 'Your note',
    from: 'Note from {name}',
    report: 'Report note',
    reportNote: 'Moderators will see this note. It disappears from your likes right away.',
    upsellTitle: 'Message before you match',
    upsellText: 'With VIP you can send one note a day together with your like.',
  },
}

export const vipPerksErrorsEn = {
  perkRequired: 'This is a VIP feature.',
  noteLimitReached: 'You have used today’s note. Try again tomorrow.',
  noteAlreadySent: 'You have already sent this person a note.',
  noteUnavailable: 'You can no longer send a note to this person.',
  noteTooLong: 'At most 200 characters',
}

export type VipPerksDictionary = typeof vipPerksEn
