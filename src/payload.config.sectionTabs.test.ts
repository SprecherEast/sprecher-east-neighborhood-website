import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'
import { bootWithAdmin, content, node } from '@/platform/payload/testing/factTabsRequests'

/**
 * A section tabs block (#1333) saves through Payload like any other: a valid one is kept with the
 * rich text of each tab, and one that breaks its rules cannot be published, in posts and events.
 */

let payload: Payload
beforeAll(async () => {
  ;({ payload } = await bootWithAdmin())
}, 60_000)

const text = (value: string) => ({ type: 'text', text: value, format: 0, version: 1 })
const panel = (value: string) =>
  content({
    type: 'paragraph',
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children: [text(value)],
  })
const tab = (label: string, body = 'Some words.') => ({ label, panel: panel(body) })
const sectionTabs = (tabs: unknown[]) => content(node({ blockType: 'sectionTabs', tabs }))

let next = 0
const publish = (collection: 'posts' | 'events', tabs: unknown[]) => {
  next += 1
  const common = {
    title: `Tabs ${next}`,
    slug: `tabs-${next}`,
    _status: 'published' as const,
    content: sectionTabs(tabs) as never,
  }
  return payload.create({
    collection,
    data: (collection === 'events'
      ? { ...common, date: '2026-11-20T00:00:00.000Z' }
      : common) as never,
    context: NO_REVALIDATE,
    overrideAccess: true,
  })
}

describe.each(['posts', 'events'] as const)('a section tabs block in %s', (collection) => {
  it('is kept with each tab’s own rich text', async () => {
    const doc = await publish(collection, [tab('Overview', 'First'), tab('The plan', 'Second')])
    const saved = JSON.stringify(doc.content)
    expect(saved).toContain('"blockType":"sectionTabs"')
    expect(saved).toContain('First')
    expect(saved).toContain('Second')
  })

  it.each([
    ['one tab only', [tab('Overview')]],
    ['five tabs', ['a', 'b', 'c', 'd', 'e'].map((label) => tab(label))],
    ['a label over the limit', [tab('Overview'), tab('A label far too long for it')]],
    ['a blank label', [tab('Overview'), tab('   ')]],
    ['a tab with no content', [tab('Overview'), { label: 'Plan' }]],
  ])('cannot be published with %s', async (_name, tabs) => {
    await expect(publish(collection, tabs)).rejects.toThrow()
  })
})
