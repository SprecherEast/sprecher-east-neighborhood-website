// ops/developer-site-check.sh (#1459): what the developer site may serve. Each rule has a test that
// fails without it: the folder is judged before Caddy serves it, as root, so a file that should never
// be public is refused by name, kind or place and not trusted to be absent.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'

let dir = ''
const p = (...parts) => path.join(dir, 'site', ...parts)
const write = (name, text = 'x\n') => {
  fs.mkdirSync(path.dirname(p(name)), { recursive: true })
  fs.writeFileSync(p(name), text)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'developer-check-'))
  for (const f of [
    'index.html',
    '404.html',
    'style.css',
    'showcase/index.html',
    'showcase/iframe.html',
  ])
    write(f, '<!doctype html><title>x</title>\n')
  write('showcase/assets/app.js', 'console.log(1)\n')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const check = (folder = p(), env = {}) =>
  new Promise((resolve) => {
    const child = spawn('bash', [path.join(OPS, 'developer-site-check.sh'), ...[folder].flat()], {
      env: { PATH: process.env.PATH, ...env },
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
  })
const refused = async (why, env) => {
  const { code, out } = await check(p(), env)
  expect(code, out).toBe(1)
  expect(out).toContain(why)
}

describe('developer-site-check.sh: a folder that may be served', () => {
  it('accepts the index page, the 404 page and the showcase, and says so', async () => {
    const { code, out } = await check()
    expect(code, out).toBe(0)
    expect(out).toContain('holds only the index page, the 404 page and the showcase')
  })

  it('refuses no folder, a missing folder and a link in place of the folder', async () => {
    expect((await check([])).code).toBe(1)
    expect((await check(p('nothing'))).code).toBe(1)
    fs.symlinkSync(p(), p('..', 'link'))
    const { code, out } = await check(p('..', 'link'))
    expect(code).toBe(1)
    expect(out).toContain('missing or is a link')
  })
})

describe('developer-site-check.sh: only the showcase and the two pages', () => {
  it('refuses another entry at the top, a file or a folder', async () => {
    write('notes.txt')
    await refused('unexpected entry at the top: notes.txt')
    fs.rmSync(p('notes.txt'))
    write('other/readme.html')
    await refused('unexpected entry at the top: other')
  })

  for (const needed of [
    'index.html',
    '404.html',
    'style.css',
    'showcase/index.html',
    'showcase/iframe.html',
  ])
    it(`refuses a folder with no ${needed}`, async () => {
      fs.rmSync(p(needed))
      await refused(`${needed} is missing`)
    })

  it('refuses a showcase file that is a folder where a file belongs', async () => {
    fs.rmSync(p('index.html'))
    fs.mkdirSync(p('index.html'))
    await refused('index.html is missing')
  })
})

describe('developer-site-check.sh: nothing that leads out of the folder', () => {
  it('refuses a link, to a file or to a folder, anywhere', async () => {
    fs.symlinkSync('/etc/hostname', p('showcase/assets/hostname.txt'))
    await refused('a link: showcase/assets/hostname.txt')
    fs.rmSync(p('showcase/assets/hostname.txt'))
    fs.symlinkSync('/etc', p('showcase/etc'))
    await refused('a link: showcase/etc')
  })

  it('refuses a link at the top, even one that points inside the folder', async () => {
    fs.symlinkSync('showcase', p('alias'))
    await refused('a link: alias')
  })

  it('refuses a file that has another name elsewhere (a hard link)', async () => {
    fs.writeFileSync(path.join(dir, 'outside.txt'), 'secret\n')
    fs.linkSync(path.join(dir, 'outside.txt'), p('showcase/assets/inside.txt'))
    await refused('another name elsewhere: showcase/assets/inside.txt')
  })

  it('refuses anything that is neither a file nor a folder (a pipe)', async () => {
    expect(spawnSync('mkfifo', [p('showcase/assets/pipe')]).status).toBe(0)
    await refused('not a plain file or folder: showcase/assets/pipe')
  })
})

describe('developer-site-check.sh: nothing that is private by name', () => {
  it('refuses a dot file or dot folder, anywhere (.env, .git, .htaccess)', async () => {
    write('showcase/.env')
    await refused('hidden name: showcase/.env')
    fs.rmSync(p('showcase/.env'))
    write('showcase/.git/config')
    await refused('hidden name: showcase/.git')
  })

  for (const name of [
    'payload.db',
    'data.sqlite',
    'data.sqlite3',
    'dump.sql',
    'cert.pem',
    'id.key',
    'site.bak',
    'app.log',
    'prod.env',
    'backup.tar.gz',
    'dump.sql.gz',
    'payload.db-wal',
    'payload.db-shm',
    'site.tgz',
    'id_ed25519',
    'id_rsa',
    'CERT.PEM',
    'data.sqlite-wal',
    'data.sqlite-shm',
    'site.tar',
    'site.zip',
    'id_ecdsa',
    'Data.DB',
  ])
    it(`refuses ${name}`, async () => {
      write(`showcase/assets/${name}`)
      await refused(`a file that is never public: showcase/assets/${name}`)
    })

  it('accepts names that only look like them', async () => {
    write('showcase/assets/keyboard.js')
    write('showcase/assets/database.html')
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  it('refuses a file anyone could write to', async () => {
    fs.chmodSync(p('showcase/assets/app.js'), 0o666)
    await refused('writable by anyone: showcase/assets/app.js')
  })

  it('refuses a file only "others" can write to, and accepts one only its group can', async () => {
    fs.chmodSync(p('showcase/assets/app.js'), 0o646)
    await refused('writable by anyone: showcase/assets/app.js')
    fs.chmodSync(p('showcase/assets/app.js'), 0o664)
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  it('refuses a folder anyone could write to', async () => {
    fs.chmodSync(p('showcase/assets'), 0o777)
    await refused('writable by anyone: showcase/assets')
  })
})

describe('developer-site-check.sh: size and fonts', () => {
  it('refuses a folder over the size cap, and accepts one at it', async () => {
    write('showcase/assets/big.js', 'x'.repeat(5000))
    await refused('is over the size cap', { DEVELOPER_MAX_BYTES: '4000' })
    const { code } = await check(p(), { DEVELOPER_MAX_BYTES: '100000' })
    expect(code).toBe(0)
  })

  it('accepts a folder of exactly the cap and refuses one byte less', async () => {
    const bytes = Number(
      spawnSync('bash', ['-c', 'du -sb "$1"', '--', p()], { encoding: 'utf8' }).stdout.split(
        '\t',
      )[0],
    )
    expect((await check(p(), { DEVELOPER_MAX_BYTES: String(bytes) })).code).toBe(0)
    await refused('is over the size cap', { DEVELOPER_MAX_BYTES: String(bytes - 1) })
  })

  it('reads the cap from environment.sh when the caller names none', async () => {
    const { code } = await check()
    expect(code).toBe(0) // 100 MiB by default: the showcase is about 15 MB
  })

  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com'])
    it(`refuses a file that names ${host}: the font is served from here`, async () => {
      write('showcase/assets/app.css', `@font-face{src:url(https://${host}/s/x.woff2)}\n`)
      await refused('names a third-party font host: showcase/assets/app.css')
    })

  it('is not clean when the folder could not be searched for them', async () => {
    fs.mkdirSync(path.join(dir, 'bin'))
    fs.writeFileSync(path.join(dir, 'bin/grep'), '#!/bin/sh\nexit 2\n', { mode: 0o755 })
    const { code, out } = await check(p(), { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` })
    expect(code).toBe(1)
    expect(out).toContain('could not be read to look for font hosts')
  })

  it('reads a file with a stray NUL byte too, so one byte cannot hide a font host', async () => {
    fs.writeFileSync(p('showcase/assets/f.js'), Buffer.from('x\0fonts.gstatic.com\0', 'latin1'))
    await refused('names a third-party font host: showcase/assets/f.js')
  })

  it('refuses a font host in any letter case', async () => {
    write('showcase/assets/app.css', '@import "https://Fonts.GoogleAPIs.com/css";\n')
    await refused('names a third-party font host: showcase/assets/app.css')
  })

  it('accepts a font file that names no host', async () => {
    fs.writeFileSync(p('showcase/assets/f.woff2'), Buffer.from('wOF2\0\x01poppins', 'latin1'))
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })
})

describe('developer-site-check.sh --source: the release’s own showcase, before it is copied', () => {
  const source = (folder = p('showcase')) =>
    new Promise((resolve) => {
      const child = spawn('bash', [path.join(OPS, 'developer-site-check.sh'), '--source', folder], {
        env: { PATH: process.env.PATH },
      })
      let out = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (out += d))
      child.on('close', (code) => resolve({ code, out }))
    })

  it('accepts a showcase with no link, and needs no index page or 404 page beside it', async () => {
    fs.rmSync(p('index.html'))
    const { code, out } = await source()
    expect(code, out).toBe(0)
    expect(out).toContain('no link in it')
  })

  it('refuses a link, a hard link and a pipe', async () => {
    fs.symlinkSync('/etc/hostname', p('showcase/assets/l.txt'))
    fs.writeFileSync(path.join(dir, 'outside.txt'), 'x\n')
    fs.linkSync(path.join(dir, 'outside.txt'), p('showcase/assets/h.txt'))
    expect(spawnSync('mkfifo', [p('showcase/assets/pipe')]).status).toBe(0)
    const { code, out } = await source()
    expect(code).toBe(1)
    expect(out).toContain('a link: assets/l.txt')
    expect(out).toContain('another name elsewhere: assets/h.txt')
    expect(out).toContain('not a plain file or folder: assets/pipe')
  })

  it('leaves the other rules to the check of the folder that is served', async () => {
    write('showcase/assets/payload.db')
    expect((await source()).code).toBe(0)
  })

  it('refuses no folder, a missing folder and a link in place of the folder', async () => {
    expect((await source(p('nothing'))).code).toBe(1)
    fs.symlinkSync(p('showcase'), p('..', 'link'))
    expect((await source(p('..', 'link'))).code).toBe(1)
  })
})

describe('developer-site-check.sh: it reports every problem and never a file’s content', () => {
  it('lists each problem it finds, not only the first', async () => {
    write('notes.txt', 'SECRET-CONTENT')
    write('showcase/.env', 'SECRET-CONTENT')
    const { code, out } = await check()
    expect(code).toBe(1)
    expect(out).toContain('notes.txt')
    expect(out).toContain('showcase/.env')
    expect(out).not.toContain('SECRET-CONTENT')
  })
})
