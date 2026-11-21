/**
 * The first database of a pull request preview (#1075), run once per deploy by `payload run` from
 * ops/deploy-release.sh, after the migrations and before the app is switched on: one admin account
 * nobody can sign in to, so the first account registered on an empty database never becomes the
 * preview's admin. It does nothing when the database already has an account. The demo seed
 * (`isSeedEnabled`) stays off in production builds and is not used here.
 */
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { seedPreviewDatabase } from '../src/endpoints/seed/preview-database'

const payload = await getPayload({ config })
const result = await seedPreviewDatabase(payload)

payload.logger.info(
  result === 'seeded'
    ? 'preview: made the admin account no one can sign in to'
    : 'preview: the database already has accounts, nothing changed',
)
process.exit(0)
