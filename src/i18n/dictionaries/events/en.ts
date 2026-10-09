// Blind Dating Night: the countdown widget (Discover, blind date start screen), the live lobby and
// the two reminder pushes. Kept apart from en.ts so the main dictionary stays small.
export const eventsEn = {
  kicker: 'Blind Dating Night',
  // Countdown pieces: "in 3 h 12 min", "in 2 d 5 h", "in 12 min", "starting now".
  startsIn: 'Starts {time}',
  in: 'in {time}',
  days: '{n} d',
  hours: '{n} h',
  minutes: '{n} min',
  startingNow: 'starting now',
  liveNow: 'Live now',
  inRoom: '{count} people in the room',
  inRoomOne: '1 person in the room',
  inRoomNone: 'Be the first in the room',
  remind: 'Remind me',
  reminded: 'We will remind you 15 minutes before it starts.',
  enter: 'Enter',
  hide: 'Hide',
  // Live lobby
  youAreIn: 'You are in: {title}',
  relaxedFilters:
    'Tonight we pair by gender only, with a wide age range (about 10 years either side of yours). Interests are not filtered.',
  waitingHint: 'Hang on, the next person is on their way.',
  leave: 'Leave the night',
  nextSoon: 'Finding the next person...',
  endedTitle: 'The night is over',
  endedText: 'Thanks for coming. Blind dates are open every day.',
  endedButton: 'Back to blind dates',
  // Push
  pushSoonTitle: '{title} starts in 15 minutes',
  pushSoonBody: 'Get ready for a Blind Dating Night on Vibely.',
  pushLiveTitle: '{title} is live now',
  pushLiveBody: 'Enter the room and meet someone new.',
}

export const eventErrorsEn = {
  eventNotLive: 'This night is over. Blind dates are still open.',
}

export type EventsDictionary = typeof eventsEn
