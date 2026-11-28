/**
 * Whether the browser says this request began on another site (`Sec-Fetch-Site: cross-site`): a
 * link, a redirect or a form from there. A page or route that must trust only visits from this
 * site ignores the session on such a request, by this one rule, whatever Payload's own check
 * accepts (from 3.94 it reads the cookie on a top-level visit from another site). A request
 * without the header isn't judged here; Payload still refuses its cookie when there's no `Origin`.
 */
export function isFromAnotherSite(headers: Pick<Headers, 'get'>): boolean {
  return headers.get('sec-fetch-site') === 'cross-site'
}
