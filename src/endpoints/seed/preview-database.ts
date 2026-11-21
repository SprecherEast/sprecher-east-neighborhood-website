import type { Payload } from 'payload'

import {
  PREVIEW_ACCOUNT_ROLES,
  previewAccountEmail,
  type PreviewPasswords,
} from './preview-accounts'

/**
 * The accounts of a pull request preview's database (#1075, #1393; epic #1070, #1077): one throwaway
 * test account per role in `PREVIEW_ACCOUNT_ROLES`, so a change can be judged as each kind of user. The
 * first account on an empty `users` collection becomes an admin (`firstAccountIsAdmin`, #354), so a
 * preview that anyone can reach must never have it empty: the admin is made first, and the other roles
 * keep the role they are given.
 *
 * The passwords come from the deploy script's private file (`ops/preview-accounts.sh`, read by
 * `readPreviewPasswordsText`), never from here and never from production. They are new on every deploy: an
 * account that exists gets the new password (which also ends its sessions), is put back to its role,
 * verified and unlocked. Accounts are made verified and no verification email is made. Nothing here logs
 * or returns a password.
 */
export type PreviewSeedResult = { created: number; refreshed: number }

/** Makes or refreshes each role's account; any other account (a neighbor who signed up in the preview)
 * is left as it is. Safe to run on every deploy of the same preview. */
export async function seedPreviewDatabase(
  payload: Payload,
  passwords: PreviewPasswords,
  env: Record<string, string | undefined> = process.env,
): Promise<PreviewSeedResult> {
  // A second check against an honest mistake, such as running the seed by hand against production: the deploy
  // sets PREVIEW_NUMBER (already validated by ops/environment.sh) only for a preview. It lives in the release's own
  // code, so it is no boundary: production is kept out by the `is_preview` gate in main's deploy-release.sh and by
  // the preview account's isolation.
  if (!env.PREVIEW_NUMBER) {
    throw new Error('the preview seed runs only for a pull request preview')
  }
  const result: PreviewSeedResult = { created: 0, refreshed: 0 }
  for (const role of PREVIEW_ACCOUNT_ROLES) {
    const email = previewAccountEmail(role)
    const { docs } = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true, // seeding, no user
      where: { email: { equals: email } },
    })
    const fields = {
      role,
      password: passwords[role],
      _verified: true,
      loginAttempts: 0,
      lockUntil: null,
    }
    if (docs[0]) {
      await payload.update({
        collection: 'users',
        id: docs[0].id,
        depth: 0,
        data: fields,
        overrideAccess: true,
      })
      result.refreshed++
    } else {
      await payload.create({
        collection: 'users',
        depth: 0,
        data: { name: `Preview ${role}`, email, ...fields },
        disableVerificationEmail: true, // verified here; its link would be the only way in
        overrideAccess: true,
      })
      result.created++
    }
  }
  return result
}
