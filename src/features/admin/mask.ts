// "+60 •••• 4567": enough to tell accounts apart in lists without exposing the number.
export const maskPhone = (digits: string | null) =>
  digits ? `+${digits.slice(0, 2)} •••• ${digits.slice(-4)}` : 'нет телефона'
