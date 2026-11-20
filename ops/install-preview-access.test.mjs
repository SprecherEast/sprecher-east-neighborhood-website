// ops/install-preview-access.sh (#1345): the production deploy's installer for the restricted
// preview account. It must make exactly the account, files, sudo rule and key line it describes,
// change nothing on any doubt, and put the sudo rule and key line back if a check after the first
// change fails. `useradd`, `sshd`, `runuser`, `sudo`, `visudo` and `chown` are stand-ins; the real
// ones are checked on the server (ops/README.md, "Pull request preview account").
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CADDY_FILES, SCRIPTS, runCommand } from './preview-access-harness.mjs'
import { OPS, write } from './umami-harness.mjs'

const UID = String(process.getuid())
const BLOB = Buffer.concat([
  Buffer.from([0, 0, 0, 11]),
  Buffer.from('ssh-ed25519'),
  Buffer.from([0, 0, 0, 32]),
  Buffer.alloc(32, 7),
]).toString('base64')
const KEY = `ssh-ed25519 ${BLOB} someone@laptop`
const GOOD_SSHD = [
  'pubkeyauthentication yes',
  'authorizedkeysfile .ssh/authorized_keys .ssh/authorized_keys2',
  'passwordauthentication no',
].join('\n')
const NODE_DIR = path.dirname(process.execPath)

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const stub = (name, body) => write(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
const log = () => fs.readFileSync(p('log'), 'utf8')
const read = (...parts) => fs.readFileSync(p(...parts), 'utf8')
const mode = (...parts) => (fs.statSync(p(...parts)).mode & 0o777).toString(8)
const HOME = () => p('home/sprecher-preview')
const WRAPPER = () => p('installed/ops/preview-wrapper.sh')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-access-'))
  fs.chmodSync(dir, 0o755)
  fs.writeFileSync(p('log'), '')
  fs.mkdirSync(p('state'))
  for (const f of [...SCRIPTS, 'install-preview-access.sh'])
    write(p('code/ops', f), fs.readFileSync(path.join(OPS, f)))
  for (const f of CADDY_FILES)
    write(p('code/ops/caddy', f), fs.readFileSync(path.join(OPS, 'caddy', f)))
  write(p('code/ops/preview-deploy-key.pub'), `${KEY}\n`)
  write(p('sudoers'), `@includedir ${p('sudoers.d')}\n`)
  fs.mkdirSync(p('sudoers.d'))
  // Tools the script checks for and runs. The account exists once `useradd` has run.
  stub('useradd', 'echo "useradd $*" >> "$STUB_LOG"; touch "$STUB_STATE/user"')
  stub(
    'getent',
    '[ -f "$STUB_STATE/user" ] || exit 2; echo "${STUB_PASSWD:-sprecher-preview:x:998:998::$PREVIEW_HOME:/bin/bash}"',
  )
  stub(
    'id',
    [
      'case "$*" in',
      '  "-u") echo "${STUB_UID:-0}" ;;',
      '  "-un") echo "${STUB_DEPLOY_USER:-root}" ;;',
      `  "-u sprecher-preview") echo ${UID} ;;`,
      '  "-Gn sprecher-preview") echo "${STUB_GROUPS:-sprecher-preview}" ;;',
      '  *) exec /usr/bin/id "$@" ;;',
      'esac',
    ].join('\n'),
  )
  stub('visudo', 'echo "visudo $*" >> "$STUB_LOG"; [ -z "$STUB_VISUDO_FAILS" ]')
  stub('sshd', 'echo "${STUB_SSHD}"; [ -z "$STUB_SSHD_FAILS" ]')
  stub(
    'ssh-keygen',
    '[ -z "$STUB_KEYGEN_FAILS" ] || exit 1; echo "256 SHA256:TestFingerprint1234 comment (ED25519)"',
  )
  stub('chown', 'echo "chown $*" >> "$STUB_LOG"')
  stub('pm2', 'exit 0')
  stub('node', `exec ${process.execPath} "$@"`)
  // runuser -u <user> -- <command…>: the command runs as this test; `test -w` answers as the account.
  stub(
    'runuser',
    [
      'shift 3',
      'echo "runuser $* | key-present:$([ -e "$PREVIEW_HOME/.ssh/authorized_keys" ] && echo yes || echo no)" >> "$STUB_LOG"',
      '[ -z "$STUB_RUNUSER_FAILS" ] || exit 1',
      'if [ "$1" = test ]; then [ -n "$STUB_CAN_WRITE" ]; exit; fi',
      'exec "$@"',
    ].join('\n'),
  )
  stub(
    'sudo',
    'echo "sudo $*" >> "$STUB_LOG"; [ -n "$STUB_SUDO_LISTS_NOTHING" ] || cat "$SUDOERS_FILE"',
  )
  fs.chmodSync(p('bin'), 0o755)
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const run = (env = {}, { removeTools = [] } = {}) => {
  for (const tool of removeTools) fs.rmSync(p('bin', tool))
  return runCommand('bash', [p('code/ops/install-preview-access.sh')], {
    env: {
      PATH: `${p('bin')}:${NODE_DIR}:/usr/bin:/bin`, // /usr/sbin left out: a tool is found only as a stand-in
      STUB_LOG: p('log'),
      STUB_STATE: p('state'),
      STUB_SSHD: GOOD_SSHD,
      CODE_DIR: p('code'),
      PREVIEW_HOME: HOME(),
      PREVIEW_ROOT: p('proot'),
      PREVIEW_ACCESS_DIR: p('installed'),
      SUDOERS_FILE: p('sudoers.d/sprecher-east-preview'),
      SUDOERS_MAIN: p('sudoers'),
      PREVIEW_ACCESS_ROOT_UID: UID,
      ...env,
    },
  })
}
/** Everything the run could have changed, as relative paths (backups and temp files included). */
const tree = (...roots) =>
  roots
    .flatMap((r) =>
      fs.existsSync(p(r))
        ? fs.readdirSync(p(r), { recursive: true }).map((f) => `${r}/${f}`)
        : [r + '?absent'],
    )
    .sort()
const untouched = async (env, removeTools, reason) => {
  const before = tree('home', 'installed', 'proot', 'sudoers.d')
  const { code, out } = await run(env, { removeTools })
  expect(code).toBe(0)
  expect(out).toContain('WARNING: preview access was not installed')
  expect(out).toContain('nothing was changed')
  if (reason) expect(out).toContain(reason)
  expect(tree('home', 'installed', 'proot', 'sudoers.d')).toEqual(before)
  expect(log()).not.toContain('useradd')
  expect(log()).not.toContain('chown')
  expect(log()).not.toContain('runuser')
}

describe('install-preview-access.sh: a first install', () => {
  it('makes the account, the root-owned scripts, the sudo rule and the restricted key line', async () => {
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(log()).toContain(
      `useradd --system --user-group --no-create-home --home-dir ${HOME()} --shell /bin/bash sprecher-preview`,
    )
    // the key line: restrict, the wrapper as forced command, the key and nothing else
    const keys = read('home/sprecher-preview/.ssh/authorized_keys').trim().split('\n')
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^# Managed by ops\/install-preview-access\.sh/)
    expect(keys[1]).toBe(
      `restrict,command="${WRAPPER()}" ssh-ed25519 ${BLOB} sprecher-east-preview-deploy`,
    )
    // the copies of main's scripts
    for (const f of SCRIPTS) {
      expect(read('installed/ops', f)).toBe(fs.readFileSync(path.join(OPS, f), 'utf8'))
      expect(mode('installed/ops', f)).toBe('755')
    }
    for (const f of CADDY_FILES)
      expect(read('installed/ops/caddy', f)).toBe(
        fs.readFileSync(path.join(OPS, 'caddy', f), 'utf8'),
      )
    expect(read('installed/tools-path').trim()).toBe(p('bin'))
    expect(mode('proot')).toBe('750')
    expect(out).toContain('Preview access installed')
    expect(out).toContain('SHA256:TestFingerprint1234')
    expect(out).not.toContain(BLOB)
  })

  it('writes the sudo rule: one script, a pull request number of 1 to 6 digits, nothing wider', async () => {
    await run()
    const rule = read('sudoers.d/sprecher-east-preview')
    const script = p('installed/ops/preview-caddy.sh')
    expect(mode('sudoers.d/sprecher-east-preview')).toBe('440')
    expect(rule).toContain(`Defaults!${script} env_reset, !setenv`)
    const line = rule.split('\n').find((l) => l.startsWith('sprecher-preview '))
    expect(line).toBe(
      `sprecher-preview ALL=(root) NOPASSWD: ${[1, 2, 3, 4, 5, 6]
        .map((n) => `${script} [1-9]${'[0-9]'.repeat(n - 1)}`)
        .join(', ')}`,
    )
    expect(line).not.toMatch(/\*|ALL$|NOPASSWD: ALL/)
    expect(rule.match(/NOPASSWD/g)).toHaveLength(1)
    expect(log()).toMatch(/visudo -cf .*sprecher-east-preview/)
  })

  it.skipIf(!fs.existsSync('/usr/sbin/visudo') || process.getuid() !== 0)(
    'the sudo rule passes the real visudo',
    async () => {
      await run()
      const { code, out } = await runCommand(
        '/usr/sbin/visudo',
        ['-cf', p('sudoers.d/sprecher-east-preview')],
        { env: {} },
      )
      expect(out).toContain('parsed OK')
      expect(code).toBe(0)
    },
  )

  it('keeps the account’s home, .ssh and key line root-owned and not writable by anyone else', async () => {
    await run()
    for (const [target, expected] of [
      ['home/sprecher-preview', '755'],
      ['home/sprecher-preview/.ssh', '755'],
      ['home/sprecher-preview/.ssh/authorized_keys', '644'],
    ]) {
      expect(mode(target), target).toBe(expected)
      expect(Number.parseInt(mode(target), 8) & 0o022, target).toBe(0) // not writable by group or others
    }
    const owners = log()
      .split('\n')
      .filter((l) => l.startsWith('chown'))
    const forAccount = owners.filter((l) => l.includes('sprecher-preview:sprecher-preview'))
    expect(forAccount).toEqual([`chown sprecher-preview:sprecher-preview ${p('proot')}`]) // only the previews root
    for (const target of [
      HOME(),
      `${HOME()}/.ssh`,
      p('installed'),
      p('installed/ops'),
      p('sudoers.d'),
    ]) {
      if (target === p('sudoers.d')) continue
      expect(
        owners.some((l) => l === `chown root:root ${target}`),
        target,
      ).toBe(true)
    }
    expect(owners.filter((l) => l.includes('authorized_keys') && !l.includes('root:root'))).toEqual(
      [],
    )
  })

  it('puts the key line in last, after the account has been checked and the sudo rule works', async () => {
    await run()
    const checks = log()
      .split('\n')
      .filter((l) => l.startsWith('runuser'))
    expect(checks.length).toBeGreaterThan(0)
    for (const line of checks) expect(line).toContain('key-present:no')
  })

  it('changes nothing else: the only files it makes are the account’s, the scripts, the rule and the key line', async () => {
    await run()
    expect(tree('sudoers.d')).toEqual(['sudoers.d/sprecher-east-preview'])
    expect(tree('home')).toEqual(
      [
        'home/sprecher-preview',
        'home/sprecher-preview/.ssh',
        'home/sprecher-preview/.ssh/authorized_keys',
      ].sort(),
    )
    expect(tree('installed').filter((f) => f.includes('.bak'))).toEqual([])
    expect(fs.readdirSync(p('proot'))).toEqual(['.home']) // the wrapper's check made its working folder
  })

  it('copies every script the installed ones source or run from their own folder', async () => {
    await run()
    const installed = new Set(fs.readdirSync(p('installed/ops')).filter((f) => f.endsWith('.sh')))
    const wanted = new Set()
    for (const f of installed) {
      const text = read('installed/ops', f)
      for (const m of text.matchAll(
        /(?:\$here|\$OPS_DIR|\$\(dirname "\$0"\)|\$\{BASH_SOURCE\[0\]\}\)")\/([a-z-]+\.sh)/g,
      ))
        wanted.add(m[1])
    }
    expect([...wanted].filter((f) => !installed.has(f))).toEqual([])
  })

  it('with no key file, allows no key', async () => {
    fs.rmSync(p('code/ops/preview-deploy-key.pub'))
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(read('home/sprecher-preview/.ssh/authorized_keys')).not.toMatch(/ssh-ed25519|restrict/)
    expect(out).toContain('no key allowed')
  })
})

describe('install-preview-access.sh: running it again', () => {
  it('changes nothing and says so', async () => {
    await run()
    const before = tree('home', 'installed', 'proot', 'sudoers.d')
    fs.writeFileSync(p('log'), '')
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('already in place')
    expect(tree('home', 'installed', 'proot', 'sudoers.d')).toEqual(before)
    expect(log()).not.toContain('useradd')
  })

  it('replaces a changed script and keeps a dated copy of the old one', async () => {
    await run()
    fs.appendFileSync(p('code/ops/preview-caddy.sh'), '# changed\n')
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(read('installed/ops/preview-caddy.sh')).toMatch(/# changed\n$/)
    const backups = fs
      .readdirSync(p('installed/ops'))
      .filter((f) => f.startsWith('preview-caddy.sh.bak-preview-access-'))
    expect(backups).toHaveLength(1)
    expect(read('installed/ops', backups[0])).not.toMatch(/# changed/)
    expect(out).toContain('bak-preview-access-')
  })

  it('replaces a changed key, keeping the old key line in a dated copy, and a removed key file revokes the key', async () => {
    await run()
    const other = Buffer.concat([
      Buffer.from([0, 0, 0, 11]),
      Buffer.from('ssh-ed25519'),
      Buffer.from([0, 0, 0, 32]),
      Buffer.alloc(32, 9),
    ]).toString('base64')
    fs.writeFileSync(p('code/ops/preview-deploy-key.pub'), `ssh-ed25519 ${other}\n`)
    await run()
    expect(read('home/sprecher-preview/.ssh/authorized_keys')).toContain(other)
    expect(read('home/sprecher-preview/.ssh/authorized_keys')).not.toContain(BLOB)
    const backups = fs
      .readdirSync(p('home/sprecher-preview/.ssh'))
      .filter((f) => f.includes('.bak-preview-access-'))
    expect(backups).toHaveLength(1)
    expect(read('home/sprecher-preview/.ssh', backups[0])).toContain(BLOB)
    fs.rmSync(p('code/ops/preview-deploy-key.pub'))
    await run()
    expect(read('home/sprecher-preview/.ssh/authorized_keys')).not.toContain('restrict')
  })
})

describe('install-preview-access.sh: it changes nothing on any doubt', () => {
  it('when it is not run as root', async () =>
    untouched({ STUB_UID: '1000' }, [], 'not run as root'))
  it('when it is a preview’s deploy', async () =>
    untouched({ PREVIEW_NUMBER: '7' }, [], 'only runs for production'))
  it.each(['visudo', 'sshd', 'runuser', 'useradd', 'pm2'])('when %s is missing', async (tool) =>
    untouched({}, [tool], `${tool} was not found`),
  )
  it.each([
    ['too short', 'ab'],
    ['not lowercase', 'Sprecher-Preview'],
    ['with a shell character', 'preview;id'],
    ['with a space', 'pre view'],
  ])('when the account name is %s', async (_, name) =>
    untouched({ PREVIEW_USER: name }, [], 'plain lowercase name'),
  )
  it('when the preview account would be the deploy account', async () =>
    untouched({ STUB_DEPLOY_USER: 'sprecher-preview' }, [], 'deploy account'))
  it.each([
    ['a folder with ..', { PREVIEW_ACCESS_DIR: '/usr/../etc/x' }],
    ['a folder with a space', { PREVIEW_ROOT: '/var/www/pr eviews' }],
    [
      'the previews root inside production’s folder',
      { PREVIEW_ROOT: '/var/www/sprecher-east/previews' },
    ],
    ['the previews root inside the account’s home', { PREVIEW_ROOT: `${HOME()}/previews` }],
  ])('with %s', async (_, env) => untouched(env, [], ''))

  describe('when the account exists but is not the one it would make', () => {
    beforeEach(() => fs.writeFileSync(p('state/user'), ''))
    it('has another home', async () =>
      untouched(
        { STUB_PASSWD: 'sprecher-preview:x:998:998::/home/other:/bin/bash' },
        [],
        'other settings',
      ))
    it('has another shell', async () =>
      untouched(
        { STUB_PASSWD: `sprecher-preview:x:998:998::${HOME()}:/bin/sh` },
        [],
        'other settings',
      ))
    it('is uid 0', async () =>
      untouched(
        { STUB_PASSWD: `sprecher-preview:x:0:0::${HOME()}:/bin/bash` },
        [],
        'other settings',
      ))
    it('belongs to other groups', async () =>
      untouched({ STUB_GROUPS: 'sprecher-preview sudo docker' }, [], 'groups'))
  })

  describe('when a path is not what it should be', () => {
    it('home is a link', async () => {
      fs.mkdirSync(p('elsewhere'))
      fs.mkdirSync(p('home'))
      fs.symlinkSync(p('elsewhere'), HOME())
      await untouched({}, [], 'is a link')
    })
    it('.ssh is a link', async () => {
      fs.mkdirSync(p('elsewhere'))
      fs.mkdirSync(`${HOME()}`, { recursive: true })
      fs.symlinkSync(p('elsewhere'), `${HOME()}/.ssh`)
      await untouched({}, [], 'is a link')
    })
    it('authorized_keys is a link', async () => {
      fs.mkdirSync(`${HOME()}/.ssh`, { recursive: true })
      fs.writeFileSync(p('victim'), 'x')
      fs.symlinkSync(p('victim'), `${HOME()}/.ssh/authorized_keys`)
      await untouched({}, [], 'is a link')
      expect(read('victim')).toBe('x')
    })
    it('authorized_keys holds a line this script did not write', async () => {
      fs.mkdirSync(`${HOME()}/.ssh`, { recursive: true })
      fs.writeFileSync(`${HOME()}/.ssh/authorized_keys`, `${KEY}\n`)
      await untouched({}, [], 'did not write')
    })
    it('the sudo rule file is someone else’s', async () => {
      fs.writeFileSync(p('sudoers.d/sprecher-east-preview'), 'someone ALL=(ALL) ALL\n')
      await untouched({}, [], 'did not write')
    })
    it('home is not owned by root', async () => {
      fs.mkdirSync(HOME(), { recursive: true })
      await untouched({ PREVIEW_ACCESS_ROOT_UID: String(Number(UID) + 1) }, [], 'not owned by root')
    })
    it.each([
      ['home', ''],
      ['home', '.ssh'],
      ['installed', ''],
    ])('%s/%s can be written by others', async (top, sub) => {
      const target = p(top, ...(top === 'home' ? ['sprecher-preview'] : []), sub)
      fs.mkdirSync(target, { recursive: true })
      fs.chmodSync(target, 0o775)
      await untouched({}, [], 'can be written by others')
    })
    it('the scripts folder is a link', async () => {
      fs.mkdirSync(p('elsewhere'))
      fs.symlinkSync(p('elsewhere'), p('installed'))
      await untouched({}, [], 'is a link')
    })
    it('ssh-keygen will not read the key', async () =>
      untouched({ STUB_KEYGEN_FAILS: '1' }, [], 'ssh-keygen would not read'))
    it('the previews root is a link', async () => {
      fs.writeFileSync(p('state/user'), '')
      fs.mkdirSync(p('elsewhere'))
      fs.symlinkSync(p('elsewhere'), p('proot'))
      await untouched({}, [], 'is a link or not a folder')
    })
    it('the previews root exists and is not the account’s', async () => {
      fs.mkdirSync(p('proot'))
      await untouched({}, [], 'not owned by sprecher-preview')
    })
    it('sudo does not read the sudoers folder', async () => {
      fs.writeFileSync(p('sudoers'), '# nothing included\n')
      await untouched({}, [], 'does not read')
    })
    it('a release file is missing', async () => {
      fs.rmSync(p('code/ops/preview-wrapper.sh'))
      await untouched({}, [], 'missing from this release')
    })
    it('node cannot be run by other accounts', async () => {
      fs.chmodSync(p('bin'), 0o700)
      await untouched({}, [], "can't be run by other accounts")
    })
  })

  describe('when sshd would not take the key line', () => {
    it.each([
      [
        'public keys are off',
        'pubkeyauthentication no\nauthorizedkeysfile .ssh/authorized_keys',
        'public key',
      ],
      [
        'it reads another key file',
        'pubkeyauthentication yes\nauthorizedkeysfile /etc/ssh/keys/%u',
        'other authorized_keys',
      ],
      ['AllowUsers leaves the account out', `${GOOD_SSHD}\nallowusers deploy`, 'AllowUsers'],
      ['AllowGroups is set', `${GOOD_SSHD}\nallowgroups ssh-users`, 'AllowGroups'],
      ['DenyUsers names the account', `${GOOD_SSHD}\ndenyusers sprecher-preview`, 'DenyUsers'],
    ])('%s', async (_, settings, reason) => untouched({ STUB_SSHD: settings }, [], reason))
    it('sshd will not print its settings', async () =>
      untouched({ STUB_SSHD_FAILS: '1' }, [], 'would not print'))
    it('AllowUsers that names the account is fine', async () => {
      const { out } = await run({ STUB_SSHD: `${GOOD_SSHD}\nallowusers deploy sprecher-preview` })
      expect(out).toContain('Preview access installed')
    })
  })

  describe('when the key file is not one plain ed25519 key', () => {
    it.each([
      ['carries options', `command="/bin/sh" ${KEY}`],
      ['carries restrictions off', `no-restrict ${KEY}`],
      ['is an RSA key', 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7 comment'],
      ['has trailing junk', `${KEY} ; rm -rf /`],
      ['has a comment with a quote', `ssh-ed25519 ${BLOB} a"b`],
      ['is two lines', `${KEY}\nssh-ed25519 ${BLOB}`],
      ['hides a second key after a carriage return', `ssh-ed25519 ${BLOB}\rssh-rsa AAAA`],
      ['is empty', ''],
    ])('%s', async (_, text) => {
      fs.writeFileSync(p('code/ops/preview-deploy-key.pub'), `${text}\n`)
      await untouched({}, [], 'preview key')
    })
  })
})

describe('install-preview-access.sh: a failed check after the first change puts the access back', () => {
  const rolledBack = async (env, reason) => {
    const { code, out } = await run(env)
    expect(code).toBe(1)
    expect(out).toContain('ERROR: preview access')
    expect(out).toContain(reason)
    expect(fs.existsSync(p('sudoers.d/sprecher-east-preview'))).toBe(false)
    expect(fs.existsSync(`${HOME()}/.ssh/authorized_keys`)).toBe(false) // never written: the key goes in last
  }
  it('when visudo rejects the rule', async () =>
    rolledBack({ STUB_VISUDO_FAILS: '1' }, 'visudo rejected'))
  it('when the account cannot run the wrapper', async () =>
    rolledBack({ STUB_RUNUSER_FAILS: '1' }, 'could not run the wrapper'))
  it('when the account can write to its home or key line', async () =>
    rolledBack({ STUB_CAN_WRITE: '1' }, 'can write to'))
  it('when sudo does not list the Caddy script for the account', async () =>
    rolledBack({ STUB_SUDO_LISTS_NOTHING: '1' }, 'does not list'))
  it('when the wrapper does not answer facts', async () => {
    fs.writeFileSync(
      p('code/ops/preview-wrapper.sh'),
      '#!/usr/bin/env bash\n[ "$SSH_ORIGINAL_COMMAND" = facts ] || exit 2\necho hello\n',
    )
    await rolledBack({}, 'did not report Node')
  })
  it('when the wrapper runs a command that is not one of its actions', async () => {
    fs.writeFileSync(p('code/ops/preview-wrapper.sh'), '#!/usr/bin/env bash\necho node=v1\n')
    await rolledBack({}, 'not one of its actions')
  })
  it('and restores the sudo rule that was there before', async () => {
    await run()
    const before = read('sudoers.d/sprecher-east-preview')
    fs.appendFileSync(p('code/ops/preview-caddy.sh'), '# next\n')
    const { code } = await run({ STUB_CAN_WRITE: '1' })
    expect(code).toBe(1)
    expect(read('sudoers.d/sprecher-east-preview')).toBe(before)
  })
})
