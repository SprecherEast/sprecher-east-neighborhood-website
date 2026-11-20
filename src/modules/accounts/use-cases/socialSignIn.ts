import 'server-only'

import { getServerSideURL } from '@/platform/lib/getURL'
import { logServerFailure } from '@/platform/service'

import { authorizationUrl, finishAuthorization, newSocialFlow } from '../data/oauthProviders'
import { startSessionFor } from '../data/session'
import {
  createVerifiedAccount,
  findAccountByEmail,
  findAccountBySubject,
  saveSocialFlow,
  takeSocialFlow,
} from '../data/socialAccounts'
import { ACCOUNT_PATH, SIGN_IN_PATH } from '../domain/paths'
import { SIGN_UP_LIMITS, SOCIAL_SIGN_IN_LIMITS } from '../domain/requestLimits'
import {
  decideSocialSignIn,
  enabledProviders,
  providerKeys,
  SOCIAL_RESULT_PARAM,
  socialCallbackPath,
  type SocialProfile,
  type SocialProvider,
  type SocialSignInFailure,
} from '../domain/socialSignIn'
import { createRequestGuard, NO_ROBOT_CHECK } from './guardPublicRequest'

// Sign in with Google (#188, decision 0020). The routes in src/app/(frontend)/auth/
// call these two, and redirect wherever they answer.

const toLogin = (result: SocialSignInFailure) => `${SIGN_IN_PATH}?${SOCIAL_RESULT_PARAM}=${result}`

// A new account from a provider counts against the same limits as an email sign-up: each one
// stores an account. No robot check: the provider's own sign-in
// stands in for it.
const signInGuard = createRequestGuard('Provider sign-in', SOCIAL_SIGN_IN_LIMITS)
const newAccountGuard = createRequestGuard('Provider sign-up', SIGN_UP_LIMITS)

/** The providers whose keys are set: the log-in and sign-up pages show a button for each. */
export function getEnabledSocialProviders(): SocialProvider[] {
  return enabledProviders(process.env)
}

/**
 * Starts a sign-in: keeps its checks in this browser and answers where to send the person.
 * Answers `/login` with a fixed message when the provider is off or can't be reached.
 */
export async function startSocialSignIn(
  provider: SocialProvider,
  ip: string | null,
): Promise<string> {
  if (!providerKeys(provider, process.env)) return toLogin('failed')
  if (await signInGuard({ token: null, ip }, NO_ROBOT_CHECK)) return toLogin('too-many')
  try {
    const flow = newSocialFlow(provider)
    const url = await authorizationUrl(flow, redirectUri(provider))
    await saveSocialFlow(flow, new Date())
    return url.href
  } catch (error) {
    logServerFailure(`${provider} sign-in start`, error)
    return toLogin('failed')
  }
}

/**
 * Finishes a sign-in from the provider's answer (`search`: the callback's query string). Checks
 * it against the flow this browser started, then follows the sign-in rule
 * (`decideSocialSignIn`). Answers where to send the person: their account when they're signed in,
 * otherwise `/login` with a fixed message. A failure is logged as the error's class name only (it
 * comes from `openid-client` for a protocol failure), never Google's text, and never shown.
 */
export async function finishSocialSignIn(
  provider: SocialProvider,
  search: string,
  ip: string | null,
): Promise<string> {
  // Per connection only, before anything is read or sent to the provider
  if (await signInGuard({ token: null, ip }, NO_ROBOT_CHECK)) return toLogin('too-many')
  const now = new Date()
  const flow = await takeSocialFlow(now)
  // No flow, or one for another provider: this browser didn't start this sign-in
  if (!flow || flow.provider !== provider) return toLogin('failed')

  let profile: SocialProfile
  try {
    const callbackUrl = new URL(`${socialCallbackPath(provider)}${search}`, getServerSideURL())
    profile = await finishAuthorization(flow, callbackUrl)
  } catch (error) {
    // Includes the person pressing Cancel at the provider: an `error` answer fails the checks
    logServerFailure(`${provider} sign-in`, error)
    return toLogin('failed')
  }

  try {
    const bySubject = await findAccountBySubject(provider, profile.subject)
    const decision = decideSocialSignIn({
      profile,
      bySubject,
      // The email only matters for a person no Google id is linked to
      byEmail: !bySubject && profile.email ? await findAccountByEmail(profile.email) : null,
      now,
    })
    switch (decision.kind) {
      case 'sign-in':
        await startSessionFor(decision.accountId)
        return ACCOUNT_PATH
      case 'refuse':
        return toLogin(decision.failure)
      case 'create-verified':
        if (await newAccountGuard({ token: null, ip }, NO_ROBOT_CHECK)) return toLogin('too-many')
        await startSessionFor(await createVerifiedAccount(profile))
        return ACCOUNT_PATH
    }
  } catch (error) {
    logServerFailure(`${provider} sign-in account`, error)
    return toLogin('failed')
  }
}

const redirectUri = (provider: SocialProvider) =>
  new URL(socialCallbackPath(provider), getServerSideURL()).href
