import React from 'react'

import { Button } from '@/platform/ui/Button'

import { SIGN_IN_BUTTON_SIZE } from './signInButton'
import { PasskeyButtonStack } from './PasskeyButtonStack'
import { PASSKEY_LOGIN_LABEL } from './passkeyMessages'

/**
 * The room "Log in with a passkey" will take, held before it shows (#1365). The quick ways in sit
 * above the form, and whether this one shows is only known once its code has loaded and the
 * browser has answered, so without this the form would jump down under a neighbor's finger. It is
 * the real button, so it is the same size by construction, made `invisible` so it can't be seen,
 * focused or read.
 */
export function PasskeyButtonRoom() {
  return (
    <PasskeyButtonStack>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size={SIGN_IN_BUTTON_SIZE}
        className="invisible"
        aria-hidden
      >
        {PASSKEY_LOGIN_LABEL}
      </Button>
    </PasskeyButtonStack>
  )
}
