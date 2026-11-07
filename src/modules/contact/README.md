# Contact

What happens when a neighbor sends a form on the site: the checks it passes, why its emails wait for the sender to confirm their address, who gets which email, and when messages are deleted. The forms and submissions are the form-builder plugin's; this module adds the hooks. The confirmation link itself belongs to the verification module. Fields, access and hook names: [forms](../../../docs/reference/content-types/forms.md) and [form submissions](../../../docs/reference/content-types/form-submissions.md).

## How the fields and hooks link up

- `senderEmail` is the value of the form's first `email` field that holds one plain address, trimmed and lowercase, else empty; `emailConfirmed` is the verification confirmer's answer for it. Both are overwritten on every create, and `heldEmails` is cleared, so a visitor can't set them (`domain/senderEmail.ts`, `cms/senderEmail.ts`).
- The emails the form builder made are left in the request context (`HELD_EMAILS`) by `guardFormEmails`, then stored in `heldEmails` by the next hook, `requestSenderConfirmation`, which knows the submission's id (`cms/heldEmails.ts`, `cms/senderEmail.ts`).
- When the sender clicks the link, verification calls `markSubmissionsConfirmed`, which sends each message's held emails once and then sets `emailConfirmed`; joined in `src/payload.config.ts` (`onConfirmed`), tested in `src/payload.config.confirmation.test.ts`.
- `guardFormEmails` matches each formatted email to the form's own `emails` setting by position (`cms/guardFormEmails.ts`).
- A Reply-To built from `{{...}}` is kept only when it is one plain address, otherwise it falls back to From; a From built from submitted data is blanked, so the default sender is used (`domain/formEmails.ts`).
- `retentionHold` can't be set on create, and `retentionHoldReason` is required while it is on (`cms/retentionHold.ts`).
- `keepSendersWithMessages` is handed to the verification retention task, so a confirmed address stays while one of its messages is kept; both modules take their periods from `src/platform/lib/retention.ts` (`src/payload.config.ts`).
- A form field's `width` of 50 or less shares a row from 640 px, otherwise it is full width (`ui/FormBuilderField.client.tsx`).

## Screens

| Screen     | Route        | Data comes from                                                                                             |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| Form block | any CMS page | the `formBlock` block's `forms` relation and optional intro (`cms/formBlock.ts`, `ui/FormBlock.client.tsx`) |

## Behaviors and events

- A submission runs in this order, cheapest first (`cms/formBuilder.ts`): size, then rate limit, then robot check, then the sender lookup, then the plugin's email step (`guardFormEmails`), then `requestSenderConfirmation`, then `acknowledgeConfirmedSender`. The plugin's email step runs right after the save, before our two after-save hooks (`@payloadcms/plugin-form-builder`).
- Size: over 50 rows, or a name, value or total over its limit, is refused with 413; rows that aren't text, number or true/false are refused with 400. This applies to everyone, staff included (`cms/limitSubmissionSize.ts`, `domain/submissionSize.ts`).
- Rate limit: 5 submissions an hour per connection, then 429, counted in memory (one PM2 process); with no known IP it doesn't apply (`cms/rateLimits.ts`, `domain/rateLimits.ts`).
- Robot check: a missing or wrong token is refused with 400, the reason only goes to the log; it is off while Turnstile keys are not set. Admins and editors skip the rate limit and the robot check, not the size check (`cms/verifyHumanSubmission.ts`).
- Emails whose to, cc or bcc comes from the submission are dropped, so only staff-configured recipients get mail. An email with no matching setting is dropped too (`domain/formEmails.ts`).
- Emails then pass a site-wide cap of 30 an hour, counted on emails sent; past it they are dropped, the submission is still stored, and one warning is logged an hour (`cms/rateLimits.ts` `capFormEmails`).
- A message reaches the team only once its sender confirms: unconfirmed means held, confirmed before or a form with no email field means sent at once, and a form that asks for an email but got no valid one sends nothing (`domain/senderEmail.ts` `toEmailDelivery`). Sent emails end with a "Sender's email: confirmed." line (`cms/heldEmails.ts`).
- A sender confirmed before gets a fixed "we received your message" email instead of the welcome email; a first-time sender gets verification's welcome email after the click, so nobody gets both. It counts toward the cap, and a failed send is logged, never thrown (`cms/acknowledgeSender.ts`, `domain/acknowledgment.ts`).
- Held emails are cleared before they are sent, so a repeated click sends nothing twice; one message that fails doesn't stop the others (`cms/heldEmails.ts`).
- Retention, hourly (`cms/retention.ts`, `domain/retention.ts`): never a message on hold; a message that waits for a click (it has an address, or its form asks for one) goes 48 hours after it was sent; any other goes 12 months after its sender's last message, and one without an address 12 months after it was sent. The delete is one statement that checks hold and confirmation again, so a hold or a click made meanwhile keeps the message.
- Forms are public to read, so visitors can fill them in; the `emails` setting stays staff-only. Anyone may create a submission, only admins read, change or delete one (`cms/formBuilder.ts`).
- The page never shows the server's message: it maps the status to a fixed text, and a form that asks for an email adds a "check your email" note, the same for every sender (`ui/submitErrorMessage.ts`, `ui/confirmEmailNote.ts`).

## Shared pieces it uses

- `Form`, `Field`, `Button`, `Card` from `src/platform/ui/`; the robot check from `src/platform/turnstile/` and `src/platform/lib/humanCheck.ts`; `src/platform/lib/retention.ts`; the confirmer types in `src/platform/payload/emailConfirmer.ts`.
- Where it meets verification (decision 0008): `src/payload.config.ts` passes the confirmer in and the listener and keeper out.

## Rules and the tests that protect them

- Each hook does what is above: `cms/*.test.ts`; the order and the fields it adds: `cms/formBuilder.test.ts`.
- A held message goes only to the form's configured recipient, once: `cms/deliveryToRecipient.test.ts`.
- Email, rate, size, acknowledgment and retention rules: `domain/*.test.ts`.
- The form's fields, errors and note: `ui/FormBlock.client.test.tsx`, `ui/formSchema.test.ts`, `ui/submitErrorMessage.test.ts`, `ui/confirmEmailNote.test.ts`.
- The contact form gets the real confirmer and its listener: `src/payload.config.confirmation.test.ts`.

## Boundaries

- Entry files: `cms.ts` (block, plugin options, listener, retention task and keeper, never server-only) and `server.ts` (`FormBlock`). It imports no other module; lint enforces it.

## Decisions

[0004](../../../docs/architecture/decisions/0004-email-through-smtp.md), [0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0010](../../../docs/architecture/decisions/0010-contact-data-retention.md).

## Known gaps

None.
