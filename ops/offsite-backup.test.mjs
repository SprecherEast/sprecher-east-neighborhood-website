// ops/offsite-backup.sh and ops/offsite-restore.sh (#1332): the weekly job that seals the newest daily archive to
// the owner's public key and sends it to Google Drive, and the script the owner opens a copy with on his own
// computer. `rclone` is a stand-in that keeps "Drive" in a local folder, and the key pair is made for the test
// with openssl: nothing here uses the network, and no real key or credential exists.
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MARKER,
  REMOTE_DIR,
  makeKeyPair,
  openWithJobCommand,
  sealWithJobCommand,
  setUpOffsiteHarness,
} from './offsite-harness.mjs'

const h = setUpOffsiteHarness()
const STAMP = '2026-11-22T0815Z'
const NAME = `sprecher-east-${STAMP}.tar.gz.cms`
const archiveNames = () =>
  h.remoteNames().filter((n) => /^sprecher-east-\d{4}-.*\.tar\.gz\.cms$/.test(n))
const status = () => fs.readFileSync(h.p('backups/offsite-status'), 'utf8')
const leftovers = () => fs.readdirSync(h.p('backups')).filter((n) => n.startsWith('.offsite-work-'))
const uploadedPaths = () =>
  h
    .rcloneLog()
    .split('\n')
    .filter((l) => l.includes('copyto'))
    .map((l) => l.split(' ').find((w) => w.startsWith(h.p('backups'))))

describe('offsite-backup.sh run', () => {
  it('seals the newest daily archive, sends it, checks it, and writes the result', async () => {
    h.makeArchive('2026-11-21T0815Z', 30)
    const newest = h.makeArchive(STAMP, 2)
    const { code, out } = await h.run('offsite-backup.sh')
    expect(out).toContain('off-site backup ok')
    expect(code).toBe(0)
    expect(archiveNames()).toEqual([NAME])
    // the copy was checked by size and MD5, from Drive's own listing
    expect(h.rcloneLog()).toMatch(/lsf .*--hash MD5/)
    expect(status()).toContain('result=ok')
    expect(leftovers()).toEqual([])
    expect(fs.existsSync(newest)).toBe(true) // the daily archive itself is untouched
  })

  it('never sends anything unsealed, and the copy in Drive is not readable without the private key', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    for (const file of uploadedPaths()) expect(file).toMatch(/\.cms$/)
    const sealed = h.remoteFile(NAME)
    expect(sealed.subarray(0, 2).toString('hex')).not.toBe('1f8b') // not the gzip archive
    expect(sealed.includes(Buffer.from(MARKER))).toBe(false)
    expect(sealed.includes(Buffer.from('PAYLOAD_SECRET'))).toBe(false)
    expect(h.rcloneLog()).not.toContain(MARKER)
    // sealed with an authenticated cipher to RSA-OAEP, as the scheme says
    const text = execFileSync('openssl', ['cms', '-cmsout', '-print', '-inform', 'DER'], {
      input: sealed,
    }).toString()
    expect(text).toContain('id-smime-ct-authEnvelopedData')
    expect(text).toContain('rsaesOaep')
    expect(text).toContain('aes-256-gcm')
    // the server holds only the certificate: it cannot open the copy with it
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-open-'))
    try {
      fs.writeFileSync(path.join(tmp, 'c.cms'), sealed)
      expect(() =>
        openWithJobCommand(h.keys.cert, path.join(tmp, 'c.cms'), path.join(tmp, 'o')),
      ).toThrow()
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
    expect(fs.readFileSync(h.p('code/ops/offsite-backup-cert.pem'), 'utf8')).not.toContain(
      'PRIVATE',
    )
  })

  it('a copy opens on the owner computer with the private key and equals the daily archive', async () => {
    const archive = h.makeArchive()
    await h.run('offsite-backup.sh')
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-restore-'))
    try {
      fs.writeFileSync(path.join(work, NAME), h.remoteFile(NAME))
      const result = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work])
      expect(result.code).toBe(0)
      const opened = path.join(work, `sprecher-east-${STAMP}.tar.gz`)
      expect(fs.readFileSync(opened).equals(fs.readFileSync(archive))).toBe(true)
      expect(fs.readdirSync(work).filter((n) => n.endsWith('.partial'))).toEqual([])
      // the restored archive holds the database copy
      const files = execFileSync('tar', ['-tzf', opened]).toString()
      expect(files).toContain('payload.db')
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('keeps the newest 8 copies and deletes only names the job made', async () => {
    h.makeArchive()
    for (let i = 1; i <= 10; i++)
      h.putRemote(
        `sprecher-east-2026-10-${String(i).padStart(2, '0')}T0815Z.tar.gz.cms`,
        'old',
        60 - i,
      )
    h.putRemote('holiday-photos.zip', 'not ours')
    h.putRemote('sprecher-east-test-2026-10-01T0000Z.txt.cms', 'a test file')
    const { code } = await h.run('offsite-backup.sh')
    expect(code).toBe(0)
    const names = archiveNames()
    expect(names).toHaveLength(8)
    expect(names).toContain(NAME)
    expect(names).not.toContain('sprecher-east-2026-10-01T0815Z.tar.gz.cms')
    expect(names).toContain('sprecher-east-2026-10-10T0815Z.tar.gz.cms')
    expect(h.remoteNames()).toContain('holiday-photos.zip')
    expect(h.remoteNames()).toContain('sprecher-east-test-2026-10-01T0000Z.txt.cms')
    expect(h.rcloneLog()).toMatch(
      /deletefile --drive-use-trash=false offsite:sprecher-east-backups\//,
    ) // permanent, so the quota is freed
  })

  it('removes a copy that does not match (size or checksum) and keeps the older ones', async () => {
    h.makeArchive()
    h.putRemote('sprecher-east-2026-10-01T0815Z.tar.gz.cms', 'old')
    const { code, out } = await h.run('offsite-backup.sh', [], { MOCK_CORRUPT_UPLOAD: '1' })
    expect(code).toBe(1)
    expect(out).toContain('::error')
    expect(out).toContain('does not match')
    expect(archiveNames()).toEqual(['sprecher-east-2026-10-01T0815Z.tar.gz.cms'])
    expect(status()).toContain('result=failed')
    expect(leftovers()).toEqual([])
  })

  it('does not accept a Drive that gives no checksum', async () => {
    h.makeArchive()
    const { code, out } = await h.run('offsite-backup.sh', [], { MOCK_NO_HASH: '1' })
    expect(code).toBe(1)
    expect(out).toContain('does not match')
    expect(archiveNames()).toEqual([])
  })

  it('fails with a message when the upload fails, deleting nothing and leaving nothing behind', async () => {
    h.makeArchive()
    for (let i = 1; i <= 9; i++) h.putRemote(`sprecher-east-2026-10-0${i}T0815Z.tar.gz.cms`, 'old')
    const { code, out } = await h.run('offsite-backup.sh', [], { MOCK_FAIL: 'copyto' })
    expect(code).toBe(1)
    expect(out).toContain('the upload to Drive failed')
    expect(archiveNames()).toHaveLength(9) // retention did not run
    expect(status()).toContain('result=failed')
    expect(leftovers()).toEqual([])
  })

  it('fails when listing Drive fails, without declaring success', async () => {
    h.makeArchive()
    const { code } = await h.run('offsite-backup.sh', [], { MOCK_FAIL: 'lsf' })
    expect(code).toBe(1)
    expect(status()).toContain('result=failed')
  })

  it('refuses a stale or missing daily archive, and sends nothing', async () => {
    let result = await h.run('offsite-backup.sh')
    expect(result.code).toBe(1)
    expect(result.out).toContain('no daily archive')
    h.makeArchive(STAMP, 80)
    result = await h.run('offsite-backup.sh')
    expect(result.code).toBe(1)
    expect(result.out).toContain('daily backup is not running')
    expect(h.rcloneLog()).not.toContain('copyto')
  })

  it('stops when the disk has no room for the sealed copy', async () => {
    h.makeArchive()
    const { code, out } = await h.run('offsite-backup.sh', [], { OFFSITE_SPARE_KB: '900000000000' })
    expect(code).toBe(1)
    expect(out).toContain('MB free')
    expect(h.rcloneLog()).not.toContain('copyto')
  })

  it('does not run twice at once', async () => {
    h.makeArchive()
    fs.mkdirSync(h.p('backups'), { recursive: true })
    const holder = spawn('flock', ['-n', h.p('backups/.offsite.lock'), 'sleep', '30'])
    await new Promise((resolve) => setTimeout(resolve, 300))
    try {
      const { code, out } = await h.run('offsite-backup.sh')
      expect(code).toBe(1)
      expect(out).toContain('another run is still going')
      expect(h.rcloneLog()).not.toContain('copyto')
    } finally {
      holder.kill()
    }
  })

  it('removes the leftovers of a killed run', async () => {
    h.makeArchive()
    fs.mkdirSync(h.p('backups/.offsite-work-abc'))
    fs.writeFileSync(h.p('backups/.offsite-work-abc/x'), 'x')
    await h.run('offsite-backup.sh')
    expect(leftovers()).toEqual([])
  })
})

describe('what is missing is "not set up", never an upload', () => {
  it('without the public key', async () => {
    h.makeArchive()
    fs.rmSync(h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(78)
    expect(out).toContain('public key')
    expect(h.rcloneLog()).toBe('')
  })

  it('without the Drive credential', async () => {
    h.makeArchive()
    fs.rmSync(h.p('etc/offsite-rclone.conf'))
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(78)
    expect(out).toContain('credential')
    expect(h.rcloneLog()).toBe('')
  })

  it('with a private key where the public one should be', async () => {
    h.makeArchive()
    fs.copyFileSync(h.keys.key, h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(1)
    expect(out).toContain('private key must never be here')
    expect(h.rcloneLog()).toBe('')
  })

  it('with a key that is too weak, or no certificate at all', async () => {
    h.makeArchive()
    const weakDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-weak-'))
    try {
      const weak = makeKeyPair(weakDir, { bits: 2048 })
      fs.copyFileSync(weak.cert, h.p('code/ops/offsite-backup-cert.pem'))
      let result = await h.run('offsite-backup.sh')
      expect(result.code).toBe(1)
      expect(result.out).toContain('between 3072 and 8192 bits')
      fs.writeFileSync(h.p('code/ops/offsite-backup-cert.pem'), 'hello\n')
      result = await h.run('offsite-backup.sh')
      expect(result.code).toBe(1)
      expect(h.rcloneLog()).toBe('')
    } finally {
      fs.rmSync(weakDir, { recursive: true, force: true })
    }
  })

  it('without rclone installed', async () => {
    h.makeArchive()
    const { code, out } = await h.run('offsite-backup.sh', [], { RCLONE: 'no-such-rclone' })
    expect(code).toBe(1)
    expect(out).toContain('rclone is not installed')
  })
})

describe('offsite-backup.sh test', () => {
  it('sends a small sealed test file with no site data, and keeps only the newest test file', async () => {
    h.putRemote('sprecher-east-test-2026-10-01T0000Z.txt.cms', 'older test')
    h.makeArchive()
    const { code, out } = await h.run('offsite-backup.sh', ['test'])
    expect(code).toBe(0)
    expect(out).toContain('off-site backup test ok')
    const tests = h.remoteNames().filter((n) => n.startsWith('sprecher-east-test-'))
    expect(tests).toHaveLength(1)
    expect(tests[0]).not.toBe('sprecher-east-test-2026-10-01T0000Z.txt.cms')
    expect(archiveNames()).toEqual([])
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-test-'))
    try {
      fs.writeFileSync(path.join(work, tests[0]), h.remoteFile(tests[0]))
      // the restore script is for archives; a test file is opened with the job's own opener
      openWithJobCommand(h.keys.key, path.join(work, tests[0]), path.join(work, 'opened.txt'))
      expect(fs.readFileSync(path.join(work, 'opened.txt'), 'utf8')).toContain('holds no site data')
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('offsite-backup.sh check', () => {
  it('is fine with a recent copy', async () => {
    h.putRemote(NAME, 'x', 3)
    const { code, out } = await h.run('offsite-backup.sh', ['check'])
    expect(code).toBe(0)
    expect(out).toContain('off-site backup ok')
  })

  it('fails with a copy older than 8 days, naming it', async () => {
    h.putRemote(NAME, 'x', 12)
    const { code, out } = await h.run('offsite-backup.sh', ['check'])
    expect(code).toBe(1)
    expect(out).toContain('::warning') // a warning annotation: the deploy that reports it stays green
    expect(out).not.toContain('::error')
    expect(out).toContain('12 days old')
  })

  it('fails when the last weekly run failed, even with a recent copy', async () => {
    h.putRemote(NAME, 'x', 3)
    fs.writeFileSync(
      h.p('backups/offsite-status'),
      'result=failed\ntime=2026-11-22T09:30:00Z\ndetail=the upload to Drive failed\n',
    )
    const { code, out } = await h.run('offsite-backup.sh', ['check'])
    expect(code).toBe(1)
    expect(out).toContain('the upload to Drive failed')
  })

  it('waits for the first weekly run right after the install, then fails', async () => {
    h.makeRemoteDir()
    fs.mkdirSync(h.p('cron'), { recursive: true })
    fs.writeFileSync(h.p('cron/sprecher-east-offsite-backup'), 'job\n')
    let result = await h.run('offsite-backup.sh', ['check'])
    expect(result.code).toBe(0)
    expect(result.out).toContain('first weekly copy is not there yet')
    const old = new Date(Date.now() - 20 * 86400 * 1000)
    fs.utimesSync(h.p('cron/sprecher-east-offsite-backup'), old, old)
    result = await h.run('offsite-backup.sh', ['check'])
    expect(result.code).toBe(1)
    expect(result.out).toContain('no copy in Drive')
  })

  it('changes nothing in Drive and is "not set up" without a credential', async () => {
    h.putRemote(NAME, 'x', 30)
    await h.run('offsite-backup.sh', ['check'])
    expect(h.rcloneLog()).not.toMatch(/copyto|deletefile/)
    fs.rmSync(h.p('etc/offsite-rclone.conf'))
    expect((await h.run('offsite-backup.sh', ['check'])).code).toBe(78)
  })
})

describe('offsite-restore.sh: the opened archive and the OpenSSL it needs', () => {
  it('writes the opened archive readable by its owner only', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-mode-'))
    try {
      fs.writeFileSync(path.join(work, NAME), h.remoteFile(NAME))
      await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work])
      expect(fs.statSync(path.join(work, `sprecher-east-${STAMP}.tar.gz`)).mode & 0o077).toBe(0)
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('refuses a copy that opens but is not a readable archive, leaving no output', async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-notar-'))
    try {
      fs.writeFileSync(path.join(work, 'plain.txt'), 'this is not a tar archive')
      sealWithJobCommand(h.keys.cert, path.join(work, 'plain.txt'), path.join(work, NAME))
      const result = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work])
      expect(result.code).toBe(1)
      expect(result.out).toContain('not a readable archive')
      expect(fs.readdirSync(work).sort()).toEqual(['plain.txt', NAME])
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it.each([
    ['LibreSSL, which a Mac ships', 'LibreSSL 3.3.6'],
    ['OpenSSL older than 3.0', 'OpenSSL 1.1.1w  11 Sep 2023'],
  ])('stops with what to install when openssl is %s', async (_what, banner) => {
    h.stub('openssl', `echo "${banner}"`)
    const result = await h.run('offsite-restore.sh', ['/dev/null', '/dev/null', h.dir])
    expect(result.code).toBe(1)
    expect(result.out).toContain('OpenSSL 3.0 or later')
    expect(result.out).toContain('brew install openssl@3')
    expect(result.out).toContain('OFFSITE_OPENSSL=')
  })

  it('uses the openssl that OFFSITE_OPENSSL names', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-alt-'))
    try {
      h.stub('openssl', 'echo "LibreSSL 3.3.6"')
      fs.writeFileSync(path.join(work, NAME), h.remoteFile(NAME))
      const result = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work], {
        OFFSITE_OPENSSL: '/usr/bin/openssl',
      })
      expect(result.code).toBe(0)
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('offsite-restore.sh', () => {
  const seal = async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-bad-'))
    fs.writeFileSync(path.join(work, NAME), h.remoteFile(NAME))
    return work
  }

  it('refuses the wrong key and leaves no output', async () => {
    const work = await seal()
    try {
      const other = h.otherKeys
      const result = await h.run('offsite-restore.sh', [path.join(work, NAME), other.key, work])
      expect(result.code).toBe(1)
      expect(result.out).toContain('could not open the copy')
      expect(fs.readdirSync(work)).toEqual([NAME])
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('refuses a copy that was changed by one byte, and leaves no output', async () => {
    const work = await seal()
    try {
      const file = path.join(work, NAME)
      const bytes = fs.readFileSync(file)
      bytes[Math.floor(bytes.length / 2)] ^= 1
      fs.writeFileSync(file, bytes)
      const result = await h.run('offsite-restore.sh', [file, h.keys.key, work])
      expect(result.code).toBe(1)
      expect(fs.readdirSync(work)).toEqual([NAME])
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite, a wrong name, and missing arguments', async () => {
    const work = await seal()
    try {
      fs.writeFileSync(path.join(work, `sprecher-east-${STAMP}.tar.gz`), 'mine')
      let result = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work])
      expect(result.code).toBe(1)
      expect(result.out).toContain('exists already')
      expect(fs.readFileSync(path.join(work, `sprecher-east-${STAMP}.tar.gz`), 'utf8')).toBe('mine')
      // a copy that is not named as a sealed copy, opened into a different folder so "exists already" cannot be the reason
      const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-out-'))
      try {
        fs.copyFileSync(path.join(work, NAME), path.join(work, 'plain.bin'))
        result = await h.run('offsite-restore.sh', [
          path.join(work, 'plain.bin'),
          h.keys.key,
          elsewhere,
        ])
        expect(result.code).toBe(1)
        expect(result.out).toContain('is not a sealed copy')
        expect(fs.readdirSync(elsewhere)).toEqual([])
      } finally {
        fs.rmSync(elsewhere, { recursive: true, force: true })
      }
      expect((await h.run('offsite-restore.sh', [])).code).toBe(2)
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('the guards that protect the copies', () => {
  const oldCopies = (n) => {
    for (let i = 1; i <= n; i++)
      h.putRemote(
        `sprecher-east-2026-10-${String(i).padStart(2, '0')}T0815Z.tar.gz.cms`,
        'old',
        60 - i,
      )
  }

  it.each([
    ['a different size', 'MOCK_CORRUPT_UPLOAD'],
    ['one flipped byte of the same size', 'MOCK_FLIP_UPLOAD'],
  ])(
    'keeps every older copy when the new one has %s (retention only after the check)',
    async (_what, flag) => {
      h.makeArchive()
      oldCopies(9) // more than the 8 kept: a retention run before the check would delete one
      const { code } = await h.run('offsite-backup.sh', [], { [flag]: '1' })
      expect(code).toBe(1)
      expect(archiveNames()).toHaveLength(9)
      expect(h.rcloneLog().match(/deletefile/g)).toHaveLength(1) // only the copy that did not match
    },
  )

  it('seals with RSA-OAEP using SHA-256 and MGF1 with SHA-256, not the SHA-1 default', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-asn1-'))
    try {
      fs.writeFileSync(path.join(tmp, 'c.der'), h.remoteFile(NAME))
      const text = execFileSync(
        'openssl',
        ['asn1parse', '-inform', 'DER', '-in', path.join(tmp, 'c.der'), '-i'],
        {
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      ).toString()
      const head = text.split('\n').slice(0, 40).join('\n')
      expect(head).toContain('rsaesOaep')
      expect(head.match(/OBJECT\s+:sha256/g)?.length).toBeGreaterThanOrEqual(2) // the hash and the MGF1 hash
      expect(head).not.toMatch(/OBJECT\s+:sha1\b/)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('deletes only names that are exactly the job pattern (anchored at both ends, dots literal)', async () => {
    h.makeArchive()
    oldCopies(9)
    const lookalikes = [
      'old-sprecher-east-2026-09-01T0815Z.tar.gz.cms', // starts differently
      'sprecher-east-2026-09-01T0815Z.tar.gz.cms.bak', // ends differently
      'sprecher-east-2026-09-01T0815Zxtar.gz.cms', // a dot is a dot
    ]
    for (const name of lookalikes) h.putRemote(name, 'not ours', 90)
    const { code } = await h.run('offsite-backup.sh')
    expect(code).toBe(0)
    for (const name of lookalikes) expect(h.remoteNames()).toContain(name)
    expect(archiveNames()).toHaveLength(8)
  })

  it('refuses a certificate file with two certificates in it', async () => {
    h.makeArchive()
    const cert = fs.readFileSync(h.keys.cert, 'utf8')
    fs.writeFileSync(h.p('code/ops/offsite-backup-cert.pem'), cert + cert)
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(1)
    expect(out).toContain('exactly one')
    expect(h.rcloneLog()).toBe('')
  })

  it('refuses a certificate that holds a key that is not RSA', async () => {
    h.makeArchive()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-ec-'))
    try {
      execFileSync(
        'openssl',
        [
          'genpkey',
          '-algorithm',
          'EC',
          '-pkeyopt',
          'ec_paramgen_curve:P-256',
          '-out',
          path.join(dir, 'ec.pem'),
        ],
        { stdio: 'ignore' },
      )
      execFileSync(
        'openssl',
        [
          'req',
          '-new',
          '-x509',
          '-key',
          path.join(dir, 'ec.pem'),
          '-subj',
          '/CN=x',
          '-days',
          '30',
          '-out',
          h.p('code/ops/offsite-backup-cert.pem'),
        ],
        { stdio: 'ignore' },
      )
      const { code, out } = await h.run('offsite-backup.sh')
      expect(code).toBe(1)
      expect(out).toContain('RSA')
      expect(h.rcloneLog()).toBe('')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps what it writes private to root (umask 077)', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    expect(fs.statSync(h.p('backups/offsite-status')).mode & 0o077).toBe(0)
    expect(fs.statSync(h.p('backups/.offsite.lock')).mode & 0o077).toBe(0)
    expect(fs.statSync(h.p('offsite.log')).mode & 0o077).toBe(0)
  })

  it('stops with a clear message when openssl is too old for the scheme', async () => {
    h.makeArchive()
    h.stub('openssl', 'echo "OpenSSL 1.1.1w  11 Sep 2023"')
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(1)
    expect(out).toContain('OpenSSL 3.0 or later')
    expect(h.rcloneLog()).toBe('')
  })

  it("keeps rclone's own error text out of the output (it goes to the root-only log)", async () => {
    h.makeArchive()
    const { out } = await h.run('offsite-backup.sh', [], { MOCK_FAIL: 'copyto' })
    expect(out).not.toContain('mock: copyto failed')
    expect(fs.readFileSync(h.p('offsite.log'), 'utf8')).toContain('mock: copyto failed')
    const check = await h.run('offsite-backup.sh', ['check'], { MOCK_FAIL: 'lsf' })
    expect(check.out).not.toContain('mock: lsf failed')
  })

  it('warns, before it uploads, when the copy is too big to open comfortably', async () => {
    h.makeArchive()
    const { code, out } = await h.run('offsite-backup.sh', [], { OFFSITE_WARN_BYTES: '1000' })
    expect(code).toBe(0)
    expect(out).toContain('::warning')
    expect(out).toContain('memory')
  })

  it('a test run does not clear the failure of a weekly run', async () => {
    h.makeArchive()
    h.putRemote(NAME, 'x', 3)
    fs.writeFileSync(
      h.p('backups/offsite-status'),
      'result=failed\ntime=2026-11-22T09:30:00Z\ndetail=the upload to Drive failed\n',
    )
    expect((await h.run('offsite-backup.sh', ['test'])).code).toBe(0)
    expect(status()).toContain('result=failed')
    const { code } = await h.run('offsite-backup.sh', ['check'])
    expect(code).toBe(1)
  })

  it('check fails, saying so, when the Drive folder cannot be listed', async () => {
    const { code, out } = await h.run('offsite-backup.sh', ['check'])
    expect(code).toBe(1)
    expect(out).toContain('could not list')
  })
})

describe('the settings', () => {
  it('a usage error exits 2 and an unknown mode does nothing', async () => {
    expect((await h.run('offsite-backup.sh', ['nonsense'])).code).toBe(2)
    expect(h.rcloneLog()).toBe('')
    expect(REMOTE_DIR).toBe('sprecher-east-backups')
  })
})

describe('every guard fails a test when it is taken out', () => {
  const oldCopies = (n) => {
    for (let i = 1; i <= n; i++)
      h.putRemote(
        `sprecher-east-2026-10-${String(i).padStart(2, '0')}T0815Z.tar.gz.cms`,
        'old',
        60 - i,
      )
  }

  it('turns an unexpected error into a message, the failed status and exit 1', async () => {
    h.makeArchive()
    h.stub('md5sum', 'exit 1')
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(1)
    expect(out).toContain('stopped unexpectedly')
    expect(status()).toContain('result=failed')
  })

  it('refuses a daily archive whose name is not the expected form, and sends nothing', async () => {
    h.makeArchive('weird-name')
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(1)
    expect(out).toContain('not the expected form')
    expect(h.rcloneLog()).not.toContain('copyto')
  })

  it('fails, and says so, when an old copy cannot be removed', async () => {
    h.makeArchive()
    oldCopies(9)
    const { code, out } = await h.run('offsite-backup.sh', [], { MOCK_FAIL: 'deletefile' })
    expect(code).toBe(1)
    expect(out).toContain('removing old copy')
    expect(status()).toContain('result=failed')
  })

  it('fails, and says so, when Drive cannot be listed for old copies after a good upload', async () => {
    h.makeArchive()
    oldCopies(9)
    const { code, out } = await h.run('offsite-backup.sh', [], { MOCK_FAIL_FROM: 'lsf:2' })
    expect(code).toBe(1)
    expect(out).toContain('listing Drive for old copies failed')
    expect(status()).toContain('result=failed')
    expect(archiveNames()).toHaveLength(10) // nothing was pruned, and the new copy is there
  })

  it('makes the backup folder root-only', async () => {
    h.makeArchive()
    fs.chmodSync(h.p('backups'), 0o755)
    await h.run('offsite-backup.sh')
    expect((fs.statSync(h.p('backups')).mode & 0o777).toString(8)).toBe('700')
  })

  it('deletes only test files with exactly the test name (anchored, dots literal)', async () => {
    h.putRemote('sprecher-east-test-2026-10-01T0000Z.txt.cms', 'an old test file', 40)
    const lookalikes = [
      'old-sprecher-east-test-2026-09-01T0000Z.txt.cms',
      'sprecher-east-test-2026-09-01T0000Z.txt.cms.bak',
      'sprecher-east-test-2026-09-01T0000Zxtxt.cms',
    ]
    for (const name of lookalikes) h.putRemote(name, 'not ours', 90)
    const { code } = await h.run('offsite-backup.sh', ['test'])
    expect(code).toBe(0)
    for (const name of lookalikes) expect(h.remoteNames()).toContain(name)
    expect(h.remoteNames()).not.toContain('sprecher-east-test-2026-10-01T0000Z.txt.cms')
  })

  it.each([
    ['test', 'copyto'],
    ['check', 'lsf'],
  ])('cuts off a rclone call that hangs in %s, after its time limit', async (mode, hanging) => {
    h.makeArchive()
    const started = Date.now()
    const { code } = await h.run('offsite-backup.sh', [mode], {
      MOCK_HANG: hanging,
      OFFSITE_QUICK_SECONDS: '1',
    })
    expect(code).toBe(1)
    expect(Date.now() - started).toBeLessThan(25000)
  })

  it("clears RCLONE_* settings from the job's environment", async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh', [], {
      RCLONE_CONFIG_OFFSITE_TYPE: 'local',
      RCLONE_DRIVE_ROOT_FOLDER_ID: 'elsewhere',
    })
    expect(h.rcloneLog()).toContain('copyto')
    expect(h.rcloneLog()).not.toMatch(/^ENV RCLONE_/m)
  })

  it('reports a symbolic link in place of the certificate as a link, and uploads nothing', async () => {
    h.makeArchive()
    fs.rmSync(h.p('code/ops/offsite-backup-cert.pem'))
    fs.symlinkSync(h.keys.cert, h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await h.run('offsite-backup.sh')
    expect(code).toBe(1)
    expect(out).toContain('symbolic link')
    expect(h.rcloneLog()).toBe('')
  })
})

describe('the scope the sign-in was granted', () => {
  it('is checked in the first try: wider than drive.file fails it, with a warning that names no value', async () => {
    const { code, out } = await h.run('offsite-backup.sh', ['test'], {
      STUB_TOKENINFO_ANSWER: '{"scope":"https://www.googleapis.com/auth/drive"}',
    })
    expect(code).toBe(79)
    expect(out).toContain('::warning')
    expect(out).toContain('granted more than drive.file')
    expect(out).not.toContain('ya29.fake-access-token')
  })

  it.each([
    ['an access token with a character that could add a form field', 'a&scope=x'],
    ['an empty access token', ''],
  ])('is not asked about %s: nothing is sent to Google', async (_what, access) => {
    fs.writeFileSync(
      h.p('etc/offsite-rclone.conf'),
      `[offsite]\ntype = drive\nscope = drive.file\ntoken = {"access_token":"${access}","refresh_token":"r","expiry":"2026-11-27T06:03:00Z"}\n`,
      { mode: 0o600 },
    )
    const { code, out } = await h.run('offsite-backup.sh', ['test'])
    expect(code).toBe(1)
    expect(out).toContain('could not be read')
    expect(fs.readFileSync(h.p('log'), 'utf8')).not.toContain('tokeninfo')
  })

  it('is not asked in the weekly run (one try per credential is enough)', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    expect(fs.readFileSync(h.p('log'), 'utf8')).not.toContain('tokeninfo')
  })
})

describe("each copy's SHA-256 is recorded where the owner can read it", () => {
  it('writes it to the status file, the list and the notice, and the check shows it', async () => {
    h.makeArchive()
    const { out } = await h.run('offsite-backup.sh')
    const sha = crypto.createHash('sha256').update(h.remoteFile(NAME)).digest('hex')
    expect(out).toContain(`sealed SHA-256 ${sha}`)
    expect(status()).toContain(`file=${NAME}\nsha256=${sha}\n`)
    expect(fs.readFileSync(h.p('backups/offsite-sha256'), 'utf8')).toBe(`${sha}  ${NAME}\n`)
    const check = await h.run('offsite-backup.sh', ['check'])
    expect(check.out).toContain(`sealed SHA-256 ${sha}`)
  })

  it('keeps only as many as the copies kept in Drive, and one line per copy', async () => {
    const lines = Array.from(
      { length: 8 },
      (_, i) => `${String(i).repeat(64)}  sprecher-east-2026-10-0${i + 1}T0815Z.tar.gz.cms`,
    )
    fs.writeFileSync(h.p('backups/offsite-sha256'), lines.join('\n') + '\n')
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const kept = fs.readFileSync(h.p('backups/offsite-sha256'), 'utf8').trim().split('\n')
    expect(kept).toHaveLength(8)
    expect(kept.at(-1)).toContain(NAME)
    expect(kept[0]).toBe(lines[1])
    await h.run('offsite-backup.sh') // the same copy again: not listed twice
    expect(
      fs
        .readFileSync(h.p('backups/offsite-sha256'), 'utf8')
        .split('\n')
        .filter((l) => l.includes(NAME)),
    ).toHaveLength(1)
  })

  it('says it is not recorded for a copy the job did not record', async () => {
    h.putRemote(NAME, 'x', 3)
    const { out } = await h.run('offsite-backup.sh', ['check'])
    expect(out).toContain('sealed SHA-256 not recorded')
  })
})

describe('offsite-restore.sh takes nothing but what a backup holds', () => {
  const sh = (cmd, cwd) => execFileSync('bash', ['-c', cmd], { cwd, stdio: 'ignore' })
  /** Makes an archive with `build(stage)` and the tar command's arguments, seals it to the test key, returns the folder. */
  const crafted = (build, tarArgs = ['payload.db', 'env.local', 'media'], extra = []) => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-craft-'))
    const stage = path.join(work, 'stage')
    fs.mkdirSync(path.join(stage, 'media'), { recursive: true })
    fs.writeFileSync(path.join(stage, 'payload.db'), 'db')
    fs.writeFileSync(path.join(stage, 'env.local'), 'A=b\n')
    build(stage)
    const plain = path.join(work, `sprecher-east-${STAMP}.tar.gz`)
    execFileSync('tar', [...extra, '-czf', plain, '-C', stage, ...tarArgs], { stdio: 'ignore' })
    sealWithJobCommand(h.keys.cert, plain, path.join(work, NAME))
    fs.rmSync(plain)
    fs.rmSync(stage, { recursive: true })
    const out = path.join(work, 'out')
    fs.mkdirSync(out)
    return { work, out }
  }
  const open = (c, env = {}) =>
    h.run('offsite-restore.sh', [path.join(c.work, NAME), h.keys.key, c.out], env)

  it('opens an archive of the real shape, with media in folders and a name with spaces', async () => {
    const c = crafted((stage) => {
      fs.mkdirSync(path.join(stage, 'media/2026/11'), { recursive: true })
      fs.writeFileSync(path.join(stage, 'media/2026/11/a photo (1).jpg'), 'jpg')
      fs.writeFileSync(path.join(stage, 'media/x.png'), 'png')
    })
    try {
      const result = await open(c)
      expect(result.code).toBe(0)
      expect(result.out).toContain('Checked: not changed since it was sealed')
      expect(result.out).toContain('Compare its SHA-256')
      expect(fs.readdirSync(c.out)).toEqual([`sprecher-east-${STAMP}.tar.gz`])
    } finally {
      fs.rmSync(c.work, { recursive: true, force: true })
    }
  })

  it.each([
    [
      'a symbolic link under media',
      (stage) => fs.symlinkSync('/etc', path.join(stage, 'media/evil')),
      undefined,
      [],
    ],
    [
      'a symbolic link in place of media',
      (stage) => {
        fs.rmSync(path.join(stage, 'media'), { recursive: true })
        fs.symlinkSync('/etc', path.join(stage, 'media'))
      },
      undefined,
      [],
    ],
    [
      'a hard link',
      (stage) => {
        fs.writeFileSync(path.join(stage, 'media/a'), 'a')
        fs.linkSync(path.join(stage, 'media/a'), path.join(stage, 'media/b'))
      },
      undefined,
      [],
    ],
    [
      'a setuid file',
      (stage) => {
        fs.writeFileSync(path.join(stage, 'media/run'), 'x')
        fs.chmodSync(path.join(stage, 'media/run'), 0o4755)
      },
      undefined,
      [],
    ],
    ['a named pipe', (stage) => sh(`mkfifo "${stage}/media/pipe"`), undefined, []],
    [
      'a file with another name at the top',
      (stage) => fs.writeFileSync(path.join(stage, 'extra.txt'), 'x'),
      ['payload.db', 'env.local', 'extra.txt', 'media'],
      [],
    ],
    [
      'a name with a line break in it',
      (stage) => fs.writeFileSync(path.join(stage, 'media/x\nrest'), 'x'),
      undefined,
      [],
    ],
    [
      'an absolute path',
      (stage) => fs.writeFileSync(path.join(stage, 'abs.txt'), 'x'),
      ['payload.db', 'env.local', 'media', 'abs.txt'],
      ['-P', '--transform', 's,^abs.txt$,/tmp/abs.txt,'],
    ],
    [
      'a parent path',
      (stage) => fs.writeFileSync(path.join(stage, 'up.txt'), 'x'),
      ['payload.db', 'env.local', 'media', 'up.txt'],
      ['-P', '--transform', 's,^up.txt$,media/../up.txt,'],
    ],
    ['no database file', () => {}, ['env.local', 'media'], []],
    [
      'a plain file named media',
      (stage) => {
        fs.rmSync(path.join(stage, 'media'), { recursive: true })
        fs.writeFileSync(path.join(stage, 'media'), 'not a folder')
      },
      undefined,
      [],
    ],
  ])('refuses %s, and writes nothing', async (_what, build, tarArgs, extra) => {
    const c = crafted(build, tarArgs, extra)
    try {
      const result = await open(c)
      expect(result.code).toBe(1)
      expect(result.out).toContain('nothing was written')
      expect(result.out).not.toContain('Checked')
      expect(fs.readdirSync(c.out)).toEqual([])
      expect(fs.readdirSync(c.work).filter((n) => n.endsWith('.partial'))).toEqual([])
    } finally {
      fs.rmSync(c.work, { recursive: true, force: true })
    }
  })

  it('refuses a copy whose SHA-256 is not the one the job recorded, before opening it', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-sha-'))
    try {
      fs.writeFileSync(path.join(work, NAME), h.remoteFile(NAME))
      const sha = crypto.createHash('sha256').update(h.remoteFile(NAME)).digest('hex')
      // an openssl that logs what it is asked to do: opening (`cms`) must not happen for a copy with the wrong hash
      h.stub('openssl-logged', 'echo "$1" >> "$STUB_LOG"\nexec /usr/bin/openssl "$@"')
      const logged = { OFFSITE_OPENSSL: h.p('bin/openssl-logged') }
      const wrong = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work], {
        ...logged,
        OFFSITE_EXPECTED_SHA256: '0'.repeat(64),
      })
      expect(wrong.code).toBe(1)
      expect(wrong.out).toContain('SHA-256 is not the one expected')
      expect(fs.readdirSync(work)).toEqual([NAME])
      expect(fs.readFileSync(h.p('log'), 'utf8')).not.toMatch(/^cms$/m)
      const right = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work], {
        ...logged,
        OFFSITE_EXPECTED_SHA256: sha,
      })
      expect(right.code).toBe(0)
      expect(right.out).toContain('Checked: its SHA-256 is the one you gave')
      expect(right.out).not.toContain('Compare its SHA-256')
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('takes the expected SHA-256 in capitals too', async () => {
    h.makeArchive()
    await h.run('offsite-backup.sh')
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-caps-'))
    try {
      fs.writeFileSync(path.join(work, NAME), h.remoteFile(NAME))
      const sha = crypto.createHash('sha256').update(h.remoteFile(NAME)).digest('hex')
      const result = await h.run('offsite-restore.sh', [path.join(work, NAME), h.keys.key, work], {
        OFFSITE_EXPECTED_SHA256: sha.toUpperCase(),
      })
      expect(result.code).toBe(0)
      expect(result.out).toContain('Checked: its SHA-256 is the one you gave')
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })

  it('refuses a copy that is not named like one the job made, even when it opens and holds a bad member', async () => {
    const c = crafted((stage) => {
      fs.rmSync(path.join(stage, 'media'), { recursive: true })
      fs.symlinkSync('/etc', path.join(stage, 'media'))
    })
    try {
      const odd = path.join(c.work, 'sprecher-east-2026-11-22T0815Z.tar.cms')
      fs.renameSync(path.join(c.work, NAME), odd)
      const result = await h.run('offsite-restore.sh', [odd, h.keys.key, c.out])
      expect(result.code).toBe(1)
      expect(result.out).toContain('is not a sealed copy the job made')
      expect(result.out).not.toContain('Checked')
      expect(fs.readdirSync(c.out)).toEqual([])
    } finally {
      fs.rmSync(c.work, { recursive: true, force: true })
    }
  })

  it('works on the bash macOS ships: no mapfile or readarray (bash 4), and the bash 3.2 compatibility mode', async () => {
    const c = crafted((stage) => {
      fs.mkdirSync(path.join(stage, 'media/2026'), { recursive: true })
      fs.writeFileSync(path.join(stage, 'media/2026/a photo.jpg'), 'jpg')
    })
    try {
      fs.writeFileSync(h.p('no-bash4.sh'), 'enable -n mapfile readarray\n')
      const result = await open(c, { BASH_ENV: h.p('no-bash4.sh'), BASH_COMPAT: '32' })
      expect(result.code).toBe(0)
      expect(result.out).toContain('Checked: not changed since it was sealed')
      expect(fs.readdirSync(c.out)).toEqual([`sprecher-east-${STAMP}.tar.gz`])
    } finally {
      fs.rmSync(c.work, { recursive: true, force: true })
    }
  })
})
