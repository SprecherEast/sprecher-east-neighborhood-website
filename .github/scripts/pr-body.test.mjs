import { describe, expect, it } from 'vitest'

import { linkedIssues, sectionsOf, withoutComments } from './pr-body.mjs'

describe('withoutComments', () => {
  it('removes HTML comments, also across lines', () => {
    expect(withoutComments('a<!-- x\ny -->b')).toBe('ab')
  })

  it('leaves no comment marker behind when removal joins two halves of one', () => {
    expect(withoutComments('<!<!-- x -->-- Behavior change: none -->')).toBe('')
    expect(withoutComments('<!-<!-- a -->- b -->ok')).toBe('ok')
  })

  it('drops everything after a comment that is never closed', () => {
    expect(withoutComments('keep\n<!-- Behavior change: none and a long reason')).toBe('keep\n')
  })

  it('reads a CRLF body like an LF one', () => {
    expect(withoutComments('a\r\n<!-- x\r\ny -->b')).toBe('a\nb')
    expect(sectionsOf('## Why\r\nBecause\r\n').why).toBe('Because\n')
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

describe('linkedIssues', () => {
  it('reads Closes, Fixes and Resolves forms as closing', () => {
    const body = 'Closes #1\nfixes: #2\nResolved #3'
    expect(linkedIssues(body).closes).toEqual([1, 2, 3])
  })

  it('reads "Part of" as progress, unless the same issue is also closed', () => {
    expect(linkedIssues('Part of #4\nCloses #5\nPart of #5')).toEqual({ closes: [5], partOf: [4] })
  })

  it('lists each issue once and ignores links inside comments', () => {
    expect(linkedIssues('Closes #1 Closes #1 <!-- Closes #9 -->').closes).toEqual([1])
  })

  it('finds nothing in a body with no link', () => {
    expect(linkedIssues(undefined)).toEqual({ closes: [], partOf: [] })
  })
})
