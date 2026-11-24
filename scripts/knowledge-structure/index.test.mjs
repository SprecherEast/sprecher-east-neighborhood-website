import { describe, expect, it } from 'vitest'

import { indexLine, renderIndex } from './indexLines.mjs'
import { goodIndex } from './testkit.mjs'

const entry = { path: 'src/modules/demo/README.md', name: 'Demo', summary: 'What the demo is for' }

describe('indexLine', () => {
  it('links the name to the note, from the index folder, and adds the summary', () => {
    expect(indexLine(entry, 'docs/knowledge/index.md')).toBe(
      '- [Demo](../../src/modules/demo/README.md): What the demo is for',
    )
  })
})

describe('renderIndex', () => {
  it('replaces only the lines under Notes and leaves the rest as it was', () => {
    const old = goodIndex('- [Old](../../x.md): stale')
    expect(renderIndex(old, [entry], 'docs/knowledge/index.md')).toBe(goodIndex())
  })

  it('is stable: rendering its own output changes nothing', () => {
    const once = renderIndex(goodIndex(), [entry], 'docs/knowledge/index.md')
    expect(renderIndex(once, [entry], 'docs/knowledge/index.md')).toBe(once)
  })

  it('throws when the index has no Notes section, instead of writing somewhere else', () => {
    expect(() => renderIndex('# Index\n', [entry], 'docs/knowledge/index.md')).toThrow(/## Notes/)
  })
})
