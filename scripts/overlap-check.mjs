#!/usr/bin/env node
/**
 * The overlap check before a claim (#695): do the files two issues declare, the shared hot spots
 * or a blocker mean they must not run at the same time? Pure and deterministic: the same issues
 * always give the same lines in the same order. No network, no model.
 *
 *   node scripts/overlap-check.mjs issues.json [--candidate 123]
 *
 * `issues.json` is a list of `{ number, body }` (the issue body, whose "Files likely touched" and
 * "Must not touch" sections are read) or `{ number, files, mustNotTouch, blockedBy }`. List the
 * candidate and every issue In progress. Exit 0: no clash. Exit 1: clashes are listed, one per
 * line. Exit 2: bad input. Only backticked paths in a section count; prose is ignored.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { HOT_SPOTS } from './overlap-hot-spots.mjs'

const SECTION = {
  files: /^#{1,6}\s+files likely touched\s*$/i,
  mustNot: /^#{1,6}\s+must not touch\s*$/i,
}
const HEADING = /^#{1,6}\s/
const LOOKS_LIKE_PATH = /\/|^\.|\.[A-Za-z0-9]+$/

/** A path as a folder prefix: no ./, no outer slashes, a glob cut back to its folder. */
export function normalizePath(entry) {
  let p = entry.trim().replace(/^\.\//, '').replace(/^\/+/, '')
  const star = p.indexOf('*')
  if (star !== -1) p = p.slice(0, star).replace(/[^/]*$/, '')
  return p.replace(/\/+$/, '')
}

/** True when the two paths are equal or one is a folder holding the other ('' is the root). */
export function pathsOverlap(a, b) {
  const [x, y] = [normalizePath(a), normalizePath(b)]
  return x === '' || y === '' || x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)
}

/** The backticked paths in a block of text, or [] for "None". */
function pathsIn(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).filter((t) => LOOKS_LIKE_PATH.test(t))
}

/**
 * The declared paths of an issue body: `files` and `mustNotTouch` are lists, or null when the
 * section is missing or holds prose with no backticked path (and is not "None").
 */
export function parseDeclared(body) {
  const found = { files: null, mustNotTouch: null }
  let current = null
  const text = { files: [], mustNot: [] }
  for (const line of String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')) {
    if (HEADING.test(line)) {
      current = SECTION.files.test(line) ? 'files' : SECTION.mustNot.test(line) ? 'mustNot' : null
      if (current) text[current] = []
      continue
    }
    if (current) text[current].push(line)
  }
  const read = (lines) => {
    const block = lines.join('\n').trim()
    if (block === '') return null
    const paths = pathsIn(block).map(normalizePath)
    if (paths.length) return paths
    return /^none\b/i.test(block) ? [] : null
  }
  found.files = read(text.files)
  found.mustNotTouch = read(text.mustNot)
  return found
}

/** One issue as the checker reads it. Explicit lists win over the body. */
export function normalizeIssue({ number, body, files, mustNotTouch, blockedBy }) {
  const declared = parseDeclared(body)
  return {
    number,
    files: (files ?? declared.files)?.map(normalizePath) ?? null,
    mustNotTouch: (mustNotTouch ?? declared.mustNotTouch ?? []).map(normalizePath),
    blockedBy: blockedBy ?? [],
  }
}

/** The names of the hot spot groups any of the paths touches, in the list's order. */
export function hotSpotsTouched(paths) {
  return HOT_SPOTS.filter((group) =>
    group.paths.some((hot) => paths.some((p) => pathsOverlap(p, hot))),
  ).map((group) => group.name)
}

const byIssues = (a, b) => a.issues[0] - b.issues[0] || a.issues[1] - b.issues[1] || 0

/**
 * Every clash among the issues, sorted. With `candidate`, only clashes that involve that issue.
 * Kinds: `undeclared`, `contradiction` (one issue, both sections), and per pair `files`,
 * `hot-spot` and `blocked` (a blocker that is in the set).
 */
export function checkOverlap(issues, { candidate } = {}) {
  const set = [...issues].sort((a, b) => a.number - b.number)
  const clashes = []
  for (const issue of set) {
    if (candidate !== undefined && issue.number !== candidate) continue
    if (issue.files === null) {
      clashes.push({
        kind: 'undeclared',
        issues: [issue.number],
        detail: 'no "Files likely touched" paths declared; write backticked paths or None',
      })
      continue
    }
    for (const path of issue.files) {
      const same = issue.mustNotTouch.find((m) => pathsOverlap(path, m))
      if (same !== undefined)
        clashes.push({
          kind: 'contradiction',
          issues: [issue.number],
          detail: `${path} is in files likely touched and ${same} in must not touch`,
        })
    }
  }
  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) {
      const [a, b] = [set[i], set[j]]
      if (candidate !== undefined && a.number !== candidate && b.number !== candidate) continue
      const pair = [a.number, b.number]
      for (const [first, second] of [
        [a, b],
        [b, a],
      ]) {
        if (first.blockedBy.includes(second.number))
          clashes.push({
            kind: 'blocked',
            issues: pair,
            detail: `#${first.number} is blocked by #${second.number}`,
          })
      }
      if (a.files === null || b.files === null) continue
      const seen = new Set()
      for (const pa of a.files)
        for (const pb of b.files) {
          if (!pathsOverlap(pa, pb)) continue
          const line = `${pa} (#${a.number}) overlaps ${pb} (#${b.number})`
          if (!seen.has(line)) clashes.push({ kind: 'files', issues: pair, detail: line })
          seen.add(line)
        }
      // The written rule: two issues that each touch any hot spot overlap
      const [hotA, hotB] = [hotSpotsTouched(a.files), hotSpotsTouched(b.files)]
      if (hotA.length && hotB.length)
        clashes.push({
          kind: 'hot-spot',
          issues: pair,
          detail: `#${a.number} touches ${hotA.join(', ')}; #${b.number} touches ${hotB.join(', ')}`,
        })
    }
  }
  return clashes.sort(byIssues)
}

/** One line per clash. */
export function formatClashes(clashes) {
  return clashes.map((c) => `${c.issues.map((n) => `#${n}`).join(' / ')} ${c.kind}: ${c.detail}`)
}

const isList = (value, test) => Array.isArray(value) && value.every(test)

/**
 * Why the input cannot be checked, or null. A wrong or missing candidate must never read as "no
 * overlap", so it is bad input (exit 2), not a pass.
 */
export function inputProblem(list, candidate) {
  if (!Array.isArray(list) || list.length === 0)
    return 'The input must be a non-empty list of issues.'
  const numbers = new Set()
  for (const item of list) {
    if (!Number.isInteger(item?.number)) return 'Every issue in the list needs a number.'
    if (numbers.has(item.number)) return `Issue #${item.number} is in the list twice.`
    numbers.add(item.number)
    const isPath = (v) => typeof v === 'string'
    if (item.body !== undefined && typeof item.body !== 'string')
      return `#${item.number}: body must be text.`
    for (const key of ['files', 'mustNotTouch'])
      if (item[key] !== undefined && !isList(item[key], isPath))
        return `#${item.number}: ${key} must be a list of paths.`
    if (item.blockedBy !== undefined && !isList(item.blockedBy, Number.isInteger))
      return `#${item.number}: blockedBy must be a list of issue numbers.`
  }
  if (candidate !== undefined && !numbers.has(candidate))
    return `The candidate #${candidate} is not in the list; add it, or the check says nothing about it.`
  return null
}

/** Runs the command line; returns the exit code. */
export function main(argv, out = console.log) {
  const args = argv.slice(2)
  const candidateAt = args.indexOf('--candidate')
  const candidate = candidateAt === -1 ? undefined : Number(args[candidateAt + 1])
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--candidate')
  if (!file || (candidateAt !== -1 && !Number.isInteger(candidate))) {
    out('Usage: node scripts/overlap-check.mjs issues.json [--candidate <number>]')
    return 2
  }
  let list
  try {
    list = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    out(`Cannot read ${file}: ${error.message}`)
    return 2
  }
  const problem = inputProblem(list, candidate)
  if (problem) {
    out(problem)
    return 2
  }
  const issues = list.map(normalizeIssue)
  const lines = formatClashes(checkOverlap(issues, { candidate }))
  if (lines.length === 0) {
    out(`No overlap among ${issues.map((i) => `#${i.number}`).join(', ')}`)
    return 0
  }
  lines.forEach((line) => out(line))
  return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv)
