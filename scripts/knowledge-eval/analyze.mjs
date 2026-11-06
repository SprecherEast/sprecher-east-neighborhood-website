#!/usr/bin/env node
// Turns the folder run.mjs wrote into the results tables of #715's [DECISION] comment.
//
//   node scripts/knowledge-eval/analyze.mjs <results folder> [--answers] [--min-faster 5]
//
// --answers also prints each question's answer with the facts the key did not find, because the
// grading is a mechanical first pass that a person still reads.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { gradeAnswer, gradeChange } from './grade.mjs'
import { renderReport } from './report.mjs'
import { loadTasks } from './tasks.mjs'
import { parseTranscript } from './transcript.mjs'

/** One run's row for the report: its numbers from the transcript, and its grade against the task. */
export function buildRunRow(task, meta, transcriptText) {
  const parsed = parseTranscript(transcriptText, meta.workdir)
  const graded =
    task.kind === 'question'
      ? gradeAnswer(parsed.answer, task.key)
      : gradeChange(task, {
          commands: meta.commands,
          changedFiles: meta.changedFiles,
          contents: meta.contents,
        })
  const grade =
    task.kind === 'question' ? graded.score : graded.pass && parsed.finished ? 'pass' : 'fail'
  return {
    cond: meta.cond,
    task: meta.task,
    rep: meta.rep,
    tokens: parsed.tokens,
    toolCalls: parsed.toolCalls,
    filesRead: parsed.filesRead.length,
    costUsd: parsed.costUsd,
    grade,
    answer: parsed.answer,
    details: task.kind === 'question' ? graded.missing : graded.failures,
  }
}

export function collectRows(dir, tasks) {
  const rows = []
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    const task = tasks.find((t) => t.id === meta.task)
    const transcript = path.join(dir, file.replace(/\.json$/, '.jsonl'))
    if (!task || !fs.existsSync(transcript)) continue
    rows.push(buildRunRow(task, meta, fs.readFileSync(transcript, 'utf8')))
  }
  return rows
}

function main(argv) {
  const dir = argv.find((arg) => !arg.startsWith('--'))
  if (!dir) throw new Error('usage: analyze.mjs <results folder> [--answers] [--min-faster N]')
  const rows = collectRows(dir, loadTasks())
  if (rows.length === 0) throw new Error(`no finished runs in ${dir}`)
  const at = argv.indexOf('--min-faster')
  const minTasksFaster = at >= 0 ? Number(argv[at + 1]) : 5
  console.log(renderReport(rows, { minTasksFaster }))
  if (argv.includes('--answers')) {
    for (const row of rows.filter((r) => r.answer)) {
      const missing = row.details.length ? `  [not found: ${row.details.join('; ')}]` : ''
      console.log(
        `===== ${row.cond}-${row.task}-${row.rep} (${row.grade})${missing}\n${row.answer}\n`,
      )
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
