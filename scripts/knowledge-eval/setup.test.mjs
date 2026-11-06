import { describe, expect, it } from 'vitest'

import { ALLOWED_TOOLS, DISALLOWED_TOOLS, buildClaudeArgs, checkoutProblem } from './claude.mjs'
import { parseOptions } from './options.mjs'
import { loadTasks, validateTasks } from './tasks.mjs'

describe('the task set', () => {
  it('has the 8 tasks of #715, six questions with a key and two changes with commands', () => {
    const tasks = loadTasks()
    expect(tasks.map((t) => t.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    expect(tasks.filter((t) => t.kind === 'question')).toHaveLength(6)
    expect(tasks.filter((t) => t.kind === 'change')).toHaveLength(2)
    expect(validateTasks(tasks)).toEqual([])
  })

  it('reports a task that cannot be graded', () => {
    const bad = [
      { id: '1', kind: 'question', prompt: 'q', key: [] },
      { id: '1', kind: 'change', prompt: '', commands: [], mustChange: [] },
      { id: '3', kind: 'poem', prompt: 'x' },
    ]
    expect(validateTasks(bad)).toEqual([
      'task 1: a question needs a non-empty key',
      'task 1: duplicate id',
      'task 1: empty prompt',
      'task 1: a change needs commands',
      'task 1: a change needs mustChange',
      'task 3: unknown kind poem',
    ])
  })

  it('has keys whose regular expressions compile', () => {
    for (const task of loadTasks().filter((t) => t.kind === 'question')) {
      for (const alternatives of task.key) {
        for (const alt of alternatives.filter(
          (a) => a.length > 2 && a.startsWith('/') && a.endsWith('/'),
        )) {
          expect(() => new RegExp(alt.slice(1, -1), 'i')).not.toThrow()
        }
      }
    }
  })
})

describe('buildClaudeArgs', () => {
  it('runs headless on stream-json with the model, the effort and both tool lists', () => {
    const args = buildClaudeArgs({ model: 'sonnet', effort: 'medium' })
    expect(args.slice(0, 9)).toEqual([
      '-p',
      '--model',
      'sonnet',
      '--effort',
      'medium',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
    ])
    expect(args).toContain('acceptEdits')
    const allowed = args.indexOf('--allowedTools')
    const disallowed = args.indexOf('--disallowedTools')
    expect(args.slice(allowed + 1, disallowed)).toEqual(ALLOWED_TOOLS)
    expect(args.slice(disallowed + 1)).toEqual(DISALLOWED_TOOLS)
  })

  it('allows what task 8 needs: Prettier, git checkout and payload migrate:create', () => {
    expect(ALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        'Bash(npx prettier:*)',
        'Bash(git checkout:*)',
        'Bash(npx payload migrate:create:*)',
      ]),
    )
  })

  it('blocks GitHub, the web, pushes, commits and curl, and never both allows and blocks a tool', () => {
    expect(DISALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        'WebFetch',
        'WebSearch',
        'Bash(gh:*)',
        'Bash(git push:*)',
        'Bash(git commit:*)',
        'Bash(curl:*)',
      ]),
    )
    expect(ALLOWED_TOOLS.filter((t) => DISALLOWED_TOOLS.includes(t))).toEqual([])
  })
})

describe('checkoutProblem', () => {
  const ok = { dir: '/w/A-1-1', toplevel: '/w/A-1-1', hasAgentsFile: true }

  it('accepts the root of a real checkout', () => {
    expect(checkoutProblem(ok)).toBeNull()
  })

  it('refuses a folder git does not know, or one inside another repository', () => {
    expect(checkoutProblem({ ...ok, toplevel: null })).toMatch(/not a git checkout/)
    expect(checkoutProblem({ ...ok, toplevel: '/home/me/site' })).toMatch(/not the root/)
  })

  it('refuses a folder without AGENTS.md, which a silent fall-back to the scratch folder would be', () => {
    expect(checkoutProblem({ ...ok, hasAgentsFile: false })).toMatch(/AGENTS\.md/)
  })
})

describe('parseOptions', () => {
  it('needs the two commits and defaults to 2 runs of every task', () => {
    expect(parseOptions(['--a', 'aa0bd3d', '--b', '5ca6dfd'])).toMatchObject({
      a: 'aa0bd3d',
      b: '5ca6dfd',
      runs: 2,
      tasks: null,
      model: 'sonnet',
      effort: 'medium',
      jobs: 1,
    })
  })

  it('reads runs, tasks, jobs and the output folder', () => {
    const o = parseOptions([
      '--a',
      'x',
      '--b',
      'y',
      '--runs',
      '1',
      '--tasks',
      '1,3',
      '--jobs',
      '4',
      '--out',
      '/o',
    ])
    expect(o).toMatchObject({ runs: 1, tasks: ['1', '3'], jobs: 4, out: '/o' })
  })

  it('rejects a missing commit and a bad number', () => {
    expect(() => parseOptions(['--a', 'x'])).toThrow(/--b/)
    expect(() => parseOptions(['--a', 'x', '--b', 'y', '--runs', '0'])).toThrow(/--runs/)
  })
})
