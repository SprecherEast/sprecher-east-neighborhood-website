import type { ResolvedLink } from '@/platform/lib'

import { documentHref } from './documentHref'

/**
 * The CMS link field (`./link.ts`) as plain data for `Button` and `Link`: the one place
 * that turns a reference or a custom URL into an `href`. Typed structurally, so any collection's
 * populated document works and an unpopulated ID resolves to nothing.
 */
export type CmsLink = {
  type?: 'reference' | 'custom' | null
  url?: string | null
  label?: string | null
  newTab?: boolean | null
  appearance?: 'default' | 'outline' | 'accent' | null
  reference?: {
    relationTo: string
    value: number | string | { slug?: string | null }
  } | null
}

export function resolveLink(link: CmsLink | null | undefined): ResolvedLink | null {
  if (!link) return null

  const href = link.type === 'reference' ? referenceHref(link.reference) : link.url
  if (!href) return null

  return {
    href,
    label: link.label ?? '',
    external: Boolean(link.newTab),
    appearance:
      link.appearance === 'outline' || link.appearance === 'accent' ? link.appearance : 'default',
  }
}

function referenceHref(reference: CmsLink['reference']): string | null {
  // A deleted document leaves the value null; an unpopulated one leaves its ID
  const value = reference?.value
  const slug = value && typeof value === 'object' ? value.slug : null
  return reference && slug ? documentHref(reference.relationTo, slug) : null
}
