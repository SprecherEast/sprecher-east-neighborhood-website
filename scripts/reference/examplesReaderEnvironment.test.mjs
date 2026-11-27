import { describe, expect, it } from 'vitest'

import { read, withBody } from './examplesFixture.mjs'

/** The reader guards against mistakes; it is not a sandbox (an example is code that runs at build time). */
describe('readExamples: other ways to the environment, the machine or the page', () => {
  const inRender = (use) =>
    read(
      `export const A = defineExample({ purpose: 'x', render: () => { ${use}; return null } })\n`,
    )

  it('refuses the names of the server, the machine, the page and timers', () => {
    const names = [
      'global',
      'module',
      'exports',
      'Buffer',
      '__dirname',
      '__filename',
      'Reflect',
      'Proxy',
      'Worker',
      'SharedWorker',
      'Deno',
      'Bun',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'caches',
      'location',
      'history',
      'navigator',
      'top',
      'parent',
      'frames',
      'opener',
      'setTimeout',
      'setInterval',
      'setImmediate',
      'queueMicrotask',
      'importScripts',
      'postMessage',
      'BroadcastChannel',
    ]
    for (const name of names) {
      expect(() => inRender(`const x = ${name}`), name).toThrow(
        new RegExp(`A: references ${name} \\(line`),
      )
      expect(
        () => read(`const x = ${name}\n${withBody('render: () => null')}`),
        `top ${name}`,
      ).toThrow(/references/)
    }
    for (const use of ["module.require('fs')", "new Worker('x')", 'localStorage.getItem("a")']) {
      expect(() => inRender(use), use).toThrow(/references (module|Worker|localStorage)/)
    }
  })

  it('does not mind a property that only has the name', () => {
    expect(() =>
      inRender('const o = { top: 1, location: 2 }; return o.parent + o.global'),
    ).not.toThrow()
  })

  it('refuses reaching a constructor, however it is written', () => {
    for (const use of [
      "[].constructor.constructor('return process')()",
      "[]['constructor']['constructor']('return process')()",
      '[][`constructor`]',
      'const { constructor } = []',
      'const { constructor: c } = []',
      '({}).__proto__',
      "({})['__proto__']",
      "const k = 'x'; ({})[k]['constructor']",
    ]) {
      expect(() => inRender(use), use).toThrow(/A: reaches (constructor|__proto__) \(line/)
    }
  })

  it('still accepts ordinary computed access and a class with a constructor of its own', () => {
    expect(() =>
      inRender("const items = ['a']; const i = 0; return items[i] + items['0'] + items.length"),
    ).not.toThrow()
    expect(() =>
      read(`class Box { constructor(public n: number) {} }\n${withBody('render: () => null')}`),
    ).not.toThrow()
  })
})
