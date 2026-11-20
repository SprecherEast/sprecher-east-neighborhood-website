// ops/preview-caddy.sh (#1345): the one script the restricted preview account may run as root, with
// one pull request number. Each guard has a test that fails without it. `caddy`, `sudo` and the Caddy
// reload are stand-ins (ops/preview-access-harness.mjs); real Caddy is checked on the server.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'
import { runCommand, setUpPreviewAccessHarness } from './preview-access-harness.mjs'

const { p, log, caddyScript } = setUpPreviewAccessHarness()
const block = () => fs.readFileSync(p('caddy/previews/pr-7.caddy'), 'utf8')
const folderEntries = () => fs.readdirSync(p('caddy/previews')).sort()
const makePreview = (n = '7') => fs.mkdirSync(p(`previews/pr-${n}/releases`), { recursive: true })
const reloads = () =>
  log()
    .split('\n')
    .filter((l) => l.startsWith('reload')).length

describe('preview-caddy.sh: the block comes from main', () => {
  it('writes the preview’s block from the installed template, address, port and shared files', async () => {
    makePreview()
    const { code, out } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(out).toContain('preview 7')
    expect(block()).toContain('pr-7.dev.sprechereast.com {')
    expect(block()).toContain(`import ${p('caddy/headers.caddy')}`)
    expect(block()).toContain(`import ${p('caddy/limits.caddy')}`)
    expect(block()).toContain('reverse_proxy 127.0.0.1:3207')
    expect(block()).not.toContain('__')
    expect(reloads()).toBe(1)
  })

  it('uses main’s template, not a file of the pull request, even a hostile one in the preview’s folder', async () => {
    makePreview()
    const hostile = 'evil.example {\n\trespond "pwned"\n}\n'
    for (const where of [
      'previews/pr-7/releases/r1/ops/caddy/preview-site.caddy',
      'previews/pr-7/ops/caddy/preview-site.caddy',
      'previews/pr-7/releases/r1/ops/caddy/preview-headers.caddy',
    ]) {
      fs.mkdirSync(p(where, '..'), { recursive: true })
      fs.writeFileSync(p(where), hostile)
    }
    fs.writeFileSync(
      p('access/ops/caddy/preview-site.caddy'),
      '# main\n__PREVIEW_HOST__ {\n\timport __PREVIEW_HEADERS_FILE__\n\treverse_proxy 127.0.0.1:__PREVIEW_PORT__\n\timport __LIMITS_FILE__\n}\n',
    )
    const { code } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(block()).toContain('# main')
    expect(block()).not.toContain('evil')
    expect(block()).not.toContain('pwned')
  })

  it('refuses when the headers file on the server is not main’s copy', async () => {
    makePreview()
    fs.writeFileSync(p('caddy/headers.caddy'), '# someone else’s\n')
    const { code, out } = await caddyScript(['7'])
    expect(code).toBe(2)
    expect(out).toContain('not main')
    expect(folderEntries()).toEqual([])
  })

  it('refuses a file path with characters a Caddy block could not hold safely', async () => {
    makePreview()
    fs.copyFileSync(p('caddy/headers.caddy'), p('caddy/head ers {x}.caddy'))
    const { code, out } = await caddyScript(['7'], {
      PREVIEW_HEADERS_FILE: p('caddy/head ers {x}.caddy'),
    })
    expect(code).toBe(2)
    expect(out).toContain('characters')
    expect(folderEntries()).toEqual([])
  })

  it('refuses a template that leaves a placeholder unfilled', async () => {
    makePreview()
    fs.appendFileSync(p('access/ops/caddy/preview-site.caddy'), '# __PREVIEW_NOPE__\n')
    const { code } = await caddyScript(['7'])
    expect(code).toBe(2)
    expect(folderEntries()).toEqual([])
  })

  it('refuses when the Caddyfile does not import the previews folder', async () => {
    makePreview()
    fs.writeFileSync(
      p('caddy/Caddyfile'),
      'sprechereast.com {\n\treverse_proxy localhost:3000\n}\n',
    )
    const { code, out } = await caddyScript(['7'])
    expect(code).toBe(2)
    expect(out).toContain('does not import')
    expect(folderEntries()).toEqual([])
  })

  it('does nothing, and does not reload, when the block is already as it should be', async () => {
    makePreview()
    await caddyScript(['7'])
    const again = await caddyScript(['7'])
    expect(again.code).toBe(0)
    expect(again.out).toContain('already in place')
    expect(reloads()).toBe(1)
  })
})

describe('preview-caddy.sh: it takes one pull request number and nothing else', () => {
  const hostile = [
    '',
    '0',
    '01',
    '-1',
    '+7',
    '7 ',
    ' 7',
    '7\n',
    '7\n8',
    '1234567',
    '--help',
    '-n',
    '--',
    '7;id',
    '7 && id',
    '$(id)',
    '`id`',
    '7|id',
    '../7',
    '7/../../etc',
    '/etc/passwd',
    '7.caddy',
    '٣',
    '7\0',
    'pr-7',
    '7x',
    '*',
    '{7}',
    '7#',
    "7'",
    '7"',
  ].filter((v) => !v.includes('\0')) // a NUL can't be an argument at all
  it.each(hostile.map((v) => [JSON.stringify(v), v]))(
    'refuses %s and changes nothing',
    async (_, value) => {
      makePreview()
      const { code } = await caddyScript([value])
      expect(code).toBe(2)
      expect(folderEntries()).toEqual([])
      expect(log()).toBe('')
    },
  )

  it('refuses no argument, and more than one', async () => {
    makePreview()
    expect((await caddyScript([])).code).toBe(2)
    expect((await caddyScript(['7', '8'])).code).toBe(2)
    expect((await caddyScript(['7', '--extra'])).code).toBe(2)
    expect(folderEntries()).toEqual([])
    expect(log()).toBe('')
  })

  it('run as root, refuses an environment that points it elsewhere', async () => {
    makePreview()
    const { code, out } = await caddyScript(['7'], { STUB_UID: '0' }) // the base environment sets PREVIEW_ROOT and the rest
    expect(code).toBe(2)
    expect(out).toContain('the environment sets')
    expect(folderEntries()).toEqual([])
  })

  // Every variable environment.sh or lib.sh reads from the caller that could redirect the script.
  const REFUSED_AS_ROOT = [
    'PREVIEW_ROOT',
    'PREVIEW_DOMAIN',
    'PREVIEW_CADDY_DIR',
    'PREVIEW_PORT_MIN',
    'PREVIEW_PORT_MAX',
    'PREVIEW_MAX_COUNT',
    'PREVIEW_ACCESS_DIR',
    'PREVIEW_HEADERS_FILE',
    'LIMITS_FILE',
    'CADDYFILE',
    'CADDY_LOCK_FILE',
    'CADDY_LOCK_WAIT',
    'RELOAD_CADDY',
    'CODE_DIR',
  ]
  it('keeps its list of refused variables equal to the one these tests cover', () => {
    const text = fs.readFileSync(path.join(OPS, 'preview-caddy.sh'), 'utf8')
    const list = text
      .match(/for name in ([^;]+); do/)[1]
      .replaceAll('\\\n', ' ')
      .split(/\s+/)
      .filter(Boolean)
    expect(list.sort()).toEqual([...REFUSED_AS_ROOT].sort())
  })
  it.each(REFUSED_AS_ROOT)('run as root, refuses %s from the environment', async (name) => {
    makePreview()
    const env = {
      PATH: `${p('bin')}:${process.env.PATH}`,
      STUB_LOG: p('log'),
      STUB_UID: '0',
      [name]: '/tmp/x',
    }
    const { code, out } = await runCommand('/bin/bash', [p('access/ops/preview-caddy.sh'), '7'], {
      env,
    })
    expect(code).toBe(2)
    expect(out).toContain(`sets ${name}`)
  })
})

describe('preview-caddy.sh: it runs as root on its own PATH (the caller’s is never used)', () => {
  const text = fs.readFileSync(path.join(OPS, 'preview-caddy.sh'), 'utf8')

  it('starts with an absolute shebang in privileged mode and sets PATH and locale before anything runs', () => {
    expect(text.split('\n')[0]).toBe('#!/bin/bash -p')
    const code = text.split('\n').filter((l) => l && !l.startsWith('#'))
    expect(code.slice(0, 5)).toEqual([
      'SECURE_PATH=/usr/sbin:/usr/bin:/sbin:/bin',
      'PATH=$SECURE_PATH',
      'export PATH',
      'LC_ALL=C',
      'export LC_ALL',
    ])
  })

  it('uses the PATH environment.sh names for sudo’s secure_path', () => {
    const env = fs.readFileSync(path.join(OPS, 'environment.sh'), 'utf8')
    expect(env).toContain('ROOT_SECURE_PATH="${ROOT_SECURE_PATH:-/usr/sbin:/usr/bin:/sbin:/bin}"')
  })

  it('never runs a program planted on the caller’s PATH, for any tool it uses', async () => {
    makePreview()
    const names =
      'id realpath dirname readlink basename caddy flock find mktemp cat cmp rm mv cp chmod date sed awk grep wc systemctl bash env cut sort head tail tr'.split(
        ' ',
      )
    fs.mkdirSync(p('evil'))
    for (const name of names)
      fs.writeFileSync(p('evil', name), `#!/bin/sh\necho ${name} >> "${p('planted')}"\n`, {
        mode: 0o755,
      })
    // the real script, with a state that makes it refuse late: it has used most of its tools by then
    for (const preview of ['7', undefined]) {
      const env = { PATH: `${p('evil')}:/usr/bin:/bin`, HOME: '/nonexistent' }
      if (preview) env.PREVIEW_NUMBER = preview // the caller tries to make environment.sh run a program too
      const { out } = await runCommand('/bin/bash', [path.join(OPS, 'preview-caddy.sh'), '7'], {
        env,
      })
      expect(out).toContain('refused')
    }
    expect(fs.existsSync(p('planted')) ? fs.readFileSync(p('planted'), 'utf8') : '').toBe('')
  })
})

describe('preview-caddy.sh: Caddy is never left worse off', () => {
  it('an invalid block never reaches the previews folder, and nothing reloads', async () => {
    makePreview()
    const { code, out } = await caddyScript(['7'], { STUB_CADDY_REJECTS: 'pr-7.dev' })
    expect(code).toBe(2)
    expect(out).toContain('Caddy rejected the block')
    expect(folderEntries()).toEqual([])
    expect(reloads()).toBe(0)
  })

  it('keeps the block being checked out of the folder’s `*.caddy` import until it is valid', async () => {
    makePreview()
    await caddyScript(['7'])
    const candidateChecks = log()
      .split('\n')
      .filter((l) => l.startsWith('visible-blocks'))
    expect(candidateChecks).toEqual(['visible-blocks 0'])
  })

  it('a block Caddy accepts alone but not with the rest is taken out again, with the old one put back', async () => {
    makePreview()
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# old block\n')
    const { code, out } = await caddyScript(['7'], { STUB_WHOLE_REJECTS: 'reverse_proxy' })
    expect(code).toBe(1)
    expect(out).toContain('previous block is back')
    expect(block()).toBe('# old block\n')
    expect(folderEntries()).toEqual(['pr-7.caddy'])
  })

  it('a reload that fails puts the previous block back and reloads again', async () => {
    makePreview()
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# old block\n')
    const { code, out } = await caddyScript(['7'], { STUB_RELOAD_FAILS: 'pr-7.dev' })
    expect(code).toBe(1)
    expect(out).toContain('would not reload')
    expect(block()).toBe('# old block\n')
    expect(reloads()).toBe(2) // the failed one, then the one that restores Caddy
  })

  it('a first block whose reload fails is removed, with nothing left behind', async () => {
    makePreview()
    const { code } = await caddyScript(['7'], { STUB_RELOAD_FAILS: 'pr-7.dev' })
    expect(code).toBe(1)
    expect(folderEntries()).toEqual([])
    expect(reloads()).toBe(2)
  })

  it('leaves everything alone when the Caddyfile does not validate before any change', async () => {
    makePreview()
    const { code, out } = await caddyScript(['7'], { STUB_CADDY_REJECTS: 'sprechereast.com' })
    expect(code).toBe(2)
    expect(out).toContain('does not validate')
    expect(folderEntries()).toEqual([])
  })
})

describe('preview-caddy.sh: a preview that is gone loses its block', () => {
  it('removes the block and reloads', async () => {
    makePreview()
    await caddyScript(['7'])
    fs.rmSync(p('previews/pr-7'), { recursive: true })
    const { code, out } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(out).toContain('removed')
    expect(folderEntries()).toEqual([])
  })

  it('puts the block back when Caddy will not reload without it', async () => {
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# the block\n')
    const { code } = await caddyScript(['7'], { STUB_RELOAD_FAILS: 'zzz-never' })
    expect(code).toBe(0) // reload works: removed
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# the block\n')
    fs.writeFileSync(p('caddy/previews/pr-8.caddy'), '# keeps reload failing\n')
    const failing = await caddyScript(['7'], { STUB_RELOAD_FAILS: 'keeps reload' })
    expect(failing.code).toBe(1)
    expect(block()).toBe('# the block\n')
  })

  it('says so, and reloads nothing, when there was no block to remove', async () => {
    const { code, out } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(out).toContain('has no Caddy block')
    expect(reloads()).toBe(0)
  })

  it('does not touch another preview’s block', async () => {
    makePreview('8')
    await caddyScript(['8'])
    const { code } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(folderEntries()).toEqual(['pr-8.caddy'])
  })

  it('treats a link at the preview’s folder as no folder, never following it', async () => {
    fs.mkdirSync(p('elsewhere'))
    fs.symlinkSync(p('elsewhere'), p('previews/pr-7'))
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# the block\n')
    const { code } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(folderEntries()).toEqual([]) // removed, not (re)written
  })
})

describe('preview-caddy.sh: what it checks before it writes', () => {
  const refusedWith = async (reason, env) => {
    makePreview()
    const { code, out } = await caddyScript(['7'], env)
    expect(code).toBe(2)
    expect(out).toContain(reason)
    expect(folderEntries()).toEqual([])
    expect(reloads()).toBe(0)
  }

  it('refuses a missing previews folder', () =>
    refusedWith('previews folder is missing', { PREVIEW_CADDY_DIR: p('caddy/none') }))
  it('refuses a previews folder that is a link', async () => {
    fs.symlinkSync(p('caddy/previews'), p('caddy/linked'))
    await refusedWith('previews folder is a link', { PREVIEW_CADDY_DIR: p('caddy/linked') })
  })
  it('refuses a missing Caddyfile', () =>
    refusedWith('Caddyfile is missing', { CADDYFILE: p('caddy/none.caddyfile') }))
  it('refuses when main’s block template is missing', async () => {
    fs.rmSync(p('access/ops/caddy/preview-site.caddy'))
    await refusedWith('template is missing')
  })
  it('refuses when main’s headers copy is missing', async () => {
    fs.rmSync(p('access/ops/caddy/preview-headers.caddy'))
    await refusedWith('template is missing')
  })
  it('refuses when the form limits file is missing', () =>
    refusedWith('form limits file is missing', { LIMITS_FILE: p('caddy/none-limits.caddy') }))

  it('writes the block readable by Caddy’s own user (mode 644, not the 600 of a temporary file)', async () => {
    makePreview()
    await caddyScript(['7'])
    expect((fs.statSync(p('caddy/previews/pr-7.caddy')).mode & 0o777).toString(8)).toBe('644')
  })
})

describe('preview-caddy.sh: one change to Caddy at a time', () => {
  it('waits for the shared lock, and refuses when it does not come, changing nothing', async () => {
    makePreview()
    const holder = spawn('flock', ['-x', p('caddy/.sprecher-east-caddy.lock'), 'sleep', '5'])
    await new Promise((resolve) => setTimeout(resolve, 300))
    const { code, out } = await caddyScript(['7'], { CADDY_LOCK_WAIT: '1' })
    holder.kill()
    expect(code).toBe(2)
    expect(out).toContain('another change to Caddy is running')
    expect(folderEntries()).toEqual([])
    expect(reloads()).toBe(0)
  })

  it('two runs at once do not overlap: the second starts when the first has reloaded', async () => {
    makePreview()
    makePreview('8')
    fs.writeFileSync(
      p('bin/reload-caddy'),
      '#!/usr/bin/env bash\necho "reload-start" >> "$STUB_LOG"; sleep 1; echo "reload-end" >> "$STUB_LOG"\n',
      { mode: 0o755 },
    )
    const results = await Promise.all([caddyScript(['7']), caddyScript(['8'])])
    expect(results.map((r) => r.code)).toEqual([0, 0])
    const marks = log()
      .split('\n')
      .filter((l) => l.startsWith('reload-'))
    expect(marks).toEqual(['reload-start', 'reload-end', 'reload-start', 'reload-end'])
  })
})

describe('preview-caddy.sh: only so many previews', () => {
  const blocks = (n) => {
    for (let i = 1; i <= n; i++) fs.writeFileSync(p(`caddy/previews/pr-${i}.caddy`), '# a block\n')
  }

  it('refuses a new block beyond the maximum, changing nothing', async () => {
    makePreview('3')
    blocks(2)
    const { code, out } = await caddyScript(['3'], { PREVIEW_MAX_COUNT: '2' })
    expect(code).toBe(2)
    expect(out).toContain('as many previews as are allowed')
    expect(folderEntries()).toEqual(['pr-1.caddy', 'pr-2.caddy'])
    expect(reloads()).toBe(0)
  })

  it('still updates an existing block when the maximum is reached', async () => {
    makePreview('2')
    blocks(2)
    const { code } = await caddyScript(['2'], { PREVIEW_MAX_COUNT: '2' })
    expect(code).toBe(0)
    expect(fs.readFileSync(p('caddy/previews/pr-2.caddy'), 'utf8')).toContain(
      'pr-2.dev.sprechereast.com',
    )
  })

  it('allows one more below the maximum, and removals at any count', async () => {
    makePreview('3')
    blocks(2)
    expect((await caddyScript(['3'], { PREVIEW_MAX_COUNT: '3' })).code).toBe(0)
    expect((await caddyScript(['1'], { PREVIEW_MAX_COUNT: '1' })).code).toBe(0) // folder gone: a removal
    expect(folderEntries()).toEqual(['pr-2.caddy', 'pr-3.caddy'])
  })

  it('counts only previews’ blocks, and the default is ten', async () => {
    const env = fs.readFileSync(path.join(OPS, 'environment.sh'), 'utf8')
    expect(env).toContain('PREVIEW_MAX_COUNT="${PREVIEW_MAX_COUNT:-10}"')
    makePreview('3')
    fs.writeFileSync(p('caddy/previews/other.caddy'), '# not a preview\n')
    blocks(1)
    expect((await caddyScript(['3'], { PREVIEW_MAX_COUNT: '2' })).code).toBe(0)
  })
})

describe('preview-caddy.sh: removing a block checks the whole config too', () => {
  it('puts the block back when Caddy would not accept the config without it', async () => {
    makePreview()
    await caddyScript(['7'])
    fs.rmSync(p('previews/pr-7'), { recursive: true })
    const { code, out } = await caddyScript(['7'], { STUB_WHOLE_NEEDS: 'pr-7.caddy' })
    expect(code).toBe(1)
    expect(out).toContain('the block is back')
    expect(block()).toContain('pr-7.dev.sprechereast.com')
  })
})
