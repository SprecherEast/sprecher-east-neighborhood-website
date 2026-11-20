// Server-only entry: who is signed in and what they may open, and the components pages and the
// layout render.
import 'server-only'

export { getCurrentUser } from './data/session'
export { arePasskeysOn } from './use-cases/addPasskey'
export { getGoogleConnection, hasPendingGoogleLink } from './use-cases/connectGoogle'
export { getVerificationLinkStatus } from './use-cases/getVerificationLinkStatus'
export { requireRole, requireUser } from './use-cases/requireUser'
export {
  finishSocialSignIn,
  getEnabledSocialProviders,
  startSocialSignIn,
} from './use-cases/socialSignIn'

export { AccountMenu } from './ui/AccountMenu.client'
export { AccountOffer } from './ui/AccountOffer.client'
export { AccountProvider } from './ui/AccountProvider.client'
export { AddPasskey } from './ui/AddPasskeyLoader.client'
export { ConnectGoogle } from './ui/ConnectGoogle'
export { ConnectGoogleClosed } from './ui/ConnectGoogleClosed'
export { ConnectGoogleForm } from './ui/ConnectGoogleForm.client'
export { ChangePasswordForm } from './ui/ChangePasswordForm.client'
export { continuePage } from './ui/continuePage'
export { ForgotPasswordForm } from './ui/ForgotPasswordForm.client'
export { ResetPasswordForm } from './ui/ResetPasswordForm.client'
export { SignInForm } from './ui/SignInForm.client'
export { SignUpForm } from './ui/SignUpForm.client'
export { SocialSignIn } from './ui/SocialSignIn'
export { VerifyAccount } from './ui/VerifyAccount.client'
