import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseTranscript, totalTokens } from './transcript.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const fixture = (name) => fs.readFileSync(path.join(dir, `${name}.jsonl`), 'utf8')

describe('totalTokens', () => {
  it('adds input, output and both cache counts of every model', () => {
    const usage = {
      a: { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4 },
      b: { inputTokens: 10, outputTokens: 20 },
    }
    expect(totalTokens(usage)).toBe(40)
  })

  it('is zero without usage', () => {
    expect(totalTokens(undefined)).toBe(0)
  })
})

describe('parseTranscript', () => {
  it('totals tokens, turns, cost and time from the result event', () => {
    const run = parseTranscript(fixture('A-3-1'), '/work/A-3-1')
    expect(run.tokens).toBe(6 + 1068 + 192838 + 97873)
    expect(run.turns).toBe(4)
    expect(run.durationMs).toBe(11116)
    expect(run.costUsd).toBeGreaterThan(0)
    expect(run.finished).toBe(true)
  })

  it('counts every tool call and the distinct files read, relative to the checkout', () => {
    const run = parseTranscript(fixture('A-7-1'), '/work/A-7-1')
    expect(run.toolCalls).toBe(6)
    expect(run.filesRead).toEqual([
      'src/modules/events/data/mappers.thisWeek.test.ts',
      'src/modules/events/domain/thisWeek.test.ts',
      'src/modules/events/domain/thisWeek.ts',
    ])
  })

  it('keeps the final answer', () => {
    const run = parseTranscript(fixture('B-3-1'), '/work/B-3-1')
    expect(run.answer).toContain('isStaffOrAgent')
  })

  it('reports a run that never produced a result as unfinished', () => {
    const text =
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/w/a.ts"}}]}}\nnot json\n'
    const run = parseTranscript(text, '/w')
    expect(run).toMatchObject({
      finished: false,
      tokens: 0,
      toolCalls: 1,
      filesRead: ['a.ts'],
      answer: '',
    })
  })

  it('counts a file read twice once, and leaves paths outside the checkout as they are', () => {
    const read = (p) =>
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: p } }] },
      })
    const run = parseTranscript(
      [read('/w/a.ts'), read('/w/a.ts'), read('/elsewhere/b.ts')].join('\n'),
      '/w',
    )
    expect(run.filesRead).toEqual(['/elsewhere/b.ts', 'a.ts'])
  })

  it('counts the code files read and the searches, apart from notes and docs', () => {
    const read = (file) => ({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: file } }] },
    })
    const search = (name) => ({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: name, input: { pattern: 'x' } }] },
    })
    const text = [
      read('/w/src/modules/events/README.md'),
      read('/w/docs/reference/routes.md'),
      read('/w/.claude/rules/generated/a.md'),
      read('/w/src/modules/events/domain/scope.ts'),
      read('/w/src/modules/events/domain/scope.ts'),
      read('/w/src/modules/events/cms/events.ts'),
      search('Grep'),
      search('Glob'),
      search('Bash'),
    ]
      .map((event) => JSON.stringify(event))
      .join('\n')
    const run = parseTranscript(text, '/w')
    expect(run.codeFilesRead).toEqual([
      'src/modules/events/cms/events.ts',
      'src/modules/events/domain/scope.ts',
    ])
    expect(run.searches).toBe(2)
  })
})
