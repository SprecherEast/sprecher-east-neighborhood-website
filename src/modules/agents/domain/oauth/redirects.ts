/**
 * Where the browser goes back to the client: its redirect address with the answer in the query,
 * and `iss` (RFC 9207), so a client that talks to several servers knows which one answered.
 */
export function redirectBack(
  redirectUri: string,
  issuer: string,
  answer: Record<string, string | undefined>,
): string {
  const url = new URL(redirectUri)
  for (const [name, value] of Object.entries(answer)) {
    if (value !== undefined) url.searchParams.set(name, value)
  }
  url.searchParams.set('iss', issuer)
  return url.toString()
}

/** The same, for an error the client should hear about (only once its address is trusted). */
export const redirectError = (
  redirectUri: string,
  issuer: string,
  error: { code: string; description: string },
  state?: string,
): string =>
  redirectBack(redirectUri, issuer, {
    error: error.code,
    error_description: error.description,
    state,
  })
