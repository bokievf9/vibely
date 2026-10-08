// Strings added by the flows UI pass (feed, blind date, sign-up, verification).
// Kept apart from en.ts so the main dictionary stays small.
export const flowsEn = {
  step: 'Step {n} of {total}',
  otp: {
    changeNumber: 'Change number',
  },
  selfie: {
    fitFace: 'Fit your face inside the oval',
  },
  random: {
    minAge: 'Minimum age',
    maxAge: 'Maximum age',
  },
  feed: {
    loadingMore: 'Loading more posts',
    writeFirst: 'Write a post',
    end: 'You are all caught up',
  },
}

export type FlowsDictionary = typeof flowsEn
