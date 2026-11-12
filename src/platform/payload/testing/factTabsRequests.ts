import { REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'

import { type Account, bootPayload, createAccount } from './inMemoryPayload'

/**
 * Shared by the Fact tabs tests (#664): Payload booted on in-memory SQLite with an admin who has
 * signed in, the rich-text bodies the editor saves, and a REST request as the site's `/api` route
 * sends it.
 */

export async function bootWithAdmin(): Promise<{
  payload: Payload
  config: SanitizedConfig
  token: string
  editor: Account
}> {
  const { payload, config } = await bootPayload()
  const admin = await createAccount(payload, 'admin', 'ana')
  const login = await payload.login({
    collection: 'users',
    data: { email: admin.email, password: 'ana-password-for-tests' },
  })
  const editor = await createAccount(payload, 'editor', 'eddie')
  return { payload, config, token: login.token ?? '', editor }
}

export const node = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: 'fact-tabs-1', blockType: 'factTabs', ...fields },
})
export const content = (...children: unknown[]) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children },
})

export const TIMELINE = {
  blockType: 'timeline',
  entries: [
    { date: 'Oct 2026', status: 'done', title: 'Proposed' },
    { date: 'Nov 10', status: 'next', title: 'Vote' },
  ],
}
export const BAR = {
  blockType: 'chart',
  kind: 'bar',
  title: 'Budget',
  summary: 'Up a little.',
  unit: 'usd',
  bars: [
    { label: '2026', value: 452 },
    { label: '2027', value: 477 },
  ],
}
export const tab = (extra: Record<string, unknown> = {}) => ({
  value: '$477.5M',
  label: 'Day-to-day',
  icon: 'money',
  certainty: 'confirmed',
  heading: 'Day-to-day money',
  definition: 'What it costs.',
  panel: [BAR, TIMELINE],
  ...extra,
})
export const tabs = (n: number) =>
  Array.from({ length: n }, (_, i) => tab({ heading: `Tab ${i + 1}` }))

let next = 0
export const post = (
  fields: Record<string, unknown>,
  status: 'published' | 'draft' = 'published',
) => ({
  title: `Budget ${++next}`,
  slug: `budget-${next}`,
  _status: status,
  content: content(node(fields)) as never,
})
export const event = (
  fields: Record<string, unknown>,
  status: 'published' | 'draft' = 'published',
) => ({
  title: `Night ${++next}`,
  slug: `night-${next}`,
  date: '2026-11-20T00:00:00.000Z',
  _status: status,
  content: content(node(fields)) as never,
})
export const SHAPES = { posts: post, events: event } as const

export const rest = async (
  config: SanitizedConfig,
  token: string,
  method: 'POST' | 'PATCH',
  path: string[],
  body: Record<string, unknown>,
  query = '',
) => {
  const handler = (method === 'POST' ? REST_POST : REST_PATCH)(Promise.resolve(config))
  const request = new Request(`http://localhost:3000/api/${path.join('/')}${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify(body),
  })
  return handler(request, { params: Promise.resolve({ slug: path }) })
}
