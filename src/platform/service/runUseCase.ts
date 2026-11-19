import 'server-only'

import type { ActionResult } from '@/platform/lib'

import { logServerFailure } from './logServerFailure'

/** The failure code for "our side broke", the only one that is logged by `runAction`. */
const SERVER_ERROR = 'server-error'

/**
 * Runs a server call that must not throw to its caller. A failure is logged without personal data
 * (`logServerFailure`) and `fallback` is returned instead. The one place to add timing, request
 * IDs or retries to such calls later (#521).
 */
export async function runUseCase<T>(
  action: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    logServerFailure(action, error)
    return fallback
  }
}

/**
 * Runs a server action that answers with an `ActionResult`. A throw becomes `{ ok: false }` with
 * the failure `toFailure` names for it; only `'server-error'` is logged, since any other code
 * is an expected refusal (a wrong password, an expired link) that has nothing to report.
 */
export async function runAction<Failure extends string>(
  action: string,
  run: () => Promise<ActionResult<Failure>>,
  toFailure: (error: unknown) => Failure,
): Promise<ActionResult<Failure>> {
  try {
    return await run()
  } catch (error) {
    const failure = toFailure(error)
    if (failure === SERVER_ERROR) logServerFailure(action, error)
    return { ok: false, failure }
  }
}
