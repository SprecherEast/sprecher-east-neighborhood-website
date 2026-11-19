import 'server-only'

import { runAction } from '@/platform/service'

import { toSignInFailure } from '../data/failures'
import { startSession } from '../data/session'
import type { SignInValues } from '../domain/credentials'
import type { ActionResult, SignInFailure } from '../domain/types'

/** Signs in and sets the auth cookie. Every refusal is the same failure (no enumeration). */
export function signInWithPassword(values: SignInValues): Promise<ActionResult<SignInFailure>> {
  return runAction(
    'Sign-in',
    async () => {
      await startSession(values)
      return { ok: true }
    },
    toSignInFailure,
  )
}
