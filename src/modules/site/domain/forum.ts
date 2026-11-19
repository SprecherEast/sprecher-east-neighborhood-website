/*
 * The neighborhood forum (#485, epic #161): discussions happen on the neighborhood's Discourse
 * forum, not in comments on the site. Editors keep its address in the footer global; the footer
 * and each post page link to it, and both links are hidden when no address is set.
 */

/** The address the footer starts with, and the seed's (the owner confirmed it, 2026-10-27). */
export const FORUM_DEFAULT_URL = 'https://discourse.sprechereast.org'

/** The message Admin shows for an address the forum link can't use. */
export const FORUM_URL_PROBLEM =
  'Enter the forum’s full https address, such as https://forum.example.org.'

/** A host name: dot-separated labels of letters, digits and inner hyphens (IDNs arrive as `xn--`). */
const HOST_NAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/**
 * The forum address to link to, or `null` for none. It must be written as `https://host…`, with a
 * real host name, no user name or password (`https://forum@evil.example` goes to evil.example), and
 * no whitespace or control characters inside. The link uses the address as the browser reads it
 * (`url.href`), so what is checked is what is followed. Anything else, including old or imported
 * data, draws no link.
 */
export function toForumUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^https:\/\//i.test(trimmed) || /[\s\u0000-\u001f\u007f\u200b-\u200d\u2060]/.test(trimmed)) {
    return null
  }
  try {
    const url = new URL(trimmed)
    const plain = url.protocol === 'https:' && !url.username && !url.password
    return plain && HOST_NAME.test(url.hostname) ? url.href : null
  } catch {
    return null
  }
}

/** Trims the address before it's checked and stored, so spaces typed around it aren't kept. */
export function trimForumUrl(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value
}

/** The field's check on save: empty is allowed (no forum link), anything else must be https. */
export function validateForumUrl(value: unknown): true | string {
  if (value === null || value === undefined || value === '') return true
  return toForumUrl(value) === null ? FORUM_URL_PROBLEM : true
}
