import { describe, expect, it } from 'vitest'

import { frontmatterText, parseFrontmatter } from './frontmatter.mjs'

describe('frontmatter', () => {
  it('reads the block between the dashes', () => {
    expect(parseFrontmatter('---\nname: a\ntools: Read, Edit\n---\n\nbody\n')).toEqual({
      name: 'a',
      tools: 'Read, Edit',
    })
  })

  it('reads a file that ends right after the closing dashes, and Windows line ends', () => {
    expect(parseFrontmatter('---\r\nname: a\r\n---')).toEqual({ name: 'a' })
  })

  it('returns nothing for a file without frontmatter or with an empty block', () => {
    expect(frontmatterText('# Title\n---\nx\n---\n')).toBeNull()
    expect(parseFrontmatter('# Title\n')).toEqual({})
    expect(parseFrontmatter('---\n\n---\nbody')).toEqual({})
  })

  it('passes options to the YAML reader', () => {
    expect(
      parseFrontmatter('---\nwhen: 2026-11-24\n---\n', { schema: undefined }).when,
    ).toBeInstanceOf(Date)
  })

  it('throws on invalid YAML instead of hiding it', () => {
    expect(() => parseFrontmatter('---\ndescription: Does one: thing\n---\n')).toThrow()
  })
})
