// ops/install-preview-access.sh (#1345): the production deploy's installer for the restricted
// preview account. It must make exactly the account, files, sudo rule and key line it describes,
// change nothing on any doubt, and put the sudo rule and key line back if a check after the first
// change fails. `useradd`, `sshd`, `runuser`, `sudo`, `visudo` and `chown` are stand-ins; the real
// ones are checked on the server (ops/README.md, "Pull request preview account").
import { execFileSync, spawn } from 'node:child_process'
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
  'usepam yes',
  'permituserenvironment no',
  'acceptenv LANG',
  'acceptenv LC_*',
  'authorizedkeyscommand none',
  'forcecommand none',
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
  // The host guards and the isolation check have their own test files; here they are stand-ins that
  // log how they were run and answer with the status the test sets (0 when it sets none).
  write(
    p('code/ops/preview-host-guards.sh'),
    'echo "guards $PREVIEW_ACCESS_DIR" >> "$STUB_LOG"\nexit "${STUB_GUARDS_STATUS:-0}"\n',
  )
  write(
    p('code/ops/preview-isolation-check.sh'),
    'echo "isolation-check $0 cwd:$(pwd) key-present:$([ -e "$PREVIEW_HOME/.ssh/authorized_keys" ] && echo yes || echo no)" >> "$STUB_LOG"\nexit "${STUB_ISOLATION_STATUS:-0}"\n',
  )
  write(p('sudoers'), `@includedir ${p('sudoers.d')}\n`)
  fs.mkdirSync(p('sudoers.d'))
  // Tools the script checks for and runs. The account exists once `useradd` has run.
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
      `  "-u sprecher-preview") echo "\${STUB_PREVIEW_UID:-${UID}}" ;;`,
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
  // a file being made (named <file>.new-…) cannot get its mode, or be moved into place, when asked
  stub(
    'chmod',
    'case "$*" in *.new-*) [ -z "$STUB_CHMOD_FAILS" ] || exit 1 ;; esac; exec /bin/chmod "$@"',
  )
  stub('mv', 'case "$*" in *.new-*) [ -z "$STUB_MV_FAILS" ] || exit 1 ;; esac; exec /bin/mv "$@"')
  // a file being made (named <file>.new-…) whose path holds STUB_MKTEMP_DIR is made as a folder, so a
  // write into it fails after the name was found
  stub(
    'mktemp',
    'case "$*" in *"${STUB_MKTEMP_DIR:-@@none@@}"*.new-*) d=$(/usr/bin/mktemp -u "$1"); mkdir "$d"; echo "$d"; exit 0 ;; esac; exec /usr/bin/mktemp "$@"',
  )
  stub('pm2', 'exit 0')
  stub('caddy', 'exit 0')
  stub('systemctl', 'exit 0')
  // the dated copy of a replaced file fails to be made when STUB_CP_FAILS is set
  stub(
    'cp',
    'case "$*" in *bak-preview-access*) [ -z "$STUB_CP_FAILS" ] || exit 1 ;; esac; exec /bin/cp "$@"',
  )
  stub(
    'useradd',
    'echo "useradd $*" >> "$STUB_LOG"; [ -z "$STUB_USERADD_FAILS" ] || exit 1; touch "$STUB_STATE/user"',
  )
  stub('node', `exec ${process.execPath} "$@"`)
  // runuser -u <user> -- <command…>: the command runs as this test; `test -w` answers as the account.
  stub(
    'runuser',
    [
      'shift 3',
      'echo "runuser $* | key-present:$([ -e "$PREVIEW_HOME/.ssh/authorized_keys" ] && echo yes || echo no)" >> "$STUB_LOG"',
      '[ -z "$STUB_RUNUSER_FAILS" ] || exit 1',
      // `test -w <path>` answers as the account: it can write the paths ending in STUB_CAN_WRITE ("all": every one)
      'if [ "$1" = test ]; then [ -n "$STUB_CAN_WRITE" ] && { [ "$STUB_CAN_WRITE" = all ] || [[ "$3" == *"$STUB_CAN_WRITE" ]]; }; exit; fi',
      'exec "$@"',
    ].join('\n'),
  )
  stub(
    'sudo',
    'echo "sudo $*" >> "$STUB_LOG"; [ -n "$STUB_SUDO_LISTS_NOTHING" ] || { [ -z "$STUB_SUDO_LISTS_ONLY_CADDY" ] && cat "$SUDOERS_FILE" || grep -v preview-copy "$SUDOERS_FILE"; }',
  )
  fs.chmodSync(p('bin'), 0o755)
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const run = (env = {}, { removeTools = [], cwd } = {}) => {
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
      PREVIEW_COPY_TMP: p('copytmp'),
      CADDY_LOCK_FILE: p('caddy.lock'),
      SUDOERS_FILE: p('sudoers.d/sprecher-east-preview'),
      SUDOERS_MAIN: p('sudoers'),
      PREVIEW_ACCESS_ROOT_UID: UID,
      ROOT_SECURE_PATH: `${p('bin')}:/usr/bin:/bin`,
      ...env,
    },
    cwd,
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
      expect(read('installed/ops', f)).toBe(read('code/ops', f))
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

  it('writes the sudo rule: two scripts, each with a pull request number of 1 to 6 digits, nothing wider', async () => {
    await run()
    const rule = read('sudoers.d/sprecher-east-preview')
    expect(mode('sudoers.d/sprecher-east-preview')).toBe('440')
    const lines = rule.split('\n').filter((l) => l.startsWith('sprecher-preview '))
    expect(lines).toHaveLength(2)
    for (const name of ['preview-caddy.sh', 'preview-copy.sh']) {
      const script = p('installed/ops', name)
      expect(rule).toContain(
        `Defaults!${script} env_reset, !setenv, secure_path="${p('bin')}:/usr/bin:/bin"`,
      )
      const line = lines.find((l) => l.includes(script))
      expect(line).toBe(
        `sprecher-preview ALL=(root) NOPASSWD: ${[1, 2, 3, 4, 5, 6]
          .map((n) => `${script} [1-9]${'[0-9]'.repeat(n - 1)}`)
          .join(', ')}`,
      )
      expect(line).not.toMatch(/\*|ALL$|NOPASSWD: ALL/)
    }
    expect(rule.match(/NOPASSWD/g)).toHaveLength(2)
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

describe('ops/preview-deploy-key.pub: the committed public key (#1385)', () => {
  const committed = () => fs.readFileSync(path.join(OPS, 'preview-deploy-key.pub'), 'utf8')

  it('is one ed25519 public key line with a trailing newline and nothing before the type', () => {
    expect(committed()).toMatch(/^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]{48} \S+\n$/)
    expect(committed().trim().split('\n')).toHaveLength(1)
  })

  it('passes the installer’s own validation: the real file becomes the restricted key line', async () => {
    write(p('code/ops/preview-deploy-key.pub'), committed())
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).not.toContain('not a plain ed25519 public key')
    const [, blob] = committed().trim().split(' ')
    const keys = read('home/sprecher-preview/.ssh/authorized_keys').trim().split('\n')
    expect(keys[1]).toBe(
      `restrict,command="${WRAPPER()}" ssh-ed25519 ${blob} sprecher-east-preview-deploy`,
    )
  })
})

describe('install-preview-access.sh: what it always says about the key and the checks (#1075)', () => {
  it('says the key state and both checks on a first run, with and without a key file', async () => {
    const first = await run()
    expect(first.out).toMatch(
      /Preview access: key SHA256:\S+ allowed; host guards passed; isolation check passed/,
    )
    fs.rmSync(p('code/ops/preview-deploy-key.pub'))
    const second = await run()
    expect(second.out).toContain(
      'Preview access: no preview key file: no key allowed; host guards passed; isolation check passed',
    )
  })

  it('says it again when nothing changed, so a quiet run still shows the state', async () => {
    await run()
    const again = await run()
    expect(again.out).toContain('already in place')
    expect(again.out).toMatch(/Preview access: key SHA256:\S+ allowed; host guards passed/)
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
    it('the previews root exists, the account exists, and another account owns the folder', async () => {
      fs.writeFileSync(p('state/user'), '')
      fs.mkdirSync(p('proot'))
      await untouched(
        { STUB_PREVIEW_UID: String(Number(UID) + 1) },
        [],
        'not owned by sprecher-preview',
      )
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
    rolledBack({ STUB_CAN_WRITE: 'all' }, 'can write to'))
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
})

describe('install-preview-access.sh: the snapshot folder and the content copy script (#1397)', () => {
  it('makes the snapshot folder, root-only (mode 700), and installs the copy script root-owned beside the others', async () => {
    const { code } = await run()
    expect(code).toBe(0)
    expect(mode('copytmp')).toBe('700')
    expect(log()).toContain(`chown root:root ${p('copytmp')}`)
    expect(mode('installed/ops/preview-copy.sh')).toBe('755')
    expect(read('installed/ops/preview-copy.sh')).toBe(
      fs.readFileSync(path.join(OPS, 'preview-copy.sh'), 'utf8'),
    )
  })

  it('leaves a snapshot folder that is already right as it is, and says nothing changed', async () => {
    await run()
    const { out } = await run()
    expect(out).toContain('Preview access already in place')
    expect(mode('copytmp')).toBe('700')
  })

  it.each([
    [
      'open to others',
      () => fs.mkdirSync(p('copytmp'), { mode: 0o755 }),
      'is not closed to everyone but root',
    ],
    [
      'a link',
      () => {
        fs.mkdirSync(p('elsewhere'))
        fs.symlinkSync(p('elsewhere'), p('copytmp'))
      },
      'is a link',
    ],
    ['a file', () => fs.writeFileSync(p('copytmp'), 'x'), 'is not what it should be'],
  ])('changes nothing when the snapshot folder is %s', async (_, make, reason) => {
    make()
    if (_ === 'open to others') fs.chmodSync(p('copytmp'), 0o755)
    await untouched({}, [], reason)
  })

  it.each(['proot/inside', 'installed/inside', 'home/inside'])(
    'changes nothing when the snapshot folder is inside %s’s folder',
    async (where) => {
      const folder = where.split('/')[0]
      const inner = folder === 'home' ? p('home/sprecher-preview/inside') : p(where)
      await untouched({ PREVIEW_COPY_TMP: inner }, [], 'snapshot folder is inside')
    },
  )

  it('sets its mode whatever the caller’s umask is', async () => {
    const { code } = await runCommand(
      'bash',
      ['-c', 'umask 000; exec bash "$0"', p('code/ops/install-preview-access.sh')],
      {
        env: {
          PATH: `${p('bin')}:${NODE_DIR}:/usr/bin:/bin`,
          STUB_LOG: p('log'),
          STUB_STATE: p('state'),
          STUB_SSHD: GOOD_SSHD,
          CODE_DIR: p('code'),
          PREVIEW_HOME: HOME(),
          PREVIEW_ROOT: p('proot'),
          PREVIEW_ACCESS_DIR: p('installed'),
          PREVIEW_COPY_TMP: p('copytmp'),
          SUDOERS_FILE: p('sudoers.d/sprecher-east-preview'),
          SUDOERS_MAIN: p('sudoers'),
          PREVIEW_ACCESS_ROOT_UID: UID,
          ROOT_SECURE_PATH: `${p('bin')}:/usr/bin:/bin`,
        },
      },
    )
    expect(code).toBe(0)
    expect(mode('copytmp')).toBe('700')
  })

  it('puts the sudo rule back when sudo does not list the copy script for the account', async () => {
    const before = tree('sudoers.d')
    const { code, out } = await run({ STUB_SUDO_LISTS_ONLY_CADDY: '1' })
    expect(code).toBe(1)
    expect(out).toContain('does not list the content copy script')
    expect(tree('sudoers.d')).toEqual(before)
  })
})

describe('install-preview-access.sh: what the content copy script needs from the host (#1397)', () => {
  it('changes nothing when node can be written by others, since the copy script runs it as root', async () => {
    const before = tree('home', 'installed', 'proot', 'sudoers.d')
    fs.chmodSync(p('bin/node'), 0o775)
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('node is not owned by root and writable only by root')
    expect(tree('home', 'installed', 'proot', 'sudoers.d')).toEqual(before)
  })

  it('changes nothing when node is not root’s', async () => {
    await untouched(
      { PREVIEW_ACCESS_ROOT_UID: String(Number(UID) + 1) },
      [],
      'node is not owned by root',
    )
  })

  it.each(['timeout', 'awk', 'grep', 'env', 'mkdir', 'rm', 'cat', 'dirname', 'id', 'wc', 'mv'])(
    'changes nothing when %s is not in the PATH the root scripts run with',
    async (tool) => {
      // a PATH folder with every tool the root scripts use except this one
      fs.mkdirSync(p('rootbin'))
      for (const name of ['caddy', 'systemctl', 'chown'])
        fs.symlinkSync(p('bin', name), p('rootbin', name))
      for (const name of [
        'flock',
        'stat',
        'find',
        'df',
        'cp',
        'ln',
        'mktemp',
        'chmod',
        'readlink',
        'openssl',
        'getent',
        'realpath',
        'awk',
        'grep',
        'env',
        'id',
        'mkdir',
        'rm',
        'cat',
        'dirname',
        'timeout',
        'wc',
        'mv',
      ].filter((name) => name !== tool))
        fs.symlinkSync(execFileSync('which', [name]).toString().trim(), p('rootbin', name))
      await untouched({ ROOT_SECURE_PATH: p('rootbin') }, [], `${tool} is not in`)
    },
  )

  describe('leftovers of a content copy that was killed', () => {
    const leftovers = () => {
      write(`${p('copytmp')}/run.OLD/snapshot.db`, 'SECRET')
      fs.chmodSync(p('copytmp/run.OLD'), 0o700)
      write(`${p('proot')}/pr-3/.copy-media/a.jpg`, 'x')
    }

    it('sweeps an old snapshot folder and a staging folder that is still root’s, and says how many', async () => {
      await run()
      leftovers()
      const { code, out } = await run()
      expect(code).toBe(0)
      expect(out).toContain('2 leftovers of a content copy removed')
      expect(fs.existsSync(p('copytmp/run.OLD'))).toBe(false)
      expect(fs.existsSync(p('proot/pr-3/.copy-media'))).toBe(false)
      expect(fs.existsSync(p('proot/pr-3'))).toBe(true)
    })

    it('never follows a preview folder that is a link, so it removes nothing outside the previews', async () => {
      await run()
      write(`${p('elsewhere')}/.copy-media/keep.txt`, 'x')
      fs.symlinkSync(p('elsewhere'), p('proot/pr-4'))
      write(`${p('proot')}/pr-3/.copy-media/a.jpg`, 'x')
      const { code, out } = await run()
      expect(code).toBe(0)
      expect(out).toContain('1 leftovers of a content copy removed')
      expect(fs.existsSync(p('elsewhere/.copy-media/keep.txt'))).toBe(true)
      expect(fs.existsSync(p('proot/pr-3/.copy-media'))).toBe(false)
    })

    it('says nothing, and removes nothing else, when there are none', async () => {
      await run()
      write(`${p('proot')}/pr-3/public/media/a.jpg`, 'x')
      const { out } = await run()
      expect(out).not.toContain('leftovers')
      expect(fs.existsSync(p('proot/pr-3/public/media/a.jpg'))).toBe(true)
    })

    it('leaves them and warns when the Caddy lock is held, since a copy may be running', async () => {
      await run()
      leftovers()
      const holder = spawn('bash', ['-c', `exec 9>>${p('caddy.lock')}; flock 9; sleep 8`])
      await new Promise((r) => setTimeout(r, 300))
      const { code, out } = await run({ CADDY_LOCK_WAIT: '1' })
      holder.kill()
      expect(code).toBe(0)
      expect(out).toContain('leftovers could not be swept')
      expect(fs.existsSync(p('copytmp/run.OLD'))).toBe(true)
    })
  })
})

describe('install-preview-access.sh: the key line waits for the host guards and the isolation check', () => {
  const keysFile = () => read('home/sprecher-preview/.ssh/authorized_keys')
  const hasKey = () => /ssh-ed25519|restrict/.test(keysFile())

  it('runs the guards, then the isolation check as the account from the root-owned copy, before a key line exists', async () => {
    const { code } = await run()
    expect(code).toBe(0)
    const lines = log().split('\n')
    const guards = lines.findIndex((l) => l.startsWith('guards '))
    const check = lines.findIndex((l) => l.startsWith('runuser bash '))
    expect(guards).toBeGreaterThanOrEqual(0)
    expect(check).toBeGreaterThan(guards)
    // the installed copy ran, as the account, from /, and no key line was there yet
    expect(lines[check]).toContain(p('installed/ops/preview-isolation-check.sh'))
    expect(log()).toContain(
      `isolation-check ${p('installed/ops/preview-isolation-check.sh')} cwd:/ key-present:no`,
    )
    expect(hasKey()).toBe(true)
  })

  it('writes no key line when the isolation check fails, and says so, but still installs the rest', async () => {
    const { code, out } = await run({ STUB_ISOLATION_STATUS: '1' })
    expect(code).toBe(0)
    expect(hasKey()).toBe(false)
    expect(out).toContain('no key allowed: the host guards or the isolation check did not pass')
    expect(out).not.toContain('SHA256:')
    expect(fs.existsSync(p('sudoers.d/sprecher-east-preview'))).toBe(true)
  })

  it('writes no key line when a host guard did not apply, even though the isolation check passes', async () => {
    const { code, out } = await run({ STUB_GUARDS_STATUS: '3' })
    expect(code).toBe(0)
    expect(hasKey()).toBe(false)
    expect(out).toContain('no key allowed')
  })

  it('takes a key line from an earlier run out again when the check stops passing, keeping a dated copy', async () => {
    await run()
    expect(hasKey()).toBe(true)
    const { code } = await run({ STUB_ISOLATION_STATUS: '1' })
    expect(code).toBe(0)
    expect(hasKey()).toBe(false)
    const copies = fs.readdirSync(`${HOME()}/.ssh`).filter((f) => f.includes('bak-preview-access'))
    expect(copies).toHaveLength(1)
  })

  it('still runs both when there is no key file, so the deploy annotations show the result', async () => {
    fs.rmSync(p('code/ops/preview-deploy-key.pub'))
    await run()
    expect(log()).toContain('guards ')
    expect(log()).toContain('isolation-check ')
    expect(hasKey()).toBe(false)
  })

  it('changes nothing when the release has no isolation check to install', async () => {
    fs.rmSync(p('code/ops/preview-isolation-check.sh'))
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('ops/preview-isolation-check.sh is missing from this release')
    expect(fs.existsSync(HOME())).toBe(false)
  })
})

describe('install-preview-access.sh: what it checks about sudo and sshd as well', () => {
  const only = (dirName, tools) => {
    fs.mkdirSync(p(dirName), { recursive: true })
    for (const t of tools)
      fs.symlinkSync(`/usr/bin/${t === 'caddy' || t === 'systemctl' ? 'true' : t}`, p(dirName, t))
    return p(dirName)
  }
  const ROOT_TOOLS =
    'caddy systemctl flock stat find df cp ln mktemp chown chmod readlink openssl getent realpath'.split(
      ' ',
    )
  it.each(ROOT_TOOLS)('doubts when %s is not in the root script’s PATH', async (missing) => {
    const dirPath = only(
      'rootpath',
      ROOT_TOOLS.filter((t) => t !== missing),
    )
    await untouched({ ROOT_SECURE_PATH: dirPath }, [], `${missing} is not in`)
  })
  it('doubts when the root script’s PATH has odd characters', async () =>
    untouched({ ROOT_SECURE_PATH: '/usr/bin:/bin /tmp' }, [], 'PATH has characters'))

  // [what is wrong, the setting to take out of the good ones, the line to put in its place, the reason]
  it.each([
    ['UsePAM is off', 'usepam', 'usepam no', 'UsePAM'],
    ['UsePAM is missing', 'usepam', '', 'UsePAM'],
    [
      'user environment files are allowed',
      'permituserenvironment',
      'permituserenvironment yes',
      'PermitUserEnvironment',
    ],
    ['PermitUserEnvironment is missing', 'permituserenvironment', '', 'PermitUserEnvironment'],
    ['the client may set other variables', '', 'acceptenv BASH_ENV', 'AcceptEnv takes BASH_ENV'],
    [
      'an authorized keys command is set',
      'authorizedkeyscommand',
      'authorizedkeyscommand /usr/bin/lookup',
      'AuthorizedKeysCommand',
    ],
    ['a forced command is set', 'forcecommand', 'forcecommand /bin/false', 'ForceCommand'],
  ])('doubts when %s', async (_, remove, line, reason) => {
    const settings = GOOD_SSHD.split('\n')
      .filter((l) => !remove || !l.startsWith(`${remove} `))
      .concat(line ? [line] : [])
      .join('\n')
    await untouched({ STUB_SSHD: settings }, [], reason)
  })
  it('judges AcceptEnv * as the name it is, not as the files in the current folder', async () => {
    fs.mkdirSync(p('cwd'))
    fs.writeFileSync(p('cwd/LANG'), '')
    const settings = GOOD_SSHD.split('\n')
      .filter((l) => !l.startsWith('acceptenv '))
      .concat('acceptenv *')
      .join('\n')
    const { out } = await run({ STUB_SSHD: settings }, { cwd: p('cwd') })
    expect(out).toContain('AcceptEnv takes *')
    expect(out).not.toContain('Preview access installed')
  })
  it('accepts AcceptEnv of LANG and LC_ variables only', async () => {
    const { out } = await run({ STUB_SSHD: `${GOOD_SSHD}\nacceptenv LC_ALL` })
    expect(out).toContain('Preview access installed')
  })
})

describe('install-preview-access.sh: more doubts', () => {
  it.each([
    ['equal to production’s folder', { PREVIEW_ROOT: '/var/www/sprecher-east' }],
    ['equal to the account’s home', () => ({ PREVIEW_ROOT: HOME() })],
  ])('when the previews root is %s', async (_, env) =>
    untouched(typeof env === 'function' ? env() : env, [], "production's or the account's home"),
  )
  it('when home is a file, not a folder', async () => {
    fs.mkdirSync(p('home'))
    fs.writeFileSync(HOME(), 'x')
    await untouched({}, [], 'is not what it should be')
  })
  it('when authorized_keys is a folder', async () => {
    fs.mkdirSync(`${HOME()}/.ssh/authorized_keys`, { recursive: true })
    await untouched({}, [], 'is not what it should be')
  })
  it('when authorized_keys is a link to nowhere', async () => {
    fs.mkdirSync(`${HOME()}/.ssh`, { recursive: true })
    fs.symlinkSync(p('nowhere'), `${HOME()}/.ssh/authorized_keys`)
    await untouched({}, [], 'is a link')
  })
  it.each(['ops', 'ops/caddy'])('when installed/%s can be written by others', async (sub) => {
    fs.mkdirSync(p('installed', sub), { recursive: true })
    fs.chmodSync(p('installed'), 0o755)
    fs.chmodSync(p('installed', sub), 0o775)
    await untouched({}, [], 'can be written by others')
  })
  it('when the sudo rule file is not root’s', async () => {
    fs.writeFileSync(
      p('sudoers.d/sprecher-east-preview'),
      '# Managed by ops/install-preview-access.sh (#1345)\n',
    )
    await untouched({ PREVIEW_ACCESS_ROOT_UID: String(Number(UID) + 1) }, [], 'not owned by root')
  })
  it('when the sudoers folder does not exist', async () => {
    await untouched(
      { SUDOERS_FILE: p('no-such-folder/sprecher-east-preview') },
      [],
      'does not exist',
    )
  })
  it('when a Caddy template is missing from the release', async () => {
    fs.rmSync(p('code/ops/caddy/preview-site.caddy'))
    await untouched({}, [], 'ops/caddy/preview-site.caddy is missing')
  })
  it('when the folder of node has characters it should not', async () => {
    const odd = p('odd dir')
    for (const t of ['node', 'pm2']) write(`${odd}/${t}`, '#!/bin/sh\nexit 0\n', 0o755)
    fs.chmodSync(odd, 0o755)
    await untouched(
      { PATH: `${odd}:${p('bin')}:${NODE_DIR}:/usr/bin:/bin` },
      [],
      'characters it should not',
    )
  })
})

describe('install-preview-access.sh: files and modes', () => {
  it('sets every mode itself, whatever the caller’s umask', async () => {
    const { code } = await runCommand(
      'bash',
      ['-c', 'umask 077; exec bash "$0"', p('code/ops/install-preview-access.sh')],
      {
        env: {
          PATH: `${p('bin')}:${NODE_DIR}:/usr/bin:/bin`,
          STUB_LOG: p('log'),
          STUB_STATE: p('state'),
          STUB_SSHD: GOOD_SSHD,
          CODE_DIR: p('code'),
          PREVIEW_HOME: HOME(),
          PREVIEW_ROOT: p('proot'),
          PREVIEW_ACCESS_DIR: p('installed'),
          PREVIEW_COPY_TMP: p('copytmp'),
          PREVIEW_COPY_TMP: p('copytmp'),
          SUDOERS_FILE: p('sudoers.d/sprecher-east-preview'),
          SUDOERS_MAIN: p('sudoers'),
          PREVIEW_ACCESS_ROOT_UID: UID,
          ROOT_SECURE_PATH: `${p('bin')}:/usr/bin:/bin`,
        },
      },
    )
    expect(code).toBe(0)
    expect(mode('home/sprecher-preview')).toBe('755')
    expect(mode('home/sprecher-preview/.ssh')).toBe('755')
    expect(mode('home/sprecher-preview/.ssh/authorized_keys')).toBe('644')
    expect(mode('installed/ops/preview-caddy.sh')).toBe('755')
    expect(mode('installed/ops/caddy/preview-site.caddy')).toBe('644')
    expect(mode('installed/tools-path')).toBe('644')
    expect(mode('sudoers.d/sprecher-east-preview')).toBe('440')
    expect(mode('proot')).toBe('750')
  })
})

describe('install-preview-access.sh: a step that fails is a failure, not a silent skip', () => {
  it('a dated copy that cannot be made stops the run and leaves the file as it was', async () => {
    await run()
    fs.appendFileSync(p('code/ops/preview-caddy.sh'), '# next\n')
    const before = read('installed/ops/preview-caddy.sh')
    const { code, out } = await run({ STUB_CP_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('could not write')
    expect(read('installed/ops/preview-caddy.sh')).toBe(before)
  })

  it.each([
    ['a script', 'preview-wrapper.sh', 'installed/ops/preview-wrapper.sh'],
    ['the sudo rule', 'sudoers.d', 'sudoers.d/sprecher-east-preview'],
    ['the key line', '.ssh/authorized_keys', 'home/sprecher-preview/.ssh/authorized_keys'],
  ])(
    '%s that cannot be written stops the run and puts nothing in its place',
    async (_, hit, file) => {
      const { code, out } = await run({ STUB_MKTEMP_DIR: hit })
      expect(code).toBe(1)
      expect(out).toContain('could not write')
      expect(fs.existsSync(p(file))).toBe(false)
    },
  )

  it('a rule that cannot be written leaves the one in place', async () => {
    await run()
    const rule = read('sudoers.d/sprecher-east-preview')
    const { code, out } = await run({
      PREVIEW_ACCESS_DIR: p('installed2'),
      STUB_MKTEMP_DIR: 'sudoers.d',
    })
    expect(code).toBe(1)
    expect(out).toContain('could not write')
    expect(read('sudoers.d/sprecher-east-preview')).toBe(rule)
  })

  it('a failing account creation says so, and writes nothing', async () => {
    const { code, out } = await run({ STUB_USERADD_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('ERROR: preview access')
    expect(out).toContain('unexpectedly')
    expect(fs.existsSync(p('sudoers.d/sprecher-east-preview'))).toBe(false)
  })

  it.each([['STUB_CHMOD_FAILS'], ['STUB_MV_FAILS']])(
    '%s stops the run and leaves no half-made file',
    async (flag) => {
      const { code, out } = await run({ [flag]: '1' })
      expect(code).toBe(1)
      expect(out).toContain('could not write')
      expect(
        tree('home', 'installed', 'proot', 'sudoers.d').filter((f) => f.includes('.new-')),
      ).toEqual([])
    },
  )

  it.each([
    ['home', ''],
    ['.ssh', '/.ssh'],
    ['authorized_keys', '/.ssh/authorized_keys'],
  ])('a run where the account can write %s fails, and writes no key line', async (_, suffix) => {
    await run() // the files exist now
    fs.appendFileSync(p('code/ops/preview-caddy.sh'), '# next\n')
    const { code, out } = await run({ STUB_CAN_WRITE: `sprecher-preview${suffix}` })
    expect(code).toBe(1)
    expect(out).toContain(`can write to ${HOME()}${suffix}`)
  })

  it('puts back the sudo rule that was there before when a later check fails', async () => {
    await run()
    const before = read('sudoers.d/sprecher-east-preview')
    // a different folder for the scripts changes the rule's text, so this run replaces it
    const { code } = await run({ PREVIEW_ACCESS_DIR: p('installed2'), STUB_CAN_WRITE: 'all' })
    expect(code).toBe(1)
    expect(read('sudoers.d/sprecher-east-preview')).toBe(before)
  })
})
