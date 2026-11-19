import 'server-only'

import { runUseCase } from '@/platform/service'

import { findLinkState } from '../data/links'
import { toLinkStatus } from '../domain/rules'
import { parseConfirmationToken } from '../domain/tokenFormat'
import type { LinkStatus } from '../domain/types'

/**
 * Where a confirmation link stands when its page opens (#391), so a link opened again after
 * confirming says so instead of offering Confirm again. Changes nothing: confirming still takes
 * the button and the robot check (#303). Only someone holding the link can ask, and the answer
 * holds no address. If the read fails, the page offers the button as before.
 */
export function getConfirmationLinkStatus(value: unknown): Promise<LinkStatus> {
  const token = parseConfirmationToken(value)
  if (!token) return Promise.resolve('invalid')
  // The page falls back to the Confirm button, whose answer is the real one
  return runUseCase(
    'Reading a confirmation link',
    async () => toLinkStatus(await findLinkState(token), Date.now()),
    'pending',
  )
}
