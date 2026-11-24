/**
 * The agent setup is the chief of staff, one worker and one reviewer (#695). These checks keep
 * every agent, skill pointer and role guide the docs name real, keep removed agents out of the
 * docs, and keep leftovers of a broken find-and-replace (a literal backslash and digit) out of
 * them. They scan every Markdown and YAML file under `docs/`, `.claude/`, `.agents/`, `.github/`,
 * `ops/`, `intelligence/` and `src/`, plus `AGENTS.md` and `CLAUDE.md`. They leave out history
 * (`docs/memory/`, `docs/sprint-2-tasks.md`, the decision records), the third-party `vercel-`
 * skills, and `scripts/`, whose tests name the removed agents as data.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseFrontmatter } from './frontmatter.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const names = (dir, ext) =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => entry.name)

const SKIPPED = [
  'node_modules',
  '.next',
  'docs/memory',
  'docs/sprint-2-tasks.md',
  'docs/architecture/decisions',
  '.agents/skills/vercel-',
]

/** Every Markdown and YAML file under `dir`, as repository paths. */
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`
    if (SKIPPED.some((skipped) => file.startsWith(skipped))) return []
    if (entry.isDirectory()) return walk(file)
    return /\.(md|ya?ml)$/.test(entry.name) ? [file] : []
  })
}

/** The only agents in use; the chief of staff may start the other two. */
const AGENTS = ['chief-of-staff', 'qa-reviewer', 'worker']

/** Role guides in docs/roles that were once agents too, named so a revival fails here. */
const REMOVED = [
  'backend-eng',
  'cms-eng',
  'content-lead',
  'events-mgr',
  'frontend-eng',
  'legal-compliance',
  'media-mgr',
  'ops-lead',
  'seo-specialist',
  'ui-designer',
  'ux-designer',
]

const DOCS = [
  'AGENTS.md',
  'CLAUDE.md',
  ...['docs', '.claude', '.agents', '.github', 'ops', 'intelligence', 'src'].flatMap((dir) =>
    exists(dir) ? walk(dir) : [],
  ),
]

const frontmatter = (file) => parseFrontmatter(read(file))
const mentions = (re) =>
  DOCS.flatMap((file) => [...read(file).matchAll(re)].map((m) => [file, m[1]]))

describe('agents', () => {
  it('are exactly the chief of staff, the worker and the reviewer', () => {
    expect(names('.claude/agents', '.md').map((n) => n.replace(/\.md$/, ''))).toEqual(AGENTS)
  })

  it.each(AGENTS)('%s is named by its file and points at something that exists', (agent) => {
    const file = `.claude/agents/${agent}.md`
    expect(frontmatter(file).name).toBe(agent)
    const pointer =
      agent === 'chief-of-staff'
        ? '.agents/skills/chief-of-staff/SKILL.md'
        : `docs/roles/${agent}.md`
    expect(read(file)).toContain(pointer)
    expect(exists(pointer), pointer).toBe(true)
  })

  it('are the only ones the chief of staff may start, and every path to one resolves', () => {
    const start = String(frontmatter('.claude/agents/chief-of-staff.md').tools).match(
      /Agent\(([^)]*)\)/,
    )
    expect(
      start[1]
        .split(',')
        .map((n) => n.trim())
        .sort(),
    ).toEqual(['qa-reviewer', 'worker'])
    for (const [file, agent] of mentions(/\.claude\/agents\/([\w-]+)(?:\.md)?/g)) {
      expect(AGENTS, `${file} names the agent ${agent}`).toContain(agent)
    }
  })

  it('are the only agents the docs describe', () => {
    for (const file of DOCS) {
      const text = read(file)
      expect(text, file).not.toMatch(/\brole agents?\b/i)
      expect(text, file).not.toMatch(/registers each role/i)
      for (const role of REMOVED) {
        expect(text, `${file} names ${role} as an agent`).not.toMatch(
          new RegExp(`\\.claude/agents/${role}|\\b${role}\\b agent|agent \`${role}\``, 'i'),
        )
      }
    }
  })
})

describe('role guides', () => {
  const guides = names('docs/roles', '.md')
    .filter((n) => n !== 'README.md')
    .map((n) => n.replace(/\.md$/, ''))

  it('are each listed by name in docs/roles/README.md, and each listed guide exists', () => {
    const listed = [...read('docs/roles/README.md').matchAll(/\]\(([\w-]+)\.md\)/g)].map(
      (m) => m[1],
    )
    expect([...new Set(listed)].sort()).toEqual([...guides].sort())
  })

  it('include one for every agent that works from one, and for each role once an agent', () => {
    for (const agent of ['qa-reviewer', 'worker']) expect(guides).toContain(agent)
    for (const role of REMOVED) expect(guides).toContain(role)
  })

  it('are loaded as docs/roles/<name>.md, and the README says so', () => {
    expect(read('docs/roles/README.md')).toMatch(/## How a role guide is loaded/)
    for (const [file, guide] of mentions(/docs\/roles\/([\w-]+)\.md/g)) {
      expect([...guides, 'README'], `${file} names the guide ${guide}`).toContain(guide)
    }
  })
})

describe('skill pointers', () => {
  const skills = fs.readdirSync(path.join(root, '.agents/skills'))

  it.each(skills)('.claude/skills/%s points at its .agents/skills copy', (skill) => {
    const pointer = `.claude/skills/${skill}/SKILL.md`
    expect(exists(pointer), pointer).toBe(true)
    expect(read(pointer)).toContain(`.agents/skills/${skill}/SKILL.md`)
    const source = frontmatter(`.agents/skills/${skill}/SKILL.md`)
    expect(frontmatter(pointer)).toEqual({ name: source.name, description: source.description })
  })

  it('has no pointer without a skill, apart from the simplify alias', () => {
    const pointers = fs
      .readdirSync(path.join(root, '.claude/skills'))
      .filter((n) => n !== 'simplify')
    expect(pointers.sort()).toEqual([...skills].sort())
  })

  it('are the only skills the docs name', () => {
    for (const [file, skill] of mentions(/\.agents\/skills\/([\w-]+)\//g)) {
      expect(skills, `${file} names the skill ${skill}`).toContain(skill)
    }
  })
})

describe('the docs', () => {
  const withoutCode = (text) =>
    text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '')

  it('hold no literal backslash and digit left by a broken find-and-replace', () => {
    const own = DOCS.filter((file) => /^(docs|\.agents|\.claude)\//.test(file))
    expect(own.length).toBeGreaterThan(50)
    for (const file of own) {
      expect(withoutCode(read(file)), file).not.toMatch(/\\\d/)
    }
  })
})
