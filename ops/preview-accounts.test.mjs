// ops/preview-accounts.sh (#1393): the random passwords of a pull request preview's test accounts. Made on
// every deploy, by main's copy of the script, into one private file in the preview's own folder; the
// preview's seed (src/endpoints/seed/preview-database.ts) reads that file. The deploy log is public, so
// no value may reach any output.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'

const SCRIPT = path.join(OPS, 'preview-accounts.sh')
const ROLES = ['admin', 'editor', 'resident', 'guest']

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const fileOf = (number = '7') => p('previews', `pr-${number}`, '.preview-accounts')

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
const read = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('=')),
  )
const output = (r) => r.stdout + r.stderr

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-accounts-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('a preview’s account passwords', () => {
  it('makes one random 64-character password per role, in a private file of the preview’s own folder', () => {
    const r = run()
    expect(r.status, output(r)).toBe(0)
    const passwords = read(fileOf())
    expect(Object.keys(passwords)).toEqual(ROLES)
    for (const password of Object.values(passwords)) expect(password).toMatch(/^[0-9a-f]{64}$/)
    expect(new Set(Object.values(passwords)).size).toBe(ROLES.length)
    expect(fs.statSync(fileOf()).mode & 0o777).toBe(0o600)
    expect(fs.readdirSync(p('previews/pr-7'))).toEqual(['.preview-accounts']) // no temp file left behind
  })

  it('prints no password, whatever it says', () => {
    const r = run()
    expect(output(r)).toContain('::notice') // it does report
    for (const password of Object.values(read(fileOf()))) expect(output(r)).not.toContain(password)
  })

  it('makes new passwords on every deploy, so the old ones stop working', () => {
    run()
    const first = read(fileOf())
    expect(run().status).toBe(0)
    const second = read(fileOf())
    for (const role of ROLES) expect(second[role]).not.toBe(first[role])
    expect(fs.statSync(fileOf()).mode & 0o777).toBe(0o600)
  })

  it('shares no password with another preview', () => {
    run('7')
    run('8')
    const [a, b] = [read(fileOf('7')), read(fileOf('8'))]
    for (const role of ROLES) expect(a[role]).not.toBe(b[role])
  })

  it('puts nothing in the data folder, the release or the settings file', () => {
    fs.mkdirSync(p('previews/pr-7/data'), { recursive: true })
    fs.mkdirSync(p('previews/pr-7/releases/r1'), { recursive: true })
    fs.writeFileSync(p('previews/pr-7/.env.local'), 'A=1\n')
    run()
    expect(fs.readdirSync(p('previews/pr-7/data'))).toEqual([])
    expect(fs.readdirSync(p('previews/pr-7/releases/r1'))).toEqual([])
    expect(fs.readFileSync(p('previews/pr-7/.env.local'), 'utf8')).toBe('A=1\n')
  })

  it('replaces a file that was opened up with a private one', () => {
    run()
    fs.chmodSync(fileOf(), 0o644)
    run()
    expect(fs.statSync(fileOf()).mode & 0o777).toBe(0o600)
  })

  it('refuses to run for production (no preview named), and writes nothing', () => {
    const r = run(null, { APP_DIR: p('production') })
    expect(r.status).not.toBe(0)
    expect(output(r)).toContain('::error title=Server::')
    expect(fs.existsSync(p('production'))).toBe(false)
  })

  it('takes no value from the caller’s environment', () => {
    run('7', { PREVIEW_ACCOUNTS_FILE: p('elsewhere'), APP_DIR: p('production') })
    expect(fs.existsSync(p('elsewhere'))).toBe(false)
    expect(fs.existsSync(p('production'))).toBe(false)
    expect(fs.existsSync(fileOf())).toBe(true)
  })

  it('refuses a link at the preview’s folder or file, before anything is written', () => {
    fs.mkdirSync(p('elsewhere'))
    fs.mkdirSync(p('previews'))
    fs.symlinkSync(p('elsewhere'), p('previews/pr-7'))
    expect(run().status).not.toBe(0)
    expect(fs.readdirSync(p('elsewhere'))).toEqual([])
    fs.rmSync(p('previews/pr-7'))
    fs.mkdirSync(p('previews/pr-7'))
    fs.writeFileSync(p('elsewhere/target'), 'keep')
    fs.symlinkSync(p('elsewhere/target'), fileOf())
    const r = run()
    expect(r.status).not.toBe(0)
    expect(fs.readFileSync(p('elsewhere/target'), 'utf8')).toBe('keep')
  })

  it('refuses a folder where the file belongs, and moves nothing into it', () => {
    fs.mkdirSync(fileOf(), { recursive: true })
    const r = run()
    expect(r.status).not.toBe(0)
    expect(fs.readdirSync(fileOf())).toEqual([]) // not moved into it
    expect(fs.readdirSync(p('previews/pr-7')).filter((f) => f.startsWith('.accounts.'))).toEqual([])
  })

  it('stops, writing nothing, when it can’t make a random value', () => {
    const bin = p('bin')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'openssl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    const r = run('7', { PATH: `${bin}:${process.env.PATH}` })
    expect(r.status).not.toBe(0)
    expect(output(r)).toContain('::error title=Server::')
    expect(fs.existsSync(fileOf())).toBe(false)
  })
})

describe('the role list', () => {
  it('is the same in the deploy script’s settings and in the seed’s one constant', () => {
    const env = fs.readFileSync(path.join(OPS, 'environment.sh'), 'utf8')
    const shell = /^PREVIEW_ACCOUNT_ROLES="([^"]*)"/m.exec(env)?.[1].split(' ')
    const ts = fs.readFileSync(
      path.join(OPS, '..', 'src/endpoints/seed/preview-accounts.ts'),
      'utf8',
    )
    const roles = /PREVIEW_ACCOUNT_ROLES = \[([^\]]*)\]/.exec(ts)?.[1]
    expect(shell).toEqual(ROLES)
    expect(
      roles
        ?.split(',')
        .map((r) => r.trim().replace('ROLES.', ''))
        .filter(Boolean),
    ).toEqual(ROLES)
  })
})
