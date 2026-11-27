// Test helpers for the off-site backup scripts (#1332): a server-shaped folder tree in a temp directory, a
// throwaway RSA key pair made with openssl, and a stand-in `rclone` that keeps the "Drive" in a local folder
// (rclone is not installed where the tests run, and nothing here may use the network). Not a test file itself.
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { OPS, write } from './umami-harness.mjs'

export const MARKER = 'SECRET-DATABASE-ROW-marker-9f3a'
export const REMOTE_DIR = 'sprecher-east-backups'
const SCRIPTS = [
  'lib.sh',
  'environment.sh',
  'offsite-lib.sh',
  'offsite-backup.sh',
  'offsite-restore.sh',
  'install-offsite-backup.sh',
]

// The stand-in for rclone. It understands only what the scripts call, keeps the remote `offsite:<dir>` in
// $MOCK_STORE/<dir>, logs each call's arguments, and can be told to misbehave through MOCK_* variables.
const MOCK_RCLONE = String.raw`
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const argv = process.argv.slice(2)
fs.appendFileSync(process.env.MOCK_LOG, argv.join(' ') + '\n')
const valueFlags = new Set(['--config', '--retries', '--low-level-retries', '--contimeout', '--timeout', '--format', '--hash', '--separator'])
const flags = {}
const rest = []
for (let i = 0; i < argv.length; i++) {
  if (valueFlags.has(argv[i])) flags[argv[i]] = argv[++i]
  else if (argv[i].startsWith('--')) flags[argv[i].split('=')[0]] = argv[i].includes('=') ? argv[i].split('=')[1] : true
  else rest.push(argv[i])
}
const [cmd, ...args] = rest
const fail = (m) => { console.error(m); process.exit(1) }
const failing = (process.env.MOCK_FAIL || '').split(',')
if (cmd === 'version') { console.log('rclone v' + (process.env.MOCK_VERSION || '1.76.0')); process.exit(0) }
if (!flags['--config'] || !fs.existsSync(flags['--config'])) fail('mock: no config file')
if (failing.includes(cmd)) fail('mock: ' + cmd + ' failed')
const remote = (spec) => {
  const m = /^offsite:(.*)$/.exec(spec)
  if (!m) fail('mock: unknown remote ' + spec)
  return path.join(process.env.MOCK_STORE, m[1])
}
if (cmd === 'copyto') {
  const dest = remote(args[1])
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  let data = fs.readFileSync(args[0])
  if (process.env.MOCK_CORRUPT_UPLOAD) data = data.subarray(0, data.length - 1)
  fs.writeFileSync(dest, data)
} else if (cmd === 'deletefile') {
  fs.rmSync(remote(args[0]), { force: true })
} else if (cmd === 'lsf') {
  const dir = remote(args[0])
  const sep = flags['--separator'] || ';'
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
  for (const name of names) {
    const file = path.join(dir, name)
    const st = fs.statSync(file)
    const cell = { p: name, s: String(st.size), t: new Date(st.mtimeMs).toISOString().slice(0, 19).replace('T', ' ') }
    cell.h = process.env.MOCK_NO_HASH ? '' : crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex')
    console.log((flags['--format'] || 'p').split('').map((c) => cell[c]).join(sep))
  }
} else fail('mock: unsupported ' + cmd)
`

/** One throwaway key pair for a test file: 3072-bit RSA, the certificate that carries the public half. */
export function makeKeyPair(dir, { bits = 3072 } = {}) {
  const key = path.join(dir, 'private.pem')
  const cert = path.join(dir, 'cert.pem')
  execFileSync(
    'openssl',
    ['genpkey', '-algorithm', 'RSA', '-pkeyopt', `rsa_keygen_bits:${bits}`, '-out', key],
    {
      stdio: 'ignore',
    },
  )
  execFileSync(
    'openssl',
    [
      'req',
      '-new',
      '-x509',
      '-key',
      key,
      '-subj',
      '/CN=Sprecher East backups',
      '-days',
      '7300',
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  )
  return { key, cert }
}

/** Registers hooks and returns the helpers; call it once at the top of a test file. */
export function setUpOffsiteHarness({ install = false } = {}) {
  const h = { dir: '', keys: null, keyDir: '' }
  const p = (...parts) => path.join(h.dir, ...parts)
  const stub = (name, body) => write(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)

  beforeAll(() => {
    h.keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-keys-'))
    h.keys = makeKeyPair(h.keyDir)
  })
  afterAll(() => fs.rmSync(h.keyDir, { recursive: true, force: true }))

  beforeEach(() => {
    h.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-'))
    for (const f of SCRIPTS) write(p('code/ops', f), fs.readFileSync(path.join(OPS, f)))
    fs.mkdirSync(p('app'), { recursive: true })
    fs.mkdirSync(p('cron'), { recursive: true }) // /etc/cron.d
    fs.symlinkSync(p('code'), p('app/current'), 'dir') // the app folder's `current` link (the cron job runs through it)
    write(p('code/ops/offsite-backup-cert.pem'), fs.readFileSync(h.keys.cert))
    write(p('log'), '')
    write(p('rclone.log'), '')
    fs.mkdirSync(p('store'), { recursive: true })
    fs.mkdirSync(p('backups/daily'), { recursive: true })
    write(p('etc/offsite-rclone.conf'), '[offsite]\ntype = drive\nscope = drive.file\n', 0o600)
    // The mock is the `rclone` the scripts find (the installer's tests start without it).
    write(p('mock-rclone.js'), MOCK_RCLONE)
    write(
      p('bin/rclone-mock'),
      `#!/usr/bin/env bash\nexec ${process.execPath} "${p('mock-rclone.js')}" "$@"\n`,
      0o755,
    )
    fs.copyFileSync(p('bin/rclone-mock'), p('bin/rclone'))
    fs.chmodSync(p('bin/rclone'), 0o755)
    if (install) {
      fs.rmSync(p('etc/offsite-rclone.conf'))
      fs.rmSync(p('bin/rclone'))
    }
  })
  afterEach(() => fs.rmSync(h.dir, { recursive: true, force: true }))

  /** A daily archive as ops/backup.sh makes one: a real gzip tar holding the marker, `hoursOld` hours old. */
  h.makeArchive = (stamp = '2026-11-22T0815Z', hoursOld = 2) => {
    const stage = fs.mkdtempSync(path.join(h.dir, 'stage-'))
    fs.writeFileSync(
      path.join(stage, 'payload.db'),
      `${MARKER}\n${crypto.randomBytes(40000).toString('hex')}`,
    )
    fs.writeFileSync(path.join(stage, 'env.local'), 'PAYLOAD_SECRET=not-a-real-secret\n')
    const archive = p('backups/daily', `sprecher-east-${stamp}.tar.gz`)
    execFileSync('tar', ['-czf', archive, '-C', stage, 'payload.db', 'env.local'])
    const when = new Date(Date.now() - hoursOld * 3600 * 1000)
    fs.utimesSync(archive, when, when)
    fs.rmSync(stage, { recursive: true })
    return archive
  }
  /** A file already in the fake Drive, `daysOld` days old. */
  h.putRemote = (name, content = 'x', daysOld = 0) => {
    const file = p('store', REMOTE_DIR, name)
    write(file, content)
    const when = new Date(Date.now() - daysOld * 86400 * 1000)
    fs.utimesSync(file, when, when)
    return file
  }
  h.remoteNames = () =>
    fs.existsSync(p('store', REMOTE_DIR)) ? fs.readdirSync(p('store', REMOTE_DIR)).sort() : []
  h.remoteFile = (name) => fs.readFileSync(p('store', REMOTE_DIR, name))
  h.rcloneLog = () => fs.readFileSync(p('rclone.log'), 'utf8')

  /** The settings a server would have, pointed into the temp folder. `env` overrides them. */
  h.env = (env = {}) => ({
    PATH: `${p('bin')}:${process.env.PATH}`,
    HOME: h.dir,
    APP_DIR: p('app'),
    BACKUP_ROOT: p('backups'),
    OFFSITE_DIR: p('etc'),
    OFFSITE_CRON_FILE: p('cron/sprecher-east-offsite-backup'),
    OFFSITE_LOG: p('offsite.log'),
    OFFSITE_ROOT_UID: String(process.getuid()),
    MOCK_STORE: p('store'),
    MOCK_LOG: p('rclone.log'),
    OFFSITE_SPARE_KB: '1',
    ...env,
  })

  /** Runs a script from the fake release. */
  h.run = (script, args = [], env = {}, input = undefined) =>
    new Promise((resolve) => {
      const child = spawn('bash', [p('code/ops', script), ...args], { env: h.env(env) })
      if (input !== undefined) child.stdin.end(input)
      else child.stdin.end()
      let out = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (out += d))
      child.on('close', (code) => resolve({ code, out }))
    })
  h.stub = stub
  h.p = p
  return h
}
