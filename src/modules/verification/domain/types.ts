/** One email confirmation as the rules read it: an address, and where its link stands. */
export type ConfirmationRecord = {
  id: number
  email: string
  /** When the link was clicked; `null` while unconfirmed. */
  confirmedAt: string | null
  /** When the latest link stops working. */
  tokenExpiresAt: string | null
  /** Links sent in the current window (`sendWindowStart`), for the per-address limit. */
  sendCount: number
  sendWindowStart: string | null
  welcomeSentAt: string | null
}

/**
 * What asking for a confirmation link did. For server code and logs only: the person always sees
 * the same answer, so nobody learns whether an address is known or confirmed.
 */
export type RequestOutcome =
  | 'sent'
  | 'already-confirmed'
  | 'invalid-address'
  | 'address-limit'
  | 'connection-limit'
  | 'site-limit'

/**
 * What following a confirmation link did. These the person may see: only someone holding the
 * link (an unguessable token) can ask.
 */
export type ConfirmOutcome = 'confirmed' | 'already-confirmed' | 'expired' | 'invalid'

/**
 * What a confirmation link's holder learns: the outcome, and the address once it is confirmed,
 * so the confirm page can offer what comes next with it filled in (an account, #187). Only someone
 * holding the link (sent to that address) can ask, so it tells them nothing new.
 */
export type ConfirmResult =
  | { outcome: Extract<ConfirmOutcome, 'confirmed' | 'already-confirmed'>; email: string }
  | { outcome: Extract<ConfirmOutcome, 'expired' | 'invalid'> }

/**
 * Where a link stands when its page opens (#391), read without changing anything: `pending` still
 * needs the Confirm button; the others are final, so the page shows their message and no button.
 */
export type LinkStatus =
  | 'pending'
  | Extract<ConfirmOutcome, 'already-confirmed' | 'expired' | 'invalid'>
