import type { Payload } from 'payload'

/**
 * The first database of a pull request preview (#1075, epic #1070): the content copy comes later
 * (#1077); until then it holds one admin account that nobody can sign in to. The first account on an
 * empty `users` collection becomes an admin (`firstAccountIsAdmin`, #354), so a preview that anyone can
 * reach must never have it empty: the first visitor to `/admin` would register as its admin.
 *
 * The password is random, held in no variable that outlives this call, and never stored, logged or
 * shown, and no verification email is made (it would carry a link to the account). The address is on
 * `example.com`, as every seed address is (docs/guidelines/security.md).
 */
export const PREVIEW_ADMIN_EMAIL = 'preview-admin@example.com'

export type PreviewSeedResult = 'seeded' | 'kept'

/** Makes the admin account when the database has no account at all; changes nothing otherwise, so it is
 * safe to run on every deploy of the same preview. */
export async function seedPreviewDatabase(
  payload: Payload,
  env: Record<string, string | undefined> = process.env,
): Promise<PreviewSeedResult> {
  // A second check against an honest mistake, such as running the seed by hand against production: the deploy
  // sets PREVIEW_NUMBER (already validated by ops/environment.sh) only for a preview. It lives in the release's own
  // code, so it is no boundary: production is kept out by the `is_preview` gate in main's deploy-release.sh and by
  // the preview account's isolation.
  if (!env.PREVIEW_NUMBER) {
    throw new Error('the preview seed runs only for a pull request preview')
  }
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs > 0) return 'kept'
  await payload.create({
    collection: 'users',
    depth: 0,
    data: {
      name: 'Preview admin',
      email: PREVIEW_ADMIN_EMAIL,
      role: 'admin',
      password: crypto.randomUUID(),
    },
    disableVerificationEmail: true, // its link would be the only way in
    overrideAccess: true, // seeding, no user
  })
  return 'seeded'
}
