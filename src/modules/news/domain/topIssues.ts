import type { ResolvedLink } from '@/platform/lib'
import { isHttpUrl } from '@/platform/lib/reviewQueue'

/*
 * "Top issues" (#484, epic #161): a short list editors keep on the home page of what matters to
 * the neighborhood right now, each item linking to a post, a page or a forum thread. Its block
 * config is in `cms/topIssuesBlock.ts`; the mapper `toTopIssuesBlockProps` builds these props.
 */

export const TOP_ISSUES_DEFAULT_HEADING = 'Top issues right now'

/** The bounds editors may set, shared by the block's fields and the mapper. */
export const TOP_ISSUES_LIMITS = {
  items: { min: 1, max: 5 },
  title: { maxLength: 80 },
  summary: { maxLength: 200 },
} as const

/** One issue: its title is the link's text, and the optional summary sits below it. */
export type TopIssue = {
  title: string
  summary: string | null
  link: Pick<ResolvedLink, 'href' | 'external'>
}

/** The block as it draws: at least one item, in the editor's order. */
export type TopIssuesBlockProps = {
  id?: string
  heading: string
  /** The day the editor last checked the list (day-only, midnight UTC), or `null` */
  reviewedAt: string | null
  items: TopIssue[]
}

/** A base no real address shares: a path that stays on it is a path on this site. */
const SITE_BASE = 'https://site.invalid'

/**
 * True for an address a top issue may link to: a full http(s) URL, or a path on this site. Other
 * schemes (`javascript:`, `data:`) and protocol-relative `//host` addresses are refused. The
 * address is checked as the browser reads it: it may hold no whitespace or control characters
 * (browsers drop tabs and line breaks, so `/\t/evil.com` would leave the site), and a path must
 * resolve on this site.
 */
export function isSafeHref(href: string): boolean {
  if (/[\s\u0000-\u001f\u007f]/.test(href)) return false
  if (href.startsWith('/')) {
    try {
      return new URL(href, SITE_BASE).origin === SITE_BASE
    } catch {
      return false
    }
  }
  return /^https?:\/\//i.test(href) && isHttpUrl(href)
}
