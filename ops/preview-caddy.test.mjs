// ops/preview-caddy.sh (#1345): the one script the restricted preview account may run as root, with
// one pull request number. Each guard has a test that fails without it. `caddy`, `sudo` and the Caddy
// reload are stand-ins (ops/preview-access-harness.mjs); real Caddy is checked on the server.
import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

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
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
  })

  it('refuses a file path with characters a Caddy block could not hold safely', async () => {
    makePreview()
    fs.copyFileSync(p('caddy/headers.caddy'), p('caddy/head ers {x}.caddy'))
    const { code, out } = await caddyScript(['7'], {
      PREVIEW_HEADERS_FILE: p('caddy/head ers {x}.caddy'),
    })
    expect(code).toBe(2)
    expect(out).toContain('characters')
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
  })

  it('refuses a template that leaves a placeholder unfilled', async () => {
    makePreview()
    fs.appendFileSync(p('access/ops/caddy/preview-site.caddy'), '# __PREVIEW_NOPE__\n')
    const { code } = await caddyScript(['7'])
    expect(code).toBe(2)
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
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
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
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

  it.each([
    'RELOAD_CADDY',
    'CADDYFILE',
    'PREVIEW_CADDY_DIR',
    'PREVIEW_ROOT',
    'LIMITS_FILE',
    'PREVIEW_ACCESS_DIR',
    'PREVIEW_HEADERS_FILE',
    'PREVIEW_PORT_MIN',
    'APP_DIR',
    'CODE_DIR',
    'PREVIEW_NUMBER',
  ])('run as root, refuses %s from the environment', async (name) => {
    makePreview()
    const env = {
      PATH: `${p('bin')}:${process.env.PATH}`,
      STUB_LOG: p('log'),
      STUB_UID: '0',
      [name]: '/tmp/x',
    }
    const { code, out } = await runCommand('bash', [p('access/ops/preview-caddy.sh'), '7'], { env })
    expect(code).toBe(2)
    expect(out).toContain(`sets ${name}`)
  })
})

describe('preview-caddy.sh: Caddy is never left worse off', () => {
  it('an invalid block never reaches the previews folder, and nothing reloads', async () => {
    makePreview()
    const { code, out } = await caddyScript(['7'], { STUB_CADDY_REJECTS: 'pr-7.dev' })
    expect(code).toBe(2)
    expect(out).toContain('Caddy rejected the block')
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
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
    expect(folderEntries()).toEqual(['.preview-caddy.lock', 'pr-7.caddy'])
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
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
    expect(reloads()).toBe(2)
  })

  it('leaves everything alone when the Caddyfile does not validate before any change', async () => {
    makePreview()
    const { code, out } = await caddyScript(['7'], { STUB_CADDY_REJECTS: 'sprechereast.com' })
    expect(code).toBe(2)
    expect(out).toContain('does not validate')
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
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
    expect(folderEntries()).toEqual(['.preview-caddy.lock'])
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

  it('does not touch another preview’s block', async () => {
    makePreview('8')
    await caddyScript(['8'])
    const { code } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(folderEntries()).toEqual(['.preview-caddy.lock', 'pr-8.caddy'])
  })

  it('treats a link at the preview’s folder as no folder, never following it', async () => {
    fs.mkdirSync(p('elsewhere'))
    fs.symlinkSync(p('elsewhere'), p('previews/pr-7'))
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# the block\n')
    const { code } = await caddyScript(['7'])
    expect(code).toBe(0)
    expect(folderEntries()).toEqual(['.preview-caddy.lock']) // removed, not (re)written
  })
})
