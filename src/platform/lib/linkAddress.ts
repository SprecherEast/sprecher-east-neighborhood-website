/**
 * The one rule for an address a link may go to, shared by the editor's link fields, a chart's
 * sources and the Markdown tag: a site path or an http(s) address, nothing a browser could run
 * (`javascript:`) or send off the site while it looks like a path.
 *
 * A site path (`/events/…`) can't start with a second slash or hold a backslash anywhere:
 * browsers read `\` as `/`, so `/\host` and `//host` both leave the site (#513 review).
 */
const SITE_PATH = /^\/(?![/\\])[^\s\\]*$/
const WEB_ADDRESS = /^https?:\/\/[^\s\\]+$/i

export const isLinkAddress = (address: string): boolean =>
  SITE_PATH.test(address.trim()) || WEB_ADDRESS.test(address.trim())

/** What to tell someone whose address is refused */
export const LINK_ADDRESS_HINT =
  'Use a site path such as /events or a full address starting with http:// or https://'
