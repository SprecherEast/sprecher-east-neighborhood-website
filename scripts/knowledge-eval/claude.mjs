// How the eval starts `claude` (#715). One place, so both conditions get the same session.

/** What a run may use: read and edit files, run the tests and the type check, read git history. */
export const ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
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
]

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
