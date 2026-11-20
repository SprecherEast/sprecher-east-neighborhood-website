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
  'accounts.passkey.added': 'Passkey added. Next time, choose Log in with a passkey.',
  'accounts.passkey.cancelled': 'No passkey was added. You can try again any time.',
  'accounts.passkey.failed': 'We couldn’t add that passkey. Please try again.',
  'accounts.passkey.signInAgain':
    'To keep your account safe, please log in again first. Then you can add a passkey.',
  'accounts.passkey.cap': 'You have as many passkeys as we can keep. Remove one to add another.',
  'accounts.passkey.alreadyHere': 'This device already has a passkey for your account.',
  // Logging in with one on /login (#1315). The verb is the log in page's own: "Log In", "Log in".
  'accounts.passkey.loginButton': 'Log in with a passkey',
  'accounts.passkey.loginFailed':
    'We couldn’t log you in with that passkey. Try again, or use your email and password.',
} as const
