/**
 * Static check of the chief of staff agent's limits (#695). It reads `disallowedTools` and `tools`
 * from the agent file and applies Claude Code's documented matching for `Bash(...)` rules to each
 * forbidden action. This proves the file lists the actions; it does not prove the harness refuses
 * them. The refusal itself is tried by hand: see "Manual test: the chief of staff's limits" in
 * docs/process/agent-operating-model.md, whose results table stays empty until someone runs it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const AGENT = '.claude/agents/chief-of-staff.md'
const text = fs.readFileSync(path.join(root, AGENT), 'utf8')
const frontmatter = yaml.load(text.match(/^---\n([\s\S]*?)\n---/)[1])

/** Frontmatter lists may be a YAML list or a comma-separated string (commas inside parentheses stay). */
const list = (value) =>
  Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(/,(?![^(]*\))/)
        .map((s) => s.trim())
        .filter(Boolean)

const disallowed = list(frontmatter.disallowedTools)
const allowed = list(frontmatter.tools)

/** Does a deny rule refuse this tool call? `*` matches anything; a trailing " *" also matches the bare command. */
function refuses(rules, tool, command) {
  return rules.some((rule) => {
    const match = rule.match(/^([A-Za-z]+)(?:\((.*)\))?$/)
    if (!match || match[1] !== tool) return false
    if (match[2] === undefined) return true
    if (tool !== 'Bash') return false
    const pattern = match[2]
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/ \*$/, '( .*)?')
      .replace(/\*/g, '.*')
    return new RegExp(`^${pattern}$`).test(command)
  })
}

describe('the chief of staff agent file', () => {
  it('uses the strongest model by its plain alias, at high effort', () => {
    expect(frontmatter.name).toBe('chief-of-staff')
    expect(frontmatter.model).toBe('opus')
    expect(frontmatter.effort).toBe('high')
  })

  it('points at its skill', () => {
    expect(text).toContain('.agents/skills/chief-of-staff/SKILL.md')
  })

  it.each(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])('refuses the %s tool', (tool) => {
    expect(refuses(disallowed, tool, '')).toBe(true)
    expect(allowed).not.toContain(tool)
  })

  it.each([
    'git push',
    'git push origin agent/x/1-y',
    'git push --force-with-lease origin x',
    'git -C worktree push origin x',
    'git merge main',
    'git -C worktree merge main',
    'gh pr merge 12 --squash',
    'gh api -X PUT repos/o/r/pulls/12/merge-async -f merge_method=squash',
    'gh api -X PUT repos/o/r/pulls/12/merge',
  ])('refuses the command: %s', (command) => {
    expect(refuses(disallowed, 'Bash', command)).toBe(true)
  })

  it.each([
    'git status',
    'git log --oneline',
    'git merge-base main HEAD',
    'gh api repos/o/r/issues/695',
    'gh pr view 12',
    'node scripts/overlap-check.mjs issues.json',
  ])('still allows the command: %s', (command) => {
    expect(refuses(disallowed, 'Bash', command)).toBe(false)
  })

  it('may start only the worker and the reviewer', () => {
    const agentTools = allowed.filter((t) => t === 'Agent' || t.startsWith('Agent('))
    expect(agentTools).toEqual(['Agent(worker, qa-reviewer)'])
  })

  it('leaves the twelve role agents as they are', () => {
    const files = fs
      .readdirSync(path.join(root, '.claude/agents'))
      .filter((f) => f !== 'chief-of-staff.md')
    expect(files).toHaveLength(12)
  })
})
