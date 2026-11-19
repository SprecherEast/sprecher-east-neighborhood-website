import { describe, expect, it } from 'vitest'

import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
  apiKeyProblem,
  buildClaudeArgs,
  changedPaths,
  childEnv,
  isolatePermissions,
  runChanges,
} from './claude.mjs'

describe('what a run may use', () => {
  it('has no bare Edit or Write, so the edits stay in the checkout (acceptEdits covers it)', () => {
    expect(ALLOWED_TOOLS).not.toContain('Edit')
    expect(ALLOWED_TOOLS).not.toContain('Write')
    expect(ALLOWED_TOOLS.some((t) => /^(Edit|Write)\(/.test(t))).toBe(false)
  })

  it('denies the network and push routes the pilot list missed', () => {
    expect(DISALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        'Bash(wget:*)',
        'Bash(node:*)',
        'Bash(bash:*)',
        'Bash(sh:*)',
        'Bash(git -c:*)',
        'Bash(git fetch:*)',
        'Bash(git remote:*)',
        'Bash(npm install:*)',
        'Bash(npx -y:*)',
      ]),
    )
  })

  it('reads only the project settings, so the owner’s user settings do not apply', () => {
    const args = buildClaudeArgs({ model: 'sonnet', effort: 'medium' })
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('project')
  })
})

describe('isolatePermissions', () => {
  const project = {
    model: 'opusplan',
    permissions: { allow: ['Bash(*)', 'Edit(*)', 'Write(*)', 'WebFetch(*)'], defaultMode: 'x' },
    hooks: { PreToolUse: [{ matcher: 'Bash' }] },
    enabledPlugins: { a: true },
  }

  it('replaces the project’s permissions with exactly the eval’s lists', () => {
    const out = isolatePermissions(project)
    expect(out.permissions).toEqual({ allow: ALLOWED_TOOLS, deny: DISALLOWED_TOOLS })
    expect(JSON.stringify(out)).not.toContain('Bash(*)')
  })

  it('keeps the rest of the project’s settings, so both commits run with their own hooks', () => {
    const out = isolatePermissions(project)
    expect(out.hooks).toEqual(project.hooks)
    expect(out.enabledPlugins).toEqual(project.enabledPlugins)
  })

  it('works when the commit has no settings file', () => {
    expect(isolatePermissions(undefined).permissions.deny).toEqual(DISALLOWED_TOOLS)
  })
})

describe('the child environment', () => {
  it('refuses to start when ANTHROPIC_API_KEY is set, because every session would bill the API', () => {
    expect(apiKeyProblem({ ANTHROPIC_API_KEY: 'k' })).toMatch(/ANTHROPIC_API_KEY/)
    expect(apiKeyProblem({ PATH: '/bin' })).toBeNull()
    expect(apiKeyProblem({ ANTHROPIC_API_KEY: '' })).toBeNull()
  })

  it('strips the API key and GitHub tokens from what the session inherits', () => {
    const env = childEnv({
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'k',
      GH_TOKEN: 't',
      GITHUB_TOKEN: 't',
      HOME: '/h',
    })
    expect(env).toEqual({ PATH: '/bin', HOME: '/h' })
  })
})

describe('changedPaths', () => {
  it('reads the paths of `git status --porcelain`, including a first line that starts with a space', () => {
    const status = ' M src/a.ts\n?? src/b.ts\nM  src/c.ts\n'
    expect(changedPaths(status)).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })

  it('is empty for a clean checkout', () => {
    expect(changedPaths('')).toEqual([])
  })
})

describe('runChanges', () => {
  it('drops the dependency link and the settings file the runner rewrote', () => {
    expect(
      runChanges(['node_modules', '.claude/settings.json', 'src/a.ts', '.claude/rules/x.md']),
    ).toEqual(['src/a.ts', '.claude/rules/x.md'])
  })
})
