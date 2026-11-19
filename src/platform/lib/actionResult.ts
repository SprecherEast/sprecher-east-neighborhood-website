/** What a server action that changes something returns. Failures are fixed codes, never text. */
export type ActionResult<Failure extends string> = { ok: true } | { ok: false; failure: Failure }
