// ops/install-offsite-backup.sh (#1332): what the deploy does for the off-site backup. `curl`, `dpkg` and
// `sha256sum` are stand-ins (no network, no package is installed), `rclone` is the local stand-in from
// offsite-harness.mjs, and the credential below is made up. The real rclone and Drive are checked on the server.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { setUpOffsiteHarness } from './offsite-harness.mjs'
import { OPS } from './umami-harness.mjs'

const h = setUpOffsiteHarness({ install: true })
const TOKEN = 'FAKE-TOKEN-VALUE-do-not-print-7c1d'
const GOOD = `[offsite]
type = drive
client_id = fake-client.apps.example
client_secret = fake-client-secret-5b2e
scope = drive.file
token = {"access_token":"${TOKEN}","refresh_token":"fake-refresh"}
`
const PINNED = fs
  .readFileSync(path.join(OPS, 'offsite-lib.sh'), 'utf8')
  .match(/OFFSITE_RCLONE_SHA256_AMD64="([0-9a-f]{64})"/)[1]
const NAME = 'sprecher-east-2026-11-22T0815Z.tar.gz.cms'

/** Puts the stand-ins in place; `sha` is what `sha256sum` says about the downloaded package. */
function stubs({ sha = PINNED, arch = 'amd64' } = {}) {
  h.stub(
    'curl',
    'echo "curl $*" >> "$STUB_LOG"\nout=""\nwhile [ $# -gt 0 ]; do [ "$1" = -o ] && out="$2"; shift; done\n[ -z "$STUB_CURL_FAILS" ] || exit 22\necho package > "$out"',
  )
  h.stub(
    'dpkg',
    'echo "dpkg $*" >> "$STUB_LOG"\ncase "$1" in --print-architecture) echo "$STUB_ARCH" ;; -i) [ -z "$STUB_DPKG_FAILS" ] && cp "$STUB_RCLONE_SOURCE" "$STUB_RCLONE_TARGET" ;; esac',
  )
  h.stub(
    'sha256sum',
    'case "$1" in *.deb) echo "$STUB_SHA  $1" ;; *) exec /usr/bin/sha256sum "$@" ;; esac',
  )
  return {
    STUB_LOG: h.p('log'),
    STUB_SHA: sha,
    STUB_ARCH: arch,
    STUB_RCLONE_SOURCE: h.p('bin/rclone-mock'),
    STUB_RCLONE_TARGET: h.p('installed-rclone'),
    RCLONE: h.p('installed-rclone'),
  }
}
const cronFile = () => h.p('cron/sprecher-east-offsite-backup')
const stubLog = () => fs.readFileSync(h.p('log'), 'utf8')
const mode = (...parts) => (fs.statSync(h.p(...parts)).mode & 0o777).toString(8)
const install = (env = {}, config = GOOD) =>
  h.run('install-offsite-backup.sh', ['--config-stdin'], { ...stubs(), ...env }, config)
const seedDrive = (daysOld) => h.putRemote(NAME, 'x', daysOld)

describe('install-offsite-backup.sh while something is missing', () => {
  it('says the public key is missing, changes nothing and succeeds', async () => {
    fs.rmSync(h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('public key')
    expect(fs.existsSync(cronFile())).toBe(false)
    expect(fs.existsSync(h.p('etc'))).toBe(false) // nothing is made before the key and the credential both exist
    expect(stubLog()).not.toContain('curl')
  })

  it('says the credential is missing, installs nothing and succeeds', async () => {
    const { code, out } = await install({}, '')
    expect(code).toBe(0)
    expect(out).toContain('OFFSITE_BACKUP_RCLONE_CONF')
    expect(fs.existsSync(cronFile())).toBe(false)
    expect(fs.existsSync(h.p('etc'))).toBe(false)
    expect(stubLog()).not.toContain('curl')
  })

  it('takes the job away when the public key is removed later', async () => {
    seedDrive(1)
    expect((await install()).code).toBe(0)
    expect(fs.existsSync(cronFile())).toBe(true)
    fs.rmSync(h.p('code/ops/offsite-backup-cert.pem'))
    expect((await install({}, '')).code).toBe(0)
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('refuses a private key in place of the public one, with the reason', async () => {
    fs.copyFileSync(h.keys.key, h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('private key must never be here')
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('refuses to run as anyone but root', async () => {
    const { code, out } = await install({ OFFSITE_ROOT_UID: '99999' })
    expect(code).toBe(0)
    expect(out).toContain('must run as root')
  })
})

describe('the credential', () => {
  it.each([
    ['a wider scope', GOOD.replace('drive.file', 'drive'), 'scope must be drive.file'],
    ['a wider scope added after the good one', `${GOOD}scope = drive\n`, 'more than once'],
    ['a local type added after the good one', `${GOOD}type = local\n`, 'more than once'],
    ['a wider scope with no spaces around the =', `${GOOD}scope=drive\n`, 'more than once'],
    ['a setting spelled with capitals', `${GOOD}Scope = drive\n`, 'not allowed'],
    ['a setting with an indent', `${GOOD}  type = local\n`, 'more than once'],
    ['the client id twice', `${GOOD}client_id = another\n`, 'more than once'],
    ['the section twice', `${GOOD}[offsite]\ntype = local\n`, 'more than one'],
    ['a setting before the section', `type = local\n${GOOD}`, 'before the [offsite] section'],
    [
      'a local type with Windows line endings',
      `${GOOD.replaceAll('\n', '\r\n')}type = local\r\n`,
      'more than once',
    ],
    [
      'a section header with other spacing',
      GOOD.replace('[offsite]', '[ offsite ]'),
      'section other than',
    ],
    ['no scope line', GOOD.replace('scope = drive.file\n', ''), 'scope must be drive.file'],
    ['another type', GOOD.replace('type = drive', 'type = sftp'), 'type drive'],
    ['a second section', `${GOOD}[other]\ntype = local\n`, 'section other than'],
    [
      'a setting that points elsewhere',
      `${GOOD}service_account_file = /root/key.json\n`,
      'not allowed',
    ],
    ['a shared drive', `${GOOD}team_drive = 0ABC\n`, 'team_drive, which is not allowed'],
    ['a folder set', `${GOOD}root_folder_id = abc\n`, 'root_folder_id, which is not allowed'],
    ['a setting that runs a command', `${GOOD}drive_impersonate = x\n`, 'not allowed'],
    ['no token', GOOD.replace(/token = .*\n/, ''), 'no token'],
    ['no client secret', GOOD.replace(/client_secret = .*\n/, ''), 'no client_secret'],
    ['text that is not a config', 'hello world', 'not a setting'],
  ])(
    'is refused with %s, never stored, and no value is printed',
    async (_label, config, message) => {
      const { code, out } = await install({}, config)
      expect(code).toBe(0)
      expect(out).toContain(message)
      expect(out).not.toContain(TOKEN)
      expect(out).not.toContain('fake-client-secret')
      expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(false)
      expect(fs.existsSync(cronFile())).toBe(false)
    },
  )

  it('is kept root-only, rewritten in one canonical form with only what was validated', async () => {
    seedDrive(1)
    const config = `# a comment\r\n[offsite]\r\ntype=drive\r\n  client_id =   fake-client.apps.example  \r\nclient_secret = fake-client-secret-5b2e\r\nscope = drive.file\r\ntoken = {"access_token":"${TOKEN}","refresh_token":"fake-refresh"}\r\nteam_drive =\r\n`
    expect((await install({}, config)).code).toBe(0)
    expect(mode('etc/offsite-rclone.conf')).toBe('600')
    expect(mode('etc')).toBe('700')
    expect(fs.readFileSync(h.p('etc/offsite-rclone.conf'), 'utf8')).toBe(
      `[offsite]\ntype = drive\nclient_id = fake-client.apps.example\nclient_secret = fake-client-secret-5b2e\nscope = drive.file\ntoken = {"access_token":"${TOKEN}","refresh_token":"fake-refresh"}\n`,
    )
  })

  it('removes the credential, the job and the marker when the secret is empty (the way to undo it without a shell)', async () => {
    seedDrive(1)
    expect((await install()).code).toBe(0)
    expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(true)
    const again = await install({}, '')
    expect(again.code).toBe(0)
    expect(again.out).toContain('removed')
    expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(false)
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(false)
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('leaves no copy of the credential behind when the run is killed in the middle of writing it', async () => {
    h.stub('mv', 'kill -TERM "$PPID"; sleep 2')
    await install()
    expect(fs.readdirSync(h.p('etc')).filter((n) => n.startsWith('.offsite-rclone.'))).toEqual([])
  })

  it('takes the empty settings rclone writes for a personal Drive', async () => {
    seedDrive(1)
    const config = `${GOOD}team_drive = \nroot_folder_id =\nservice_account_file = \n`
    expect((await install({}, config)).code).toBe(0)
    expect(fs.readFileSync(h.p('etc/offsite-rclone.conf'), 'utf8')).not.toContain('team_drive') // only the checked values are written
  })

  it('never reaches an argument or a log line', async () => {
    seedDrive(1)
    const { out } = await install()
    expect(out).not.toContain(TOKEN)
    expect(stubLog()).not.toContain(TOKEN)
    expect(h.rcloneLog()).not.toContain(TOKEN)
    expect(fs.readdirSync(h.p('etc')).filter((n) => n.startsWith('.offsite-rclone.'))).toEqual([])
  })
})

describe('rclone', () => {
  it('is installed from the pinned package after its SHA-256 matches', async () => {
    seedDrive(1)
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('rclone 1.76.0 installed')
    const log = stubLog()
    expect(log).toContain('curl')
    expect(log).toContain('https://downloads.rclone.org/v1.76.0/rclone-v1.76.0-linux-amd64.deb')
    expect(log).toContain('--proto =https')
    expect(log).toContain('--tlsv1.2')
    expect(log).toMatch(/dpkg -i .*rclone-v1\.76\.0-linux-amd64\.deb/)
  })

  it('is not installed when the checksum differs', async () => {
    const { code, out } = await install(stubs({ sha: '0'.repeat(64) }))
    expect(code).toBe(0)
    expect(out).toContain('does not match its pinned SHA-256')
    expect(stubLog()).not.toContain('dpkg -i')
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('uses the arm64 package, with its own checksum, on an arm64 server', async () => {
    const arm = fs
      .readFileSync(path.join(OPS, 'offsite-lib.sh'), 'utf8')
      .match(/OFFSITE_RCLONE_SHA256_ARM64="([0-9a-f]{64})"/)[1]
    seedDrive(1)
    expect((await install(stubs({ sha: arm, arch: 'arm64' }))).code).toBe(0)
    expect(stubLog()).toContain('linux-arm64.deb')
    fs.rmSync(h.p('installed-rclone'))
    expect((await install(stubs({ sha: PINNED, arch: 'arm64' }))).code).toBe(0) // the amd64 hash is not arm64's
  })

  it('stops on an unknown architecture, a failed download and a failed install', async () => {
    let result = await install(stubs({ arch: 'riscv64' }))
    expect(result.code).toBe(0)
    expect(result.out).toContain('architecture')
    result = await install({ STUB_CURL_FAILS: '1' })
    expect(result.code).toBe(0)
    expect(result.out).toContain('downloading')
    result = await install({ STUB_DPKG_FAILS: '1' })
    expect(result.code).toBe(0)
    expect(result.out).toContain('installing')
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('is not accepted when what runs after the install is not the pinned version', async () => {
    fs.writeFileSync(h.p('wrong-rclone'), '#!/usr/bin/env bash\necho "rclone v1.75.0"\n', {
      mode: 0o755,
    })
    const { code, out } = await install({ STUB_RCLONE_SOURCE: h.p('wrong-rclone') })
    expect(code).toBe(0)
    expect(out).toContain('is not what runs after the install')
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('is left alone when the pinned version is already there', async () => {
    seedDrive(1)
    fs.copyFileSync(h.p('bin/rclone-mock'), h.p('installed-rclone'))
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).not.toContain('installed (SHA-256')
    expect(stubLog()).not.toContain('curl')
  })

  it('is replaced when another version is there', async () => {
    seedDrive(1)
    fs.writeFileSync(h.p('installed-rclone'), '#!/usr/bin/env bash\necho "rclone v1.60.1"\n', {
      mode: 0o755,
    })
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('rclone 1.76.0 installed')
    expect(stubLog()).toContain('dpkg -i')
  })
})

describe('the weekly job and the first try', () => {
  it('installs the weekly job, tries the credential once with a test file, and checks Drive', async () => {
    seedDrive(1)
    const { code, out } = await install()
    expect(code).toBe(0)
    const cron = fs.readFileSync(cronFile(), 'utf8')
    expect(cron).toMatch(
      /^30 9 \* \* 0 root bash .*\/current\/ops\/offsite-backup\.sh run >> .*offsite\.log 2>&1$/m,
    )
    expect(cron).toContain('Managed by ops/install-offsite-backup.sh')
    expect(out).toContain('off-site backup test ok')
    expect(h.remoteNames().some((n) => n.startsWith('sprecher-east-test-'))).toBe(true)
    expect(out).toContain('off-site backup job in place')
  })

  it('does nothing twice: same cron file, no second download, no second test upload', async () => {
    seedDrive(1)
    await install()
    const before = fs.statSync(cronFile()).mtimeMs
    const copies = h
      .rcloneLog()
      .split('\n')
      .filter((l) => l.includes('copyto')).length
    const curls = stubLog()
      .split('\n')
      .filter((l) => l.startsWith('curl')).length
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = await install()
    expect(second.code).toBe(0)
    expect(fs.statSync(cronFile()).mtimeMs).toBe(before)
    expect(
      h
        .rcloneLog()
        .split('\n')
        .filter((l) => l.includes('copyto')).length,
    ).toBe(copies)
    expect(
      stubLog()
        .split('\n')
        .filter((l) => l.startsWith('curl')).length,
    ).toBe(curls)
  })

  it('tries again when the credential changes', async () => {
    seedDrive(1)
    await install()
    const copies = () =>
      h
        .rcloneLog()
        .split('\n')
        .filter((l) => l.includes('copyto')).length
    const before = copies()
    expect((await install({}, GOOD.replace('fake-refresh', 'another-refresh'))).code).toBe(0)
    expect(copies()).toBe(before + 1)
  })

  it('does not try again just because rclone refreshed the access token in the file', async () => {
    seedDrive(1)
    await install()
    const copies = () =>
      h
        .rcloneLog()
        .split('\n')
        .filter((l) => l.includes('copyto')).length
    const before = copies()
    const file = h.p('etc/offsite-rclone.conf')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(TOKEN, 'a-newer-access-token'))
    expect((await install({}, '')).code).toBe(0)
    expect(copies()).toBe(before)
  })

  it('warns with the reason, without failing the deploy, when the test upload fails, and tries again next time', async () => {
    seedDrive(1)
    const failed = await install({ MOCK_FAIL: 'copyto' })
    expect(failed.code).toBe(0)
    expect(failed.out).toContain('did not pass the test upload')
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(false)
    const again = await install()
    expect(again.code).toBe(0)
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(true)
  })

  it('only warns, and the deploy stays green, when the newest copy in Drive is too old; no warning in the first week', async () => {
    seedDrive(15)
    const stale = await install()
    expect(stale.code).toBe(0)
    expect(stale.out).toContain('::warning')
    expect(stale.out).toContain('15 days old')
    fs.rmSync(h.p('store'), { recursive: true })
    fs.mkdirSync(h.p('store'))
    h.makeRemoteDir()
    fs.rmSync(cronFile())
    const first = await install()
    expect(first.code).toBe(0) // a new install waits for its first weekly run
    expect(first.out).toContain('first weekly copy is not there yet')
  })
})
