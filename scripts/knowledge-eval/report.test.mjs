import { describe, expect, it } from 'vitest'

import { evaluateGate, formatChange, formatTokens, renderReport, summarize } from './report.mjs'

const run = (cond, task, tokens, extra = {}) => ({
  cond,
  task,
  tokens,
  toolCalls: 2,
  filesRead: 1,
  costUsd: tokens / 1e6,
  grade: 'full',
  ...extra,
})

const runs = [
  run('A', '1', 300_000),
  run('A', '1', 280_000, { toolCalls: 4, filesRead: 3 }),
  run('B', '1', 200_000),
  run('B', '1', 240_000),
  run('A', '2', 100_000),
  run('B', '2', 120_000, { grade: 'half' }),
]

describe('formatTokens and formatChange', () => {
  it('writes thousands with a separator, and signed percentages with a real minus', () => {
    expect(formatTokens(291_400)).toBe('291k')
    expect(formatTokens(3_020_000)).toBe('3,020k')
    expect(formatChange(291, 222)).toBe('−24%')
    expect(formatChange(100, 107)).toBe('+7%')
    expect(formatChange(0, 5)).toBe('n/a')
  })
})

describe('summarize', () => {
  it('averages tokens, tool calls and files read per task and condition', () => {
    const rows = summarize(runs)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      task: '1',
      A: { runs: 2, tokens: 290_000, toolCalls: 3, filesRead: 2 },
      B: { runs: 2, tokens: 220_000 },
    })
  })

  it('orders tasks numerically', () => {
    const rows = summarize([
      run('A', '10', 1),
      run('A', '2', 1),
      run('B', '10', 1),
      run('B', '2', 1),
    ])
    expect(rows.map((r) => r.task)).toEqual(['2', '10'])
  })
})

describe('evaluateGate', () => {
  it('passes when correctness does not drop and tokens fall on enough tasks', () => {
    const rows = summarize([
      run('A', '1', 10),
      run('B', '1', 5),
      run('A', '2', 10),
      run('B', '2', 5),
    ])
    expect(evaluateGate(rows, { minTasksFaster: 2 })).toMatchObject({
      pass: true,
      fewerTokens: 2,
      total: 2,
    })
  })

  it('fails when B scores lower than A on any task', () => {
    const rows = summarize(runs)
    const gate = evaluateGate(rows, { minTasksFaster: 1 })
    expect(gate.pass).toBe(false)
    expect(gate.correctnessDrops).toEqual(['2'])
  })

  it('fails when tokens fall on too few tasks', () => {
    const rows = summarize([run('A', '1', 10), run('B', '1', 20)])
    expect(evaluateGate(rows, { minTasksFaster: 1 }).pass).toBe(false)
  })
})

describe('renderReport', () => {
  it('writes the token table with an All row, then the correctness table and the gate line', () => {
    const text = renderReport(runs, { minTasksFaster: 1 })
    expect(text).toContain('| Task | A | B | Change | Tool calls A → B | Files read A → B |')
    expect(text).toContain('| 1 | 290k | 220k | −24% | 3.0 → 2.0 | 2.0 → 1.0 |')
    expect(text).toContain('| **All** | **390k** | **340k** | **−13%** (cost −13%) | | |')
    expect(text).toContain('| 2 | full | half |')
    expect(text).toContain('Gate: failed')
  })
})
