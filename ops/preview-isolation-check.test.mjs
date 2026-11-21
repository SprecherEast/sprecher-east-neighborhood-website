// ops/preview-isolation-check.sh (#1346): the proof, run as the preview account, that it can't read
// production's files or reach Caddy's admin endpoint. It must fail for each protected place and for the
// endpoint on IPv4 and IPv6, pass when none is reachable, and report every failure without printing a
// file's content. The tests use real file modes and real sockets. The check runs as an unprivileged user:
// the test's own, or `nobody` when the tests run as root (which reads everything).
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runCommand } from './preview-access-harness.mjs'
import { OPS, write } from './umami-harness.mjs'

const CHECK_FILES = [
  'preview-isolation-check.sh',
  'preview-access-lib.sh',
  'umami-lib.sh',
  'environment.sh',
]
const SECRET = 'TOP-SECRET-CONTENT-123'

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const open = (...parts) => fs.chmodSync(p(...parts), 0o755)

/**
 * A tree shaped like the server's, all private (mode 000), so the account can reach none of it, even when
 * it is the user that made the files (as it is when the tests don't run as root).
 */
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isolation-'))
  fs.chmodSync(dir, 0o755)
  for (const f of CHECK_FILES) write(p('ops', f), fs.readFileSync(path.join(OPS, f)), 0o755)
  fs.chmodSync(p('ops'), 0o755)
  write(p('prod/.env.local'), `KEY=${SECRET}\n`, 0o000)
  write(p('prod/data/payload.db'), SECRET, 0o000)
  write(p('prod/public/media/a.jpg'), SECRET, 0o000)
  write(p('prod/releases/abc/server.js'), SECRET, 0o000)
  write(p('backups/daily/x.tar.gz'), SECRET, 0o000)
  write(p('umami/.env'), `PASSWORD=${SECRET}\n`, 0o000)
  write(p('pm2/logs/app.log'), SECRET, 0o000)
  write(p('pmlogs/sprecher-east-out.log'), SECRET, 0o000)
  write(p('caddy/.local/share/caddy/pki/key.pem'), SECRET, 0o000)
  for (const d of [
    'prod',
    'prod/data',
    'prod/public',
    'prod/public/media',
    'prod/releases',
    'prod/releases/abc',
    'backups',
    'backups/daily',
    'umami',
    'pm2',
    'pm2/logs',
    'pmlogs',
    'caddy',
    'caddy/.local',
    'caddy/.local/share',
    'caddy/.local/share/caddy',
    'caddy/.local/share/caddy/pki',
  ].reverse())
    fs.chmodSync(p(d), 0o000)
})
afterEach(() => {
  // folders with no access can't be entered to delete what is in them
  execFileSync('chmod', ['-R', 'u+rwx', dir])
  fs.rmSync(dir, { recursive: true, force: true })
})

/** Runs the check as an unprivileged user, with the stand-in tree and a port nothing listens on. */
const check = (env = {}) => {
  const full = {
    PATH: process.env.PATH,
    PRODUCTION_DIR_FOR_TESTS: p('prod'),
    BACKUP_ROOT: p('backups'),
    UMAMI_DIR: p('umami'),
    PRODUCTION_PM2_HOME: p('pm2'),
    PRODUCTION_PM2_LOG_DIR: p('pmlogs'),
    CADDY_STORAGE_DIR: p('caddy'),
    CADDY_ADMIN_PORT: '1', // nothing listens on port 1
    ...env,
  }
  const script = p('ops/preview-isolation-check.sh')
  return process.getuid() === 0
    ? runCommand('setpriv', ['--reuid=65534', '--regid=65534', '--clear-groups', 'bash', script], {
        env: full,
      })
    : runCommand('bash', [script], { env: full })
}

/** A server on 127.0.0.1 or ::1, standing in for Caddy's admin endpoint. Resolves with the port and a closer. */
const listen = (host) =>
  new Promise((resolve, reject) => {
    const server = net.createServer((s) => s.end())
    server.on('error', reject)
    server.listen(0, host, () =>
      resolve({ port: server.address().port, close: () => new Promise((r) => server.close(r)) }),
    )
  })

describe('preview-isolation-check.sh: when nothing is reachable', () => {
  it('passes, and says so', async () => {
    const { code, out } = await check()
    expect(code).toBe(0)
    expect(out).toContain(
      "the preview account can't read production's files or reach Caddy's admin endpoint",
    )
    expect(out).not.toContain('::error')
  })

  it('does not count a file it can see but not read', async () => {
    for (const d of [
      'caddy',
      'caddy/.local',
      'caddy/.local/share',
      'caddy/.local/share/caddy',
      'caddy/.local/share/caddy/pki',
    ])
      open(d) // listable, but the file in it has no access (a folder the guards leave alone)
    expect((await check()).code).toBe(0)
  })

  it('treats a path that does not exist as safe', async () => {
    for (const folder of ['umami', 'pm2']) {
      execFileSync('chmod', ['-R', 'u+rwx', p(folder)]) // a folder with no access can't be deleted
      fs.rmSync(p(folder), { recursive: true })
    }
    expect((await check()).code).toBe(0)
  })
})

describe('preview-isolation-check.sh: a production file the account can open', () => {
  // The folder can be entered but not listed (311: no read bit for anyone), so only the known file name finds it.
  const knownFile = async (folder, file, shown) => {
    fs.chmodSync(p(folder), 0o311)
    fs.chmodSync(p(file), 0o644)
    const { code, out } = await check()
    expect(code).toBe(1)
    expect(out).toContain(`the preview account can read ${p(shown ?? file)}`)
    expect(out).not.toContain(SECRET)
  }
  it('the settings file (.env.local)', () => knownFile('prod', 'prod/.env.local'))
  it('the database', async () => {
    fs.chmodSync(p('prod'), 0o311)
    return knownFile('prod/data', 'prod/data/payload.db')
  })
  it('Umami’s settings', () => knownFile('umami', 'umami/.env'))
})

describe('preview-isolation-check.sh: a folder with a readable file anywhere in it', () => {
  const folderCase = (name, folder, file, expectedFolder) =>
    it(name, async () => {
      // the whole path down to the file is open to everyone
      let walk = ''
      for (const part of file.split('/').slice(0, -1)) {
        walk = path.join(walk, part)
        open(walk)
      }
      fs.chmodSync(p(file), 0o644)
      const { code, out } = await check()
      expect(code).toBe(1)
      expect(out).toContain(`the preview account can read files in ${p(expectedFolder ?? folder)}`)
      expect(out).not.toContain(SECRET)
    })
  folderCase('production’s folder (a release)', 'prod', 'prod/releases/abc/server.js')
  folderCase(
    'production’s media',
    'prod/public/media',
    'prod/public/media/a.jpg',
    'prod/public/media',
  )
  folderCase('the backups', 'backups', 'backups/daily/x.tar.gz')
  folderCase('Umami’s folder', 'umami', 'umami/.env')
  folderCase('production’s PM2 state', 'pm2', 'pm2/logs/app.log')
  folderCase('production’s PM2 logs (/var/log/pm2)', 'pmlogs', 'pmlogs/sprecher-east-out.log')
  folderCase('Caddy’s certificate storage', 'caddy', 'caddy/.local/share/caddy/pki/key.pem')

  it('finds a file eight levels down, and the production database folder on its own', async () => {
    open('backups') // so that the deep folders can be made
    write(p('backups/a/b/c/d/e/f/g/deep'), SECRET, 0o644)
    for (const d of [
      'backups',
      'backups/a',
      'backups/a/b',
      'backups/a/b/c',
      'backups/a/b/c/d',
      'backups/a/b/c/d/e',
      'backups/a/b/c/d/e/f',
      'backups/a/b/c/d/e/f/g',
    ])
      open(d)
    expect((await check()).out).toContain(`can read files in ${p('backups')}`)
    // production's folder can be entered but not listed; its database folder is open
    fs.chmodSync(p('prod'), 0o311)
    open('prod/data')
    fs.chmodSync(p('prod/data/payload.db'), 0o644)
    expect((await check()).out).toContain(`can read files in ${p('prod/data')}`)
  })

  it('follows a link at the folder’s own path', async () => {
    open('backups')
    open('backups/daily')
    fs.chmodSync(p('backups/daily/x.tar.gz'), 0o644)
    fs.symlinkSync(p('backups'), p('linked'))
    const { out } = await check({ BACKUP_ROOT: p('linked') })
    expect(out).toContain(`can read files in ${p('linked')}`)
  })
})

describe('preview-isolation-check.sh: a closed folder the account can enter but not list', () => {
  const enterable = (folder) =>
    it(`fails for ${folder}, though a file in it can be found only by its name`, async () => {
      fs.chmodSync(p(folder), 0o311) // no read bit for anyone
      const { code, out } = await check()
      expect(code).toBe(1)
      expect(out).toContain(`the preview account can enter ${p(folder)}`)
      expect(out).not.toContain(SECRET)
    })
  enterable('prod')
  enterable('backups')
  enterable('umami')
  enterable('pmlogs')

  it('does not say so for PM2’s state or Caddy’s storage, which the guards leave alone', async () => {
    fs.chmodSync(p('pm2'), 0o311)
    fs.chmodSync(p('caddy'), 0o311)
    expect((await check()).code).toBe(0)
  })

  it('ignores a closed folder that is a file or missing', async () => {
    execFileSync('chmod', ['-R', 'u+rwx', p('umami')])
    fs.rmSync(p('umami'), { recursive: true })
    write(p('umami'), 'x', 0o000)
    expect((await check()).code).toBe(0)
  })

  it('does not call a file the account can execute but not read a folder it can enter', async () => {
    execFileSync('chmod', ['-R', 'u+rwx', p('umami')])
    fs.rmSync(p('umami'), { recursive: true })
    write(p('umami'), 'x', 0o111)
    expect((await check()).code).toBe(0)
  })
})

describe('preview-isolation-check.sh: Caddy’s admin endpoint', () => {
  it('fails when it can connect over IPv4', async () => {
    const server = await listen('127.0.0.1')
    try {
      const { code, out } = await check({ CADDY_ADMIN_PORT: String(server.port) })
      expect(code).toBe(1)
      expect(out).toContain(`Caddy's admin endpoint (127.0.0.1 port ${server.port})`)
    } finally {
      await server.close()
    }
  })

  it('fails when it can connect over IPv6', async (ctx) => {
    let server
    try {
      server = await listen('::1')
    } catch {
      ctx.skip() // this machine has no IPv6 loopback
    }
    try {
      const { code, out } = await check({ CADDY_ADMIN_PORT: String(server.port) })
      expect(code).toBe(1)
      expect(out).toContain(`Caddy's admin endpoint (::1 port ${server.port})`)
    } finally {
      await server.close()
    }
  })

  it('counts a connection that hangs as blocked, within the time it is given', async () => {
    // a server that never accepts: once its queue is full, further connections wait for ever
    const child = spawn('python3', [
      '-I',
      '-c',
      `
import socket, sys, time
s = socket.socket(); s.bind(("127.0.0.1", 0)); s.listen(0)
held = []
for _ in range(8):
    c = socket.socket(); c.setblocking(False)
    try: c.connect(s.getsockname())
    except BlockingIOError: pass
    held.append(c)
print(s.getsockname()[1], flush=True)
time.sleep(60)`,
    ])
    try {
      const port = await new Promise((resolve) =>
        child.stdout.once('data', (d) => resolve(String(d).trim())),
      )
      const started = Date.now()
      const { code } = await check({ CADDY_ADMIN_PORT: port, ISOLATION_CONNECT_SECONDS: '1' })
      expect(code).toBe(0)
      expect(Date.now() - started).toBeLessThan(4000)
    } finally {
      child.kill()
    }
  }, 8000)
})

describe('preview-isolation-check.sh: what it reports', () => {
  it('reports every failure, not only the first', async () => {
    const server = await listen('127.0.0.1')
    try {
      fs.chmodSync(p('umami'), 0o311)
      fs.chmodSync(p('umami/.env'), 0o644)
      const { out } = await check({ CADDY_ADMIN_PORT: String(server.port) })
      expect(out).toContain(`can read ${p('umami/.env')}`)
      expect(out).toContain("Caddy's admin endpoint")
      expect(out).toContain(`the preview account can enter ${p('umami')}`)
      expect(out).toContain('the isolation check failed (3 problems)')
    } finally {
      await server.close()
    }
  })

  it('stays out of the way of its caller’s PATH: a program planted there never runs', async () => {
    write(p('planted/timeout'), `#!/bin/sh\ntouch ${p('RAN')}\n`, 0o755)
    write(p('planted/find'), `#!/bin/sh\ntouch ${p('RAN')}\n`, 0o755)
    fs.chmodSync(p('planted'), 0o755)
    await check({ PATH: `${p('planted')}:${process.env.PATH}` })
    expect(fs.existsSync(p('RAN'))).toBe(false)
  })

  it('starts with an absolute shebang and fixes the locale and PATH itself', () => {
    const text = fs.readFileSync(path.join(OPS, 'preview-isolation-check.sh'), 'utf8')
    expect(text.split('\n')[0]).toBe('#!/bin/bash')
    expect(text).toMatch(/^PATH=\/usr\/local\/bin:\/usr\/bin:\/bin$/m)
    expect(text).toMatch(/^LC_ALL=C$/m)
  })
})
