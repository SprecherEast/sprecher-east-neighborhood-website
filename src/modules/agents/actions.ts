'use server'

// Server actions are public endpoints: anyone can call them with any input
// (https://nextjs.org/docs/app/guides/data-security). This one parses its input again and finds
// the account from the session, never from what the caller sends; the ticket then proves the
// request is the one the admin was shown (#1501).

import { redirect } from 'next/navigation'

import { CONNECTION_REFUSED } from './domain/oauth/constants'
import { consentInputSchema } from './domain/oauth/consentInput'
import { getViewer } from './data/oauth/viewer'
import { decideConsent } from './use-cases/oauth/decideConsent'

/**
 * Answers only when the approval is refused, with a message for the page; on success it sends the
 * browser back to the AI tool and does not return.
 */
export async function decideConnection(input: unknown): Promise<{ message: string }> {
  const parsed = consentInputSchema.safeParse(input)
  if (!parsed.success) return { message: CONNECTION_REFUSED }
  const { request, ticket, decision } = parsed.data
  const decided = await decideConsent(request, ticket, decision, await getViewer())
  if (decided.kind === 'redirect') redirect(decided.url)
  return { message: decided.message }
}

/**
 * The same approval as a form's action, so the buttons work before the page has hydrated: React
 * runs a form's server action from the server-rendered page. The request and ticket arrive bound
 * to the action, the choice as the pressed button's value, and all three go through the same
 * checks as above (the input is still untrusted). It answers `null` to nothing: the first answer
 * is the refusal, and a success leaves for the AI tool.
 */
export async function decideConnectionForm(
  input: unknown,
  _previous: { message: string } | null,
  form: FormData,
): Promise<{ message: string }> {
  return decideConnection({ ...Object(input), decision: form.get('decision') })
}
