// ops/developer-site-check.sh (#1459, #1530): what the developer site may serve. Each rule has a test that
// fails without it: the folder is judged before Caddy serves it, as root, so a file that should never
// be public is refused by name, kind or place and not trusted to be absent.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { siteFaces, writePagesFonts, writeShowcaseFonts } from './developer-site-fonts.mjs'
import { OPS } from './umami-harness.mjs'

let dir = ''
const p = (...parts) => path.join(dir, 'site', ...parts)
const write = (name, text = 'x\n') => {
  fs.mkdirSync(path.dirname(p(name)), { recursive: true })
  fs.writeFileSync(p(name), text)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'developer-check-'))
  // The developer pages as the static export writes them, and the Storybook showcase beside them
  for (const f of [
    'index.html',
    '404.html',
    'showcase/index.html',
    'storybook/index.html',
    'storybook/iframe.html',
  ])
    write(f, '<!doctype html><title>x</title>\n')
  write('_next/static/chunks/page.js', 'console.log(1)\n')
  write('storybook/assets/app.js', 'console.log(1)\n')
  writePagesFonts(p())
  writeShowcaseFonts(p('storybook'))
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
  it('accepts the developer pages with the Storybook showcase beside them, and says so', async () => {
    const { code, out } = await check()
    expect(code, out).toBe(0)
    expect(out).toContain(
      'holds only the developer pages and, if there is one, the Storybook showcase',
    )
  })

  it('accepts the pages alone: the Storybook showcase is optional', async () => {
    fs.rmSync(p('storybook'), { recursive: true })
    const { code, out } = await check()
    expect(code, out).toBe(0)
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

describe('developer-site-check.sh: only the developer pages and the Storybook showcase', () => {
  it('refuses another entry at the top, a file or a folder', async () => {
    write('notes.txt')
    await refused('unexpected entry at the top: notes.txt')
    fs.rmSync(p('notes.txt'))
    write('other/readme.html')
    await refused('unexpected entry at the top: other')
  })

  it('refuses the hand-made index page’s old stylesheet at the top: nothing from before is served', async () => {
    write('style.css')
    await refused('unexpected entry at the top: style.css')
  })

  it('accepts what the static export writes at the top besides its pages and assets', async () => {
    for (const name of ['index.txt', '__next.__PAGE__.txt', '__next._tree.txt']) write(name)
    write('_not-found/index.html')
    write('404/index.html')
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  for (const needed of [
    'index.html',
    '404.html',
    'showcase/index.html',
    'storybook/index.html',
    'storybook/iframe.html',
  ])
    it(`refuses a folder with no ${needed}`, async () => {
      fs.rmSync(p(needed))
      await refused(`${needed} is missing`)
    })

  it('refuses pages with no assets folder: the pages would load unstyled', async () => {
    fs.rmSync(p('_next/static'), { recursive: true })
    await refused('_next/static is missing')
  })

  it('refuses a page that is a folder where a file belongs', async () => {
    fs.rmSync(p('index.html'))
    fs.mkdirSync(p('index.html'))
    await refused('index.html is missing')
  })
})

describe('developer-site-check.sh: nothing that leads out of the folder', () => {
  it('refuses a link, to a file or to a folder, anywhere', async () => {
    fs.symlinkSync('/etc/hostname', p('storybook/assets/hostname.txt'))
    await refused('a link: storybook/assets/hostname.txt')
    fs.rmSync(p('storybook/assets/hostname.txt'))
    fs.symlinkSync('/etc', p('storybook/etc'))
    await refused('a link: storybook/etc')
  })

  it('refuses a link at the top, even one that points inside the folder', async () => {
    fs.symlinkSync('storybook', p('alias'))
    await refused('a link: alias')
  })

  it('refuses a file that has another name elsewhere (a hard link)', async () => {
    fs.writeFileSync(path.join(dir, 'outside.txt'), 'secret\n')
    fs.linkSync(path.join(dir, 'outside.txt'), p('storybook/assets/inside.txt'))
    await refused('another name elsewhere: storybook/assets/inside.txt')
  })

  it('refuses anything that is neither a file nor a folder (a pipe)', async () => {
    expect(spawnSync('mkfifo', [p('storybook/assets/pipe')]).status).toBe(0)
    await refused('not a plain file or folder: storybook/assets/pipe')
  })
})

describe('developer-site-check.sh: nothing that is private by name', () => {
  it('refuses a dot file or dot folder, anywhere (.env, .git, .htaccess)', async () => {
    write('storybook/.env')
    await refused('hidden name: storybook/.env')
    fs.rmSync(p('storybook/.env'))
    write('storybook/.git/config')
    await refused('hidden name: storybook/.git')
  })

  // every name, as written and in upper case: a file system that ignores case serves both
  const privateNames = [
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
  ]
  for (const name of new Set([...privateNames, ...privateNames.map((n) => n.toUpperCase())]))
    it(`refuses ${name}`, async () => {
      write(`storybook/assets/${name}`)
      await refused(`a file that is never public: storybook/assets/${name}`)
    })

  it('accepts names that only look like them', async () => {
    write('storybook/assets/keyboard.js')
    write('storybook/assets/database.html')
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  it('refuses a file anyone could write to', async () => {
    fs.chmodSync(p('storybook/assets/app.js'), 0o666)
    await refused('writable by anyone: storybook/assets/app.js')
  })

  it('refuses a file only "others" can write to, and accepts one only its group can', async () => {
    fs.chmodSync(p('storybook/assets/app.js'), 0o646)
    await refused('writable by anyone: storybook/assets/app.js')
    fs.chmodSync(p('storybook/assets/app.js'), 0o664)
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  it('refuses a folder anyone could write to', async () => {
    fs.chmodSync(p('storybook/assets'), 0o777)
    await refused('writable by anyone: storybook/assets')
  })
})

describe('developer-site-check.sh: size and fonts', () => {
  it('refuses a folder over the size cap, and accepts one at it', async () => {
    write('storybook/assets/big.js', 'x'.repeat(5000))
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
    expect(code).toBe(0) // 100 MiB by default: the storybook is about 15 MB
  })

  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com'])
    it(`refuses a file that names ${host}: the font is served from here`, async () => {
      write('storybook/assets/app.css', `@font-face{src:url(https://${host}/s/x.woff2)}\n`)
      await refused('names a third-party font host: storybook/assets/app.css')
    })

  it('is not clean when the folder could not be searched for them', async () => {
    fs.mkdirSync(path.join(dir, 'bin'))
    fs.writeFileSync(path.join(dir, 'bin/grep'), '#!/bin/sh\nexit 2\n', { mode: 0o755 })
    const { code, out } = await check(p(), { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` })
    expect(code).toBe(1)
    expect(out).toContain('could not be read to look for font hosts')
  })

  it('reads a file with a stray NUL byte too, so one byte cannot hide a font host', async () => {
    fs.writeFileSync(p('storybook/assets/f.js'), Buffer.from('x\0fonts.gstatic.com\0', 'latin1'))
    await refused('names a third-party font host: storybook/assets/f.js')
  })

  it('refuses a font host in any letter case', async () => {
    write('storybook/assets/app.css', '@import "https://Fonts.GoogleAPIs.com/css";\n')
    await refused('names a third-party font host: storybook/assets/app.css')
  })

  it('accepts a font file that names no host', async () => {
    fs.writeFileSync(p('storybook/assets/f.woff2'), Buffer.from('wOF2\0\x01poppins', 'latin1'))
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  // The developer pages carry the site's faces too, as Next.js names a font it copies into `_next/static/media/`
  describe('the developer pages’ faces', () => {
    const under = 'poppins_latin_400_normal'
    const bare = () => {
      fs.rmSync(p('_next/static/media'), { recursive: true })
      writePagesFonts(p(), { withSiteFont: false })
    }

    it('refuses pages that carry none of the site’s faces, naming each one', async () => {
      bare()
      const { code, out } = await check()
      expect(code, out).toBe(1)
      for (const name of siteFaces())
        expect(out).toContain(`the developer pages are missing the site's font: ${name}`)
    })

    it('names the one face that is missing, and only that one', async () => {
      fs.rmSync(p(`_next/static/media/${under}-s.p.14nztc_w4mkh_.woff2`))
      const { code, out } = await check()
      expect(code).toBe(1)
      expect(out.match(/the developer pages are missing/g)).toHaveLength(1)
      expect(out).toContain(
        "the developer pages are missing the site's font: poppins-latin-400-normal\n",
      )
    })

    it('wants the latin-ext faces too, which Next.js names without the preload suffix', async () => {
      fs.rmSync(p('_next/static/media/poppins_latin_ext_700_italic.3akwhu8439i8g.woff2'))
      await refused("the developer pages are missing the site's font: poppins-latin-ext-700-italic")
    })

    it('does not take a latin face for its latin-ext twin', async () => {
      fs.rmSync(p(`_next/static/media/${under}-s.p.14nztc_w4mkh_.woff2`))
      write(`_next/static/media/poppins_latin_ext_400_normal-s.p.x.woff2`)
      await refused("the developer pages are missing the site's font: poppins-latin-400-normal")
    })

    for (const [why, name] of [
      ['a name that only ends in woff2', `${under}-hwoff2`],
      ['the older woff format', `${under}-h.woff`],
      ['a name with no hash after the face', `${under}.woff2`],
      ['a name with something before the face', `x${under}-h.woff2`],
    ])
      it(`does not count ${why}`, async () => {
        fs.rmSync(p(`_next/static/media/${under}-s.p.14nztc_w4mkh_.woff2`))
        write(`_next/static/media/${name}`, 'x')
        await refused("the developer pages are missing the site's font: poppins-latin-400-normal")
      })

    it('does not count a face anywhere but in _next/static/media', async () => {
      fs.rmSync(p(`_next/static/media/${under}-s.p.14nztc_w4mkh_.woff2`))
      write(`showcase/${under}-h.woff2`)
      await refused("the developer pages are missing the site's font: poppins-latin-400-normal")
    })

    it('counts a face in any letter case', async () => {
      bare()
      for (const name of siteFaces())
        write(`_next/static/media/${name.replaceAll('-', '_').toUpperCase()}-S.P.AbC.WOFF2`)
      const { code, out } = await check()
      expect(code, out).toBe(0)
    })

    it('asks nothing of a Storybook showcase that is not there, and still wants the pages’ faces', async () => {
      fs.rmSync(p('storybook'), { recursive: true })
      bare()
      await refused("the developer pages are missing the site's font")
    })
  })

  // The Storybook showcase must carry the site's own faces, the ones in src/platform/theme/fonts/ (the one list),
  // which Vite copies into the build as `<face>-<hash>.woff2`. Storybook's own Nunito Sans files are in
  // every build, so any font file is not enough: a build without the site's faces fell back to another
  // source, or to no font at all.
  const storybookFont = (name) => p('storybook', name)
  const only = (name) => {
    fs.rmSync(p('storybook'), { recursive: true })
    write('storybook/index.html')
    write('storybook/iframe.html')
    writeShowcaseFonts(p('storybook'), { withSiteFont: false })
    if (name) {
      fs.mkdirSync(path.dirname(storybookFont(name)), { recursive: true })
      fs.writeFileSync(storybookFont(name), 'wOF2')
    }
  }
  const face = 'poppins-latin-400-normal'

  it('reads twenty faces, in two subsets, from the theme’s font folder', () => {
    expect(siteFaces()).toHaveLength(20)
    expect(siteFaces().filter((name) => name.includes('latin-ext'))).toHaveLength(10)
  })

  it('accepts a real build: the site’s faces beside Storybook’s own fonts', async () => {
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  it('refuses a Storybook showcase that carries its own Nunito Sans files and none of the site’s', async () => {
    only()
    const { code, out } = await check()
    expect(code, out).toBe(1)
    for (const name of siteFaces())
      expect(out).toContain(`the Storybook showcase is missing the site's font: ${name}`)
  })

  it('names the one face that is missing, and only that one', async () => {
    fs.rmSync(p(`storybook/assets/${face}-C8OXljZJ.woff2`))
    const { code, out } = await check()
    expect(code).toBe(1)
    expect(out.match(/missing the site's font/g)).toHaveLength(1)
    expect(out).toContain(`the site's font: ${face}\n`)
  })

  it('wants the latin-ext faces too, not only the latin ones', async () => {
    fs.rmSync(p('storybook/assets/poppins-latin-ext-700-italic-C8OXljZJ.woff2'))
    await refused("the Storybook showcase is missing the site's font: poppins-latin-ext-700-italic")
  })

  it('counts a face in any letter case, at any depth of the storybook', async () => {
    only()
    let i = 0
    for (const name of siteFaces())
      write(
        i++ % 2
          ? `storybook/deep/er/${name.toUpperCase()}-AbC.WOFF2`
          : `storybook/${name}-x_-9.woff2`,
      )
    const { code, out } = await check()
    expect(code, out).toBe(0)
  })

  for (const [why, build] of [
    [
      'a folder named like the file',
      (n) => fs.mkdirSync(p(`storybook/assets/${n}-h.woff2`), { recursive: true }),
    ],
    ['the older woff format', (n) => write(`storybook/assets/${n}-h.woff`, 'x')],
    ['a name that only ends in woff2', (n) => write(`storybook/assets/${n}-hwoff2`, 'x')],
    ['a name with no hash after the face', (n) => write(`storybook/assets/${n}.woff2`, 'x')],
    ['a name with no dash before the hash', (n) => write(`storybook/assets/${n}h.woff2`, 'x')],
    ['a name with something before the face', (n) => write(`storybook/assets/x${n}-h.woff2`, 'x')],
    ['a file outside the storybook', (n) => write(`${n}-h.woff2`, 'x')],
  ])
    it(`does not count ${why}`, async () => {
      fs.rmSync(p(`storybook/assets/${face}-C8OXljZJ.woff2`))
      build(face)
      await refused(`the Storybook showcase is missing the site's font: ${face}`)
    })

  it('refuses when the theme’s font folder is not where the release has it', async () => {
    const release = path.join(dir, 'release')
    fs.mkdirSync(path.join(release, 'ops'), { recursive: true })
    for (const f of ['developer-site-check.sh', 'environment.sh'])
      fs.copyFileSync(path.join(OPS, f), path.join(release, 'ops', f))
    const { code, out } = await new Promise((resolve) => {
      const child = spawn('bash', [path.join(release, 'ops/developer-site-check.sh'), p()], {
        env: { PATH: process.env.PATH },
      })
      let text = ''
      child.stdout.on('data', (d) => (text += d))
      child.stderr.on('data', (d) => (text += d))
      child.on('close', (c) => resolve({ code: c, out: text }))
    })
    expect(code).toBe(1)
    expect(out).toContain("the site's font files are not at")
  })
})

describe('developer-site-check.sh --source: the release’s own storybook, before it is copied', () => {
  const source = (folder = p('storybook')) =>
    new Promise((resolve) => {
      const child = spawn('bash', [path.join(OPS, 'developer-site-check.sh'), '--source', folder], {
        env: { PATH: process.env.PATH },
      })
      let out = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (out += d))
      child.on('close', (code) => resolve({ code, out }))
    })

  it('accepts a storybook with no link, and needs no index page or 404 page beside it', async () => {
    fs.rmSync(p('index.html'))
    const { code, out } = await source()
    expect(code, out).toBe(0)
    expect(out).toContain('no link in it')
  })

  it('refuses a link, a hard link and a pipe', async () => {
    fs.symlinkSync('/etc/hostname', p('storybook/assets/l.txt'))
    fs.writeFileSync(path.join(dir, 'outside.txt'), 'x\n')
    fs.linkSync(path.join(dir, 'outside.txt'), p('storybook/assets/h.txt'))
    expect(spawnSync('mkfifo', [p('storybook/assets/pipe')]).status).toBe(0)
    const { code, out } = await source()
    expect(code).toBe(1)
    expect(out).toContain('a link: assets/l.txt')
    expect(out).toContain('another name elsewhere: assets/h.txt')
    expect(out).toContain('not a plain file or folder: assets/pipe')
  })

  it('leaves the other rules to the check of the folder that is served', async () => {
    write('storybook/assets/payload.db')
    expect((await source()).code).toBe(0)
  })

  it('refuses no folder, a missing folder and a link in place of the folder', async () => {
    expect((await source(p('nothing'))).code).toBe(1)
    fs.symlinkSync(p('storybook'), p('..', 'link'))
    expect((await source(p('..', 'link'))).code).toBe(1)
  })
})

describe('developer-site-check.sh: it reports every problem and never a file’s content', () => {
  it('lists each problem it finds, not only the first', async () => {
    write('notes.txt', 'SECRET-CONTENT')
    write('storybook/.env', 'SECRET-CONTENT')
    const { code, out } = await check()
    expect(code).toBe(1)
    expect(out).toContain('notes.txt')
    expect(out).toContain('storybook/.env')
    expect(out).not.toContain('SECRET-CONTENT')
  })
})
