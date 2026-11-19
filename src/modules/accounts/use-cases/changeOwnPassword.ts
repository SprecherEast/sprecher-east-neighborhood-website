import 'server-only'

import { runAction } from '@/platform/service'

import { toPasswordFailure } from '../data/failures'
import { setOwnPassword } from '../data/session'
import type { PasswordChangeValues } from '../domain/credentials'
import type { ActionResult, PasswordFailure } from '../domain/types'

/**
 * Sets a new password on the signed-in account, once its current password is confirmed (#233).
 * Who that is comes from the session, checked again here, never from the caller.
 */
export function changeOwnPassword({
  currentPassword,
  newPassword,
}: PasswordChangeValues): Promise<ActionResult<PasswordFailure>> {
  return runAction<PasswordFailure>(
    'Password change',
    async () => {
      const outcome = await setOwnPassword({ currentPassword, newPassword })
      return outcome === 'changed' ? { ok: true } : { ok: false, failure: outcome }
    },
    toPasswordFailure,
  )
}
