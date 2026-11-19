import 'server-only'

import { runAction } from '@/platform/service'

import { toResetPasswordFailure } from '../data/failures'
import { setPasswordFromLink } from '../data/passwordReset'
import type { ResetPasswordValues } from '../domain/credentials'
import type { ActionResult, ResetPasswordFailure } from '../domain/types'

/** Sets a new password from a reset link. A used, unknown or expired link is one failure. */
export function resetPasswordFromLink({
  token,
  newPassword,
}: ResetPasswordValues): Promise<ActionResult<ResetPasswordFailure>> {
  return runAction(
    'Password reset',
    async () => {
      await setPasswordFromLink({ token, newPassword })
      return { ok: true }
    },
    toResetPasswordFailure,
  )
}
