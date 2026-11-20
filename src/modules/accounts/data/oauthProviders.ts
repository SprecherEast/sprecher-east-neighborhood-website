import 'server-only'

import * as client from 'openid-client'

import type { SocialFlow } from '../domain/socialCookies'
import { providerKeys, type SocialProfile, type SocialProvider } from '../domain/socialSignIn'

// The protocol part of a sign-in with Google (#188, decision 0020), through `openid-client`: the
// authorization URL, then the callback's checks (`state`, PKCE, the `nonce` and the ID token) and
// the person's profile. Nothing here touches an account.

/** How long a call to a provider may take. */
const PROVIDER_TIMEOUT_S = 10

/**
 * What differs between OpenID Connect providers. Another provider is a new entry here and in
 * `domain/socialSignIn.ts`: the flow below is the same for all of them.
 */
type OidcProvider = {
  /** The issuer, whose discovery document lists the endpoints */
  issuer: string
  scope: string
  /** Extra authorization parameters */
  authorizationParams?: Record<string, string>
}

const OIDC_PROVIDERS: Record<SocialProvider, OidcProvider> = {
  google: {
    issuer: 'https://accounts.google.com',
    scope: 'openid email profile',
    // Let the person pick an account each time, rather than signing in silently
    authorizationParams: { prompt: 'select_account' },
  },
}

// A provider's settings come from its discovery document, fetched once per process. A failed
// fetch isn't kept, so the next sign-in tries again.
const configurations = new Map<SocialProvider, Promise<client.Configuration>>()

function configFor(provider: SocialProvider): Promise<client.Configuration> {
  const keys = providerKeys(provider, process.env)
  if (!keys) return Promise.reject(new Error(`${provider} sign-in is off`))
  const cached = configurations.get(provider)
  if (cached) return cached
  const pending = client
    .discovery(
      new URL(OIDC_PROVIDERS[provider].issuer),
      keys.clientId,
      keys.clientSecret,
      undefined,
      { timeout: PROVIDER_TIMEOUT_S },
    )
    .catch((error: unknown) => {
      configurations.delete(provider)
      throw error
    })
  configurations.set(provider, pending)
  return pending
}

/**
 * The values a new sign-in checks on its way back, kept in the flow cookie. `linkAccountId` is the
 * signed-in account a flow connects Google to (#1338), or null for a sign-in.
 */
export function newSocialFlow(
  provider: SocialProvider,
  linkAccountId: number | null = null,
): SocialFlow {
  return {
    provider,
    linkAccountId,
    state: client.randomState(),
    codeVerifier: client.randomPKCECodeVerifier(),
    nonce: client.randomNonce(),
  }
}

/** Where to send the person to sign in with the provider. */
export async function authorizationUrl(flow: SocialFlow, redirectUri: string): Promise<URL> {
  const config = await configFor(flow.provider)
  const { scope, authorizationParams } = OIDC_PROVIDERS[flow.provider]
  return client.buildAuthorizationUrl(config, {
    ...authorizationParams,
    redirect_uri: redirectUri,
    scope,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await client.calculatePKCECodeChallenge(flow.codeVerifier),
    code_challenge_method: 'S256',
  })
}

/**
 * Finishes the sign-in from the provider's answer at `callbackUrl` (this site's own address, with
 * the answer's query string): checks it against the flow, trades the code for tokens and reads
 * the profile from the ID token. Throws when any check fails or the provider doesn't answer.
 */
export async function finishAuthorization(
  flow: SocialFlow,
  callbackUrl: URL,
): Promise<SocialProfile> {
  const config = await configFor(flow.provider)
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    pkceCodeVerifier: flow.codeVerifier,
    idTokenExpected: true,
  })
  const claims = tokens.claims()
  if (!claims) throw new Error(`${flow.provider} sent no ID token`)
  return {
    provider: flow.provider,
    subject: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null,
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === 'string' ? claims.name : null,
  }
}
