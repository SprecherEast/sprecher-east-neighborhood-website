// What sign-up and forgot password tell a visitor (#551). Neither says whether an account uses
// the email (docs/guidelines/security.md).
export const ACCOUNTS_MESSAGES = {
  'accounts.signUp.sent':
    'Almost there! Check your email for a link to finish signing up. Nothing yet? Look in spam, or try again.',
  'accounts.forgotPassword.sent':
    'No worries, it happens! If that email has an account, a reset link is on its way. It works for {linkLifetime}. Nothing yet? Check your spam.',
} as const
