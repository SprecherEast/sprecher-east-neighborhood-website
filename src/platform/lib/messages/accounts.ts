// What sign-up and forgot password tell a visitor (#551). Neither says whether an account uses
// the email (docs/guidelines/security.md).
export const ACCOUNTS_MESSAGES = {
  'accounts.signUp.sent':
    'Almost there! Check your email for a link to finish signing up. Nothing yet? Look in spam, or try again.',
  'accounts.forgotPassword.sent':
    'No worries, it happens! If that email has an account, a reset link is on its way. It works for {linkLifetime}. Nothing yet? Check your spam.',
  // The add-a-passkey card on /account (#1314)
  'accounts.passkey.lead':
    'Log in with your phone’s or computer’s screen lock instead of a password.',
  'accounts.passkey.added': 'Passkey added. Next time, choose {button}.',
  'accounts.passkey.cancelled': 'No passkey was added. You can try again any time.',
  'accounts.passkey.failed': 'We couldn’t add that passkey. Please try again.',
  'accounts.passkey.signInAgain':
    'To keep your account safe, please log in again first. Then you can add a passkey.',
  'accounts.passkey.cap': 'You have as many passkeys as we can keep. Remove one to add another.',
  'accounts.passkey.alreadyHere': 'This device already has a passkey for your account.',
  // Seeing and removing them on /account (#1316)
  'accounts.passkey.none': 'No passkeys yet.',
  'accounts.passkey.lostDevice':
    'Lost a device? Choose “Forgot your password?” on the log in page to get back in, then remove its passkey here.',
  'accounts.passkey.removeTitle': 'Remove this passkey?',
  'accounts.passkey.removeConfirm':
    'You can still log in another way, or choose “Forgot your password?”.',
  'accounts.passkey.removed': 'Passkey removed.',
  'accounts.passkey.removeFailed': 'We couldn’t remove that passkey. Please try again.',
  'accounts.passkey.removeSignInAgain':
    'To keep your account safe, please log in again first. Then you can remove a passkey.',
  // Logging in with one on /login (#1315). The verb is the log in page's own: "Log In", "Log in".
  'accounts.passkey.loginButton': 'Log in with a passkey',
  'accounts.passkey.loginFailed':
    'We couldn’t log you in with that passkey. Try again, or use your email and password.',
  // Connecting Google to an account with a password (#1338). The verb "Connect" is the card's own.
  'accounts.google.connectLead':
    'Connect Google to log in with it. This works right after you log in; if it’s been a while, we’ll ask you to log in again.',
  'accounts.google.connected':
    'Google is connected. You can log in with Google or with your password.',
  'accounts.google.passwordLead':
    'This email already has an account. Enter your password once to connect Google.',
  'accounts.google.passwordFailed':
    'We couldn’t connect Google. Please start again with “Continue with Google”.',
  'accounts.google.linked': 'Google is connected. Next time, log in with Google.',
  'accounts.google.taken':
    'That Google account is already connected to an account here. Choose another Google account, or log in with it.',
  'accounts.google.signInAgain':
    'To keep your account safe, please log in again first. Then you can connect Google.',
  'accounts.google.failed': 'We couldn’t connect Google. Please try again.',
} as const
