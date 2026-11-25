// Direct fetching (README.md, "Fetching"; scout.md step 2): one plain GET with a clear user agent,
// a 30-second timeout and the saved ETag or Last-Modified. A 304 ends the source's run; a redirect
// is followed directly (at most 3 hops) unless it leads to a gate; a 5xx or 429 is retried once;
// any other 4xx is an error; a 401, 403, 451, login page, CAPTCHA, paywall or bot gateway is a
// gate. robots.txt is honored by choice. Playwright isn't built yet (#364): a source that would
// need it is skipped by scout before it gets here.

export const USER_AGENT =
  'SprecherEastIntelligence/1.0 (+https://sprechereast.com; neighborhood news digest for editors)'
export const TIMEOUT_MS = 30_000
const MAX_HOPS = 3
const MAX_RETRY_WAIT_MS = 30_000
export const MAX_BODY_BYTES = 10 * 1024 * 1024
const GATE_URL = /tollbit|captcha|challenge|\/login|\/signin|sign-in|paywall|subscribe/i
const GATE_STATUS = new Set([401, 403, 451])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A robots.txt path pattern (`*` anywhere, `$` at the end) as a regular expression. */
const robotsPattern = (rule) =>
  new RegExp(
    `^${rule
      .replace(/[.+?^{}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\\\$$/, '$')}`,
  )

/**
 * Whether robots.txt lets our user agent fetch `url`'s path: the group for `*` (no group names
 * us), its Allow and Disallow rules with `*` and `$`, the longest match winning, Allow on a tie.
 * `null` (robots.txt itself failed with a 5xx) disallows everything, as RFC 9309 says.
 */
export function robotsAllows(robotsText, url) {
  if (robotsText === null) return false
  const { pathname, search } = new URL(url)
  const target = `${pathname}${search}`
  const rules = []
  let groupAgents = []
  let inRules = false
  for (const raw of robotsText.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (field === 'user-agent') {
      if (inRules) groupAgents = []
      inRules = false
      groupAgents.push(value.toLowerCase())
    } else if (field === 'allow' || field === 'disallow') {
      inRules = true
      if (groupAgents.includes('*') && value) rules.push({ allow: field === 'allow', value })
    }
  }
  let best = null
  for (const rule of rules) {
    if (!robotsPattern(rule.value).test(target)) continue
    if (
      !best ||
      rule.value.length > best.value.length ||
      (rule.value.length === best.value.length && rule.allow)
    ) {
      best = rule
    }
  }
  return best ? best.allow : true
}

/** Retry-After in seconds or as an HTTP date, as a wait in milliseconds. */
export function retryWait(header, now = Date.now()) {
  if (!header) return 0
  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now
  return Number.isFinite(ms) ? Math.max(ms, 0) : 0
}

/**
 * Fetches one source URL. `http` is `fetch` or a test double with the same shape. Answers
 * `{ status, body, etag, lastModified, retries, error }`, status being `ok`, `not-modified`,
 * `blocked` or `error`. For a small API call, `timeoutMs` and `maxBytes` tighten the limits,
 * `retry: false` makes it one request with no second try, and `maxHops: 0` follows no redirect.
 */
export async function fetchDirect(
  url,
  {
    http = fetch,
    etag,
    lastModified,
    robots,
    timeoutMs = TIMEOUT_MS,
    maxBytes = MAX_BODY_BYTES,
    retry = true,
    maxHops = MAX_HOPS,
  } = {},
) {
  let current = url
  let retries = 0
  for (let hop = 0; hop <= maxHops; ) {
    // robots.txt is checked for every URL fetched, redirect targets included
    if (robots && !(await robots(current))) {
      return { status: 'blocked', retries, error: `robots.txt disallows ${current}` }
    }
    const headers = { 'user-agent': USER_AGENT, accept: '*/*' }
    if (etag) headers['if-none-match'] = etag
    if (lastModified) headers['if-modified-since'] = lastModified
    let response
    try {
      response = await http(current, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (retry && retries === 0) {
        retries = 1
        continue
      }
      return { status: 'error', retries, error: `no answer: ${error.message ?? error}` }
    }
    const code = response.status
    if (code === 304) return { status: 'not-modified', retries }
    if (code >= 300 && code < 400) {
      const location = response.headers.get('location')
      if (!location) return { status: 'error', retries, error: `${code} without a location` }
      const next = new URL(location, current).toString()
      if (GATE_URL.test(next))
        return { status: 'blocked', retries, error: `redirect to a gate: ${next}` }
      if (current.startsWith('https:') && !next.startsWith('https:')) {
        return { status: 'error', retries, error: `redirect from https to ${next}` }
      }
      current = next
      hop++
      continue
    }
    if (GATE_STATUS.has(code)) return { status: 'blocked', retries, error: `${code}` }
    if (code === 429 || code >= 500) {
      if (retry && retries === 0) {
        retries = 1
        // A server asking for a longer wait than a run can spend is left for the next run
        const wait = retryWait(response.headers.get('retry-after'))
        if (wait > MAX_RETRY_WAIT_MS) {
          return {
            status: 'error',
            retries,
            error: `${code}, asked to wait ${Math.round(wait / 1000)} s`,
          }
        }
        await sleep(wait)
        continue
      }
      return { status: 'error', retries, error: retry ? `${code} after one retry` : `${code}` }
    }
    if (code >= 400) return { status: 'error', retries, error: `${code}` }
    const declared = Number(response.headers.get('content-length'))
    if (declared > maxBytes)
      return { status: 'error', retries, error: `body over ${maxBytes} bytes` }
    let body
    try {
      body = await response.text()
    } catch (error) {
      // The connection dropped or timed out while the body came in: retried like no answer
      if (retry && retries === 0) {
        retries = 1
        continue
      }
      return { status: 'error', retries, error: `body not received: ${error.message ?? error}` }
    }
    if (body.length > maxBytes)
      return { status: 'error', retries, error: `body over ${maxBytes} bytes` }
    return {
      status: 'ok',
      retries,
      body,
      contentType: response.headers.get('content-type') ?? '',
      etag: response.headers.get('etag') ?? null,
      lastModified: response.headers.get('last-modified') ?? null,
    }
  }
  return { status: 'error', retries, error: `more than ${maxHops} redirects` }
}

/** A robots.txt check that fetches each host's file once per run. Unreachable means allowed. */
export function robotsChecker(http = fetch) {
  const cache = new Map()
  return async (url) => {
    const { origin } = new URL(url)
    if (!cache.has(origin)) {
      cache.set(
        origin,
        http(`${origin}/robots.txt`, {
          headers: { 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
          // A missing robots.txt allows everything; a server error disallows (RFC 9309)
          .then((r) => (r.ok ? r.text() : r.status >= 500 ? null : ''))
          .catch(() => ''),
      )
    }
    return robotsAllows(await cache.get(origin), url)
  }
}
