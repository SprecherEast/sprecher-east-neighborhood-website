import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'
import { bootWithAdmin, post, tab } from '@/platform/payload/testing/factTabsRequests'

/**
 * The whole-bill block's row titles and notes are fields (#1158). A block stored before they
 * existed holds only its intro and years, and must still publish, since nobody has to open it; a
 * note is checked as Admin checks it.
 */

let payload: Payload
beforeAll(async () => {
  ;({ payload } = await bootWithAdmin())
}, 60_000)

const YEAR = {
  year: 2026,
  label: '2026 rates',
  averageHome: 481300,
  schools: 8.6814,
  county: 2.3564,
  matc: 0.6153,
  city: 7.0139,
}
const bill = (extra: Record<string, unknown> = {}) => ({
  blockType: 'billShare',
  intro: 'Based on the City’s average home.',
  years: [YEAR],
  ...extra,
})
const publishing = (billBlock: Record<string, unknown>) =>
  payload.create({
    collection: 'posts',
    data: post({ tabs: [tab({ panel: [billBlock] }), tab({ heading: 'Tab 2' })] }) as never,
    context: NO_REVALIDATE,
    overrideAccess: true,
  })

describe('a whole-bill block publishes with its row titles and notes (#1158)', () => {
  it('publishes a block stored before the fields existed, with no titles and no notes', async () => {
    await expect(publishing(bill())).resolves.toMatchObject({ _status: 'published' })
  })

  it('saves a change to a post whose bill block was stored before the fields, without touching it', async () => {
    const doc = await publishing(bill())
    await expect(
      payload.update({
        collection: 'posts',
        id: doc.id,
        data: { title: 'A new title' },
        context: NO_REVALIDATE,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ title: 'A new title', _status: 'published' })
  })

  it('publishes a block whose editor wrote their own titles and notes', async () => {
    const written = bill({
      rows: { breakdown: 'Where it goes', differ: 'Why it may differ', sources: 'Where we looked' },
      notes: [
        { showWhen: 'always', text: 'Uses {year} rates.' },
        { showWhen: 'earlierYears', text: 'Your {years} value is assumed.' },
        {
          showWhen: 'always',
          text: 'Please {link}.',
          linkLabel: 'send us a note',
          linkUrl: '/contact',
        },
      ],
    })
    await expect(publishing(written)).resolves.toMatchObject({ _status: 'published' })
  })

  it.each([
    ['a blank its condition cannot fill', { showWhen: 'always', text: 'Your {years} value.' }],
    ['a name that is not a blank', { showWhen: 'always', text: 'Hello {constructor}.' }],
    ['a {link} with no link', { showWhen: 'always', text: 'Please {link}.' }],
    [
      'a link with no {link}',
      { showWhen: 'always', text: 'Please write.', linkLabel: 'write', linkUrl: '/contact' },
    ],
    [
      '{link} written twice',
      { showWhen: 'always', text: '{link} or {link}', linkLabel: 'x', linkUrl: '/contact' },
    ],
    ['a note of only spaces', { showWhen: 'always', text: '   ' }],
  ])('refuses to publish %s', async (_reason, note) => {
    await expect(publishing(bill({ notes: [note] }))).rejects.toThrow()
  })

  it('refuses a row title of only spaces, but not a missing one', async () => {
    await expect(publishing(bill({ rows: { differ: '   ' } }))).rejects.toThrow()
    await expect(publishing(bill({ rows: {} }))).resolves.toMatchObject({ _status: 'published' })
  })
})
