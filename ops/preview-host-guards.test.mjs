// ops/preview-host-guards.sh (#1346): what keeps the preview account away from production's folders, cron
// and at, and Caddy's admin endpoint. It must make each change it describes, make none on any doubt, and
// say so. `iptables`, `ip6tables`, `systemctl` and `id` are stand-ins; the real rule and unit are checked
// on the server (ops/README.md, "Pull request preview account"). Caddy's admin endpoint is a real socket.
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runCommand } from './preview-access-harness.mjs'
import { OPS, write } from './umami-harness.mjs'

const UID = process.getuid()
const FILES = ['preview-host-guards.sh', 'lib.sh', 'umami-lib.sh', 'environment.sh']
// What the script uses besides its stand-ins, so a tool missing from the stand-ins is missing for real.
const SYSTEM_TOOLS = [
  'stat',
  'find',
  'chmod',
  'cp',
  'tail',
  'grep',
  'mktemp',
  'mv',
  'rm',
  'cmp',
  'date',
  'dirname',
  'cat',
  'head',
  'tr',
  'sed',
  'awk',
  'env',
  'bash',
  'basename',
  'readlink',
  'realpath',
  'wc',
  'sort',
  'touch',
  'tee',
  'ls',
]

let dir = ''
let admin
const p = (...parts) => path.join(dir, ...parts)
const read = (...parts) => fs.readFileSync(p(...parts), 'utf8')
const mode = (...parts) => (fs.statSync(p(...parts)).mode & 0o777).toString(8)
// A stand-in replaces the link to the real tool (a write through the link would overwrite the real one).
const stub = (name, body) => {
  fs.rmSync(p('bin', name), { force: true })
  write(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
}
const log = () => fs.readFileSync(p('log'), 'utf8')
const rules = (tool) =>
  fs.existsSync(p('state', `${tool}.rules`)) ? read('state', `${tool}.rules`) : ''

const listen = () =>
  new Promise((resolve) => {
    const server = net.createServer((s) => s.end())
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: server.address().port, close: () => new Promise((r) => server.close(r)) }),
    )
  })

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-guards-'))
  fs.chmodSync(dir, 0o755)
  fs.writeFileSync(p('log'), '')
  fs.mkdirSync(p('state'))
  for (const f of FILES) write(p('ops', f), fs.readFileSync(path.join(OPS, f)), 0o755)
  for (const d of ['prod', 'backups', 'umami', 'pmlogs']) fs.mkdirSync(p(d), { mode: 0o755 })
  fs.chmodSync(p('backups'), 0o700)
  write(p('prod/.env.local'), 'x', 0o600)
  admin = await listen()
  // tools the script finds, and only these: real coreutils by link, the rest as stand-ins
  fs.mkdirSync(p('bin'))
  for (const t of SYSTEM_TOOLS) fs.symlinkSync(`/usr/bin/${t}`, p('bin', t))
  stub(
    'id',
    'if [ "$1 $2" = "-u sprecher-preview" ]; then [ -z "$STUB_NO_ACCOUNT" ] || exit 1; echo "${STUB_ACCOUNT_UID:-998}"; else exec /usr/bin/id "$@"; fi',
  )
  // caddy adapt prints STUB_CADDY_JSON (a config that names no folder of ours by default); STUB_CADDY_FAILS=1 fails
  stub(
    'caddy',
    '[ -z "$STUB_CADDY_FAILS" ] || exit 1; [ -z "$STUB_CADDY_EMPTY" ] || exit 0; echo "${STUB_CADDY_JSON:-{\\"apps\\":{\\"http\\":{}}}}"',
  )
  fs.mkdirSync(p('proc'))
  write(p('caddy/Caddyfile'), 'example.test {}\n')
  // iptables/ip6tables keep their rules in state/<tool>.rules: -C finds one, -I adds it
  for (const t of ['iptables', 'ip6tables'])
    stub(
      t,
      [
        `state="$STUB_STATE/${t}.rules"`,
        'args="$*"',
        'case " $args " in',
        '  *" -C "*) grep -qxF -- "${args#*-C OUTPUT }" "$state" 2>/dev/null ;;',
        `  *" -I "*) [ -z "$STUB_IPT_FAILS" ] || [ "$STUB_IPT_FAILS" != "${t}" -a "$STUB_IPT_FAILS" != all ] || exit 1`,
        `     echo "${t} -I $*" >> "$STUB_LOG"; echo "\${args#*-I OUTPUT 1 }" >> "$state" ;;`,
        'esac',
      ].join('\n'),
    )
  // enable makes state/enabled; STUB_SYSTEMCTL_FAILS=1 makes enable fail, =reload makes daemon-reload fail
  stub(
    'systemctl',
    [
      'echo "systemctl $*" >> "$STUB_LOG"',
      'case "$1" in',
      '  is-enabled) [ -e "$STUB_STATE/enabled" ] ;;',
      '  enable) [ "$STUB_SYSTEMCTL_FAILS" != 1 ] && touch "$STUB_STATE/enabled" ;;',
      '  daemon-reload) [ "$STUB_SYSTEMCTL_FAILS" != reload ] ;;',
      'esac',
    ].join('\n'),
  )
})
afterEach(async () => {
  await admin.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

// `umask` runs the script under that umask, the way a caller with a strict one would
const run = (args = [], env = {}, { without = [], umask } = {}) => {
  for (const t of without) fs.rmSync(p('bin', t))
  const script = p('ops/preview-host-guards.sh')
  const command = umask
    ? ['-c', 'umask "$0"; exec /bin/bash "$@"', umask, script, ...args]
    : [script, ...args]
  return runCommand('/bin/bash', command, {
    env: {
      PATH: p('bin'),
      STUB_LOG: p('log'),
      STUB_STATE: p('state'),
      PREVIEW_ACCESS_ROOT_UID: String(UID),
      PRODUCTION_DIR_FOR_TESTS: p('prod'),
      BACKUP_ROOT: p('backups'),
      UMAMI_DIR: p('umami'),
      PREVIEW_ACCESS_DIR: p('installed'),
      CADDYFILE: p('caddy/Caddyfile'),
      PREVIEW_CADDY_DIR: p('caddy/previews'),
      PROC_DIR: p('proc'),
      PRODUCTION_PM2_LOG_DIR: p('pmlogs'),
      CRON_ALLOW_FILE: p('etc/cron.allow'),
      CRON_DENY_FILE: p('etc/cron.deny'),
      AT_ALLOW_FILE: p('etc/at.allow'),
      AT_DENY_FILE: p('etc/at.deny'),
      PREVIEW_FIREWALL_UNIT: p('etc/firewall.service'),
      CADDY_ADMIN_PORT: String(admin.port),
      ...env,
    },
  })
}
beforeEach(() => fs.mkdirSync(p('etc')))
const RULE = (port) =>
  `-o lo -p tcp --dport ${port} -m owner --uid-owner 998 -m comment --comment sprecher-east-preview-caddy-admin -j REJECT --reject-with tcp-reset`

describe('preview-host-guards.sh: production’s private folders', () => {
  it('takes every access from others off a folder that has it, and says what it was', async () => {
    fs.chmodSync(p('umami'), 0o755)
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(mode('prod')).toBe('750')
    expect(mode('umami')).toBe('750')
    expect(mode('backups')).toBe('700') // already private: left as it was
    expect(out).toContain(`${p('prod')}: mode 755 -> 750 (undo: chmod 755 ${p('prod')})`)
    expect(out).not.toContain(`${p('backups')}: mode`)
  })

  it('keeps what the group had, and takes only what others had', async () => {
    fs.chmodSync(p('prod'), 0o775)
    await run()
    expect(mode('prod')).toBe('770')
  })

  it('changes nothing for a folder that is not owned by root, and says so', async () => {
    const { code, out } = await run([], { PREVIEW_ACCESS_ROOT_UID: String(UID + 1) })
    expect(code).toBe(3)
    expect(mode('prod')).toBe('755')
    expect(out).toContain(`${p('prod')} or something directly in it is not owned by root`)
  })

  it('changes nothing when something directly in it belongs to another user, so its app keeps access', async (ctx) => {
    if (UID !== 0) ctx.skip() // only root can give a file to another user
    fs.chownSync(p('prod/.env.local'), 1234, 1234)
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(mode('prod')).toBe('755')
    expect(out).toContain('may need the access')
  })

  it('changes nothing for a folder owned by another user, even when what is in it is root’s', async (ctx) => {
    if (UID !== 0) ctx.skip() // only root can give a folder to another user
    fs.chownSync(p('prod'), 1234, 1234)
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(mode('prod')).toBe('755')
    expect(out).toContain('is not owned by root')
  })

  it('changes nothing for a link, and leaves what it points at alone', async () => {
    fs.rmSync(p('umami'), { recursive: true })
    fs.mkdirSync(p('other'), { mode: 0o755 })
    fs.symlinkSync(p('other'), p('umami'))
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(mode('other')).toBe('755')
    expect(out).toContain(`${p('umami')} is a link or not a folder`)
  })

  it('changes nothing for a path that is a file', async () => {
    fs.rmSync(p('umami'), { recursive: true })
    write(p('umami'), 'x')
    expect((await run()).code).toBe(3)
  })

  it('has nothing to do for a folder that is not there', async () => {
    fs.rmSync(p('umami'), { recursive: true })
    fs.rmSync(p('backups'), { recursive: true })
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).not.toContain('WARNING')
  })

  it('closes PM2’s log folder too, since production’s logs are readable by every account', async () => {
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(mode('pmlogs')).toBe('750')
    expect(out).toContain(`${p('pmlogs')}: mode 755 -> 750`)
  })

  it('changes nothing for a link at a guarded path that points nowhere, and says so', async () => {
    fs.rmSync(p('umami'), { recursive: true })
    fs.symlinkSync(p('nowhere'), p('umami'))
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out).toContain(`${p('umami')} is a link or not a folder`)
  })

  describe('before it closes a folder it proves nothing else needs it', () => {
    // a process the way /proc shows it: a status line with the uid, a working folder, open files
    const process = (pid, uid, { cwd, fds = [] } = {}) => {
      fs.mkdirSync(p('proc', pid, 'fd'), { recursive: true })
      fs.writeFileSync(p('proc', pid, 'status'), `Name:\tx\nUid:\t${uid}\t${uid}\t${uid}\t${uid}\n`)
      fs.symlinkSync(cwd ?? '/', p('proc', pid, 'cwd'))
      fds.forEach((f, i) => fs.symlinkSync(f, p('proc', pid, 'fd', String(i + 3))))
    }

    it('leaves a folder alone, warns and exits 3 when Caddy’s configuration names a path in it', async () => {
      const json = JSON.stringify({ root: `${p('prod')}/public` })
      const { code, out } = await run([], { STUB_CADDY_JSON: json })
      expect(code).toBe(3)
      expect(mode('prod')).toBe('755')
      expect(out).toContain(`${p('prod')} is not closed: Caddy's configuration names a path in it`)
      expect(mode('umami')).toBe('750') // the others are not held back
    })

    it('leaves a folder alone when Caddy’s configuration names the folder itself', async () => {
      const { code } = await run([], { STUB_CADDY_JSON: JSON.stringify({ root: p('prod') }) })
      expect(code).toBe(3)
      expect(mode('prod')).toBe('755')
    })

    it('leaves a folder alone when a process that is not root has exactly that folder as its working folder', async () => {
      process('4244', UID + 1, { cwd: p('prod') })
      expect((await run()).code).toBe(3)
      expect(mode('prod')).toBe('755')
    })

    it('goes by the user a process acts as, not the one it started as', async () => {
      fs.mkdirSync(p('proc/4245/fd'), { recursive: true })
      fs.writeFileSync(p('proc/4245/status'), `Uid:\t${UID}\t${UID + 1}\t${UID}\t${UID}\n`)
      fs.symlinkSync(p('prod'), p('proc/4245/cwd'))
      expect((await run()).code).toBe(3)
      expect(mode('prod')).toBe('755')
    })

    // `caddy adapt` pastes an import's text in place, so the path of an imported file is only in the files
    it('leaves a folder alone when the Caddyfile imports a file from it', async () => {
      write(p('caddy/Caddyfile'), `import ${p('prod')}/ops/caddy/x.caddy\n`)
      const { code, out } = await run()
      expect(code).toBe(3)
      expect(mode('prod')).toBe('755')
      expect(out).toContain(
        `${p('prod')} is not closed: a file of Caddy's own configuration names a path in it`,
      )
      expect(mode('umami')).toBe('750')
    })

    it('leaves a folder alone when another file beside the Caddyfile names a path in it', async () => {
      write(p('caddy/snippet.caddy'), `import ${p('pmlogs')}/x\n`)
      expect((await run()).code).toBe(3)
      expect(mode('pmlogs')).toBe('755')
    })

    it('leaves a folder alone when a preview’s block, kept elsewhere, names a path in it', async () => {
      write(p('blocks/pr-7.caddy'), `import ${p('umami')}\n`)
      expect((await run([], { PREVIEW_CADDY_DIR: p('blocks') })).code).toBe(3)
      expect(mode('umami')).toBe('755')
    })

    it('reads a dot in the folder’s name as a dot, not as any character', async () => {
      fs.mkdirSync(p('pr.d'), { mode: 0o755 })
      write(p('caddy/Caddyfile'), `import ${p('prXd')}/x\n`)
      expect((await run([], { PRODUCTION_DIR_FOR_TESTS: p('pr.d') })).code).toBe(0)
      expect(mode('pr.d')).toBe('750')
    })

    it('does not mistake a longer folder name in the Caddyfile for the folder', async () => {
      write(p('caddy/Caddyfile'), `import ${p('prod')}-other/x ${p('prod')}.old\n`)
      expect((await run()).code).toBe(0)
      expect(mode('prod')).toBe('750')
    })

    it('does not mistake a longer name that starts with the same letters for the folder', async () => {
      const { code } = await run([], {
        STUB_CADDY_JSON: JSON.stringify({ root: `${p('prod')}-other/x` }),
      })
      expect(code).toBe(0)
      expect(mode('prod')).toBe('750')
    })

    it('leaves every folder alone when the Caddyfile cannot be read by caddy, since what it serves is unknown', async () => {
      const { code, out } = await run([], { STUB_CADDY_FAILS: '1' })
      expect(code).toBe(3)
      expect(mode('prod')).toBe('755')
      expect(mode('umami')).toBe('755')
      expect(out).toContain('caddy adapt could not read the live Caddyfile')
    })

    it('leaves a folder alone when caddy prints nothing', async () => {
      const { code } = await run([], { STUB_CADDY_EMPTY: '1' })
      expect(code).toBe(3)
      expect(mode('prod')).toBe('755')
    })

    it('leaves a folder alone when a process that is not root has it as its working folder', async () => {
      process('4242', UID + 1, { cwd: p('prod/public') })
      const { code, out } = await run()
      expect(code).toBe(3)
      expect(mode('prod')).toBe('755')
      expect(out).toContain("a process that isn't root's (pid 4242) has it open")
      expect(mode('umami')).toBe('750')
    })

    it('leaves a folder alone when a process that is not root has a file in it open', async () => {
      process('4243', UID + 1, { fds: [p('pmlogs/sprecher-east-out.log')] })
      const { code } = await run()
      expect(code).toBe(3)
      expect(mode('pmlogs')).toBe('755')
      expect(mode('prod')).toBe('750')
    })

    it('closes the folder when only root’s processes have it open', async () => {
      process('1', UID, { cwd: p('prod'), fds: [p('prod/data/x')] })
      const { code } = await run()
      expect(code).toBe(0)
      expect(mode('prod')).toBe('750')
    })

    it('ignores processes elsewhere', async () => {
      process('7', UID + 1, { cwd: '/tmp', fds: [`${p('prod')}-other/x`] })
      expect((await run()).code).toBe(0)
    })
  })

  it('says when a mode could not be changed', async () => {
    stub('chmod', 'exit 1')
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out).toContain('chmod failed')
  })
})

describe('preview-host-guards.sh: cron and at', () => {
  it('makes cron.deny with the account when there is none, and never makes at.deny', async () => {
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(read('etc/cron.deny')).toBe('sprecher-preview\n')
    expect(mode('etc/cron.deny')).toBe('644')
    expect(fs.existsSync(p('etc/at.deny'))).toBe(false)
    expect(out).toContain('cron: sprecher-preview added to')
  })

  it('makes cron.deny readable by everyone even when the caller’s umask is strict', async () => {
    const { code } = await run([], {}, { umask: '077' })
    expect(code).toBe(0)
    expect(mode('etc/cron.deny')).toBe('644')
  })

  it('adds the account to the deny files that exist, on a line of its own, keeping a dated copy', async () => {
    write(p('etc/cron.deny'), 'someone\n')
    write(p('etc/at.deny'), 'daemon\nbin') // no newline at the end
    await run()
    expect(read('etc/cron.deny')).toBe('someone\nsprecher-preview\n')
    expect(read('etc/at.deny')).toBe('daemon\nbin\nsprecher-preview\n')
    const copies = fs.readdirSync(p('etc')).filter((f) => f.includes('bak-preview-guards'))
    expect(copies).toHaveLength(2)
    expect(
      read(
        'etc',
        copies.find((f) => f.startsWith('at.deny')),
      ),
    ).toBe('daemon\nbin')
  })

  it('changes nothing the second time', async () => {
    await run()
    const first = log()
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(read('etc/cron.deny')).toBe('sprecher-preview\n')
    expect(out).toContain('already in place')
    // only a question to systemd, no change
    expect(log().replace(first, '')).toBe('systemctl is-enabled --quiet firewall.service\n')
  })

  it('does not count a longer name that contains the account’s as the account', async () => {
    write(p('etc/cron.deny'), 'sprecher-preview-two\n')
    await run()
    expect(read('etc/cron.deny')).toBe('sprecher-preview-two\nsprecher-preview\n')
  })

  it('stops when the account is in an allow file, and changes no scheduler file', async () => {
    write(p('etc/cron.allow'), 'sprecher-preview\n')
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out).toContain('is in an allow file for cron or at')
    expect(fs.existsSync(p('etc/cron.deny'))).toBe(false)
  })

  it('stops for an at allow file that has the account too', async () => {
    write(p('etc/at.allow'), 'root\nsprecher-preview\n')
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out).toContain('is in an allow file for cron or at')
  })

  it('leaves a deny file others can write, a link and a folder alone', async () => {
    write(p('etc/cron.deny'), 'x\n', 0o666)
    fs.chmodSync(p('etc/cron.deny'), 0o666)
    write(p('elsewhere'), 'x\n')
    fs.symlinkSync(p('elsewhere'), p('etc/at.deny'))
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(read('etc/cron.deny')).toBe('x\n')
    expect(read('elsewhere')).toBe('x\n')
    expect(out).toContain('is not root-owned or can be written by others')
    expect(out).toContain('is a link or not a file')
  })

  it('leaves a deny file the group can write alone', async () => {
    write(p('etc/cron.deny'), 'x\n')
    fs.chmodSync(p('etc/cron.deny'), 0o664)
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(read('etc/cron.deny')).toBe('x\n')
    expect(out).toContain('can be written by others')
  })

  it('says when a deny file could not be appended to, or made', async () => {
    write(p('etc/at.deny'), 'daemon\n')
    stub('tee', 'exit 1')
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out.match(/could not write/g)).toHaveLength(2) // cron.deny (made) and at.deny (appended)
    expect(out).toContain('cron would still run jobs for sprecher-preview')
    expect(out).toContain('at would still run jobs for sprecher-preview')
  })

  it('leaves a deny file that is a folder alone', async () => {
    fs.mkdirSync(p('etc/cron.deny'))
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out).toContain('is a link or not a file')
  })

  it('leaves a deny file that is not root-owned alone, and says the scheduler would still run its jobs', async () => {
    write(p('etc/cron.deny'), 'x\n')
    write(p('etc/at.deny'), 'x\n')
    const { code, out } = await run([], { PREVIEW_ACCESS_ROOT_UID: String(UID + 1) })
    expect(code).toBe(3)
    expect(read('etc/cron.deny')).toBe('x\n')
    expect(out).toContain('cron would still run jobs for sprecher-preview')
    expect(out).toContain('at would still run jobs for sprecher-preview')
  })

  it('is satisfied by an allow file that leaves the account out, for cron and for at', async () => {
    write(p('etc/cron.allow'), 'root\n')
    write(p('etc/at.allow'), 'root\n')
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).not.toContain('would still run')
  })

  it('says when a deny file could not be copied first, or written', async () => {
    write(p('etc/cron.deny'), 'x\n')
    stub('cp', 'exit 1')
    const copy = await run()
    expect(copy.code).toBe(3)
    expect(copy.out).toContain('could not copy')
    expect(read('etc/cron.deny')).toBe('x\n')
    fs.rmSync(p('bin/cp'))
    fs.symlinkSync('/usr/bin/cp', p('bin/cp'))
    fs.chmodSync(p('etc/cron.deny'), 0o444) // not writable, even by its owner
    if (UID !== 0) {
      const unwritable = await run()
      expect(unwritable.code).toBe(3)
      expect(unwritable.out).toContain('could not write')
    }
  })
})

describe('preview-host-guards.sh: the firewall rule and its unit', () => {
  it('refuses the account’s connections to the admin port, for IPv4 and IPv6, and enables a boot unit', async () => {
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(rules('iptables')).toBe(`${RULE(admin.port)}\n`)
    expect(rules('ip6tables')).toBe(`${RULE(admin.port)}\n`)
    expect(log()).toContain('iptables -I -w -I OUTPUT 1 -o lo')
    expect(out).toContain('iptables rule: connections from sprecher-preview to localhost port')
    const unit = read('etc/firewall.service')
    expect(unit).toContain('Managed by ops/preview-host-guards.sh (#1346)')
    expect(unit).toContain(`ExecStart=/bin/bash ${p('installed/ops/preview-host-guards.sh')} boot`)
    expect(unit).toContain('WantedBy=multi-user.target')
    expect(unit).toContain('Type=oneshot')
    expect(unit).toContain('RemainAfterExit=yes')
    expect(unit).toMatch(/^After=.*network-pre\.target.*ufw\.service/m) // after the firewall that could flush it
    expect(mode('etc/firewall.service')).toBe('644')
    expect(log()).toContain('systemctl daemon-reload')
    expect(log()).toContain('systemctl enable firewall.service')
  })

  it('puts the rule first in OUTPUT, so a rule that accepts loopback traffic does not come before it', async () => {
    await run()
    expect(log()).toMatch(/-w -I OUTPUT 1 /)
  })

  it('changes nothing the second time: no new rule, no rewritten unit', async () => {
    await run()
    const first = log()
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('already in place')
    expect(log().replace(first, '')).not.toContain('-I')
    expect(rules('iptables').trim().split('\n')).toHaveLength(1)
  })

  it('writes the unit again, keeping a dated copy, when what it says has changed', async () => {
    await run()
    await run([], { PREVIEW_ACCESS_DIR: p('moved') })
    expect(read('etc/firewall.service')).toContain(p('moved/ops/preview-host-guards.sh'))
    expect(
      fs.readdirSync(p('etc')).filter((f) => f.includes('firewall.service.bak-preview-guards')),
    ).toHaveLength(1)
  })

  it('adds nothing when Caddy’s admin endpoint does not answer where the rule looks', async () => {
    const { code, out } = await run([], { CADDY_ADMIN_PORT: '1' })
    expect(code).toBe(3)
    expect(out).toContain("Caddy's admin endpoint does not answer on 127.0.0.1 port 1")
    expect(rules('iptables')).toBe('')
    expect(fs.existsSync(p('etc/firewall.service'))).toBe(false)
  })

  for (const tool of ['iptables', 'ip6tables', 'systemctl'])
    it(`adds nothing when ${tool} is not there`, async () => {
      const { code, out } = await run([], {}, { without: [tool] })
      expect(code).toBe(3)
      expect(out).toContain(`${tool} was not found`)
      expect(rules('iptables') + rules('ip6tables')).toBe('')
      expect(fs.existsSync(p('etc/firewall.service'))).toBe(false)
    })

  it('adds nothing when the account does not exist', async () => {
    const { code, out } = await run([], { STUB_NO_ACCOUNT: '1' })
    expect(code).toBe(3)
    expect(out).toContain('does not exist')
    expect(rules('iptables')).toBe('')
  })

  it('adds nothing when the account would be user id 0', async () => {
    const { code, out } = await run([], { STUB_ACCOUNT_UID: '0' })
    expect(code).toBe(3)
    expect(out).toContain('does not exist')
    expect(rules('iptables')).toBe('')
    expect((await run(['boot'], { STUB_ACCOUNT_UID: '0' })).code).not.toBe(0)
  })

  it('leaves a unit file it did not write, and a link, alone, and adds no rule', async () => {
    write(p('etc/firewall.service'), '[Unit]\nDescription=someone else\n')
    const foreign = await run()
    expect(foreign.code).toBe(3)
    expect(foreign.out).toContain('exists and this script did not write it')
    expect(read('etc/firewall.service')).toBe('[Unit]\nDescription=someone else\n')
    fs.rmSync(p('etc/firewall.service'))
    write(p('elsewhere'), 'x')
    fs.symlinkSync(p('elsewhere'), p('etc/firewall.service'))
    const link = await run()
    expect(link.code).toBe(3)
    expect(link.out).toContain('is a link')
    expect(read('elsewhere')).toBe('x')
    expect(rules('iptables')).toBe('')
  })

  it('says so when a rule could not be added, for either tool', async () => {
    const all = await run([], { STUB_IPT_FAILS: 'all' })
    expect(all.code).toBe(3)
    expect(all.out).toContain('an iptables rule could not be added')
    expect(fs.existsSync(p('etc/firewall.service'))).toBe(false)
    const v6 = await run([], { STUB_IPT_FAILS: 'ip6tables' })
    expect(v6.code).toBe(3)
    expect(rules('iptables')).toContain('REJECT') // the IPv4 rule stays
  })

  it('says so when the boot unit could not be enabled', async () => {
    const { code, out } = await run([], { STUB_SYSTEMCTL_FAILS: '1' })
    expect(code).toBe(3)
    expect(out).toContain('would not enable the boot unit')
  })

  it('says so when systemd would not reload its units, and does not enable a unit it could not load', async () => {
    const { code, out } = await run([], { STUB_SYSTEMCTL_FAILS: 'reload' })
    expect(code).toBe(3)
    expect(out).toContain('would not reload its units')
    expect(log()).not.toContain('systemctl enable')
  })

  it('tries to enable the unit again on the next run when the first enable failed', async () => {
    await run([], { STUB_SYSTEMCTL_FAILS: '1' })
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('boot unit firewall.service enabled')
    expect(log().match(/systemctl enable/g)).toHaveLength(2)
  })

  it('leaves nothing behind and says so when the unit file can’t be made or filled', async () => {
    stub('mktemp', 'exit 1')
    const made = await run()
    expect(made.code).toBe(3)
    expect(made.out).toContain('could not make the unit file')
    fs.rmSync(p('bin/mktemp'))
    fs.symlinkSync('/usr/bin/mktemp', p('bin/mktemp'))
    stub('chmod', 'case "$*" in *.new-*) exit 1 ;; esac; exec /usr/bin/chmod "$@"')
    const filled = await run()
    expect(filled.code).toBe(3)
    expect(filled.out).toContain('could not write the unit file')
    expect(fs.readdirSync(p('etc')).filter((f) => f.includes('.new-'))).toEqual([])
    expect(fs.existsSync(p('etc/firewall.service'))).toBe(false)
  })

  it('keeps the old unit and says so when its dated copy can’t be made', async () => {
    await run()
    const before = read('etc/firewall.service')
    stub('cp', 'exit 1')
    const { code, out } = await run([], { PREVIEW_ACCESS_DIR: p('moved') })
    expect(code).toBe(3)
    expect(out).toContain('could not copy the unit file first')
    expect(read('etc/firewall.service')).toBe(before)
    expect(fs.readdirSync(p('etc')).filter((f) => f.includes('.new-'))).toEqual([])
  })

  it('says so when the unit file could not be written', async () => {
    stub('mv', 'exit 1')
    const { code, out } = await run()
    expect(code).toBe(3)
    expect(out).toContain('could not put the unit file in place')
    expect(fs.readdirSync(p('etc')).filter((f) => f.includes('.new-'))).toEqual([])
  })
})

describe('preview-host-guards.sh boot: only the firewall rule, at boot', () => {
  it('puts the rule back without the other guards, even though Caddy is not answering yet', async () => {
    fs.chmodSync(p('prod'), 0o755)
    const { code } = await run(['boot'], { CADDY_ADMIN_PORT: '1' })
    expect(code).toBe(0)
    expect(rules('iptables')).toBe(`${RULE(1)}\n`)
    expect(rules('ip6tables')).toBe(`${RULE(1)}\n`)
    expect(mode('prod')).toBe('755') // the folder guard did not run
    expect(fs.existsSync(p('etc/cron.deny'))).toBe(false)
    expect(fs.existsSync(p('etc/firewall.service'))).toBe(false)
  })

  it('fails when the account does not exist, or a rule can not be added', async () => {
    expect((await run(['boot'], { STUB_NO_ACCOUNT: '1' })).code).not.toBe(0)
    expect((await run(['boot'], { STUB_IPT_FAILS: 'all' })).code).not.toBe(0)
  })
})
