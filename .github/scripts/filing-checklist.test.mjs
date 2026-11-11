import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { CHECKLIST_PATH, renderChecklist } from './filing-checklist.mjs'
import { ISSUE_RULE_FIXES } from './issue-policy.mjs'
import { PR_RULE_FIXES } from './pr-body.mjs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

/** Every quoted rule ID with this prefix in a source file. */
const ruleIdsIn = (path, prefix) =>
  new Set(
    [...read(path).matchAll(new RegExp(`['"\`](${prefix}-[A-Z0-9-]+)['"\`]`, 'g'))].map(
      (m) => m[1],
    ),
  )

describe('the filing checklist (#971)', () => {
  const checklist = fs.readFileSync(CHECKLIST_PATH, 'utf8')

  it('is the page generated from the rule lists, so it never drifts from the gates', () => {
    expect(checklist).toBe(renderChecklist())
  })

  it('has a line with its one-line fix for every pull request gate rule ID', () => {
    for (const [id, fix] of Object.entries(PR_RULE_FIXES)) {
      expect(checklist).toContain(`\`${id}\``)
      expect(checklist).toContain(fix)
    }
  })

  it('has a line with its one-line fix for every issue check rule ID', () => {
    for (const [id, fix] of Object.entries(ISSUE_RULE_FIXES)) {
      expect(checklist).toContain(`\`${id}\``)
      expect(checklist).toContain(fix)
    }
  })

  it('lists every rule ID the gates can report, found in their source and workflow', () => {
    const prIds = new Set([
      ...ruleIdsIn('./pr-body.mjs', 'PR'),
      ...ruleIdsIn('../workflows/pr-policy.yml', 'PR'),
    ])
    expect([...prIds].sort()).toEqual(Object.keys(PR_RULE_FIXES).sort())
    expect([...ruleIdsIn('./issue-policy.mjs', 'ISSUE')].sort()).toEqual(
      Object.keys(ISSUE_RULE_FIXES).sort(),
    )
  })

  it('names PR-GROOMED, which the pull request gate now checks (#984)', () => {
    expect(checklist).toContain('`PR-GROOMED`')
  })

  it('is pointed to from AGENTS.md, the issue forms, the PR template and the session guide', () => {
    const paths = [
      'AGENTS.md',
      '.github/pull_request_template.md',
      '.github/ISSUE_TEMPLATE/config.yml',
      'docs/process/start-a-session.md',
      ...fs
        .readdirSync(new URL('../ISSUE_TEMPLATE/', import.meta.url))
        .filter((name) => /^\d-.*\.yml$/.test(name))
        .map((name) => `.github/ISSUE_TEMPLATE/${name}`),
    ]
    for (const path of paths) expect(read(`../../${path}`), path).toContain('filing-checklist.md')
  })
})
