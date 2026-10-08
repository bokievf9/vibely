// Username + password sign-in and the "Sign-in password" settings. Kept apart from en.ts so the
// main dictionary stays small.
export const passwordEn = {
  // Login screen
  methods: 'Sign-in method',
  tabPhone: 'Phone',
  tabUsername: 'Username',
  usernameLabel: 'Username',
  usernamePlaceholder: '@username',
  passwordLabel: 'Password',
  show: 'Show password',
  hide: 'Hide password',
  signIn: 'Sign in',
  usernameNote: 'New to Vibely? Create your account with your phone number first.',
  forgot: 'Forgot password?',
  forgotTitle: 'Forgot your password?',
  forgotBody:
    'Sign in with your phone number and the SMS code. Then open Settings, Sign-in password, and set a new password.',
  forgotAction: 'Sign in with phone',
  // Settings
  section: 'Sign-in password',
  statusOn: 'Password is on',
  statusOff: 'No password',
  hintOn: 'You can sign in with @{username} and your password, or with an SMS code.',
  hintOff:
    'Add a password to sign in with @{username} without waiting for an SMS. The SMS code always works too.',
  set: 'Set password',
  change: 'Change',
  remove: 'Remove password',
  setTitle: 'Set a password',
  changeTitle: 'Change password',
  verifyIntro:
    'To keep your account safe, confirm it is you first. We will send an SMS code to {phone}.',
  sendCode: 'Send code',
  codeLabel: 'SMS code',
  codeHint: 'Enter the 6-digit code we sent to {phone}.',
  verify: 'Confirm',
  resend: 'Send a new code',
  newLabel: 'New password',
  repeatLabel: 'Repeat the password',
  rules:
    'At least 10 characters. Do not use your username or phone number. A few unrelated words work well.',
  strength: 'Strength: {level}',
  levels: ['very weak', 'weak', 'fair', 'good', 'strong'],
  save: 'Save password',
  saved: 'Password saved. Your other devices were signed out.',
  removeTitle: 'Remove password?',
  removeBody:
    'You will only be able to sign in with an SMS code. Your other devices will be signed out.',
  removeConfirm: 'Remove',
  removed: 'Password removed',
}

export const passwordErrorsEn = {
  passwordTooShort: 'Use at least 10 characters',
  passwordTooLong: 'This password is too long',
  passwordPersonal: 'Do not use your username or phone number in the password',
  passwordWeak: 'This password is easy to guess. Add more words or characters',
  passwordMismatch: 'The passwords do not match',
  passwordPwned: 'This password has appeared in a data leak. Choose another one',
  passwordSame: 'This is already your password',
  passwordReauth: 'Please confirm with an SMS code first',
  loginFailed: 'Wrong username or password',
  loginLocked: 'Too many attempts. Try again in 15 minutes or sign in with your phone',
}

export type PasswordDictionary = typeof passwordEn
