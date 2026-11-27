// ops/offsite-lib.sh (#1332): the rule for the public certificate the weekly copies are sealed to, including the
// real one committed as ops/offsite-backup-cert.pem, and which openssl it runs. The key pair used for the cases is made
// for the test; the committed certificate is the owner's public half, read as it is.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makeKeyPair, sealWithJobCommand } from './offsite-harness.mjs'

const OPS = path.dirname(fileURLToPath(import.meta.url))
const COMMITTED = path.join(OPS, 'offsite-backup-cert.pem')
let dir = ''
let keys = null
const p = (name) => path.join(dir, name)

/** Runs offsite_cert_problem on a file; returns its status and what it said. */
function certProblem(file, env = {}) {
  const script = `. "${path.join(OPS, 'offsite-lib.sh')}"; offsite_cert_problem "$1"`
  const result = spawnSync('bash', ['-c', script, '_', file], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  })
  return { ok: result.status === 0, said: result.stdout.trim() }
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-lib-'))
  keys = makeKeyPair(dir)
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe("the owner's public certificate, as committed", () => {
  it('passes the rule the job applies before it seals anything', () => {
    expect(fs.existsSync(COMMITTED)).toBe(true)
    expect(certProblem(COMMITTED)).toEqual({ ok: true, said: '' })
  })

  it('is one certificate and holds no private key', () => {
    const text = fs.readFileSync(COMMITTED, 'utf8')
    expect(text.match(/-----BEGIN /g)).toHaveLength(1)
    expect(text).not.toContain('PRIVATE')
  })

  it('is a certificate a file can be sealed to with the job command (offsite_seal), and a copy that another key cannot open', () => {
    fs.writeFileSync(p('plain.txt'), 'a test file')
    sealWithJobCommand(COMMITTED, p('plain.txt'), p('sealed.cms'))
    expect(fs.statSync(p('sealed.cms')).size).toBeGreaterThan(0)
    expect(fs.readFileSync(p('sealed.cms')).includes('a test file')).toBe(false)
    expect(() =>
      execFileSync(
        'openssl',
        [
          'cms',
          '-decrypt',
          '-binary',
          '-inform',
          'DER',
          '-in',
          p('sealed.cms'),
          '-inkey',
          keys.key,
          '-out',
          p('opened.txt'),
        ],
        { stdio: 'ignore' },
      ),
    ).toThrow()
    expect(
      fs.existsSync(p('opened.txt')) ? fs.readFileSync(p('opened.txt'), 'utf8') : '',
    ).not.toContain('a test file')
  })
})

describe('offsite_cert_problem refuses what is not just a public certificate', () => {
  const cert = () => fs.readFileSync(keys.cert, 'utf8')

  it('accepts the test certificate', () => {
    expect(certProblem(keys.cert).ok).toBe(true)
  })

  it('says a file that is not there is missing, and a link is a link', () => {
    expect(certProblem(p('none.pem'))).toEqual({
      ok: false,
      said: 'the public key file is missing',
    })
    fs.symlinkSync(keys.cert, p('link.pem'))
    const link = certProblem(p('link.pem'))
    expect(link.ok).toBe(false)
    expect(link.said).toContain('symbolic link')
  })

  it('refuses a file over 8 KiB even when it is otherwise one good certificate', () => {
    fs.writeFileSync(p('big.pem'), `${cert()}${'# padding\n'.repeat(1000)}`)
    expect(certProblem(p('big.pem')).said).toContain('more than a public certificate')
  })

  it('refuses a small file that mentions a private key anywhere', () => {
    fs.writeFileSync(p('word.pem'), `${cert()}# a PRIVATE note\n`)
    expect(certProblem(p('word.pem')).said).toContain('a private key must never be here')
  })

  it('refuses a file that does not start with the certificate line, and one with two certificates', () => {
    fs.writeFileSync(p('lead.pem'), `# a note\n${cert()}`)
    expect(certProblem(p('lead.pem')).said).toContain('not exactly one PEM certificate')
    fs.writeFileSync(p('two.pem'), cert() + cert())
    expect(certProblem(p('two.pem')).said).toContain('not exactly one PEM certificate')
  })

  it('refuses a certificate that cannot be read', () => {
    fs.writeFileSync(
      p('junk.pem'),
      '-----BEGIN CERTIFICATE-----\nnot a certificate\n-----END CERTIFICATE-----\n',
    )
    expect(certProblem(p('junk.pem')).said).toContain('not a readable certificate')
  })
})

describe('the one openssl', () => {
  it('is the one OFFSITE_OPENSSL names, for the certificate and for the key inside it', () => {
    fs.mkdirSync(p('bin'), { recursive: true })
    fs.writeFileSync(
      p('bin/openssl'),
      '#!/usr/bin/env bash\necho "the PATH openssl was used" >&2\nexit 99\n',
      { mode: 0o755 },
    )
    const real = execFileSync('which', ['openssl']).toString().trim()
    expect(
      certProblem(keys.cert, { PATH: `${p('bin')}:${process.env.PATH}`, OFFSITE_OPENSSL: real }).ok,
    ).toBe(true)
    // and with nothing named it falls back to the one on the PATH, here the failing one
    expect(certProblem(keys.cert, { PATH: `${p('bin')}:${process.env.PATH}` }).ok).toBe(false)
  })
})
