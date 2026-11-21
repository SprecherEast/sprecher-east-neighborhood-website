/**
 * The accounts of a pull request preview (#1075, #1393), run once per deploy by `payload run` from
 * ops/deploy-release.sh, after the migrations and before the app is switched on: one verified test
 * account per role, with the passwords ops/preview-accounts.sh wrote to the preview's private file
 * (`PREVIEW_ACCOUNTS_FILE`). So the first account registered on an empty database never becomes the
 * preview's admin, and the owner can sign in as each role. It prints no password. The demo seed
 * (`isSeedEnabled`) stays off in production builds and is not used here.
 */
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { readPreviewPasswords } from '../src/endpoints/seed/preview-accounts'
import { seedPreviewDatabase } from '../src/endpoints/seed/preview-database'

const passwords = readPreviewPasswords(process.env.PREVIEW_ACCOUNTS_FILE)
const payload = await getPayload({ config })
const { created, refreshed } = await seedPreviewDatabase(payload, passwords)

payload.logger.info(
  `preview: ${created} test accounts made, ${refreshed} given new passwords (the passwords are not shown)`,
)
process.exit(0)
