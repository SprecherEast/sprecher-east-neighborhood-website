/**
 * What each job of the Planner Board workflow may write (#1435): the job that moves a card holds the
 * two writes it needs and nothing more, and the job that only reports holds none. Test first.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('../.github/workflows/planner-board.yml', import.meta.url),
  'utf8',
)

/** The text of one top-level job. */
const job = (name) => {
  const start = workflow.indexOf(`\n  ${name}:\n`)
  const rest = workflow.slice(start + 1)
  const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/)
  return next === -1 ? rest : rest.slice(0, next + 1)
}
const permissions = (text) =>
  Object.fromEntries([...text.matchAll(/permission-([a-z-]+): (\w+)/g)].map((m) => [m[1], m[2]]))

describe('the Planner Board workflow', () => {
  it('lets the job that moves a card write issues (the comment) and organization projects (the card)', () => {
    expect(permissions(job('board'))).toEqual({ issues: 'write', 'organization-projects': 'write' })
  })

  it('keeps the report job read-only', () => {
    expect(permissions(job('report'))).toEqual({ issues: 'read', 'organization-projects': 'read' })
  })

  it('reads the workflow-level token as contents: read only', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m)
  })

  it('no longer passes the label name, which the rule does not need', () => {
    expect(workflow).not.toContain('github.event.label.name')
  })

  it('shares the checkout of the planner scripts between the jobs through one anchor', () => {
    expect(workflow.match(/sparse-checkout: \|/g)).toHaveLength(1)
    expect(workflow).toMatch(/- &checkout\b/)
    expect(workflow).toMatch(/- \*checkout\b/)
  })

  it('checks out the facts module and the scripts it imports', () => {
    expect(workflow).toContain('/scripts/')
    expect(workflow).toContain('/.github/scripts/')
    expect(workflow).toContain('/.github/label-policy.json')
  })
})

describe('one run at a time for an issue', () => {
  it('puts every run for one issue in one concurrency group, so two runs never post two comments', () => {
    const group = workflow.match(/concurrency:\n {2}group: (.*)\n/)[1]
    expect(group).not.toMatch(/work|state/)
    expect(group).toContain('github.event.issue.number')
  })

  it('gives a manual run its own group, so an event for the same issue never cancels the owner confirming a card', () => {
    const group = workflow.match(/concurrency:\n {2}group: (.*)\n/)[1]
    expect(group).toMatch(/workflow_dispatch[^}]*-manual/)
    expect(workflow).toMatch(/cancel-in-progress: false/)
  })

  it('describes what the job writes now: a comment on every move and every held move, and held backward moves', () => {
    const header = workflow.slice(0, workflow.indexOf('\non:'))
    expect(header).toMatch(/every move/i)
    expect(header).toMatch(/held/i)
    expect(header).not.toMatch(/do not make/i)
  })

  it('tells both jobs the app name, so the planner finds its own comment and no other', () => {
    expect(
      workflow.match(/PLANNER_APP_SLUG: \$\{\{ steps\.app\.outputs\.app-slug \}\}/g),
    ).toHaveLength(2)
  })
})
