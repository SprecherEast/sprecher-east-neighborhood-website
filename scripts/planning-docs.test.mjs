/**
 * Static checks of the planning playbook: the two process docs, the skills that point at them, the
 * load map row that makes them load, and the manual test's dry-run section. They keep every
 * section a skill or doc links to real, keep each file short, and keep the playbook free of
 * issue numbers and dates, which go stale (the owner's rule for anything written from a conversation).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseLoadMap } from './agent-context-maps.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const MODEL = 'docs/process/planning-model.md'
const PLAYBOOK = 'docs/process/grooming-playbook.md'
const SKILLS = [
  '.agents/skills/chief-of-staff/SKILL.md',
  '.agents/skills/project-tracking/SKILL.md',
]
const MANUAL_TEST = 'docs/process/chief-of-staff-manual-test.md'
const WATCH_LIST = 'docs/process/watch-list.md'

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens. */
const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

const anchors = (file) =>
  new Set(
    [...read(file).matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slug(match[1].replace(/`/g, ''))),
  )

/** Every relative markdown link in a file, as { target, anchor }. */
const links = (file) =>
  [...read(file).matchAll(/\]\(([^)\s#]+\.md)(?:#([^)\s]+))?\)/g)].map((match) => ({
    target: path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])),
    anchor: match[2],
  }))

describe.each([MODEL, PLAYBOOK])('%s', (file) => {
  const text = read(file)

  it('stays under 250 lines', () => {
    expect(text.split('\n').length).toBeLessThan(250)
  })

  it('holds principles only: no issue numbers, no dates', () => {
    expect(text, 'an issue or PR number').not.toMatch(/(^|[\s(])#\d+/m)
    expect(text.replace(/https?:\/\/\S+/g, ''), 'a date').not.toMatch(/\b20\d\d-\d\d-\d\d\b/)
  })

  it('links only to files and sections that exist', () => {
    for (const { target, anchor } of links(file)) {
      expect(fs.existsSync(path.join(root, target)), `${target} exists`).toBe(true)
      if (anchor) expect(anchors(target), `${target}#${anchor}`).toContain(anchor)
    }
  })
})

describe('the planning model', () => {
  const text = read(MODEL)

  it.each([
    'Milestone',
    'Epic',
    'Issue and sub-issue',
    'Sprint',
    'Labels and fields',
    'Dependencies',
    'Which layer?',
    'Anti-patterns',
    'Templates',
    'Sources',
  ])('has a "%s" section', (heading) => {
    expect(anchors(MODEL)).toContain(slug(heading))
  })

  it('says where GitHub differs from Jira', () => {
    expect(text).toMatch(/one level/i)
    expect(text).toMatch(/one per issue/i)
    expect(text).toMatch(/repository/i)
  })

  it('cites the official GitHub Docs and the agile references it relies on', () => {
    const sources = text.slice(text.indexOf('## Sources'))
    for (const url of [
      'docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones',
      'docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues',
      'docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies',
      'docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-iteration-fields',
      'docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization',
      'docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization',
      'atlassian.com/agile/project-management/epics-stories-themes',
      'scrumguides.org/scrum-guide.html',
      'INVEST',
    ]) {
      expect(sources, url).toContain(url)
    }
  })
})

describe('the grooming playbook', () => {
  it.each([
    'Modes: apply and propose',
    'Board moves: entry and exit criteria',
    'Backlog to Ready',
    'Ready to In progress',
    'In progress to In review',
    'In review to Done',
    'Reopen',
    'Park',
    'Triggers',
    'The sweep',
    'Report format',
    'Retro-organization',
  ])('has a "%s" section', (heading) => {
    expect(anchors(PLAYBOOK)).toContain(slug(heading))
  })

  it('says the dry run changes nothing and apply makes only approved changes', () => {
    const text = read(PLAYBOOK)
    expect(text).toMatch(/dry run[^.]*changes nothing/i)
    expect(text).toMatch(/only[^.]*approved/i)
  })

  it('applies routine grooming directly and proposes closing, scope, structure and rules', () => {
    const text = read(PLAYBOOK)
    const modes = text.slice(text.indexOf('## Modes'), text.indexOf('## Board moves'))
    const [applied, proposed] = modes.split('- **Proposed')
    for (const word of ['labels', 'priority and size', '`ready` label']) {
      expect(applied, word).toContain(word)
    }
    for (const word of ['Closing', 'acceptance criteria', 'milestone', 'rule']) {
      expect(proposed, word).toContain(word)
    }
  })

  it('watches for drift and repeated failures in the sweep', () => {
    const text = read(PLAYBOOK)
    expect(text).toContain('### Drift and repeated failures')
    expect(links(PLAYBOOK).map((link) => link.target)).toContain(WATCH_LIST)
  })

  it('covers the duplicate, stale and orphan checks', () => {
    const text = read(PLAYBOOK)
    for (const word of ['Duplicates', 'Stale', 'Orphans', 'Missing fields', 'Wrong layer']) {
      expect(text, word).toContain(word)
    }
  })
})

describe('what points at the playbook', () => {
  it.each(SKILLS)('%s links both documents and the sections it relies on', (skill) => {
    const found = links(skill)
    expect(found.map((link) => link.target)).toEqual(expect.arrayContaining([MODEL, PLAYBOOK]))
    for (const { target, anchor } of found) {
      expect(fs.existsSync(path.join(root, target)), `${target} exists`).toBe(true)
      if (anchor) expect(anchors(target), `${target}#${anchor}`).toContain(anchor)
    }
  })

  it('has a chief of staff section for the sweep and the retro-organization', () => {
    const skill = read('.agents/skills/chief-of-staff/SKILL.md')
    expect(skill).toMatch(/^## \d+\. Grooming sweep/m)
    expect(skill).toMatch(/retro-organization/i)
  })

  it('has a load map row for each document, so they load when the work touches them', () => {
    const entries = parseLoadMap(read('docs/guidelines/README.md'))
    for (const doc of [MODEL, PLAYBOOK]) {
      const entry = entries.find((item) => item.source === doc)
      expect(entry, `${doc} has a row`).toBeTruthy()
      expect(entry.paths).toContain('.agents/skills/chief-of-staff/**')
    }
  })

  it('has the generated copies the load map produces', () => {
    for (const name of ['planning-model', 'grooming-playbook']) {
      expect(
        fs.existsSync(path.join(root, `.claude/rules/generated/docs--process--${name}.md`)),
      ).toBe(true)
    }
  })

  it('links how-we-work to both documents', () => {
    const targets = links('docs/process/project-management.md').map((link) => link.target)
    expect(targets).toEqual(expect.arrayContaining([MODEL, PLAYBOOK]))
  })
})

describe('the watch list', () => {
  const text = read(WATCH_LIST)

  it('stays under 250 lines and names no threshold', () => {
    expect(text.split('\n').length).toBeLessThan(250)
    expect(text).not.toMatch(/\d+\s*(%|percent|ms|seconds|minutes)/i)
  })

  it('says who watches each row: a check, the chief of staff, or nobody yet', () => {
    const rows = text
      .split('\n')
      .filter((line) => /^\| [A-Z]/.test(line) && !/^\| Watch/.test(line))
    expect(rows.length).toBeGreaterThan(20)
    for (const row of rows) expect(row, row).toMatch(/\| (Check|Chief of staff|Not yet)\s*\|$/)
  })

  it('cites its sources and links only to files and sections that exist', () => {
    for (const source of ['dora.dev', 'sre.google', 'anthropic.com', 'developers.openai.com']) {
      expect(text, source).toContain(source)
    }
    for (const { target, anchor } of links(WATCH_LIST)) {
      expect(fs.existsSync(path.join(root, target)), `${target} exists`).toBe(true)
      if (anchor) expect(anchors(target), `${target}#${anchor}`).toContain(anchor)
    }
  })

  it('has a load map row and is read from the chief of staff skill at the start of a session', () => {
    expect(read('docs/guidelines/README.md')).toContain('(../process/watch-list.md)')
    const skill = '.agents/skills/chief-of-staff/SKILL.md'
    expect(links(skill).map((link) => link.target)).toContain(WATCH_LIST)
    expect(read(skill)).toMatch(/status=failure&event=pull_request/)
  })
})

describe('the manual test', () => {
  const text = read(MANUAL_TEST)

  it('has a dry-run grooming section with how to start the session', () => {
    expect(anchors(MANUAL_TEST)).toContain('dry-run-grooming')
    const section = text.slice(text.indexOf('## Dry-run grooming'))
    expect(section).toMatch(/new session/i)
    expect(section).toMatch(/repository/i)
    expect(section).toMatch(/dry-run grooming report/i)
    expect(section).toMatch(/no changes/i)
  })
})
