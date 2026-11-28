import { describe, expect, it, vi } from 'vitest'

import { OUTPUTS_NEEDED, ensureReference } from './ensure-reference.mjs'

const ROOT = '/repo'
const thereAll = () => true
const thereNone = () => false

describe('ensureReference', () => {
  it('names the two files the app, the tests and the notes need before anything else runs', () => {
    expect(OUTPUTS_NEEDED).toEqual([
      'docs/reference/showcase-index.json',
      'src/platform/ui/showcaseRegistry.ts',
    ])
  })

  it('builds the reference when nothing has been built yet (a fresh clone, a new worktree)', () => {
    const build = vi.fn(() => 0)

    expect(ensureReference({ root: ROOT, exists: thereNone, build })).toEqual({
      built: true,
      status: 0,
    })
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('builds it when only one of the two files is there, since half a build is a failed one', () => {
    const build = vi.fn(() => 0)
    const onlyIndex = (file) => file.endsWith('showcase-index.json')

    expect(ensureReference({ root: ROOT, exists: onlyIndex, build }).built).toBe(true)
  })

  it('leaves a built reference alone, so tests and the dev server start at once', () => {
    const build = vi.fn(() => 0)

    expect(ensureReference({ root: ROOT, exists: thereAll, build })).toEqual({
      built: false,
      status: 0,
    })
    expect(build).not.toHaveBeenCalled()
  })

  it('rebuilds on request, whatever is there', () => {
    const build = vi.fn(() => 0)

    expect(ensureReference({ root: ROOT, exists: thereAll, build, force: true }).built).toBe(true)
  })

  it('passes a failed build on as a failure, so the command that needed it stops', () => {
    expect(ensureReference({ root: ROOT, exists: thereNone, build: () => 1 })).toEqual({
      built: true,
      status: 1,
    })
  })

  it('looks for the files under the root it is given', () => {
    const seen = []
    ensureReference({
      root: ROOT,
      exists: (file) => (seen.push(file), true),
      build: () => 0,
    })

    expect(seen).toEqual(OUTPUTS_NEEDED.map((file) => `${ROOT}/${file}`))
  })
})
