import { describe, expect, it } from 'vitest'

import { bundle } from './bundle.mjs'

const run = (modules) => new Function(`${bundle(modules)}\nreturn __modules`)()

describe('bundle (#1463)', () => {
  it('joins modules, each seeing only what it imports', () => {
    const out = run([
      [
        'a.mjs',
        'export const one = 1\nexport function plus(x) { return x + one }\nconst hidden = 5',
      ],
      ['b.mjs', "import { plus, one as uno } from './a.mjs'\nexport const two = plus(uno)"],
    ])
    expect(out['b.mjs'].two).toBe(2)
    expect(out['a.mjs']).not.toHaveProperty('hidden')
  })

  it('keeps two modules’ same-named private names apart', () => {
    const out = run([
      ['a.mjs', 'const TAU = 1\nexport const a = TAU'],
      ['b.mjs', 'const TAU = 2\nexport const b = TAU'],
    ])
    expect([out['a.mjs'].a, out['b.mjs'].b]).toEqual([1, 2])
  })

  it('refuses a form it does not understand, and an import that is not bundled first', () => {
    expect(() => bundle([['a.mjs', 'export default 1']])).toThrow(/only "export/)
    expect(() => bundle([['a.mjs', "import fs from 'node:fs'"]])).toThrow(/only named imports/)
    expect(() => bundle([['b.mjs', "import { x } from './a.mjs'"]])).toThrow(/not bundled before/)
    expect(() => bundle([['a.mjs', 'export { x }']])).toThrow(/only "export/)
  })
})
