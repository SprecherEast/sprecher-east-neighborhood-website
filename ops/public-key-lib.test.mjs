// ops/public-key-lib.sh (#1332): the one rule for a public key someone gives the server or a workflow to seal
// to (the pull request sign-in script and the off-site backup both use it): a PEM public key, RSA, 3072 to 8192
// bits, never a private key. The keys are made for the test with openssl; the 8704-bit RSA key and the 3072-bit DSA key are committed public keys only.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const OPS = path.dirname(fileURLToPath(import.meta.url))
let dir = ''
const p = (name) => path.join(dir, name)
const openssl = (...args) => execFileSync('openssl', args, { stdio: 'ignore' })
const pub = (privateKey, out) => openssl('pkey', '-in', p(privateKey), '-pubout', '-out', p(out))

/** Runs public_key_problem on a file; returns what it said and its status. */
function check(file) {
  const script = `. "${path.join(OPS, 'public-key-lib.sh')}"; if public_key_problem "$1"; then echo "ok $PUBLIC_KEY_BITS"; else echo "$PUBLIC_KEY_PROBLEM"; fi`
  return execFileSync('bash', ['-c', script, '_', file]).toString().trim()
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pubkey-'))
  openssl(
    'genpkey',
    '-algorithm',
    'RSA',
    '-pkeyopt',
    'rsa_keygen_bits:3072',
    '-out',
    p('rsa3072.pem'),
  )
  pub('rsa3072.pem', 'rsa3072.pub')
  openssl(
    'genpkey',
    '-algorithm',
    'RSA',
    '-pkeyopt',
    'rsa_keygen_bits:2048',
    '-out',
    p('rsa2048.pem'),
  )
  pub('rsa2048.pem', 'rsa2048.pub')
  openssl('genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:P-256', '-out', p('ec.pem'))
  pub('ec.pem', 'ec.pub')
  // a 3072-bit key that is not RSA: it passes the size rule, so only the RSA rule refuses it. A committed public key,
  // because making DSA parameters of this size takes long on a loaded machine.
  fs.copyFileSync(path.join(OPS, 'fixtures/dsa-3072-public.pem'), p('dsa.pub'))
  fs.copyFileSync(path.join(OPS, 'fixtures/rsa-8704-public.pem'), p('rsa8704.pub'))
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('public_key_problem', () => {
  it('accepts an RSA public key of 3072 bits and says how many', () => {
    expect(check(p('rsa3072.pub'))).toBe('ok 3072')
  })

  it('refuses a key under 3072 bits and one over 8192 bits', () => {
    expect(check(p('rsa2048.pub'))).toContain('between 3072 and 8192 bits')
    expect(check(p('rsa8704.pub'))).toContain('between 3072 and 8192 bits')
  })

  it('refuses a key that is not RSA', () => {
    expect(check(p('ec.pub'))).toContain('must be an RSA key')
    expect(check(p('dsa.pub'))).toContain('must be an RSA key')
  })

  it('refuses a private key, whatever else the file holds', () => {
    expect(check(p('rsa3072.pem'))).toContain('never send a private key')
    fs.writeFileSync(
      p('mixed.pub'),
      `${fs.readFileSync(p('rsa3072.pub'), 'utf8')}${fs.readFileSync(p('rsa3072.pem'), 'utf8')}`,
    )
    expect(check(p('mixed.pub'))).toContain('never send a private key')
  })

  it('refuses a file that is not a PEM public key, and one that does not exist', () => {
    fs.writeFileSync(
      p('junk.pub'),
      '-----BEGIN PUBLIC KEY-----\nnotakey\n-----END PUBLIC KEY-----\n',
    )
    expect(check(p('junk.pub'))).toContain('not a public key in PEM form')
    fs.writeFileSync(p('text.pub'), 'hello\n')
    expect(check(p('text.pub'))).toContain('never send a private key')
    expect(check(p('missing.pub'))).toContain('never send a private key')
  })
})
