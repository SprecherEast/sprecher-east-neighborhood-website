import { describe, expect, it } from 'vitest'

import { indexLine, noteLinesOf, renderIndex } from './indexLines.mjs'
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

  it('replaces to the end of the file when Notes is the last section', () => {
    const last = '# Index\n\n## Notes\n\n- [Old](../../x.md): stale\n'
    expect(renderIndex(last, [entry], 'docs/knowledge/index.md')).toBe(
      '# Index\n\n## Notes\n\n- [Demo](../../src/modules/demo/README.md): What the demo is for\n',
    )
  })

  it('is stable: rendering its own output changes nothing', () => {
    const once = renderIndex(goodIndex(), [entry], 'docs/knowledge/index.md')
    expect(renderIndex(once, [entry], 'docs/knowledge/index.md')).toBe(once)
  })

  it('throws when the index has no Notes section, instead of writing somewhere else', () => {
    expect(() => renderIndex('# Index\n', [entry], 'docs/knowledge/index.md')).toThrow(/## Notes/)
  })
})

describe('noteLinesOf and renderIndex messages', () => {
  it('says which file has no Notes section', () => {
    const message = (fn) => {
      try {
        fn()
      } catch (error) {
        return error.message
      }
    }
    expect(message(() => noteLinesOf('# x\n', 'docs/knowledge/index.md'))).toBe(
      'docs/knowledge/index.md has no "## Notes" section',
    )
    expect(message(() => renderIndex('# x\n', [], 'a/b.md'))).toBe(
      'a/b.md has no "## Notes" section',
    )
  })

  it('ignores a line of spaces under Notes, as a blank line', () => {
    const text = '## Notes\n\n   \n- [a](b.md): c\n\t\n## Next\n'
    expect(noteLinesOf(text, 'i.md')).toEqual(['- [a](b.md): c'])
  })
})

describe('Windows line endings', () => {
  it('reads the lines under Notes the same, and writes the index back with plain line ends', () => {
    const crlf = goodIndex().replace(/\n/g, '\r\n')
    expect(noteLinesOf(crlf, 'docs/knowledge/index.md')).toEqual(
      noteLinesOf(goodIndex(), 'docs/knowledge/index.md'),
    )
    const out = renderIndex(crlf, [entry], 'docs/knowledge/index.md')
    expect(out).toBe(goodIndex())
  })
})
