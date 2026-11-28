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
// the shape of the owner's browser sign-in: an expiry with milliseconds and a Z
const TOKEN_JSON = `{"access_token":"${TOKEN}","token_type":"Bearer","refresh_token":"fake-refresh","expiry":"2026-11-27T06:03:00.123Z"}`
const GOOD = `[offsite]
type = drive
client_id = fake-client.apps.example
client_secret = fake-client-secret-5b2e
scope = drive.file
token = ${TOKEN_JSON}
`
const PINNED = fs
  .readFileSync(path.join(OPS, 'offsite-lib.sh'), 'utf8')
  .match(/OFFSITE_RCLONE_SHA256_AMD64="([0-9a-f]{64})"/)[1]
const NAME = 'sprecher-east-2026-11-22T0815Z.tar.gz.cms'

/** Puts the stand-ins in place; `sha` is what `sha256sum` says about the downloaded package. */
function stubs({ sha = PINNED, arch = 'amd64' } = {}) {
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
/** How many test files the stand-in rclone was asked to upload so far. */
const copies = () =>
  h
    .rcloneLog()
    .split('\n')
    .filter((l) => l.includes('copyto')).length
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
    ['a token that is not JSON', GOOD.replace(TOKEN_JSON, '{not json}'), 'one line of JSON'],
    ['a token that is not an object', GOOD.replace(TOKEN_JSON, '[1]'), 'one line of JSON'],
    ['an empty token object', GOOD.replace(TOKEN_JSON, '{}'), 'no access_token'],
    [
      'an empty access token',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"","refresh_token":"r","expiry":"2026-11-27T06:03:00Z"}',
      ),
      'no access_token',
    ],
    [
      'a token without a refresh token',
      GOOD.replace(TOKEN_JSON, '{"access_token":"a","expiry":"2026-11-27T06:03:00Z"}'),
      'no refresh_token',
    ],
    [
      'a token without an expiry',
      GOOD.replace(TOKEN_JSON, '{"access_token":"a","refresh_token":"r"}'),
      'needs an expiry',
    ],
    [
      "Google's raw sign-in response",
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","expires_in":3599,"refresh_token":"r","scope":"https://www.googleapis.com/auth/drive.file","token_type":"Bearer"}',
      ),
      'raw sign-in response',
    ],
    [
      'an expiry that is not RFC 3339',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"2026-11-27 06:03:00"}',
      ),
      'RFC 3339',
    ],
    [
      'an expiry that is not a real date',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"2026-13-45T99:99:99Z"}',
      ),
      'RFC 3339',
    ],
    [
      'an access token of only spaces',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"   ","refresh_token":"r","expiry":"2026-11-27T06:03:00Z"}',
      ),
      'no access_token',
    ],
    [
      'a refresh token of only spaces',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"  ","expiry":"2026-11-27T06:03:00Z"}',
      ),
      'no refresh_token',
    ],
    [
      'a character before the expiry date',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"x2026-11-27T06:03:00Z"}',
      ),
      'RFC 3339',
    ],
    [
      'a character after the expiry date',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"2026-11-27T06:03:00Zx"}',
      ),
      'RFC 3339',
    ],
    [
      'an expiry on a day that does not exist',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"2026-02-31T06:03:00Z"}',
      ),
      'RFC 3339',
    ],
    [
      'an expiry at hour 24',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"2026-11-27T24:00:00Z"}',
      ),
      'RFC 3339',
    ],
    [
      "Go's zero time as the expiry (never refreshed)",
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"0001-01-01T00:00:00Z"}',
      ),
      'RFC 3339',
    ],
    [
      'an expiry in year 9999',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expiry":"9999-12-31T23:59:59Z"}',
      ),
      'RFC 3339',
    ],
    [
      'a refresh token blanked by a key spelled in another case',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","REFRESH_TOKEN":"","expiry":"2026-11-27T06:03:00Z"}',
      ),
      'same setting twice',
    ],
    [
      'a token type that is not text',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","token_type":5,"refresh_token":"r","expiry":"2026-11-27T06:03:00Z"}',
      ),
      'wrong type',
    ],
    [
      'an expires_in that is not a number',
      GOOD.replace(
        TOKEN_JSON,
        '{"access_token":"a","refresh_token":"r","expires_in":"x","expiry":"2026-11-27T06:03:00Z"}',
      ),
      'wrong type',
    ],
    [
      'a token spread over two lines',
      GOOD.replace(TOKEN_JSON, '{"access_token":"a",\n "refresh_token":"r"}'),
      'not a setting',
    ],
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

  it.each([
    ['milliseconds and a Z, as the owner browser sign-in writes it', TOKEN_JSON],
    [
      'no fractional seconds',
      '{"access_token":"a","refresh_token":"r","expiry":"2026-11-27T06:03:00Z"}',
    ],
    [
      'a numeric offset',
      '{"access_token":"a","refresh_token":"r","expiry":"2026-11-27T06:03:00.5+00:00"}',
    ],
    [
      'an old expiry (rclone refreshes it)',
      '{"access_token":"a","refresh_token":"r","expiry":"2001-01-01T00:00:00Z"}',
    ],
  ])('takes a token with %s', async (_label, token) => {
    seedDrive(1)
    const { code, out } = await install({}, GOOD.replace(TOKEN_JSON, token))
    expect(code).toBe(0)
    expect(out).not.toContain('::warning')
    expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(true)
  })

  it('is kept root-only, rewritten in one canonical form with only what was validated', async () => {
    seedDrive(1)
    const config = `# a comment\r\n[offsite]\r\ntype=drive\r\n  client_id =   fake-client.apps.example  \r\nclient_secret = fake-client-secret-5b2e\r\nscope = drive.file\r\ntoken = ${TOKEN_JSON}\r\nteam_drive =\r\n`
    expect((await install({}, config)).code).toBe(0)
    expect(mode('etc/offsite-rclone.conf')).toBe('600')
    expect(mode('etc')).toBe('700')
    expect(fs.readFileSync(h.p('etc/offsite-rclone.conf'), 'utf8')).toBe(
      `[offsite]\ntype = drive\nclient_id = fake-client.apps.example\nclient_secret = fake-client-secret-5b2e\nscope = drive.file\ntoken = ${TOKEN_JSON}\n`,
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

  it('leaves no copy of the credential behind when the run is killed while it is being put in place', async () => {
    seedDrive(1)
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
    expect(stubLog()).not.toContain('.deb')
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
      /^30 9 \* \* 0 root umask 077; bash .*\/current\/ops\/offsite-backup\.sh run >> .*offsite\.log 2>&1$/m,
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
    const uploads = copies()
    const curls = stubLog()
      .split('\n')
      .filter((l) => l.startsWith('curl')).length
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = await install()
    expect(second.code).toBe(0)
    expect(fs.statSync(cronFile()).mtimeMs).toBe(before)
    expect(copies()).toBe(uploads)
    expect(
      stubLog()
        .split('\n')
        .filter((l) => l.startsWith('curl')).length,
    ).toBe(curls)
  })

  it('tries again when the credential changes', async () => {
    seedDrive(1)
    await install()
    const before = copies()
    expect((await install({}, GOOD.replace('fake-refresh', 'another-refresh'))).code).toBe(0)
    expect(copies()).toBe(before + 1)
  })

  it('does not try again when only the access token in the secret changes, but does when the refresh token does', async () => {
    seedDrive(1)
    await install()
    const before = copies()
    // the deploy writes the file from the secret every time, so an owner who pastes a newer access token (the same sign-in)
    // must not start a second test upload
    const newer = GOOD.replace(TOKEN, 'a-newer-access-token').replace(
      '06:03:00.123Z',
      '07:03:00.123Z',
    )
    expect((await install({}, newer)).code).toBe(0)
    expect(copies()).toBe(before)
    expect((await install({}, GOOD.replace('fake-refresh', 'a-new-sign-in'))).code).toBe(0)
    expect(copies()).toBe(before + 1)
  })

  it('tries again when the public key changes, because copies are sealed to it', async () => {
    seedDrive(1)
    await install()
    const before = copies()
    fs.copyFileSync(h.otherKeys.cert, h.p('code/ops/offsite-backup-cert.pem'))
    expect((await install()).code).toBe(0)
    expect(copies()).toBe(before + 1)
  })

  it('warns with the reason, without failing the deploy, when the test upload fails, and tries again next time', async () => {
    seedDrive(1)
    const failed = await install({ MOCK_FAIL: 'copyto' })
    expect(failed.code).toBe(0)
    expect(failed.out).toContain('did not pass the first try')
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(false)
    expect(fs.existsSync(cronFile())).toBe(false) // a credential that fails is never scheduled
    const again = await install()
    expect(again.code).toBe(0)
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(true)
    expect(fs.existsSync(cronFile())).toBe(true)
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

describe('the weekly job file and its log', () => {
  it('is a plain file others can read but not write, and sets umask 077 itself', async () => {
    seedDrive(1)
    await install()
    expect(mode('cron/sprecher-east-offsite-backup')).toBe('644')
    expect(fs.readFileSync(cronFile(), 'utf8')).toMatch(/root umask 077; bash /)
  })

  it('has its log root-only before the job ever writes to it, and makes an old one root-only', async () => {
    seedDrive(1)
    await install()
    expect(mode('offsite.log')).toBe('600')
    fs.chmodSync(h.p('offsite.log'), 0o644)
    await install()
    expect(mode('offsite.log')).toBe('600')
  })

  it('takes the job away when the key turns out to be unusable later, not only when it is gone', async () => {
    seedDrive(1)
    await install()
    expect(fs.existsSync(cronFile())).toBe(true)
    fs.copyFileSync(h.keys.key, h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('the weekly job was taken away')
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('keeps a job that is already installed when a later first try fails (a Drive outage must not stop the backups)', async () => {
    seedDrive(1)
    await install()
    const { code } = await install(
      { MOCK_FAIL: 'copyto' },
      GOOD.replace('fake-refresh', 'a-new-sign-in'),
    )
    expect(code).toBe(0)
    expect(fs.existsSync(cronFile())).toBe(true)
  })

  it('ends with a warning, and exit 0, on an unexpected error (the deploy stays green)', async () => {
    h.stub('mkdir', 'exit 1')
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('stopped unexpectedly')
    expect(out).toContain('::warning')
  })
})

describe('the scope the sign-in was granted (asked of Google, never read from the file)', () => {
  const asked = () => fs.readFileSync(h.p('tokeninfo-body'), 'utf8')

  it('accepts exactly drive.file, and sends the access token in the request body, never in an argument', async () => {
    seedDrive(1)
    const { code, out } = await install({ STUB_TOKENINFO_BODY_FILE: h.p('tokeninfo-body') })
    expect(code).toBe(0)
    expect(out).toContain('off-site backup test ok')
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(true)
    expect(asked()).toBe(`access_token=${TOKEN}`)
    expect(stubLog()).toContain('https://oauth2.googleapis.com/tokeninfo')
    expect(stubLog()).not.toContain(TOKEN)
  })

  it.each([
    ['full Drive access', '{"scope":"https://www.googleapis.com/auth/drive"}'],
    [
      'drive.file with another scope beside it',
      '{"scope":"https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata"}',
    ],
    ['another narrow scope', '{"scope":"https://www.googleapis.com/auth/drive.readonly"}'],
    ['a bare drive.file with no URL', '{"scope":"drive.file"}'],
    ['no scope in the answer', '{"expires_in":"3000"}'],
    ['an error answer', '{"error":"invalid_token"}'],
    ['an answer that is not JSON', 'not json'],
  ])(
    'refuses %s even though the file says scope = drive.file: not tried, not scheduled, no value shown',
    async (_label, answer) => {
      seedDrive(1)
      const { code, out } = await install({ STUB_TOKENINFO_ANSWER: answer })
      expect(code).toBe(0)
      expect(out).toContain('::warning')
      expect(out).toMatch(/granted more than drive\.file|did not say what scope|could not be read/)
      expect(out).not.toContain(TOKEN)
      expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(false)
      expect(fs.existsSync(cronFile())).toBe(false)
    },
  )

  it('does not accept a credential when Google cannot be asked', async () => {
    seedDrive(1)
    const { code, out } = await install({ STUB_TOKENINFO_FAILS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('would not say what scope')
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(false)
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('is asked after the upload, so the access token rclone refreshed is the one asked about', async () => {
    seedDrive(1)
    // the stand-in rclone rewrites the access token in the file, as the real one does when it refreshes
    h.stub(
      'rclone',
      `case "$1" in version) echo "rclone v1.76.0" ;; *) sed -i 's/${TOKEN}/refreshed-by-rclone/' "$2" 2>/dev/null; exec ${process.execPath} "${h.p('mock-rclone.js')}" "$@" ;; esac`,
    )
    await install({ RCLONE: h.p('bin/rclone'), STUB_TOKENINFO_BODY_FILE: h.p('tokeninfo-body') })
    expect(asked()).toBe('access_token=refreshed-by-rclone')
  })
})

describe('time and environment', () => {
  it('cuts off a first try that hangs, with a warning, within its own limit', async () => {
    const started = Date.now()
    const { code, out } = await install({
      MOCK_HANG: 'copyto',
      OFFSITE_TEST_TOTAL_SECONDS: '2',
      OFFSITE_QUICK_SECONDS: '100',
    })
    expect(code).toBe(0)
    expect(Date.now() - started).toBeLessThan(20000)
    expect(out).toContain('did not pass the first try')
    expect(fs.existsSync(cronFile())).toBe(false)
  }, 30000)

  it('cuts off a check that hangs and still finishes the deploy step', async () => {
    seedDrive(1)
    const started = Date.now()
    const first = await install()
    expect(first.code).toBe(0)
    const { code, out } = await install({
      MOCK_HANG: 'lsf',
      OFFSITE_CHECK_TOTAL_SECONDS: '2',
      OFFSITE_QUICK_SECONDS: '100',
    })
    expect(code).toBe(0)
    expect(Date.now() - started).toBeLessThan(40000)
    expect(out).toContain('off-site backup job in place')
  }, 30000)

  it('clears RCLONE_* settings from the environment before rclone runs', async () => {
    seedDrive(1)
    await install({
      RCLONE_CONFIG_OFFSITE_TYPE: 'local',
      RCLONE_DRIVE_ROOT_FOLDER_ID: 'elsewhere',
    })
    expect(h.rcloneLog()).toContain('copyto')
    expect(h.rcloneLog()).not.toMatch(/^ENV RCLONE_/m)
  })

  it('reports a symbolic link in place of the certificate as a link, not as missing', async () => {
    fs.rmSync(h.p('code/ops/offsite-backup-cert.pem'))
    fs.symlinkSync(h.keys.cert, h.p('code/ops/offsite-backup-cert.pem'))
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('symbolic link')
    expect(out).not.toContain('is missing')
    expect(fs.existsSync(cronFile())).toBe(false)
  })
})

describe('a credential that is new is tried from a staging file and promoted only when it passes', () => {
  const stored = () => fs.readFileSync(h.p('etc/offsite-rclone.conf'), 'utf8')
  const staged = () => fs.readdirSync(h.p('etc')).filter((n) => n.startsWith('.offsite-rclone.'))
  const NEW = GOOD.replace('fake-refresh', 'a-new-sign-in')
  const WIDE = { STUB_TOKENINFO_ANSWER: '{"scope":"https://www.googleapis.com/auth/drive"}' }

  it('first install, scope refused: nothing is stored, no job, and the warning says so', async () => {
    seedDrive(1)
    const { code, out } = await install(WIDE)
    expect(code).toBe(0)
    expect(out).toContain('granted more than drive.file')
    expect(out).toContain('nothing was stored')
    expect(out).toContain('the new credential was refused')
    expect(out).not.toContain('did not pass the first try')
    expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(false)
    expect(staged()).toEqual([])
    expect(fs.existsSync(cronFile())).toBe(false)
    expect(fs.existsSync(h.p('etc/offsite-tried'))).toBe(false)
  })

  it('rotation, scope refused: the working credential and job stay, the refused one is gone', async () => {
    seedDrive(1)
    expect((await install()).code).toBe(0)
    const before = stored()
    const { code, out } = await install(WIDE, NEW)
    expect(code).toBe(0)
    expect(out).toContain('granted more than drive.file')
    expect(out).toContain('stay as they were')
    expect(out).toContain('the new credential was refused')
    expect(out).not.toContain('did not pass the first try')
    expect(stored()).toBe(before)
    expect(stored()).not.toContain('a-new-sign-in')
    expect(staged()).toEqual([])
    expect(fs.existsSync(cronFile())).toBe(true)
  })

  it('rotation, a Drive failure: the old credential and job stay, nothing of the new one is kept, and the next deploy tries again', async () => {
    seedDrive(1)
    expect((await install()).code).toBe(0)
    const before = stored()
    const failed = await install({ MOCK_FAIL: 'copyto' }, NEW)
    expect(failed.code).toBe(0)
    expect(failed.out).toContain('did not pass the first try')
    expect(failed.out).toContain('tried again on the next deploy')
    expect(stored()).toBe(before)
    expect(staged()).toEqual([])
    expect(fs.existsSync(cronFile())).toBe(true)
    const again = await install({}, NEW)
    expect(again.code).toBe(0)
    expect(stored()).toContain('a-new-sign-in')
  })

  it('first install, a Drive failure: nothing is stored and no job', async () => {
    seedDrive(1)
    const { code, out } = await install({ MOCK_FAIL: 'copyto' })
    expect(code).toBe(0)
    expect(out).toContain('did not pass the first try')
    expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(false)
    expect(staged()).toEqual([])
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('removes a staging file an earlier run left behind (a killed run cannot clean up after itself)', async () => {
    seedDrive(1)
    fs.mkdirSync(h.p('etc'), { mode: 0o700 })
    fs.writeFileSync(h.p('etc/.offsite-rclone.LEFTOV'), 'an old credential', { mode: 0o600 })
    expect((await install()).code).toBe(0)
    expect(staged()).toEqual([])
  })

  it('rotation that passes: the new credential replaces the old and is marked as tried', async () => {
    seedDrive(1)
    expect((await install()).code).toBe(0)
    const { code } = await install({}, NEW)
    expect(code).toBe(0)
    expect(stored()).toContain('a-new-sign-in')
    expect(staged()).toEqual([])
    expect(mode('etc/offsite-rclone.conf')).toBe('600')
  })
})

describe('what the installer needs of its own tools and folders', () => {
  it('refuses a credential, and stores nothing, when Node cannot check the token', async () => {
    h.stub('node', 'exit 127')
    const { code, out } = await install()
    expect(code).toBe(0)
    expect(out).toContain('Node is needed on the server')
    expect(fs.existsSync(h.p('etc/offsite-rclone.conf'))).toBe(false)
    expect(fs.existsSync(cronFile())).toBe(false)
  })

  it('stores the token as canonical JSON of the checked fields only', async () => {
    seedDrive(1)
    const token =
      '{"access_token":"a","token_type":"Bearer","refresh_token":"r","expires_in":3599,"expiry":"2026-11-27T06:03:00Z","extra":"x"}'
    expect((await install({}, GOOD.replace(TOKEN_JSON, token))).code).toBe(0)
    expect(fs.readFileSync(h.p('etc/offsite-rclone.conf'), 'utf8')).toContain(
      'token = {"access_token":"a","token_type":"Bearer","refresh_token":"r","expiry":"2026-11-27T06:03:00Z"}\n',
    )
  })

  it('makes the credential folder root-only even when it already exists with a wider mode', async () => {
    seedDrive(1)
    fs.mkdirSync(h.p('etc'), { mode: 0o755 })
    fs.chmodSync(h.p('etc'), 0o755)
    expect((await install()).code).toBe(0)
    expect(mode('etc')).toBe('700')
  })

  it('downloads the package with the time limit from the setting, and ignores a .curlrc', async () => {
    seedDrive(1)
    await install({ OFFSITE_DOWNLOAD_SECONDS: '77' })
    const line = stubLog()
      .split('\n')
      .find((l) => l.includes('.deb'))
    expect(line).toContain('--max-time 77')
    expect(line).toMatch(/^curl -q /)
  })

  it('asks Google over https only, at TLS 1.2 or later, with a time limit, ignoring a .curlrc', async () => {
    seedDrive(1)
    await install()
    const line = stubLog()
      .split('\n')
      .find((l) => l.includes('tokeninfo'))
    expect(line).toMatch(/^curl -q /)
    expect(line).toContain('--proto =https')
    expect(line).toContain('--tlsv1.2')
    expect(line).toContain('--max-time 20')
  })
})
