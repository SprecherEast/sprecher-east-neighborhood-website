import { describe, expect, it } from 'vitest'

import { COUNTED_CALLS_SENTENCE, reachedLinks, reasonLines } from './collectionCells.mjs'

describe('reachedLinks', () => {
  it('links each content type with the operations found, or says none is shown', () => {
    expect(
      reachedLinks([
        { collection: 'events', operations: ['read (access checked)'], why: [] },
        { collection: 'faq', operations: [], why: [] },
      ]),
    ).toBe(
      '[`events`](content-types/events.md) (read (access checked)), [`faq`](content-types/faq.md) (operation not shown)',
    )
  })
})

describe('reasonLines', () => {
  it('says a comment once with every operation it was found for, and keeps different ones apart', () => {
    const why = [
      { operation: 'delete', text: 'Clears old rows.' },
      { operation: 'read', text: 'Clears old rows.' },
      { operation: 'read', text: 'Lists the ids.' },
    ]
    expect(reasonLines([{ collection: 'runs', operations: [], why }], '`task`: ')).toBe(
      '\n- `task`: `runs`, delete and read, from the comment on the function that makes the call: Clears old rows.' +
        '\n- `task`: `runs`, read, from the comment on the function that makes the call: Lists the ids.',
    )
    expect(reasonLines([{ collection: 'runs', operations: [], why: [] }])).toBe('')
  })

  it('lists the calls it counts', () => {
    expect(COUNTED_CALLS_SENTENCE).toMatch(/^The calls counted are `find`, .*`deleteMany`\.$/)
  })
})
