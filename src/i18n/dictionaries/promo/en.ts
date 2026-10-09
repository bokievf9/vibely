// Promo codes and VIP perks (20261009000230): the onboarding field, the Settings row and sheet,
// the success sheet and the VIP badge. Kept apart from en.ts so the main dictionary stays small.
export const promoEn = {
  // Settings row
  section: 'Promo code',
  row: 'Enter a promo code',
  rowHint: 'Codes from events, campus groups and partners unlock Plus or VIP.',
  vipUntil: 'VIP until {date}',
  boostUntil: 'Shown first in Discover until {date}',
  pendingHint: 'Your perks switch on as soon as your selfie is approved.',
  // Onboarding
  haveCode: 'Have a promo code?',
  optional: 'Optional',
  // Sheet
  title: 'Promo code',
  label: 'Code',
  placeholder: 'e.g. XMUM2026',
  intro: 'Enter the code exactly as you received it. Letters are not case sensitive.',
  apply: 'Apply',
  grantedTitle: 'Code applied',
  pendingTitle: 'Code accepted',
  pendingBody:
    'Your code {code} is reserved for you. The perks switch on as soon as your selfie is approved.',
  grantedBody: 'Code {code} applied. Here is what you get:',
  perkPlanDate: '{plan} until {date}',
  perkPlanDays: '{plan} for {days} days',
  perkBoostDate: 'Your profile is shown first in Discover until {date}',
  perkBoostHours: 'Your profile is shown first in Discover for {hours} hours',
  nonTransferable: 'Perks are personal and cannot be transferred. See the Terms of Use.',
  done: 'Done',
  // Badge
  badge: 'VIP',
}

export const promoErrorsEn = {
  promoInvalid: 'This code does not exist. Check the spelling.',
  promoExpired: 'This code has expired.',
  promoUsedUp: 'This code has already been used up.',
  promoNotForYou: 'This code is not available for your profile.',
  promoAlreadyRedeemed: 'You have already used this code.',
  promoTooManyAttempts: 'Too many attempts. Try again in an hour.',
  promoFormat: 'Letters, digits, _ and - only (3 to 32 characters).',
}
