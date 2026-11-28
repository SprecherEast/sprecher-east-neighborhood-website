/**
 * Proof that no instruction was lost when the first layer shrank (#1553, phase 1): every instruction
 * moved out of `AGENTS.md`, `CLAUDE.md` and the always-loaded references has a new home that still
 * says it, and something loads that home when its task starts: a skill whose description names the
 * task, or a path-scoped rule whose globs match the files the task touches.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { BUDGET_TOKENS, run } from './agent-context.mjs'
import { GENERATED_DIR, buildRules, ruleName } from './agent-context-rules.mjs'
import { globToRegExp } from './agent-context-maps.mjs'
import { parseFrontmatter } from './frontmatter.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\s+/g, ' ')
const raw = (file) => fs.readFileSync(path.join(root, file), 'utf8')

/** Each moved instruction: a phrase that identifies it, its new home, and what loads the home. */
const SKILL = (name) => ({ skill: name })
const RULE = (source, work) => ({ rule: source, work })
const FILE = (...readers) => ({ readBy: readers })
const MOVED = [
  [
    'the five rules on the path to main',
    'Merge, then CI/CD takes over',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  [
    'issue first, labels, grooming',
    'The issue is groomed into',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  ['pull request sections', 'Risk & rollback', 'change-workflow', SKILL('change-workflow')],
  [
    'independent review and policy-change list',
    'Changes to the process are policy changes',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  [
    'required checks before merge',
    'All required checks pass before merge',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  [
    'milestone and epic per issue',
    'Every issue has a milestone',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  [
    'server configuration is tracked',
    'Server configuration is not code, but it is still tracked',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  [
    'how GitHub enforces the rules',
    'the no-bypass rule rests on every agent merging',
    'change-workflow',
    SKILL('change-workflow'),
  ],
  ['vendored Vercel skills', 'vendored in this repo unchanged', 'write-code', SKILL('write-code')],
  [
    'where knowledge lives',
    'each next to its code',
    'where-knowledge-lives',
    RULE('docs/guidelines/where-knowledge-lives.md', [
      'docs/process/x.md',
      'AGENTS.md',
      '.agents/skills/a/SKILL.md',
      'src/modules/news/README.md',
    ]),
  ],
  [
    'tool adapters hold only what is specific to their tool',
    'An adapter holds only what is specific to its tool',
    'where-knowledge-lives',
    RULE('docs/guidelines/where-knowledge-lives.md', ['CLAUDE.md', '.claude/rules/a.md']),
  ],
  [
    'guard rails, full text',
    'Violations are Blockers',
    'guard-rails',
    RULE('docs/guidelines/guard-rails.md', [
      'src/modules/news/domain/a.ts',
      'scripts/a.mjs',
      'docs/guidelines/development.md',
      '.agents/skills/write-code/SKILL.md',
      'package.json',
      'docs/process/a.md',
      'AGENTS.md',
      'CLAUDE.md',
      '.claude/agents/worker.md',
      '.claude/settings.json',
      'developer/app/page.tsx',
      '.storybook/main.ts',
      '.husky/pre-commit',
      'vitest.config.ts',
      'tsconfig.json',
      '.github/workflows/a.yml',
    ]),
  ],
  [
    'guard rails, enforcement table',
    'What enforces them',
    'guard-rails',
    RULE('docs/guidelines/guard-rails.md', ['src/platform/ui/Button.tsx']),
  ],
  [
    'skill pointers for Claude Code',
    'points to `.agents/skills/<name>/SKILL.md`',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', [
      '.claude/skills/a/SKILL.md',
      '.agents/skills/a/SKILL.md',
      'CLAUDE.md',
    ]),
  ],
  [
    'self-review and simplify alias',
    'Run it again before opening or updating a PR',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', [
      '.claude/skills/simplify/SKILL.md',
      '.agents/skills/self-review/SKILL.md',
    ]),
  ],
  [
    'models and effort',
    'Start the reviewer on `opus` at `high`',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', [
      '.claude/agents/qa-reviewer.md',
      '.claude/settings.json',
    ]),
  ],
  [
    'independent review and wrap-up in Claude Code',
    'never in the context that wrote the change',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', ['.claude/agents/worker.md']),
  ],
  [
    'unattended runs',
    'dangerously-skip-permissions',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', [
      '.github/workflows/deploy.yml',
      '.claude/settings.json',
    ]),
  ],
  [
    'waiting for checks, in the background',
    'run_in_background',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', ['.github/workflows/deploy.yml']),
  ],
  [
    'waiting for checks, for a worker',
    'run_in_background',
    '.claude/agents/worker.md',
    FILE('worker agent'),
  ],
  [
    'browser and dev server',
    'launch.json',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', ['.claude/launch.json']),
  ],
  [
    'never edit the generated rule copies',
    'Never edit a copy',
    'claude-code-setup',
    RULE('.claude/rules/claude-code-setup.md', ['.claude/rules/generated/a.md', 'CLAUDE.md']),
  ],
].map(([what, phrase, home, load]) => ({
  what,
  phrase,
  home: home.includes('/') ? home : homeFile(home),
  load,
}))

function homeFile(name) {
  if (name === 'change-workflow' || name === 'write-code') return `.agents/skills/${name}/SKILL.md`
  if (name === 'claude-code-setup') return '.claude/rules/claude-code-setup.md'
  return `docs/guidelines/${name}.md`
}

// The generated rules are build output, not in git: build them from the maps, as the hook does
const built = buildRules(root)
const loaded = run(root).loaded.map((file) => file.file)
const firstLayer = loaded.map(read).join(' ')

describe('every moved instruction still has a home that says it', () => {
  it.each(MOVED)('$what: in $home', ({ phrase, home }) => {
    expect(fs.existsSync(path.join(root, home)), `${home} exists`).toBe(true)
    expect(read(home)).toContain(phrase)
  })

  it.each(MOVED.filter(({ what }) => !/unattended|waiting|models/.test(what)))(
    '$what: no longer loaded in every session',
    ({ phrase }) => {
      expect(firstLayer).not.toContain(phrase)
    },
  )
})

describe('the load trigger matches the work that needs the instruction', () => {
  const skills = MOVED.filter(({ load }) => load.skill)
  const rules = MOVED.filter(({ load }) => load.rule)

  it.each(skills)(
    '$what: the $load.skill skill and its Claude Code pointer say when to use it',
    ({ load }) => {
      const description = parseFrontmatter(raw(`.agents/skills/${load.skill}/SKILL.md`)).description
      const pointer = parseFrontmatter(raw(`.claude/skills/${load.skill}/SKILL.md`)).description
      if (load.skill !== 'write-code') expect(pointer).toBe(description)
      expect(description).toMatch(/\bUse (when|before|after)\b/)
    },
  )

  it('the skills that own filing, reviewing and merging name those tasks in their description', () => {
    const description = (name) =>
      parseFrontmatter(raw(`.agents/skills/${name}/SKILL.md`)).description
    expect(description('change-workflow')).toMatch(/file an issue/)
    expect(description('change-workflow')).toMatch(/open or update a pull request/)
    expect(description('change-workflow')).toMatch(/merge it/)
    expect(description('pr-review')).toMatch(/asked to review a PR/)
    expect(description('pr-review')).toMatch(/never review a PR you authored/)
    expect(description('project-tracking')).toMatch(/pick up, file, claim, plan or report work/)
  })

  it.each(rules)('$what: the generated rule for $load.rule loads for its files', ({ load }) => {
    const file = load.rule.startsWith('.claude/rules/')
      ? load.rule
      : `${GENERATED_DIR}/${ruleName(load.rule)}`
    const paths = parseFrontmatter(load.rule === file ? raw(file) : built.rules.get(file)).paths
    expect(paths?.length, `${file} has paths`).toBeGreaterThan(0)
    for (const work of load.work) {
      expect(
        paths.some((glob) => globToRegExp(glob).test(work)),
        `${work} matches ${file}`,
      ).toBe(true)
    }
  })

  it('the Claude Code agents that wait for checks name how, and the chief of staff skill finds the model rule', () => {
    expect(raw('.claude/agents/worker.md')).toContain('/wrapped')
    expect(read('.agents/skills/chief-of-staff/SKILL.md')).toContain('claude-code-setup.md')
    expect(read('.agents/skills/pr-review/SKILL.md')).toContain('claude-code-setup.md')
  })
})

describe('the guard rails load for every path a change can touch', () => {
  // Only assets and an empty placeholder folder hold no code, config, docs, workflow or agent file
  const NO_CODE = [/^public\//, /^data\//]
  it('matches every tracked file, so a folder added later and missed fails here', () => {
    const globs = parseFrontmatter(
      built.rules.get(`${GENERATED_DIR}/${ruleName('docs/guidelines/guard-rails.md')}`),
    ).paths
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((file) => file && !NO_CODE.some((pattern) => pattern.test(file)))
    const missed = tracked.filter((file) => !globs.some((glob) => globToRegExp(glob).test(file)))
    expect(missed).toEqual([])
  })
})

describe('the first layer is a short core with pointers', () => {
  it('points to each next level', () => {
    const agents = read('AGENTS.md')
    for (const pointer of [
      '.agents/skills/change-workflow/SKILL.md',
      'docs/guidelines/guard-rails.md',
      'docs/guidelines/README.md',
      'docs/knowledge/index.md',
      'docs/guidelines/where-knowledge-lives.md',
      'docs/process/filing-checklist.md',
    ]) {
      expect(agents, pointer).toContain(pointer)
      expect(fs.existsSync(path.join(root, pointer))).toBe(true)
    }
  })

  it('imports nothing but AGENTS.md', () => {
    expect(raw('CLAUDE.md').match(/^@\S+/gm)).toEqual(['@AGENTS.md'])
  })

  it('keeps the rules that stay everywhere: the guard rails statement and the Never list', () => {
    const agents = read('AGENTS.md')
    expect(agents).toContain('a breach is a Blocker')
    expect(agents).toContain('Never remove `needs owner`')
    expect(agents).toContain('Never change code on the server')
    expect(agents).toContain('The name is "Sprecher East"')
  })

  it('stays under its budget, which was lowered to this level', () => {
    const { total, problems } = run(root)
    expect(problems.filter((problem) => problem.includes('session start'))).toEqual([])
    expect(total).toBeLessThanOrEqual(BUDGET_TOKENS)
    expect(BUDGET_TOKENS).toBeLessThan(2500)
  })
})
