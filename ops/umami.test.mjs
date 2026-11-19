import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { OPS, setUpUmamiHarness } from './umami-harness.mjs'

const h = setUpUmamiHarness()
const read = (...parts) => fs.readFileSync(path.join(OPS, ...parts), 'utf8')

describe('how the pieces agree', () => {
  it('has the outside port check cover the port Umami is published on', () => {
    const port = /UMAMI_PORT="\$\{UMAMI_PORT:-(\d+)\}"/.exec(read('umami-lib.sh'))?.[1]
    expect(port).toBeTruthy()
    expect(read('..', '.github/workflows/deploy.yml')).toContain(`for port in 3000 ${port}`)
  })

  it('publishes only Umami, on loopback, and never the database', () => {
    const compose = read('umami/compose.yaml')
    expect(compose.match(/ports:/g)).toHaveLength(1)
    expect(compose).toContain("'127.0.0.1:${UMAMI_PORT}:3000'")
    expect(compose).toContain('CLIENT_IP_HEADER: x-forwarded-for')
    expect(compose).not.toMatch(/^\s+MCP_ENABLED:/m)
  })

  it('caps the memory of both containers', () => {
    const compose = read('umami/compose.yaml')
    expect(compose).toMatch(/^ {2}umami:\n(?: {4}.*\n| *\n)*? {4}mem_limit: 768m$/m)
    expect(compose).toMatch(/^ {2}db:\n(?: {4}.*\n| *\n)*? {4}mem_limit: 512m$/m)
  })

  it('hands the password from the workflow to install-umami.sh over stdin only', () => {
    expect(read('..', '.github/workflows/deploy.yml')).toContain(
      `printf '%s' "$UMAMI_ADMIN_PASSWORD" | ssh vps "bash /var/www/sprecher-east/releases/$RELEASE/ops/deploy-release.sh --umami-password-stdin"`,
    )
    expect(read('deploy-release.sh')).toContain(
      'UMAMI_ADMIN_PASSWORD="$umami_admin_password" bash "$RELEASE/ops/install-umami.sh"',
    )
  })
})

describe('deploy-release.sh and the password on stdin', () => {
  // Run from outside a releases folder, it stops at its first check: enough to show whether it waits for stdin.
  const NOT_A_RELEASE = 'must run from a folder in'

  it('does not wait for input without the flag', async () => {
    const { code, out } = await h.run('deploy-release.sh') // stdin stays open and is never written
    expect(code).toBe(1)
    expect(out).toContain(NOT_A_RELEASE)
  })

  it('reads stdin to the end with the flag, and never prints it', async () => {
    const { code, out } = await h.run(
      'deploy-release.sh',
      {},
      ['--umami-password-stdin'],
      'a-very-secret-password',
    )
    expect(code).toBe(1)
    expect(out).toContain(NOT_A_RELEASE)
    expect(out).not.toContain('a-very-secret-password')
  })

  it('accepts an empty password with the flag (the secret is not set yet)', async () => {
    const { code, out } = await h.run('deploy-release.sh', {}, ['--umami-password-stdin'], '')
    expect(code).toBe(1)
    expect(out).toContain(NOT_A_RELEASE)
  })
})
