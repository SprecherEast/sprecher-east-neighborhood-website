// ops/offsite-backup.sh and ops/offsite-restore.sh (#1332): the weekly job that seals the newest daily archive to
// the owner's public key and sends it to Google Drive, and the script the owner opens a copy with on his own
// computer. `rclone` is a stand-in that keeps "Drive" in a local folder, and the key pair is made for the test
// with openssl: nothing here uses the network, and no real key or credential exists.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { MARKER, REMOTE_DIR, makeKeyPair, setUpOffsiteHarness } from './offsite-harness.mjs'

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
        execFileSync(
          'openssl',
          [
            'cms',
            '-decrypt',
            '-inform',
            'DER',
            '-in',
            path.join(tmp, 'c.cms'),
            '-inkey',
            h.keys.cert,
          ],
          {
            stdio: 'ignore',
          },
        ),
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
      const opened = await h.run('offsite-restore.sh', [
        path.join(work, tests[0]),
        h.keys.key,
        work,
      ])
      expect(opened.code).toBe(0)
      expect(fs.readFileSync(path.join(work, tests[0].replace(/\.cms$/, '')), 'utf8')).toContain(
        'holds no site data',
      )
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
    expect(out).toContain('::error')
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
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-other-'))
    try {
      const other = makeKeyPair(otherDir)
      const result = await h.run('offsite-restore.sh', [path.join(work, NAME), other.key, work])
      expect(result.code).toBe(1)
      expect(result.out).toContain('could not open the copy')
      expect(fs.readdirSync(work)).toEqual([NAME])
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
      fs.rmSync(otherDir, { recursive: true, force: true })
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
      fs.copyFileSync(path.join(work, NAME), path.join(work, 'plain.bin'))
      result = await h.run('offsite-restore.sh', [path.join(work, 'plain.bin'), h.keys.key, work])
      expect(result.code).toBe(1)
      expect((await h.run('offsite-restore.sh', [])).code).toBe(2)
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('the settings', () => {
  it('a usage error exits 2 and an unknown mode does nothing', async () => {
    expect((await h.run('offsite-backup.sh', ['nonsense'])).code).toBe(2)
    expect(h.rcloneLog()).toBe('')
    expect(REMOTE_DIR).toBe('sprecher-east-backups')
  })
})
