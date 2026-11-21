// The script that hands a preview's test sign-in to a requester sealed to their public key (#1394), against a
// stand-in `ssh` and the real `openssl`. What matters: the ciphertext opens with the requester's private key and
// nothing else, and the plaintext appears in no output (the run log is public).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))
const OPS = path.join(SCRIPTS, '..', '..', 'ops')
const ROLES = ['admin', 'editor', 'resident', 'guest']
const PASSWORDS = ROLES.map((_, i) => String.fromCharCode(97 + i).repeat(63) + String(i))
const PLAIN = ROLES.map((r, i) => `${r}=${PASSWORDS[i]}\n`).join('')

let keys // a throwaway key folder for the whole file
let dir
let ownKey
let otherKey
const p = (...parts) => path.join(dir, ...parts)

function makeKey(name, bits) {
  const priv = path.join(keys, `${name}.pem`)
  const gen = spawnSync('openssl', [
    'genpkey',
    '-algorithm',
    'RSA',
    '-pkeyopt',
    `rsa_keygen_bits:${bits}`,
    '-out',
    priv,
  ])
  expect(gen.status).toBe(0)
  const pub = spawnSync('openssl', ['pkey', '-in', priv, '-pubout'], { encoding: 'utf8' })
  return { priv, publicB64: Buffer.from(pub.stdout).toString('base64') }
}

beforeAll(() => {
  keys = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-credentials-keys-'))
  ownKey = makeKey('own', 3072)
  otherKey = makeKey('other', 3072)
})
afterAll(() => fs.rmSync(keys, { recursive: true, force: true }))

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-credentials-'))
  fs.writeFileSync(p('log'), '')
  fs.mkdirSync(p('bin'))
  fs.writeFileSync(
    p('bin/ssh'),
    `#!/usr/bin/env bash
echo "ssh \${@: -1}" >> "$STUB_LOG"
printf '%s' "\${STUB_CREDENTIALS-}"
exit "\${STUB_EXIT:-0}"
`,
    { mode: 0o755 },
  )
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

/** The dispatch event, as the runner writes it: the inputs only reach the script here. */
function writeEvent(publicKey) {
  fs.writeFileSync(
    p('event.json'),
    JSON.stringify({ inputs: { number: '7', public_key_base64: publicKey } }),
  )
}

function run(env = {}) {
  const { PUBLIC_KEY_B64: key = ownKey.publicB64, ...rest } = env
  writeEvent(key)
  const r = spawnSync('bash', [path.join(SCRIPTS, 'preview-credentials.sh')], {
    encoding: 'utf8',
    env: {
      PATH: `${p('bin')}:${process.env.PATH}`,
      STUB_LOG: p('log'),
      STUB_CREDENTIALS: PLAIN,
      OPS_DIR: OPS,
      NUMBER: '7',
      GITHUB_EVENT_PATH: p('event.json'),
      ...rest,
    },
  })
  const out = r.stdout + r.stderr
  return { code: r.status, out, log: fs.readFileSync(p('log'), 'utf8') }
}

/** The lines the Actions runner shows: it consumes the `::add-mask::` commands and never prints them. */
const visible = (out) =>
  out
    .split('\n')
    .filter((l) => !l.startsWith('::add-mask::'))
    .join('\n')
const sealedOf = (out) => out.match(/sealed-sign-in-begin\n(\S+)\nsealed-sign-in-end/)?.[1]
const open = (sealed, privateKey) =>
  spawnSync(
    'openssl',
    [
      'pkeyutl',
      '-decrypt',
      '-inkey',
      privateKey,
      '-pkeyopt',
      'rsa_padding_mode:oaep',
      '-pkeyopt',
      'rsa_oaep_md:sha256',
      '-pkeyopt',
      'rsa_mgf1_md:sha256',
    ],
    { input: Buffer.from(sealed, 'base64'), encoding: 'utf8' },
  )

describe('preview-credentials.sh', () => {
  it('asks the wrapper for this preview’s credentials, and nothing else', () => {
    const r = run()
    expect(r.code).toBe(0)
    expect(r.log).toBe('ssh credentials 7\n')
  })

  it('prints a ciphertext that opens with the requester’s private key', () => {
    const r = run()
    const sealed = sealedOf(r.out)
    expect(sealed).toBeTruthy()
    const opened = open(sealed, ownKey.priv)
    expect(opened.status).toBe(0)
    expect(opened.stdout).toBe(PLAIN)
  })

  it('does not open with another key', () => {
    const sealed = sealedOf(run().out)
    expect(open(sealed, otherKey.priv).status).not.toBe(0)
  })

  it('seals differently every time (OAEP is randomized)', () => {
    expect(sealedOf(run().out)).not.toBe(sealedOf(run().out))
  })

  it('prints no password, no role line and no key in what the log shows', () => {
    const shown = visible(run().out)
    for (const password of PASSWORDS) expect(shown).not.toContain(password)
    for (const role of ROLES) expect(shown).not.toContain(`${role}=`)
    expect(shown).not.toContain(ownKey.publicB64)
  })

  it('masks every line and every password before it prints anything else', () => {
    const lines = run().out.split('\n')
    const firstOther = lines.findIndex((l) => !l.startsWith('::add-mask::'))
    const masks = lines.slice(0, firstOther)
    for (const password of PASSWORDS) expect(masks).toContain(`::add-mask::${password}`)
    for (const line of PLAIN.trim().split('\n')) expect(masks).toContain(`::add-mask::${line}`)
  })

  it('does not turn tracing on, which would print the plaintext', () => {
    expect(fs.readFileSync(path.join(SCRIPTS, 'preview-credentials.sh'), 'utf8')).not.toMatch(
      /set -[a-z]*x|xtrace/,
    )
  })

  it('shows the wrapper’s fixed refusal (printed on stdout, as the real wrapper does) and fails, sealing nothing', () => {
    const refusal = '::error title=Preview access::refused: there is no such preview'
    const r = run({ STUB_EXIT: '2', STUB_CREDENTIALS: refusal })
    expect(r.code).toBe(1)
    expect(r.out).toContain(refusal)
    expect(r.out).not.toContain('sealed-sign-in-begin')
  })

  it('shows every refusal text the wrapper has for this action', () => {
    const wrapper = fs.readFileSync(path.join(OPS, 'preview-wrapper.sh'), 'utf8')
    const texts = [
      ...wrapper.matchAll(
        /(?:refuse "|none=")(there is no such preview|the preview has no test sign-in[^"]*|credentials [^"]*)"/g,
      ),
    ].map((m) => m[1])
    expect(texts.length).toBeGreaterThanOrEqual(3)
    for (const text of texts) {
      const refusal = `::error title=Preview access::refused: ${text}`
      expect(run({ STUB_EXIT: '2', STUB_CREDENTIALS: refusal }).out).toContain(refusal)
    }
  })

  it.each([
    ['more than one line', `::error title=Preview access::refused: no\nadmin=${'a'.repeat(64)}`],
    ['not the wrapper’s form', `admin=${'a'.repeat(64)}`],
    ['a workflow command', '::add-mask::x'],
    ['a refusal with a value in it', `::error title=Preview access::refused: ${'a'.repeat(64)}`],
  ])('prints nothing the server returned on a failure when it is %s', (_, text) => {
    const r = run({ STUB_EXIT: '2', STUB_CREDENTIALS: text })
    expect(r.code).toBe(1)
    expect(visible(r.out)).not.toContain('a'.repeat(64))
    expect(visible(r.out)).not.toContain('::add-mask::x')
  })

  it('fails when the server hands out nothing', () => {
    const r = run({ STUB_CREDENTIALS: '' })
    expect(r.code).toBe(1)
    expect(r.out).not.toContain('sealed-sign-in-begin')
  })

  it.each(['0', '07', '1234567', '-7', '7;id', '../7', '7 8', ''])(
    'refuses the number %j before it connects',
    (number) => {
      const r = run({ NUMBER: number })
      expect(r.code).not.toBe(0)
      expect(r.log).toBe('')
    },
  )

  it.each([
    ['not base64', '!!!not base64!!!'],
    ['base64 of something else', Buffer.from('hello').toString('base64')],
    ['a newline in it', 'QUJD\nid'],
    ['too long', 'A'.repeat(4001)],
  ])('refuses a key that is %s, before it connects', (_, value) => {
    const r = run({ PUBLIC_KEY_B64: value })
    expect(r.code).toBe(1)
    expect(r.log).toBe('')
    expect(r.out).not.toContain('sealed-sign-in-begin')
  })

  it('refuses a private key, and never prints any of it', () => {
    const privateB64 = Buffer.from(fs.readFileSync(ownKey.priv)).toString('base64')
    const r = run({ PUBLIC_KEY_B64: privateB64 })
    expect(r.code).toBe(1)
    expect(r.log).toBe('')
    expect(r.out).not.toContain(privateB64)
    expect(r.out).not.toContain('PRIVATE')
  })

  it('refuses an RSA key under 3072 bits, which could not hold the file safely', () => {
    const small = makeKey('small', 2048)
    const r = run({ PUBLIC_KEY_B64: small.publicB64 })
    expect(r.code).toBe(1)
    expect(r.log).toBe('')
  })

  it('refuses a key that is not RSA', () => {
    const priv = path.join(keys, 'ec.pem')
    spawnSync('openssl', [
      'genpkey',
      '-algorithm',
      'EC',
      '-pkeyopt',
      'ec_paramgen_curve:P-256',
      '-out',
      priv,
    ])
    const pub = spawnSync('openssl', ['pkey', '-in', priv, '-pubout'], { encoding: 'utf8' }).stdout
    const r = run({ PUBLIC_KEY_B64: Buffer.from(pub).toString('base64') })
    expect(r.code).toBe(1)
    expect(r.log).toBe('')
  })

  it('never prints the plaintext when sealing fails', () => {
    // A stand-in openssl that fails only for the encryption, as a broken runner might.
    fs.writeFileSync(
      p('bin/openssl'),
      `#!/usr/bin/env bash\n[ "$1" != pkeyutl ] || { cat >/dev/null; echo "$STUB_CREDENTIALS" >&2; exit 1; }\nexec /usr/bin/openssl "$@"\n`,
      { mode: 0o755 },
    )
    const r = run()
    expect(r.code).toBe(1)
    const shown = visible(r.out)
    for (const password of PASSWORDS) expect(shown).not.toContain(password)
  })
})
