import { CONFIRMATION_LIMITS } from './limits'
import type { ConfirmationRecord, LinkStatus } from './types'

type AddressWindow = Pick<ConfirmationRecord, 'sendCount' | 'sendWindowStart'>

/** Whether one more link may go to this address now, and the per-address window after sending it. */
export type AddressLimitCheck = { ok: false } | ({ ok: true } & AddressWindow)

/**
 * Checks the per-address limit (`CONFIRMATION_LIMITS.perAddress` links per day). A new address,
 * or one whose window has passed, starts a new window at `now`.
 */
export function checkAddressLimit(record: AddressWindow | null, now: number): AddressLimitCheck {
  const start = record?.sendWindowStart ? Date.parse(record.sendWindowStart) : NaN
  const inWindow = Number.isFinite(start) && now - start < CONFIRMATION_LIMITS.addressWindowMs
  if (!record || !inWindow) {
    return { ok: true, sendCount: 1, sendWindowStart: new Date(now).toISOString() }
  }
  if (record.sendCount >= CONFIRMATION_LIMITS.perAddress) return { ok: false }
  return { ok: true, sendCount: record.sendCount + 1, sendWindowStart: record.sendWindowStart }
}

/** When a link sent at `now` stops working. */
export const toTokenExpiry = (now: number): string =>
  new Date(now + CONFIRMATION_LIMITS.linkLifetimeMs).toISOString()

/**
 * What a valid link for this record does now: confirm it, nothing (already confirmed, so a
 * reused link) or nothing because it expired. An expiry that can't be read counts as expired.
 */
export function checkLink(
  record: Pick<ConfirmationRecord, 'confirmedAt' | 'tokenExpiresAt'>,
  now: number,
): 'confirm' | 'already-confirmed' | 'expired' {
  if (record.confirmedAt) return 'already-confirmed'
  const expires = record.tokenExpiresAt ? Date.parse(record.tokenExpiresAt) : NaN
  if (!Number.isFinite(expires) || now >= expires) return 'expired'
  return 'confirm'
}

/**
 * Where a link stands when its page opens (#391): the same rule as following it (`checkLink`),
 * but nothing changes. `null`: no record holds the link's token.
 */
export function toLinkStatus(
  record: Pick<ConfirmationRecord, 'confirmedAt' | 'tokenExpiresAt'> | null,
  now: number,
): LinkStatus {
  if (!record) return 'invalid'
  const check = checkLink(record, now)
  return check === 'confirm' ? 'pending' : check
}
