// Sign in with Google (#188, decision 0020): the providers, when each is on, and the
// rule for what a provider's answer may do to an account. Pure: no Payload, no Next.js.

/**
 * The providers the site can sign in with: OpenID Connect providers, so another one is a new entry
 * here and in `data/oauthProviders.ts`. Only Google is on (#312).
 */
export const SOCIAL_PROVIDERS = ['google'] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/** Set in the context of every create from a provider: the users collection then forces the
 * guest role (`guestOnlyFromProviders`). */
export const SOCIAL_SIGN_IN_CONTEXT = 'socialSignIn'

/** The provider's name as residents read it on the buttons. */
export const SOCIAL_PROVIDER_NAMES: Record<SocialProvider, string> = {
  google: 'Google',
}

/** The account field that holds each provider's subject: the identity, never the email. */
export const SOCIAL_SUBJECT_FIELDS = {
  google: 'googleSub',
} as const satisfies Record<SocialProvider, string>

/** The `.env.local` keys each provider needs. A provider is on only when both are set. */
const PROVIDER_KEYS: Record<SocialProvider, { id: string; secret: string }> = {
  google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
}

/** A provider's app keys, read from the environment. */
export type ProviderKeys = { clientId: string; clientSecret: string }

/** The keys of one provider, or null when it's off (either key missing or blank). */
export function providerKeys(
  provider: SocialProvider,
  env: Record<string, string | undefined>,
): ProviderKeys | null {
  const names = PROVIDER_KEYS[provider]
  const clientId = env[names.id]?.trim()
  const clientSecret = env[names.secret]?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** The providers that are on, in the order the buttons show them. */
export function enabledProviders(env: Record<string, string | undefined>): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((provider) => providerKeys(provider, env) !== null)
}

/** A provider named in a URL, or null when it isn't one the site knows. */
export function parseSocialProvider(value: unknown): SocialProvider | null {
  return SOCIAL_PROVIDERS.find((provider) => provider === value) ?? null
}

/** The query parameter `/login` reads to show how a provider sign-in ended. */
export const SOCIAL_RESULT_PARAM = 'social'

/** Where a provider sends the person back, on this site's own address. */
export const socialCallbackPath = (provider: SocialProvider) => `/auth/${provider}/callback`

/** Where a sign-in with a provider starts. */
export const socialStartPath = (provider: SocialProvider) => `/auth/${provider}`

/** What a provider said about the person, once its answer was checked. */
export type SocialProfile = {
  provider: SocialProvider
  subject: string
  /** Lowercase, or null when the provider gave none */
  email: string | null
  /** Whether the provider says it confirmed the email */
  emailVerified: boolean
  name: string | null
}

/** An account the rule may act on, as much of it as the rule needs. */
export type SocialAccount = {
  id: number
  role: string
  verified: boolean
  lockedUntil: Date | null
}

/**
 * Why a sign-in with a provider didn't open an account. Fixed codes only: the page shows a fixed
 * message for each, never the provider's error.
 */
export type SocialSignInFailure = 'failed' | 'no-email' | 'unavailable' | 'too-many'

/** What to do with a provider's answer. */
export type SocialDecision =
  /** A returning person, found by the provider's subject */
  | { kind: 'sign-in'; accountId: number }
  /** A verified email no account uses: a new guest account, already verified */
  | { kind: 'create-verified' }
  /**
   * A Google-verified email an account already uses: Google alone signs in to nothing, so the
   * person is asked for that account's password once (#1338, decision 0020). Whatever state the
   * account is in, the password step is the only place that says no, with one fixed failure.
   */
  | { kind: 'ask-password' }
  | { kind: 'refuse'; failure: SocialSignInFailure }

/** Roles a provider may sign in to. An agent's only credential is its MCP key (#336). */
const SIGN_IN_ROLES = new Set(['admin', 'editor', 'guest', 'resident'])

/**
 * Whether an account may be signed in to at all, by any way but its password: not locked (#140),
 * verified, and not an agent. Passkey sign-in (decision 0021) asks the same.
 */
export function canSignInTo(account: SocialAccount, now: Date): boolean {
  const locked = account.lockedUntil !== null && account.lockedUntil > now
  return !locked && account.verified && SIGN_IN_ROLES.has(account.role)
}

/**
 * The rule for a provider's answer (decision 0020):
 * - The identity is the provider plus its subject. A returning person is found by it, and
 *   nothing on the account changes.
 * - An account is never linked by its email alone: an email an account already uses leads to the
 *   password step (`ask-password`), and nothing is linked or signed in until that password
 *   checks out. An email the provider didn't verify is refused.
 * - A locked account, an unverified one, or an agent can't be signed in to.
 */
export function decideSocialSignIn({
  profile,
  bySubject,
  byEmail,
  now,
}: {
  profile: SocialProfile
  bySubject: SocialAccount | null
  byEmail: SocialAccount | null
  now: Date
}): SocialDecision {
  if (bySubject) {
    return canSignInTo(bySubject, now)
      ? { kind: 'sign-in', accountId: bySubject.id }
      : { kind: 'refuse', failure: 'unavailable' }
  }
  if (!profile.email) return { kind: 'refuse', failure: 'no-email' }

  if (!profile.emailVerified) return { kind: 'refuse', failure: 'failed' }
  return byEmail ? { kind: 'ask-password' } : { kind: 'create-verified' }
}

/** A name a provider gave, trimmed and kept to the length a form allows, or null. */
export function toAccountName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  return trimmed ? trimmed.slice(0, 100) : null
}
