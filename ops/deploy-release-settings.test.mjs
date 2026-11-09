// The deploy refuses a release built with different public settings than the server's .env.local
// has (#950; the Turnstile key beside it). Only the first step of deploy-release.sh runs: a release
// that passes these checks stops at the native-modules check, which this folder can't satisfy, and
// that message is how a test knows the settings guards let it through.
import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { setUpUmamiHarness, write } from './umami-harness.mjs'

const h = setUpUmamiHarness()

const ID = 'a969368e-4514-4aa9-828a-fb0cd9d8330b'
const NEXT_CHECK = 'native modules'

/** Runs deploy-release.sh against a release built with `built`, on a server whose .env.local says `env` */
async function deploy({ built = {}, env = '' }) {
  const release = h.p('app/releases/r1')
  const info = [
    `node=${process.version}`,
    'server_url=https://sprechereast.com',
    `turnstile_site_key=${built.turnstile ?? ''}`,
    ...(built.umami === undefined ? [] : [`umami_website_id=${built.umami}`]),
    '',
  ].join('\n')
  write(`${release}/.release-info`, info)
  write(`${release}/.next/BUILD_ID`, 'build\n')
  write(`${release}/node_modules/.bin/next`, '#!/bin/sh\n', 0o755)
  fs.appendFileSync(h.p('app/.env.local'), env)
  return h.run('deploy-release.sh', { CODE_DIR: release })
}

describe('deploy-release.sh: the visit counter site ID', () => {
  it.each([
    ['both unset', {}, ''],
    ['an old release with no line, and none on the server', {}, 'OTHER=1\n'],
    ['the same value', { umami: ID }, `NEXT_PUBLIC_UMAMI_WEBSITE_ID=${ID}\n`],
    [
      'the same value, quoted, with a trailing comment',
      { umami: ID },
      `NEXT_PUBLIC_UMAMI_WEBSITE_ID="${ID}"  # the site's ID\n`,
    ],
  ])('lets a release through when %s', async (_name, built, env) => {
    const { code, out } = await deploy({ built, env })
    expect(code).toBe(1)
    expect(out).toContain(NEXT_CHECK)
    expect(out).not.toContain('Umami site ID')
  })

  it.each([
    [
      'the server has one and the release has none',
      { umami: '' },
      `NEXT_PUBLIC_UMAMI_WEBSITE_ID=${ID}\n`,
    ],
    ['the release has one and the server has none', { umami: ID }, ''],
    [
      'the values differ',
      { umami: ID },
      'NEXT_PUBLIC_UMAMI_WEBSITE_ID=00000000-0000-0000-0000-000000000000\n',
    ],
  ])('stops, with the live site unchanged, when %s', async (_name, built, env) => {
    const { code, out } = await deploy({ built, env })
    expect(code).toBe(1)
    expect(out).toContain('different Umami site ID')
    expect(out).toContain('the live site was not changed')
  })
})

describe('deploy-release.sh: the robot check site key, beside it', () => {
  it('lets a release through when both sides have the same key', async () => {
    const { out } = await deploy({
      built: { turnstile: '0x4AAA' },
      env: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAA\nTURNSTILE_SECRET_KEY=s\n',
    })
    expect(out).toContain(NEXT_CHECK)
  })

  it('stops when the keys differ', async () => {
    const { out } = await deploy({
      built: { turnstile: '0x4AAA' },
      env: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4BBB\nTURNSTILE_SECRET_KEY=s\n',
    })
    expect(out).toContain('different Turnstile site key')
  })

  it('stops when only one of the two keys is set', async () => {
    const { out } = await deploy({ env: 'TURNSTILE_SECRET_KEY=s\n' })
    expect(out).toContain('only one of the two Turnstile keys')
  })
})
