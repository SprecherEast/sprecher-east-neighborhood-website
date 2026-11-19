import 'server-only'

import type { Metadata } from 'next'

import { NOT_INDEXED } from '@/platform/seo/notIndexed'

import { getPlanIssueFromAddress } from './getPlanIssue'

/**
 * The tab title and robots rule of a plan issue, for its own page and for the dialog it opens in
 * (#954). Both routes call this, so they can't drift. A screened or unknown number gets the plan's
 * title; the route answers 404 itself.
 */
export async function planIssueMetadata(address: string): Promise<Metadata> {
  const issue = await getPlanIssueFromAddress(address)
  return { title: issue?.title ?? 'Our plan', robots: NOT_INDEXED }
}
