import fs from 'node:fs'

import { ROLES } from '@/platform/lib/roles'

/**
 * The test accounts of a pull request preview (#1393, part of #1077): one per role that signs in with a
 * password. This is the one list of those roles. `agent` is left out on purpose: it has no password
 * sign-in and acts through an API key, which a preview never gets. `ops/environment.sh` names the same
 * roles for the deploy script that makes the passwords, and a test keeps the two equal.
 */
export const PREVIEW_ACCOUNT_ROLES = [
  ROLES.admin,
  ROLES.editor,
  ROLES.resident,
  ROLES.guest,
] as const

export type PreviewAccountRole = (typeof PREVIEW_ACCOUNT_ROLES)[number]
export type PreviewPasswords = Record<PreviewAccountRole, string>

/** An address on `example.com`, as every seed address is (docs/guidelines/security.md). */
export const previewAccountEmail = (role: PreviewAccountRole): string =>
  `preview-${role}@example.com`

/** What the deploy script writes for each password: 64 lowercase hex characters (`ops/secret-lib.sh`). */
const PASSWORD_PATTERN = /^[0-9a-f]{64}$/

/**
 * The file's text as one password per role. The file holds one `role=password` line per role and
 * nothing else; anything different is refused. An error never carries a value: a deploy log is public.
 */
export function parsePreviewPasswords(text: string): PreviewPasswords {
  const found: Partial<Record<string, string>> = {}
  for (const line of text.split('\n').filter((l) => l !== '')) {
    const at = line.indexOf('=')
    const role = line.slice(0, at)
    const password = line.slice(at + 1)
    const known = at > 0 && (PREVIEW_ACCOUNT_ROLES as readonly string[]).includes(role)
    if (!known || role in found || !PASSWORD_PATTERN.test(password)) {
      throw new Error('the preview accounts file is not what the deploy writes')
    }
    found[role] = password
  }
  const passwords = PREVIEW_ACCOUNT_ROLES.map((role) => found[role])
  if (passwords.some((p) => p === undefined) || new Set(passwords).size !== passwords.length) {
    throw new Error('the preview accounts file is not what the deploy writes')
  }
  return found as PreviewPasswords
}

/**
 * Reads the file the deploy script wrote (`PREVIEW_ACCOUNTS_FILE`). Refuses a link, a file that
 * is not the running user's own, and one that others can open: the passwords are only for this process.
 */
export function readPreviewPasswords(file: string | undefined): PreviewPasswords {
  if (!file) throw new Error('PREVIEW_ACCOUNTS_FILE names no file')
  // One open, then every check on that same file: no gap between the check and the read, and a link is refused.
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    const stat = fs.fstatSync(fd)
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
      throw new Error('the preview accounts file must be a private file of the running user')
    }
    return parsePreviewPasswords(fs.readFileSync(fd, 'utf8'))
  } finally {
    fs.closeSync(fd)
  }
}
