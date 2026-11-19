import type { ResolvedLink } from '@/platform/lib'
import { isLinkAddress, LINK_ADDRESS_HINT } from '@/platform/lib/linkAddress'

/**
 * The one optional "read more" link an editorial block item may carry (a label and an address).
 * Not the shared `link()` field: every field in that group is required, and a document reference
 * inside rich text isn't populated, so a plain address is the reliable choice here.
 */

/** The longest address an editor can save, the common URL limit. */
export const EDITORIAL_LINK_MAX_LENGTH = 2048

export function isEditorialLinkUrl(value: string): boolean {
  return value.trim().length <= EDITORIAL_LINK_MAX_LENGTH && isLinkAddress(value)
}

/** Payload field validation: both parts or neither, and an address the site can link to. */
export function validateEditorialLink(
  url: string | null | undefined,
  label: string | null | undefined,
): true | string {
  const hasUrl = Boolean(url?.trim())
  const hasLabel = Boolean(label?.trim())
  if (!hasUrl && !hasLabel) return true
  if (!hasUrl) return 'Add the address the link goes to, or clear the link text.'
  if (!hasLabel) return 'Add the link text readers see, or clear the address.'
  return isEditorialLinkUrl(url as string) ? true : LINK_ADDRESS_HINT
}

/** The link as `Link` takes it, or null when there is none or it isn't valid. */
export function toEditorialLink(
  url: string | null | undefined,
  label: string | null | undefined,
): ResolvedLink | null {
  const href = url?.trim() ?? ''
  const text = label?.trim() ?? ''
  if (!href || !text || !isEditorialLinkUrl(href)) return null
  return { href, label: text, external: !href.startsWith('/'), appearance: 'default' }
}
