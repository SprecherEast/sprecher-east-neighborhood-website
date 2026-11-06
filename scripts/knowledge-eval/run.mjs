#!/usr/bin/env node
// Runs the knowledge eval (#715): every task, in two conditions, in throwaway worktrees.
//
//   node scripts/knowledge-eval/run.mjs --a <commit> --b <commit> [--runs 2] [--tasks 1,3] [--jobs 1] [--out dir]
//
// Each run is a fresh headless `claude -p` session in its own worktree, which is deleted after.
// Nothing is pushed. This costs usage (about 32 sessions) and is never run in CI. The logic worth
// testing is in claude.mjs, options.mjs, grade.mjs and the other modules; this file only starts
// processes. Then run analyze.mjs on the output folder.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  apiKeyProblem,
  buildClaudeArgs,
  changedPaths,
  checkoutProblem,
  childEnv,
  isolatePermissions,
  runChanges,
} from './claude.mjs'
import { parseOptions } from './options.mjs'
import { loadTasks, validateTasks } from './tasks.mjs'

const RUN_TIMEOUT_MS = 25 * 60 * 1000
const COMMAND_TIMEOUT_MS = 15 * 60 * 1000

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function toplevelOf(dir) {
  try {
    return fs.realpathSync(git(dir, 'rev-parse', '--show-toplevel'))
  } catch {
    return null
  }
}

// What is running now, so Ctrl-C or a kill can stop the sessions and delete the worktrees
const running = { workdirs: new Set(), children: new Set(), repo: null, root: null }

function cleanUp() {
  for (const child of running.children) child.kill('SIGTERM')
  for (const workdir of running.workdirs) {
    spawnSync('git', ['worktree', 'remove', '--force', workdir], { cwd: running.repo })
  }
  if (running.root) fs.rmSync(running.root, { recursive: true, force: true })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanUp()
    process.exit(130)
  })
}

/** Replace the checkout's permissions with the eval's own lists (see `isolatePermissions`). */
function isolateSettings(workdir) {
  const file = path.join(workdir, '.claude', 'settings.json')
  let settings
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    settings = undefined // the commit has none
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(isolatePermissions(settings), null, 2)}\n`)
  fs.rmSync(path.join(workdir, '.claude', 'settings.local.json'), { force: true })
}

function createWorktree(repo, workdir, sha) {
  fs.rmSync(workdir, { recursive: true, force: true })
  git(repo, 'worktree', 'prune') // a leftover record of a deleted worktree makes `add` fail
  git(repo, 'worktree', 'add', '--quiet', '--detach', workdir, sha)
  running.workdirs.add(workdir)
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(workdir, 'node_modules'))
  isolateSettings(workdir)
  const problem = checkoutProblem({
    dir: fs.realpathSync(workdir),
    toplevel: toplevelOf(workdir),
    hasAgentsFile: fs.existsSync(path.join(workdir, 'AGENTS.md')),
  })
  if (problem) throw new Error(problem)
}

function runClaude(workdir, prompt, options, base) {
  return new Promise((resolve) => {
    const out = fs.openSync(`${base}.jsonl`, 'w')
    const err = fs.openSync(`${base}.err`, 'w')
    const child = spawn('claude', buildClaudeArgs(options), {
      cwd: workdir,
      env: childEnv(process.env),
      stdio: ['pipe', out, err],
    })
    running.children.add(child)
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS)
    let finished = false
    const finish = (code) => {
      if (finished) return // 'error' and 'close' can both fire
      finished = true
      clearTimeout(timer)
      running.children.delete(child)
      fs.closeSync(out)
      fs.closeSync(err)
      resolve(code)
    }
    child.once('close', finish)
    child.once('error', () => finish(-1))
    child.stdin.end(prompt)
  })
}

function runCommand(workdir, { cmd }) {
  const done = spawnSync(cmd, {
    cwd: workdir,
    shell: true,
    encoding: 'utf8',
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  })
  const errors = `${done.stdout}\n${done.stderr}`
    .split('\n')
    .filter((line) => line.includes('error TS'))
  return { cmd, code: done.status ?? -1, errors }
}

function changedFilesOf(workdir) {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: workdir,
    encoding: 'utf8',
  })
  return runChanges(changedPaths(status))
}

/** The text of the changed files a task's `mustContain` entries look at, by path. */
function readContents(workdir, task, changedFiles) {
  const contents = {}
  for (const { file } of task.mustContain ?? []) {
    const regex = new RegExp(file)
    for (const name of changedFiles.filter((f) => regex.test(f))) {
      contents[name] = fs.readFileSync(path.join(workdir, name), 'utf8')
    }
  }
  return contents
}

async function runOne(job, options, repo, wtRoot, outDir) {
  const { cond, sha, task, rep } = job
  const name = `${cond}-${task.id}-${rep}`
  const base = path.join(outDir, name)
  const workdir = path.join(wtRoot, name)
  const meta = { cond, task: task.id, rep, commit: sha, workdir, commands: [], changedFiles: [] }
  try {
    createWorktree(repo, workdir, sha)
    meta.exitCode = await runClaude(workdir, task.prompt, options, base)
    meta.changedFiles = changedFilesOf(workdir)
    fs.writeFileSync(
      `${base}.diff`,
      git(workdir, 'diff', '--', '.', ':(exclude).claude/settings.json'),
    )
    if (task.kind === 'change') {
      meta.contents = readContents(workdir, task, meta.changedFiles)
      meta.commands = task.commands.map((command) => runCommand(workdir, command))
    }
  } catch (error) {
    meta.error = error.message
    fs.writeFileSync(`${base}.err`, `${error.message}\n`, { flag: 'a' })
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', workdir], { cwd: repo })
    running.workdirs.delete(workdir)
  }
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(meta, null, 2)}\n`)
  console.log(`${name} done${meta.error ? ` (failed: ${meta.error})` : ''}`)
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const keyProblem = apiKeyProblem(process.env)
  if (keyProblem) throw new Error(keyProblem)
  const here = path.dirname(fileURLToPath(import.meta.url))
  const repo = toplevelOf(here)
  if (!repo) throw new Error('run this from a checkout of the repository')
  const tasks = loadTasks().filter((t) => !options.tasks || options.tasks.includes(t.id))
  const problems = validateTasks(tasks)
  if (problems.length || tasks.length === 0)
    throw new Error(`bad task set: ${problems.join('; ') || 'no tasks selected'}`)

  const outDir = options.out ?? path.join(os.tmpdir(), `knowledge-eval-${Date.now()}`)
  const wtRoot = path.join(os.tmpdir(), `knowledge-eval-wt-${process.pid}`)
  fs.mkdirSync(outDir, { recursive: true })
  fs.mkdirSync(wtRoot, { recursive: true })
  Object.assign(running, { repo, root: wtRoot })
  const shas = {
    A: git(repo, 'rev-parse', '--verify', `${options.a}^{commit}`),
    B: git(repo, 'rev-parse', '--verify', `${options.b}^{commit}`),
  }
  console.log(`A ${shas.A}\nB ${shas.B}\nresults in ${outDir}`)

  const queue = []
  for (const task of tasks)
    for (let rep = 1; rep <= options.runs; rep++)
      for (const cond of ['A', 'B']) queue.push({ cond, sha: shas[cond], task, rep })
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift())
      await runOne(job, options, repo, wtRoot, outDir)
  }
  await Promise.all(Array.from({ length: options.jobs }, worker))
  fs.rmSync(wtRoot, { recursive: true, force: true })
  console.log(`done. node scripts/knowledge-eval/analyze.mjs ${outDir}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
