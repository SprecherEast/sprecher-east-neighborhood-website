import { describe, expect, it } from 'vitest'

import { sectionsOf, withoutComments } from './pr-body.mjs'

describe('withoutComments', () => {
  it('removes HTML comments, also across lines', () => {
    expect(withoutComments('a<!-- x\ny -->b')).toBe('ab')
  })

  it('treats a missing body as empty', () => {
    expect(withoutComments(null)).toBe('')
  })
})

describe('sectionsOf', () => {
  it('maps each lower-cased heading to its text', () => {
    const sections = sectionsOf('Closes #1\n\n## What changed\nA\n\n## Risk & rollback\nB\n')
    expect(sections['what changed'].trim()).toBe('A')
    expect(sections['risk & rollback'].trim()).toBe('B')
  })

  it('gives an empty section for a heading with no text', () => {
    expect(sectionsOf('## Why')).toEqual({ why: '' })
  })

  it('ignores text before the first heading', () => {
    expect(sectionsOf('Closes #1')).toEqual({})
  })
})
