// ops/preview-settings.sh (#1344): the settings file a pull request preview starts with. Its secrets
// are made on the server for that preview alone, and the third-party keys are the test ones, so
// nothing a preview runs can sign anyone in on production or reach a real service.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TEST_SITE_KEY } from './environment-harness.mjs'
import { OPS, write } from './umami-harness.mjs'

const SCRIPT = path.join(OPS, 'preview-settings.sh')
const SITE_KEY = TEST_SITE_KEY // Cloudflare's published always-pass test keys
const SECRET_KEY = '1x0000000000000000000000000000000AA'

let dir = ''
const p = (...parts) => path.join(dir, ...parts)

/** Runs the script for preview `number` (default 7) with the preview root and `extra` env set. */
function run(number = '7', extra = {}) {
  return spawnSync('bash', [SCRIPT], {
    env: {
      PATH: process.env.PATH,
      PREVIEW_ROOT: p('previews'),
      ...(number === null ? {} : { PREVIEW_NUMBER: number }),
      ...extra,
    },
    encoding: 'utf8',
  })
}
const settingsOf = (number = '7') => p('previews', `pr-${number}`, '.env.local')
const read = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-settings-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('a new preview’s settings', () => {
  it('holds the test keys, its own address and database, and nothing real', () => {
    expect(run().status).toBe(0)
    expect(read(settingsOf())).toMatchObject({
      NEXT_PUBLIC_SERVER_URL: 'https://pr-7.dev.sprechereast.com',
      DATABASE_URI: 'file:./data/payload.db',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: SITE_KEY,
      TURNSTILE_SECRET_KEY: SECRET_KEY,
      CONTACT_NOTIFY_EMAIL: 'preview@example.com',
    })
  })

  it('sets no mail, analytics, GitHub or sign-in keys', () => {
    run()
    const names = Object.keys(read(settingsOf()))
    for (const name of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS',
      'NEXT_PUBLIC_UMAMI_WEBSITE_ID',
      'GITHUB_READ_TOKEN',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'PASSKEYS_ENABLED',
      'TURNSTILE_ALLOWED_HOSTNAMES',
    ])
      expect(names).not.toContain(name)
  })

  it('has random secrets of 32 or more characters, and keeps the file private', () => {
    run()
    const s = read(settingsOf())
    expect(s.PAYLOAD_SECRET).toMatch(/^[0-9a-f]{64}$/)
    expect(s.PREVIEW_SECRET).toMatch(/^[0-9a-f]{64}$/)
    expect(s.PAYLOAD_SECRET).not.toBe(s.PREVIEW_SECRET)
    expect(fs.statSync(settingsOf()).mode & 0o777).toBe(0o600)
    expect(fs.readdirSync(p('previews/pr-7'))).toEqual(['.env.local']) // no temp file left behind
  })

  it('shares no secret with another preview', () => {
    run('7')
    run('8')
    const [a, b] = [read(settingsOf('7')), read(settingsOf('8'))]
    expect(a.PAYLOAD_SECRET).not.toBe(b.PAYLOAD_SECRET)
    expect(a.PREVIEW_SECRET).not.toBe(b.PREVIEW_SECRET)
  })

  it('uses no value from the caller’s environment', () => {
    run('7', {
      PAYLOAD_SECRET: 'from-the-caller',
      SMTP_HOST: 'smtp.example.test',
      TURNSTILE_SECRET_KEY: 'real-secret',
      NEXT_PUBLIC_SERVER_URL: 'https://sprechereast.com',
    })
    const text = fs.readFileSync(settingsOf(), 'utf8')
    for (const word of ['from-the-caller', 'smtp.example.test', 'real-secret', 'sprechereast.com/'])
      expect(text).not.toContain(word)
    expect(read(settingsOf()).NEXT_PUBLIC_SERVER_URL).toBe('https://pr-7.dev.sprechereast.com')
  })

  it('copies nothing from production’s settings', () => {
    const production = p('production/.env.local')
    write(production, 'PAYLOAD_SECRET=production-secret\nSMTP_PASS=production-mail-password\n')
    run('7', { APP_DIR: p('production'), ENV_FILE: production })
    const text = fs.readFileSync(settingsOf(), 'utf8')
    expect(text).not.toContain('production-secret')
    expect(text).not.toContain('production-mail-password')
  })
})

describe('a redeploy of the same preview', () => {
  it('keeps its secrets, so nobody is signed out', () => {
    run()
    const first = read(settingsOf())
    expect(run().status).toBe(0)
    expect(read(settingsOf())).toEqual(first)
  })

  it('puts the file back to private if it was opened up', () => {
    run()
    fs.chmodSync(settingsOf(), 0o644)
    run()
    expect(fs.statSync(settingsOf()).mode & 0o777).toBe(0o600)
  })

  it.each([
    ['a missing secret', (t) => t.replace(/^PAYLOAD_SECRET=.*\n/m, '')],
    ['a short secret', (t) => t.replace(/^PREVIEW_SECRET=.*$/m, 'PREVIEW_SECRET=short')],
    ['a real Turnstile key', (t) => t.replace(SECRET_KEY, 'a-real-turnstile-secret')],
    ['a mail server', (t) => `${t}SMTP_HOST=smtp.example.test\n`],
    ['an analytics ID', (t) => `${t}NEXT_PUBLIC_UMAMI_WEBSITE_ID=abc\n`],
    [
      'another address',
      (t) => t.replace(/^(NEXT_PUBLIC_SERVER_URL=).*$/m, '$1https://sprechereast.com'),
    ],
  ])('stops, naming no value, when the kept file has %s', (_, change) => {
    run()
    fs.writeFileSync(settingsOf(), change(fs.readFileSync(settingsOf(), 'utf8')))
    const r = run()
    expect(r.status).not.toBe(0)
    expect(r.stdout + r.stderr).toContain('::error title=Server::')
    expect(r.stdout + r.stderr).not.toMatch(/smtp\.example\.test|a-real-turnstile-secret|abc/)
  })
})

describe('what it refuses', () => {
  it.each([null, '', '0', '007', '1x', '12345678', '-1', '7; touch x'])(
    'preview number %j',
    (number) => {
      const r = run(number)
      expect(r.status).not.toBe(0)
      expect(fs.existsSync(p('previews'))).toBe(false)
    },
  )

  it('a root that is production’s folder', () => {
    const r = run('7', { PREVIEW_ROOT: '/var/www/sprecher-east' })
    expect(r.status).not.toBe(0)
  })

  it('never prints a generated secret', () => {
    const r = run()
    const s = read(settingsOf())
    expect(r.stdout + r.stderr).not.toContain(s.PAYLOAD_SECRET)
    expect(r.stdout + r.stderr).not.toContain(s.PREVIEW_SECRET)
  })

  it('stops, writing no file, when openssl fails', () => {
    const bin = p('bin')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'openssl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    const r = run('7', { PATH: `${bin}:${process.env.PATH}` })
    expect(r.status).not.toBe(0)
    expect(r.stdout + r.stderr).toContain('::error title=Server::')
    expect(fs.existsSync(settingsOf())).toBe(false)
  })
})

describe('a kept file must be exactly what the script writes', () => {
  const kept = () => {
    run()
    return fs.readFileSync(settingsOf(), 'utf8')
  }
  const hex = 'a'.repeat(64)
  it.each([
    ['a colon-style extra setting', (t) => `${t}SMTP_HOST: smtp.example.test\n`],
    ['a byte-order mark before a line', (t) => `﻿SMTP_HOST=x\n${t}`],
    ['a no-break space before a line', (t) => `${t} SMTP_HOST=x\n`],
    [
      'a lone carriage return in a line',
      (t) => t.replace('preview@example.com', 'a@b.c\rSMTP_HOST=x'),
    ],
    [
      'decoy secrets inside a quoted value',
      (t) =>
        t.replace(
          'CONTACT_NOTIFY_EMAIL=preview@example.com',
          `CONTACT_NOTIFY_EMAIL="x\nPAYLOAD_SECRET=${hex}\nTURNSTILE_SECRET_KEY=${SECRET_KEY}\n`,
        ),
    ],
    [
      'production’s database',
      (t) => t.replace('file:./data/payload.db', 'file:/var/www/sprecher-east/data/payload.db'),
    ],
    ['a real contact address', (t) => t.replace('preview@example.com', 'board@example.org')],
    ['a repeated secret line', (t) => `${t}PAYLOAD_SECRET=${hex}\n`],
  ])('stops on %s', (_name, change) => {
    fs.writeFileSync(settingsOf(), change(kept()))
    const r = run()
    expect(r.status).not.toBe(0)
    expect(r.stdout + r.stderr).toContain('::error title=Server::')
    expect(r.stdout + r.stderr).not.toMatch(/smtp\.example\.test|board@example\.org|a{64}/)
  })

  it('accepts its own file unchanged', () => {
    const before = kept()
    expect(run().status).toBe(0)
    expect(fs.readFileSync(settingsOf(), 'utf8')).toBe(before)
  })
})

describe('links to production', () => {
  const productionFile = () => {
    const file = p('production', '.env.local')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'PAYLOAD_SECRET=real\n', { mode: 0o640 })
    return file
  }

  it('refuses a settings file that links elsewhere, and leaves the target alone', () => {
    const target = productionFile()
    fs.mkdirSync(path.dirname(settingsOf()), { recursive: true })
    fs.symlinkSync(target, settingsOf())
    const r = run()
    expect(r.status).not.toBe(0)
    expect(fs.statSync(target).mode & 0o777).toBe(0o640)
    expect(fs.readFileSync(target, 'utf8')).toBe('PAYLOAD_SECRET=real\n')
  })

  it('refuses a preview folder that links elsewhere, and writes nothing into it', () => {
    productionFile()
    fs.mkdirSync(p('previews'), { recursive: true })
    fs.symlinkSync(p('production'), p('previews', 'pr-7'))
    const r = run()
    expect(r.status).not.toBe(0)
    expect(fs.readdirSync(p('production'))).toEqual(['.env.local'])
    expect(fs.statSync(p('production', '.env.local')).mode & 0o777).toBe(0o640)
    expect(fs.readFileSync(p('production', '.env.local'), 'utf8')).toBe('PAYLOAD_SECRET=real\n')
  })

  it('refuses a hard link to production’s file without changing its mode', () => {
    const target = productionFile()
    fs.mkdirSync(path.dirname(settingsOf()), { recursive: true })
    fs.linkSync(target, settingsOf())
    expect(run().status).not.toBe(0)
    expect(fs.statSync(target).mode & 0o777).toBe(0o640)
  })

  it('refuses a preview folder that links to an empty folder, and writes nothing into it', () => {
    fs.mkdirSync(p('elsewhere'))
    fs.mkdirSync(p('previews'), { recursive: true })
    fs.symlinkSync(p('elsewhere'), p('previews', 'pr-7'))
    expect(run().status).not.toBe(0)
    expect(fs.readdirSync(p('elsewhere'))).toEqual([])
  })
})
