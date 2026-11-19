/**
 * The end-to-end gate (#868): when a pull request changes the UI, the browser tests are due. The
 * `End-to-end tests` job in `ci.yml` runs this first and runs its steps only when the answer is yes,
 * so the job always reports a result (a skipped job counts as passing and can hide a failure). No
 * model is involved. What counts as a UI change is `uiChanges` in `scripts/behavior-change.mjs`
 * (comment-only and formatting-only edits, tests and docs don't); this file adds what a pull
 * request may say about it and what the job does with it:
 *
 * - A push to `main` always runs them: that is the evidence they stay green.
 * - A UI change runs them unless the description holds `End-to-end exemption: <reason>` with a
 *   reason of 20 or more characters. The independent reviewer checks the reason against the diff,
 *   as with `Behavior change: none`. A model may only add cases (`End-to-end exemption: run`
 *   asks for the tests on any pull request); it can never skip one without that written reason.
 * - A change to the tests, their config, the workflow or the gate's own rules runs them, whatever
 *   the exemption says. A change to the code the suite walks through (the accounts, contact and
 *   verification modules, the Payload config, the seed files it imports) runs them like a UI change.
 * - If anything here fails (the API, a list too long to read), the tests run.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { classifyFile } from '../../scripts/behavior-change.mjs'
import { uiChanges } from '../../scripts/ui-change.mjs'
import { withoutComments } from './pr-body.mjs'
import { changedFiles } from './knowledge-sync.mjs'

/** The shortest reason an exemption needs, like the knowledge gate's "none" declaration. */
export const MIN_EXEMPTION_REASON = 20

const LINE = /^(?:[-*] )?end-to-end exemption ?: ?(.*)$/i
const NO_EXEMPTION = /^(?:none|n\/a|no)\.?$/i
const RUN = /^run\.?$/i
/** Files whose change means the browser tests themselves changed */
const TEST_INFRASTRUCTURE = [
  /^e2e\//,
  /^playwright\.config\./,
  /^\.github\/workflows\/ci\.yml$/,
  // The rules that decide, so one diff can't narrow them and change the UI
  /^\.github\/scripts\/(?:e2e-gate|pr-body|knowledge-sync)\.mjs$/,
  /^scripts\/(?:ui-change|behavior-change)\.mjs$/,
]
/**
 * Code the suite walks through, or the seed and fixtures it imports: a change to any of it that
 * isn't a test, a comment or formatting needs the tests even when no UI file changed (the suite
 * used to run on every PR, so these cases keep it running where it matters).
 */
const FLOW_PATHS = [
  /^src\/modules\/(?:accounts|contact|verification)\//,
  /^src\/payload\.config\.ts$/,
  /^src\/endpoints\/seed\/(?:contact-form|contact-page|helpers\/lexical)\b/,
  /^src\/platform\/richtext\/editorial\/factTabsFixtures\.ts$/,
]

/**
 * What the description says about the browser tests: `{ kind, reason }`, kind being `none` (no
 * line, or "none"), `run` (the tests are asked for) or `exempt` (with its `reason`).
 */
export function e2eExemption(body) {
  for (const raw of withoutComments(body).split('\n')) {
    const line = raw.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
    const match = line.match(LINE)
    if (!match) continue
    const value = match[1].trim()
    if (value === '' || NO_EXEMPTION.test(value)) return { kind: 'none', reason: '' }
    if (RUN.test(value)) return { kind: 'run', reason: '' }
    return { kind: 'exempt', reason: value }
  }
  return { kind: 'none', reason: '' }
}

/**
 * Whether the browser tests run, and why.
 * @param {{ event: string, files: object[], body: string }} input `event` is the workflow's event name
 * @returns {{ run: boolean, reason: string, ui: object[], exemption: object }}
 */
export function e2eDecision({ event, files, body }) {
  const ui = uiChanges(files)
  const flows = files.filter(
    (f) =>
      [f.filename, f.previous_filename].some(
        (path) => path && FLOW_PATHS.some((re) => re.test(path)),
      ) && classifyFile(f).kind === 'behavior',
  )
  const exemption = e2eExemption(body)
  const answer = (run, reason) => ({ run, reason, ui, flows, exemption })
  if (event !== 'pull_request') return answer(true, 'a push to main always runs them')
  if (exemption.kind === 'run') return answer(true, 'the description asks for them')
  const paths = files.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean))
  if (paths.some((path) => TEST_INFRASTRUCTURE.some((re) => re.test(path)))) {
    return answer(true, 'the browser tests or their workflow changed')
  }
  if (ui.length === 0 && flows.length === 0) return answer(false, 'no UI change')
  if (exemption.kind === 'exempt' && exemption.reason.length >= MIN_EXEMPTION_REASON) {
    return answer(false, `exempt, reason given: ${exemption.reason}`)
  }
  return answer(true, ui.length > 0 ? 'the UI changed' : 'a flow the tests cover changed')
}

/** The problems `PR Policy` reports about what the description says on the browser tests */
export function e2eProblems({ body }) {
  const { kind, reason } = e2eExemption(body)
  if (kind === 'exempt' && reason.length < MIN_EXEMPTION_REASON) {
    return [
      `"End-to-end exemption:" needs a reason of at least ${MIN_EXEMPTION_REASON} characters saying why the browser tests are not needed, or write "none".`,
    ]
  }
  return []
}

/** The decision as lines for the job log and its summary, easy to read and to count later (#882) */
export function summaryOf({ run, reason, ui, flows = [] }) {
  const list = (title, found) =>
    found.length ? [title, ...found.map((f) => `- ${f.filename} (${f.reason ?? 'changed'})`)] : []
  return [
    `e2e-gate: decision=${run ? 'run' : 'skip'} ui_files=${ui.length} flow_files=${flows.length} reason="${reason}"`,
    ...list('UI files that count:', ui),
    ...list('Flow files that count:', flows),
  ].join('\n')
}

const gh = (path) =>
  JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 1 << 28 }))

/** Every item of a list endpoint, read page by page (shared with the measurement script) */
export function listAll(path, { limit = Infinity } = {}) {
  const items = []
  for (let page = 1; items.length < limit; page++) {
    const batch = gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    items.push(...batch)
    if (batch.length < 100) break
  }
  return items
}

/** A pull request's files as GitHub lists them, patches included (shared with the measurement script) */
export const pullFiles = (repo, number) =>
  changedFiles(listAll(`repos/${repo}/pulls/${number}/files`))

/** A pull request's description, read when the job runs, so a re-run sees an edited one */
export const pullBody = (repo, number) => gh(`repos/${repo}/pulls/${number}`).body ?? ''

/**
 * The gate's decision for a job's environment. `read` fetches the PR's files and description; when
 * it throws (API down, a file list too long to read), the answer is to run the tests.
 */
export function gateFor(env, read = { files: pullFiles, body: pullBody }) {
  try {
    const event = env.EVENT_NAME
    const pull = event === 'pull_request'
    return e2eDecision({
      event,
      files: pull ? read.files(env.REPO, env.PR_NUMBER) : [],
      body: pull ? read.body(env.REPO, env.PR_NUMBER) : '',
    })
  } catch (error) {
    const why = String(error.message).split('\n')[0]
    return {
      run: true,
      reason: `the gate could not decide (${why}), so it runs`,
      ui: [],
      flows: [],
    }
  }
}

function main(env) {
  const decision = gateFor(env)
  const text = summaryOf(decision)
  console.log(text)
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `### End-to-end gate\n\n${text}\n`)
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `run=${decision.run}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.env)
