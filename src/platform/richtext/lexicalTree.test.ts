import { describe, expect, it } from 'vitest'

import { countBlocksOfType, countNodes, lexicalRoot } from './lexicalTree'

const tree = {
  type: 'root',
  children: [
    { type: 'paragraph' },
    { type: 'block', fields: { blockType: 'keyFacts' } },
    { type: 'list', children: [{ type: 'block', fields: { blockType: 'keyFacts' } }] },
  ],
}

describe('lexicalTree', () => {
  it('counts the matching nodes at any depth, the node itself included', () => {
    expect(countNodes(tree, (node) => node.type === 'paragraph')).toBe(1)
    expect(countNodes(tree, (node) => node.type === 'root')).toBe(1)
    expect(countNodes({}, () => true)).toBe(1)
  })

  it('counts the blocks of one type, and only blocks', () => {
    expect(countBlocksOfType(tree, 'keyFacts')).toBe(2)
    expect(countBlocksOfType(tree, 'chart')).toBe(0)
    expect(
      countBlocksOfType({ type: 'paragraph', fields: { blockType: 'keyFacts' } }, 'keyFacts'),
    ).toBe(0)
  })

  it('reads the root of a value, if it has one', () => {
    expect(lexicalRoot({ root: tree } as never)).toBe(tree)
    expect(lexicalRoot(null)).toBeUndefined()
  })
})
