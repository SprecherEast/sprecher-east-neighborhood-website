// The production dependency audit the Dependency Audit job runs (#1285): `npm audit` at level high
// without dev dependencies, through better-npm-audit so `.nsprc` can hold dated exceptions.
// `.nsprc` is the only exceptions file: better-npm-audit reads `.nsprc.js` and `.nsprc.cjs` first,
// and those could compute an expiry at run time, so they fail the audit.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORBIDDEN_EXCEPTION_FILES = ['.nsprc.js', '.nsprc.cjs']

export const AUDIT_ARGS = [
  'audit',
  '--level',
  'high',
  '--production',
  '--require-notes',
  '--require-expiry',
  '--max-expiry-days',
  '45',
]

/** The exceptions files that must not exist in a directory */
export const forbiddenFilesIn = (dir, exists = existsSync) =>
  FORBIDDEN_EXCEPTION_FILES.filter((name) => exists(join(dir, name)))

const isMain = process.argv[1] === fileURLToPath(import.meta.url)

if (isMain) {
  const found = forbiddenFilesIn(process.cwd())
  if (found.length) {
    console.error(`${found.join(', ')} not allowed: .nsprc is the only audit exceptions file.`)
    process.exit(1)
  }
  const result = spawnSync('npx', ['--no-install', 'better-npm-audit', ...AUDIT_ARGS], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  process.exit(result.status ?? 1)
}
