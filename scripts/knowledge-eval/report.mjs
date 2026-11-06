// The results tables of the knowledge eval, in the shape of #715's [DECISION] comment.

const GRADE_RANK = { full: 2, pass: 2, half: 1, none: 0, fail: 0 }
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1)
const sum = (values) => values.reduce((total, v) => total + v, 0)

export function formatTokens(tokens) {
  return `${Math.round(tokens / 1000).toLocaleString('en-US')}k`
}

/** Signed change from `before` to `after`, with a real minus sign. */
export function formatChange(before, after) {
  if (!before) return 'n/a'
  const percent = Math.round(((after - before) / before) * 100)
  if (percent === 0) return '0%'
  return `${percent < 0 ? '−' : '+'}${Math.abs(percent)}%`
}

const oneDecimal = (n) => n.toFixed(1)

function side(runs) {
  return {
    runs: runs.length,
    tokens: mean(runs.map((r) => r.tokens)),
    toolCalls: mean(runs.map((r) => r.toolCalls)),
    filesRead: mean(runs.map((r) => r.filesRead)),
    costUsd: mean(runs.map((r) => r.costUsd)),
    grades: runs.map((r) => r.grade),
    correctness: mean(runs.map((r) => GRADE_RANK[r.grade] ?? 0)),
  }
}

/** One row per task, in task order, with the mean of each condition's runs. */
export function summarize(runs) {
  const tasks = [...new Set(runs.map((r) => r.task))].sort((x, y) => Number(x) - Number(y))
  return tasks.map((task) => {
    const of = (cond) => side(runs.filter((r) => r.task === task && r.cond === cond))
    return { task, A: of('A'), B: of('B') }
  })
}

/**
 * The rollout gate (decision 0019 §8): B's correctness doesn't drop on any task, and its mean
 * tokens are lower on at least `minTasksFaster` tasks.
 */
export function evaluateGate(rows, { minTasksFaster = 5 } = {}) {
  const correctnessDrops = rows.filter((r) => r.B.correctness < r.A.correctness).map((r) => r.task)
  const fewerTokens = rows.filter((r) => r.B.tokens < r.A.tokens).length
  return {
    pass: correctnessDrops.length === 0 && fewerTokens >= minTasksFaster,
    correctnessDrops,
    fewerTokens,
    total: rows.length,
    minTasksFaster,
  }
}

function tokenTable(rows) {
  const lines = [
    '| Task | A | B | Change | Tool calls A → B | Files read A → B |',
    '| ---- | - | - | ------ | ---------------- | ---------------- |',
  ]
  for (const { task, A, B } of rows) {
    lines.push(
      `| ${task} | ${formatTokens(A.tokens)} | ${formatTokens(B.tokens)} | ${formatChange(A.tokens, B.tokens)} | ` +
        `${oneDecimal(A.toolCalls)} → ${oneDecimal(B.toolCalls)} | ${oneDecimal(A.filesRead)} → ${oneDecimal(B.filesRead)} |`,
    )
  }
  const total = (cond, key) => sum(rows.map((r) => r[cond][key]))
  lines.push(
    `| **All** | **${formatTokens(total('A', 'tokens'))}** | **${formatTokens(total('B', 'tokens'))}** | ` +
      `**${formatChange(total('A', 'tokens'), total('B', 'tokens'))}** ` +
      `(cost ${formatChange(total('A', 'costUsd'), total('B', 'costUsd'))}) | | |`,
  )
  return lines
}

function correctnessTable(rows) {
  const lines = ['| Task | A | B |', '| ---- | - | - |']
  for (const { task, A, B } of rows)
    lines.push(`| ${task} | ${A.grades.join(', ')} | ${B.grades.join(', ')} |`)
  return lines
}

function gateLine(gate) {
  const drops = gate.correctnessDrops.length
    ? `Correctness dropped on task ${gate.correctnessDrops.join(', ')}`
    : 'Correctness did not drop'
  const verdict = gate.pass ? 'passed' : 'failed'
  return `Gate: ${verdict}. ${drops}; tokens fell on ${gate.fewerTokens} of ${gate.total} tasks (needs ${gate.minTasksFaster}).`
}

/**
 * The tokens table (mean of each task's runs), the correctness table and the gate line, as
 * Markdown ready to paste into the issue. Correctness from the mechanical grading still needs a
 * person to read the answers.
 */
export function renderReport(runs, gateOptions) {
  const rows = summarize(runs)
  return [
    '**Tokens** (mean of the runs, all input and output tokens across the session):',
    '',
    ...tokenTable(rows),
    '',
    '**Correctness** (one entry per run: questions full, half or none against the key; changes pass or fail):',
    '',
    ...correctnessTable(rows),
    '',
    gateLine(evaluateGate(rows, gateOptions)),
    '',
  ].join('\n')
}
