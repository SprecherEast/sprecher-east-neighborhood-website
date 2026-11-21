import { describe, expect, it } from 'vitest'

import {
  MARKER,
  commentBody,
  findStickyComment,
  previewState,
  utcMinutes,
} from './preview-comment.mjs'

const SHA = '0123456789abcdef0123456789abcdef01234567'
const RUN = 'https://github.com/Org/site/actions/runs/123456'
const base = {
  number: 7,
  sha: SHA,
  time: '2026-11-20 21:10 UTC',
  runUrl: RUN,
}

describe('commentBody', () => {
  it('holds the marker, the link, the short commit, the time and the run, for a live preview', () => {
    const text = commentBody({ ...base, state: 'live', url: 'https://pr-7.dev.sprechereast.com' })
    expect(text.startsWith(MARKER)).toBe(true)
    expect(text).toContain('**Live.** https://pr-7.dev.sprechereast.com')
    expect(text).toContain('Commit `0123456`')
    expect(text).toContain('2026-11-20 21:10 UTC')
    expect(text).toContain(`[workflow run](${RUN})`)
    expect(text).not.toContain(SHA)
  })

  it.each([
    ['failed', 'The preview did not go live.'],
    ['taken-down', 'Taken down.'],
    ['limit', 'Another preview is up'],
    ['too-big', 'bigger than a preview may be'],
    ['unreadable', 'could not be measured'],
    ['build-failed', 'The build failed.'],
    ['unavailable', 'Previews are unavailable.'],
  ])('says what happened for %s, with no link to a preview that isn’t there', (state, words) => {
    const text = commentBody({ ...base, state })
    expect(text).toContain(words)
    expect(text).not.toContain('dev.sprechereast.com')
  })

  it.each([
    ['a state that isn’t one', { state: 'ok' }],
    ['a number with a sign', { state: 'failed', number: '-7' }],
    ['a commit that isn’t one', { state: 'failed', sha: 'main' }],
    ['a time that isn’t one', { state: 'failed', time: 'now' }],
    ['a run link to another place', { state: 'failed', runUrl: 'javascript:alert(1)' }],
    [
      'a preview address of another pull request',
      { state: 'live', url: 'https://pr-8.dev.sprechereast.com' },
    ],
    ['a live preview with a link to another site', { state: 'live', url: 'https://example.com' }],
  ])('refuses %s', (_name, change) => {
    expect(() =>
      commentBody({ ...base, url: 'https://pr-7.dev.sprechereast.com', ...change }),
    ).toThrow()
  })
})

describe('previewState', () => {
  it('takes the deploy script’s own result first', () => {
    expect(previewState({ deployResult: 'taken-down', buildResult: 'success' })).toBe('taken-down')
    expect(previewState({ deployResult: 'limit' })).toBe('limit')
  })

  it('says unavailable when the server wouldn’t take the key', () => {
    expect(previewState({ available: 'no' })).toBe('unavailable')
  })

  it('says the build failed when the build did not succeed and nothing was deployed', () => {
    expect(previewState({ available: 'yes', buildResult: 'failure' })).toBe('build-failed')
  })

  it('does not call a skipped build a failed one: the step before it failed', () => {
    expect(previewState({ available: '', buildResult: 'skipped' })).toBe('failed')
  })

  it('treats anything else, or a result it doesn’t know, as a failed deploy', () => {
    expect(previewState({ available: 'yes', buildResult: 'success' })).toBe('failed')
    expect(previewState({ deployResult: 'rm -rf /', buildResult: 'success' })).toBe('failed')
  })
})

describe('findStickyComment', () => {
  const mine = { id: 2, user: { login: 'github-actions[bot]' }, body: `${MARKER}\nold` }

  it('finds the comment that carries the marker', () => {
    const comments = [{ id: 1, user: { login: 'someone' }, body: 'hello' }, mine]
    expect(findStickyComment(comments)).toBe(mine)
  })

  it('ignores a marker a person typed, so no one can point the update at their own comment', () => {
    const planted = { id: 3, user: { login: 'someone' }, body: MARKER }
    expect(findStickyComment([planted])).toBeUndefined()
    expect(findStickyComment([planted, mine])).toBe(mine)
  })

  it('finds nothing on a pull request that has no preview comment yet', () => {
    expect(findStickyComment([])).toBeUndefined()
  })
})

describe('utcMinutes', () => {
  it('writes the time to the minute in UTC', () => {
    expect(utcMinutes(new Date('2026-11-20T21:10:42.000Z'))).toBe('2026-11-20 21:10 UTC')
  })
})
