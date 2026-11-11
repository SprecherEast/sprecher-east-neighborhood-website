import { describe, expect, it } from 'vitest'

import { checkKnowledge, parseNameStatus, patchOf } from './knowledge-check.mjs'

const MAP = JSON.stringify([{ note: 'src/modules/x/README.md', paths: ['src/modules/x/**'] }])
const CHANGE = '@@ -1 +1 @@\n-export const limit = 1\n+export const limit = 2\n'
const code = { filename: 'src/modules/x/limit.ts', status: 'modified', patch: CHANGE }
const note = {
  filename: 'src/modules/x/README.md',
  status: 'modified',
  patch: '@@ -1 +1 @@\n-a\n+b\n',
}
const run = (files, body = '') =>
  checkKnowledge({ mapJson: MAP, files, noteExists: () => true, body })

describe('parseNameStatus', () => {
  it('reads added, modified, removed and renamed files the way GitHub lists them', () => {
    const text = 'A\tsrc/a.ts\nM\tsrc/b.ts\nD\tsrc/c.ts\nR087\tsrc/old.ts\tsrc/new.ts\n'
    expect(parseNameStatus(text)).toEqual([
      { filename: 'src/a.ts', status: 'added' },
      { filename: 'src/b.ts', status: 'modified' },
      { filename: 'src/c.ts', status: 'removed' },
      { filename: 'src/new.ts', previous_filename: 'src/old.ts', status: 'renamed' },
    ])
  })

  it('ignores blank lines', () => {
    expect(parseNameStatus('\n\n')).toEqual([])
  })
})

describe('patchOf', () => {
  it('keeps what GitHub calls the patch: everything from the first hunk', () => {
    const diff = 'diff --git a/f b/f\nindex 1..2 100644\n--- a/f\n+++ b/f\n' + CHANGE
    expect(patchOf(diff)).toBe(CHANGE.trimEnd())
  })

  it('is empty for a diff with no hunks, such as a binary file', () => {
    expect(patchOf('diff --git a/f b/f\nBinary files differ\n')).toBe('')
  })
})

describe('checkKnowledge', () => {
  it('names the note a behavior change left out, with the rule ID', () => {
    const problems = run([code])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('PR-KNOWLEDGE')
    expect(problems[0]).toContain('src/modules/x/README.md')
  })

  it('is quiet when the note changes with the code', () => {
    expect(run([code, note])).toEqual([])
  })

  it('accepts a written reason that no behavior changed', () => {
    const body =
      '## Knowledge\n\nBehavior change: none, because this only renames an internal constant.\n'
    expect(run([code], body)).toEqual([])
  })

  it('rejects a reason that is too short', () => {
    const body = '## Knowledge\n\nBehavior change: none, tiny.\n'
    expect(run([code], body)).toHaveLength(1)
  })
})
