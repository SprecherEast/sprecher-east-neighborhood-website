import type { Metadata } from 'next'

import { NOT_INDEXED } from './notIndexed'

/**
 * The metadata of a page whose address holds something private: a confirmation or reset token, or
 * an email. The browser never sends the address to another site (`referrer`), and search engines
 * never index it ([`NOT_INDEXED`](./notIndexed.ts)).
 */
export const privateAddressMetadata = (title: string, description: string): Metadata => ({
  title,
  description,
  referrer: 'no-referrer',
  robots: NOT_INDEXED,
})

/** The props of a page a link with `?token=` lands on (confirm email, verify account, reset). */
export type TokenLinkPageProps = { searchParams: Promise<{ token?: string | string[] }> }
