import type { PreviewPasswords } from './preview-accounts'
import type { PreviewSeedResult } from './preview-database'

/** The few things a run needs, each replaceable in a test. */
type Logger = { info: (message: string) => void; error: (message: string) => void }
type Parts = {
  readPasswords: () => PreviewPasswords
  /** Opens Payload and gives its logger. */
  getLogger: () => Promise<Logger>
  seed: (passwords: PreviewPasswords) => Promise<PreviewSeedResult>
  /** Records which passwords file the accounts now match, once the seed finished (#1394). */
  markApplied: () => void
  /** Where the failure line goes when Payload never opened (default: the console). */
  fallbackLog?: Pick<Console, 'error'>
}

/** The only failure text the seed prints. A deploy log is public and an error from the seed carries its
 * own text and stack, which could hold a value, so it is never printed (#1393). Payload's own start-up errors
 * (a database it cannot open) still print and hold no password, because passwords reach Payload only in
 * the seed. */
const FAILED =
  'preview: the test accounts could not be made (details are not shown: the log is public)'

/**
 * What `e2e/previewSeed.ts` does: read the passwords file, open Payload, seed, then confirm the file as
 * applied (never after a failure). Returns the exit code: 0, or 1
 * after printing one fixed line. Prints how many accounts were made or refreshed, never a password.
 */
export async function runPreviewSeed(parts: Parts): Promise<number> {
  let log: Logger | undefined
  try {
    const passwords = parts.readPasswords()
    log = await parts.getLogger()
    const { created, refreshed } = await parts.seed(passwords)
    parts.markApplied()
    log.info(
      `preview: ${created} test accounts made, ${refreshed} given new passwords (the passwords are not shown)`,
    )
    return 0
  } catch {
    ;(log ?? parts.fallbackLog ?? console).error(FAILED)
    return 1
  }
}
