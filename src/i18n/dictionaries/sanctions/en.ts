// Sanctions the user is told about: ban end date and appeal (/banned), warnings and mutes.
export const sanctionsEn = {
  bannedUntil: 'The block ends on {date}.',
  bannedForever: 'This block has no end date.',
  appealTitle: 'Appeal',
  appealHint:
    'If you think this is a mistake, tell us what happened. A moderator will review your appeal.',
  appealLabel: 'Your appeal',
  appealPlaceholder: 'Explain what happened (10 to 1000 characters)',
  appealSend: 'Send appeal',
  appealSent: 'Your appeal was sent. We will review it soon.',
  appealOpen: 'Your appeal from {date} is being reviewed.',
  appealRejected: 'Your last appeal was reviewed. The block stays in place.',
  warningTitle: 'Warning from moderators',
  warningBody:
    'Your account received a warning. Reason: {reason}. Repeated violations can lead to a mute or a block.',
  warningUntil: 'This warning stays active until {date}.',
  warningOk: 'I understand',
  mutedTitle: 'You can’t send messages for now',
  mutedBody:
    'Until {date} you can’t send chat messages, blind date messages, posts or comments. Reason: {reason}.',
  mutedOk: 'OK',
}

export const sanctionErrorsEn = {
  muted: 'You can’t send messages until your mute ends.',
  appealOpen: 'You already have an appeal under review.',
  appealTooShort: 'Please write at least 10 characters.',
  appealNotBanned: 'Your account is not blocked.',
}

export type SanctionsDictionary = typeof sanctionsEn
