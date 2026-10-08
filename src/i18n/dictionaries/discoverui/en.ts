// Discover, Likes and Profile UI labels (swipe stamps, sliders, carousel, photo manager).
// Kept apart from en.ts so parallel branches don't collide on the root dictionary.
export const discoverUiEn = {
  stampLike: 'LIKE',
  stampNope: 'NOPE',
  prevPhoto: 'Previous photo',
  nextPhoto: 'Next photo',
  photoOf: 'Photo {n} of {count}',
  ageLabel: 'Age',
  minAge: 'Minimum age',
  maxAge: 'Maximum age',
  maxDistance: 'Maximum distance',
  ageValue: '{age} years',
  kmValue: '{km} km',
  showAllTags: 'Show all ({count})',
  showFewerTags: 'Show fewer',
  photoOptions: 'Photo options',
  uploading: 'Uploading photo',
  matchHint: 'Say hi while the vibe is fresh.',
}

export type DiscoverUiDictionary = typeof discoverUiEn
