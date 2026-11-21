import type { PreviewPasswords } from './preview-accounts'
import type { PreviewSeedResult } from './preview-database'

/** The few things a run needs, each replaceable in a test. */
type Logger = { info: (message: string) => void; error: (message: string) => void }
type Parts = {
  readPasswords: () => PreviewPasswords
  /** Opens Payload and gives its logger. */
  getLogger: () => Promise<Logger>
  seed: (passwords: PreviewPasswords) => Promise<PreviewSeedResult>
  /** Where the failure line goes when Payload never opened (default: the console). */
  fallbackLog?: Pick<Console, 'error'>
}

/** The only failure text. A deploy log is public and an error from Payload or the database carries its
 * own text and stack, which could hold a value, so it is never printed (#1393). */
const FAILED =
  'preview: the test accounts could not be made (details are not shown: the log is public)'

/**
 * What `e2e/previewSeed.ts` does: read the passwords file, open Payload, seed. Returns the exit code: 0, or 1
 * after printing one fixed line. Prints how many accounts were made or refreshed, never a password.
 */
export async function runPreviewSeed(parts: Parts): Promise<number> {
  let log: Logger | undefined
  try {
    const passwords = parts.readPasswords()
    log = await parts.getLogger()
    const { created, refreshed } = await parts.seed(passwords)
    log.info(
      `preview: ${created} test accounts made, ${refreshed} given new passwords (the passwords are not shown)`,
    )
    return 0
  } catch {
    ;(log ?? parts.fallbackLog ?? console).error(FAILED)
    return 1
  }
}
