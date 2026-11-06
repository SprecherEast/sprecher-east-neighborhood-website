// How the eval starts `claude` (#715). One place, so both conditions get the same session.

/**
 * What a run may use: read files, run the tests and the type check, read git history. Edit and
 * Write are not listed on purpose: `--permission-mode acceptEdits` lets them change files inside
 * the checkout only, while a bare `Edit` rule would allow any path (checked against the CLI).
 */
export const ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Bash(npx vitest:*)',
  'Bash(npx tsc:*)',
  'Bash(npx next typegen:*)',
  'Bash(npm run generate:types:*)',
  'Bash(npm test:*)',
  'Bash(ls:*)',
  'Bash(find:*)',
  'Bash(grep:*)',
  'Bash(rg:*)',
  'Bash(cat:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  // Task 8 needs these: format the files, undo a stray change, make the migration for a new field
  'Bash(npx prettier:*)',
  'Bash(git checkout:*)',
  'Bash(npx payload migrate:create:*)',
]

/** No GitHub and no web, so a run can't read the answers posted on the issue. No commit or push. */
export const DISALLOWED_TOOLS = [
  'WebFetch',
  'WebSearch',
  'Bash(gh:*)',
  'Bash(git push:*)',
  'Bash(git commit:*)',
  'Bash(curl:*)',
  'Bash(wget:*)',
  'Bash(nc:*)',
  'Bash(ssh:*)',
  'Bash(scp:*)',
  // Interpreters and shells could fetch or push by any route
  'Bash(node:*)',
  'Bash(python:*)',
  'Bash(python3:*)',
  'Bash(bash:*)',
  'Bash(sh:*)',
  // Git routes to a remote, and ways to configure one
  'Bash(git -c:*)',
  'Bash(git fetch:*)',
  'Bash(git pull:*)',
  'Bash(git clone:*)',
  'Bash(git remote:*)',
  'Bash(git config:*)',
  'Bash(git ls-remote:*)',
  // Installing or running a package from the registry
  'Bash(npm install:*)',
  'Bash(npm i:*)',
  'Bash(npm exec:*)',
  'Bash(npx -y:*)',
  'Bash(npx --yes:*)',
]

/**
 * The project's own settings allow `Bash(*)`, `Edit(*)`, `Write(*)` and `WebFetch(*)`, which a
 * trusted workspace (the owner's machine) applies, and allow rules would then make the lists above
 * restrict nothing. So the runner replaces the checkout's `permissions` with exactly these two
 * lists and keeps the rest of its settings (hooks, plugins), so each commit runs as it is.
 */
export function isolatePermissions(settings) {
  return { ...settings, permissions: { allow: ALLOWED_TOOLS, deny: DISALLOWED_TOOLS } }
}

/** Why the runner must not start: with an API key set, every `-p` session bills the API. */
export function apiKeyProblem(env) {
  if (!env.ANTHROPIC_API_KEY) return null
  return 'ANTHROPIC_API_KEY is set, so every session would be billed to the API. Unset it and run again.'
}

/** What the session inherits: no API key, and no GitHub token a command could use. */
export function childEnv(env) {
  const out = { ...env }
  for (const name of ['ANTHROPIC_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN']) delete out[name]
  return out
}

/** The paths in `git status --porcelain` output, which must not be trimmed: " M a" starts with a space. */
export function changedPaths(porcelain) {
  return porcelain
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
}

/** The files a run changed, without the ones the runner itself added (the link, the settings). */
export function runChanges(files) {
  return files.filter(
    (file) => !file.startsWith('node_modules') && file !== '.claude/settings.json',
  )
}

/** The arguments of one headless session; the prompt goes in on stdin. */
export function buildClaudeArgs({ model, effort }) {
  return [
    '-p',
    '--model',
    model,
    '--effort',
    effort,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    // CLAUDE.md and the rules of the checkout still load; the owner's user settings do not
    '--setting-sources',
    'project',
    '--allowedTools',
    ...ALLOWED_TOOLS,
    '--disallowedTools',
    ...DISALLOWED_TOOLS,
  ]
}

/**
 * Why a folder is not a checkout a run may start in, or null. `toplevel` is what
 * `git rev-parse --show-toplevel` printed there (null when it failed). A run that starts in the
 * wrong folder once fell back to the scratch folder and answered from nothing.
 */
export function checkoutProblem({ dir, toplevel, hasAgentsFile }) {
  if (!toplevel) return `${dir} is not a git checkout`
  if (toplevel !== dir) return `${dir} is not the root of a checkout (git says ${toplevel})`
  if (!hasAgentsFile) return `${dir} has no AGENTS.md, so it is not this repository`
  return null
}
