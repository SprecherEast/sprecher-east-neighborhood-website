# Accounts

How a neighbor signs up, confirms the account, signs in, changes or resets a password, and what a role allows. It is the site's largest security surface; it is not the admin panel. Fields, access, hooks and sign-in settings: [users content type](../../../docs/reference/content-types/users.md); the six pages: [screens](../../../docs/reference/routes.md).

## Screens

The six account pages, their routes and data are in the [screens reference](../../../docs/reference/routes.md); only `/account` is gated (by `requireUser`).

## Links between fields and flags (read first)

- `CURRENT_PASSWORD_CONFIRMED` (`domain/passwordConfirmation.ts`) is set in the request context only by `setOwnPassword` after the current password checks out (`data/session.ts`); `cms/requireCurrentPassword.ts` refuses your own new password without it. `NEW_EMAIL_CONFIRMED` (`domain/emailChange.ts`) does the same for `cms/requireConfirmedEmailChange.ts`. Context starts empty on every REST and GraphQL request, so no HTTP caller can set either.
- `SIGN_UP_CONTEXT` (`domain/signUpContext.ts`) is set by `createResidentAccount` (`data/signUp.ts`) so `cms/firstAccountIsAdmin.ts` skips it: the only automatic promotion to admin is Payload's first registration on an empty database; an admin can also set any role by hand (the role field is admin-only to write).
- `verificationResends` and `verificationResendsSince` feed `takeResend` (`domain/verificationResends.ts`): 3 resends per 3-hour window, stored on the account so it survives restarts.
- `verificationSetsPassword` is set by a resend and tells the verify step to ask for a password; `verifiedTokenHash` (SHA-256 of the used link's token) lets a reopened link answer "already verified" (`use-cases/verifyAccountFromLink.ts`, `use-cases/getVerificationLinkStatus.ts`). All four fields are server-only (`serverOnlyFieldAccess`).
- `role` becomes `CurrentUser.role`, and the header's `AccountSummary.staff` (admin or editor), never the role itself (`data/mappers.ts`, `use-cases/getAccountSummary.ts`). A missing role counts as guest (`platform/payload/roles.ts`).
- Email links are built from the configured site address and the module's paths, never the request's Host (`domain/linkToken.ts`, `domain/paths.ts`, `cms/users.ts`).
- `src/payload.config.ts` hands `keepAccountEmails` to the verification module's retention task, so a confirmed address stays while an account uses it (`cms/keepAccountEmails.ts`).

## Behaviors and events

- Sign-up makes a guest that cannot sign in until its emailed link is pressed as Confirm on `/verify-account`, after the robot check, so a mail scanner opening the link verifies nothing. The link has no expiry (Payload's own verify), and a resend replaces it (`use-cases/signUpResident.ts`, `use-cases/verifyAccountFromLink.ts`).
- Payload's own REST verify answers 403 (`cms/verifyFromSiteOnly.ts`, on the collection in `cms/users.ts`); its GraphQL verify mutation fails a validation rule instead (`noVerifyMutation`, registered in `src/payload.config.ts`); the admin's verify page and forgot page redirect to the site's (`src/proxy.ts`).
- No answer says whether an account exists. Sign-up answers the same for a new and a used email, sign-in has one wrong-credentials failure (`data/failures.ts`), forgot password answers at once and sends in `after()` (`use-cases/requestPasswordReset.ts`). A failed sign-up email deletes the half-made account so the address isn't stuck (`data/signUp.ts`).
- A repeat sign-up for an unverified address resends the link after the answer, one resend at a time per address, within the cap (`use-cases/signUpResident.ts`).
- Sign-up and forgot password pass a per-connection limit, then the robot check, then a site-wide limit (5 per connection an hour, 20 and 30 site-wide); counts are in memory, one PM2 process (`use-cases/guardPublicRequest.ts`, `domain/requestLimits.ts`).
- Forgot password works only from the site's page (`cms/forgotPasswordFromSiteOnly.ts`); an unverified account gets no reset email, with the same answer (`cms/noResetEmailWhileUnverified.ts`).
- "Keep me signed in" stretches session, token and cookie to 7 days (`data/rememberedSession.ts`, `domain/sessionLifetimes.ts`); otherwise Payload's 2 hours apply.
- Changing your password ends your other sessions (`data/session.ts`); a reset ends every other session and sets no cookie, so the person signs in next (`data/passwordReset.ts`).
- Agent accounts cannot sign in with a password (`cms/noPasswordSignInForAgents.ts`); an MCP key is not a signed-in account (`getSessionPayloadUser` in `data/session.ts`).
- `requireUser` sends a visitor to sign in; `requireRole` gives a signed-in user without the role a 404 (`use-cases/requireUser.ts`).
- Account pages stay out of search results: each page sets `NOT_INDEXED` and the sitemap leaves out `ACCOUNT_PAGE_PATHS` and verification's `CONFIRM_EMAIL_PATH` (`src/app/sitemap.ts`).
- Server actions return fixed failure codes, never Payload's error text; the pages map them to fixed messages (`domain/types.ts`, `ui/*Message*.ts`, `platform/lib/messages/accounts.ts`).

## Shared pieces it uses

- `SlidingWindowCounter`, `HumanVerifier`, `ROLES` from `src/platform/lib`; `TurnstileVerifier` (`src/platform/turnstile`); role checks and `serverOnlyFieldAccess` (`src/platform/payload/roles.ts`); `runAction`, `runUseCase` (`src/platform/service`); `NOT_INDEXED` (`src/platform/seo`).
- Where it meets other modules (decision 0008): pages in `src/app/`, the collection, `noVerifyMutation` and the retention task in `src/payload.config.ts`, redirects in `src/proxy.ts`.
- Related notes: [verification](../verification/README.md) (keeps a confirmed address while an account uses it, and shows `AccountOffer` after a contact confirmation; sign-up itself uses Payload's own verify, not its confirmer), [agents](../agents/README.md) (an agent account is the owner of an MCP key, and sign-in is refused for it), [shared Payload code](../../platform/payload/README.md) (roles, `runAction`).

## Rules and the tests that protect them

- Sign-up never makes an admin, Payload's first registration does: `cms/signUpFirstAccount.test.ts`, `src/payload.config.roles.test.ts`. Each guard: `cms/*.test.ts`.
- Own password and email changes need the flags: `cms/requireCurrentPassword.test.ts`, `src/payload.config.emailChange.test.ts`.
- Resend cap and window: `domain/verificationResends.test.ts`, `actions.signUpResend.test.ts`.
- Verify link, password step, "already verified": `use-cases/verifyAccountFromLink.test.ts`, `actions.verifyAccount.test.ts`.
- Remembered session lasts 7 days: `data/rememberedSession.payload.test.ts`. Roles gate pages: `use-cases/requireUser.test.ts`.
- Old residents became guests: `src/payload.config.guestMigration.test.ts`. Admin redirects: `src/proxy.test.ts`.
- Actions parse input again and use the session: `actions.test.ts`, `actions.changePassword.test.ts`, `actions.passwordReset.test.ts`, `actions.signUp.test.ts`.

## Boundaries

- Entry files: `index.ts` (types, paths, safe for the proxy), `server.ts` (use cases, forms, `requireUser`), `cms.ts` (collection, never server-only), `actions.ts` (server actions). Layers: `domain/`, `use-cases/`, `data/`, `cms/`, `ui/`; no other module is imported (`eslint.boundaries.config.mjs`).
- Never let a form or caller name the account: the account comes from the session.

## Decisions

[0003](../../../docs/architecture/decisions/0003-turnstile-robot-check.md), [0007](../../../docs/architecture/decisions/0007-email-confirmation.md), [0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md).

## Known gaps

- No code sets `NEW_EMAIL_CONFIRMED`: the change-your-email flow (#553) isn't built, so your own email can't be changed, admins included.
- `requireRole` has no caller outside tests: only `/account` is gated (by `requireUser`), so no page opens by role yet. The owner kept it on purpose (#728 audit, #756), so it is not a defect to file.
