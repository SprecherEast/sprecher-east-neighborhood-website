/**
 * The accounts of a pull request preview (#1075, #1393), run once per deploy by `payload run` from
 * ops/deploy-release.sh, after the migrations and before the app is switched on: one verified test
 * account per role, with the passwords ops/preview-accounts.sh wrote to the preview's private file
 * (`PREVIEW_ACCOUNTS_FILE`). So the first account registered on an empty database never becomes the
 * preview's admin, and the owner can sign in as each role. It prints no password, and the seed's own failure
 * prints one fixed line instead of the error (the deploy log is public): `runPreviewSeed`. Payload's start-up
 * errors (a database it cannot open) still print and hold no password, because passwords reach Payload only
 * in the seed. After the accounts have their passwords it marks the file as applied
 * (`markPreviewPasswordsApplied`), which is what lets the wrapper hand the passwords out (#1394). The demo seed
 * (`isSeedEnabled`) stays off in production builds and is not used here.
 */
import { getPayload } from 'payload'

import config from '../src/payload.config'
import {
  markPreviewPasswordsApplied,
  parsePreviewPasswords,
  readPreviewPasswordsText,
} from '../src/endpoints/seed/preview-accounts'
import { seedPreviewDatabase } from '../src/endpoints/seed/preview-database'
import { runPreviewSeed } from '../src/endpoints/seed/run-preview-seed'

let text = '' // the passwords file's text, read once: the seed uses it and the marker confirms exactly it
let payload: Awaited<ReturnType<typeof getPayload>>
const code = await runPreviewSeed({
  readPasswords: () => {
    text = readPreviewPasswordsText(process.env.PREVIEW_ACCOUNTS_FILE)
    return parsePreviewPasswords(text)
  },
  getLogger: async () => {
    payload = await getPayload({ config })
    return payload.logger
  },
  seed: (passwords) => seedPreviewDatabase(payload, passwords),
  markApplied: () => markPreviewPasswordsApplied(process.env.PREVIEW_ACCOUNTS_FILE, text),
})
process.exit(code)
