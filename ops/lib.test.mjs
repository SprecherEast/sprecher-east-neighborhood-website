// ops/lib.sh helpers shared by the deploy, the rollback, the preview scripts and the developer site (#1459):
// the atomic link switch and the Caddy block placement, called directly.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const stub = (name, body) => {
  fs.mkdirSync(p('bin'), { recursive: true })
  fs.writeFileSync(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 })
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-'))
  fs.mkdirSync(p('app/releases/r1'), { recursive: true })
  fs.mkdirSync(p('app/releases/r2'))
  fs.mkdirSync(p('blocks'))
  fs.writeFileSync(p('Caddyfile'), '# main\n')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

// Runs bash with lib.sh sourced; `script` is the body.
const lib = (script, env = {}) =>
  spawnSync('bash', ['-c', `. "${OPS}/lib.sh"\n${script}`], {
    encoding: 'utf8',
    env: {
      PATH: `${p('bin')}:${process.env.PATH}`,
      APP_DIR: p('app'),
      CADDYFILE: p('Caddyfile'),
      ...env,
    },
  })

describe('point_link_at and point_current_at', () => {
  it('points the link with a hidden temporary link named after it, renamed over the old one', () => {
    stub('mv', 'echo "mv $*" >> "$STUB_LOG"; exec /bin/mv "$@"')
    stub('ln', 'echo "ln $*" >> "$STUB_LOG"; exec /bin/ln "$@"')
    const r = lib(`point_link_at "${p('app/serving')}" releases/r1`, { STUB_LOG: p('log') })
    expect(r.status, r.stderr).toBe(0)
    expect(fs.readlinkSync(p('app/serving'))).toBe('releases/r1')
    expect(fs.readFileSync(p('log'), 'utf8').split('\n').filter(Boolean)).toEqual([
      `ln -sfn releases/r1 ${p('app/.serving-new')}`,
      `mv -Tf ${p('app/.serving-new')} ${p('app/serving')}`,
    ])
    expect(fs.readdirSync(p('app')).sort()).toEqual(['releases', 'serving'])
  })

  it('switches a link that already exists, leaving no temporary link', () => {
    fs.symlinkSync('releases/r1', p('app/current'))
    const r = lib('point_link_at "$APP_DIR/current" releases/r2')
    expect(r.status, r.stderr).toBe(0)
    expect(fs.readlinkSync(p('app/current'))).toBe('releases/r2')
    expect(fs.readdirSync(p('app')).sort()).toEqual(['current', 'releases'])
  })

  it('point_current_at switches `current` in APP_DIR to the target it is given', () => {
    const r = lib('point_current_at releases/r2')
    expect(r.status, r.stderr).toBe(0)
    expect(fs.readlinkSync(p('app/current'))).toBe('releases/r2')
  })
})

describe('origin_curl', () => {
  it('asks Caddy on this machine for the origin’s name and port, and fails with no origin, without calling curl', () => {
    stub('curl', 'echo "curl $*" >> "$STUB_LOG"')
    const none = lib('origin_curl "" /x', { STUB_LOG: p('log') })
    expect(none.status).toBe(1)
    expect(fs.existsSync(p('log'))).toBe(false)
    const r = lib('origin_curl https://dev.example.com /x -o /dev/null', { STUB_LOG: p('log') })
    expect(r.status, r.stderr).toBe(0)
    expect(fs.readFileSync(p('log'), 'utf8')).toBe(
      'curl -s --max-time 15 --resolve dev.example.com:443:127.0.0.1 -o /dev/null https://dev.example.com/x\n',
    )
  })
})

describe('caddy_place_block', () => {
  beforeEach(() => {
    stub('caddy', 'exit 0')
    // Caddy would not reload the first time it is asked
    stub(
      'reload',
      '[ -f "$STUB_STATE" ] && exit 0; touch "$STUB_STATE"; [ -z "$STUB_RELOAD_FAILS_ONCE" ] || exit 1',
    )
  })
  const place = (twice) => `
    echo new > "${p('blocks/a.tmp')}"
    caddy_place_block "${p('blocks/a.tmp')}" "${p('blocks/a.caddy')}"; echo "first=$? problem=$CADDY_BLOCK_PROBLEM"
    ${twice ? `echo newer > "${p('blocks/b.tmp')}"; caddy_place_block "${p('blocks/b.tmp')}" "${p('blocks/a.caddy')}"; echo "second=$? problem=$CADDY_BLOCK_PROBLEM"` : ''}
  `

  it('forgets the first call’s problem and previous copy when it is called again in the same shell', () => {
    const r = lib(place(true), {
      RELOAD_CADDY: p('bin/reload'),
      STUB_STATE: p('state'),
      STUB_RELOAD_FAILS_ONCE: '1',
    })
    expect(r.stdout).toContain('first=1 problem=reload')
    expect(r.stdout).toContain('second=0 problem=\n')
    expect(fs.readFileSync(p('blocks/a.caddy'), 'utf8')).toBe('newer\n')
  })

  it('has no previous copy to put back when there was no block before, and none is left', () => {
    const r = lib(`${place(false)}\necho "previous=[$CADDY_BLOCK_PREVIOUS]"`, {
      RELOAD_CADDY: p('bin/reload'),
      STUB_STATE: p('state'),
    })
    expect(r.stdout).toContain('first=0 problem=')
    expect(r.stdout).toContain('previous=[]')
    expect(fs.readdirSync(p('blocks'))).toEqual(['a.caddy'])
  })

  it('puts an empty previous block back as it was', () => {
    fs.writeFileSync(p('blocks/a.caddy'), '')
    const r = lib(place(false), {
      RELOAD_CADDY: p('bin/reload'),
      STUB_STATE: p('state'),
      STUB_RELOAD_FAILS_ONCE: '1',
    })
    expect(r.stdout).toContain('first=1 problem=reload')
    expect(fs.existsSync(p('blocks/a.caddy'))).toBe(true)
    expect(fs.readFileSync(p('blocks/a.caddy'), 'utf8')).toBe('')
  })
})
