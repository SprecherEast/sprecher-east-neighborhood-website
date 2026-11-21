// The shared checks of ops/preview-access-lib.sh that more than one root script uses (#1397): the free-disk
// floor, "root's, and only root can write it", and the lookup of a node root may run. Each script's own tests
// cover how it uses them; these cover the rule once, where it is defined.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'

const UID = process.getuid()
let dir
beforeEach(() => (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'access-lib-'))))
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))
const p = (...parts) => path.join(dir, ...parts)

/** Runs a line of bash with the library loaded; the test's own user stands in for root. */
const lib = (line, env = {}) =>
  spawnSync(
    'bash',
    ['-c', `refuse() { echo "$1" >&2; exit 1; }; . "${OPS}/preview-access-lib.sh"; ${line}`],
    {
      env: { PATH: process.env.PATH, PREVIEW_ACCESS_ROOT_UID: String(UID), ...env },
      encoding: 'utf8',
    },
  )
const makeFile = (name, mode) => {
  fs.writeFileSync(p(name), '#!/bin/sh\n')
  fs.chmodSync(p(name), mode)
}

describe('preview-access-lib.sh: enough_disk', () => {
  const free = () =>
    Number(execFileSync('df', ['-Pk', dir]).toString().split('\n')[1].split(/\s+/)[3])

  it('is true when the bytes still leave the floor, and false when they would not', () => {
    const floor = Math.max(0, free() - 4096)
    expect(lib(`enough_disk "${dir}" 1024`, { PREVIEW_FREE_FLOOR_KB: String(floor) }).status).toBe(
      0,
    )
    expect(
      lib(`enough_disk "${dir}" ${16 * 1024 * 1024}`, { PREVIEW_FREE_FLOOR_KB: String(floor) })
        .status,
    ).toBe(1)
  })

  it('is false when the floor alone is above the free space, and when the folder cannot be measured', () => {
    expect(lib(`enough_disk "${dir}" 0`, { PREVIEW_FREE_FLOOR_KB: '9999999999' }).status).toBe(1)
    expect(lib(`enough_disk "${p('missing')}" 0`, { PREVIEW_FREE_FLOOR_KB: '0' }).status).toBe(1)
  })
})

describe('preview-access-lib.sh: root_only_writable', () => {
  it.each([
    [0o755, 0],
    [0o700, 0],
    [0o775, 1],
    [0o757, 1],
    [0o777, 1],
  ])('mode %o gives %i for a file of the root user', (mode, status) => {
    makeFile('f', mode)
    expect(lib(`root_only_writable "${p('f')}"`).status).toBe(status)
  })

  it('is false for a file of another user, and for a path that is not there', () => {
    makeFile('f', 0o755)
    expect(
      lib(`root_only_writable "${p('f')}"`, { PREVIEW_ACCESS_ROOT_UID: String(UID + 1) }).status,
    ).toBe(1)
    expect(lib(`root_only_writable "${p('none')}" 2>/dev/null`).status).toBe(1)
  })
})

describe('preview-access-lib.sh: trusted_tool and trusted_node', () => {
  const tool = (folder, mode = 0o755) => {
    fs.mkdirSync(p(folder), { recursive: true })
    fs.chmodSync(p(folder), 0o755)
    fs.writeFileSync(p(folder, 'node'), '#!/bin/sh\n')
    fs.chmodSync(p(folder, 'node'), mode)
  }

  it('accepts a program, its folder and its link target that only root can write', () => {
    tool('good')
    expect(lib(`trusted_tool "${p('good/node')}"`).status).toBe(0)
  })

  it('refuses one that others can write, one in a folder others can write, and one that is not a file', () => {
    tool('open-file', 0o775)
    tool('open-folder')
    fs.chmodSync(p('open-folder'), 0o777)
    fs.mkdirSync(p('dir/node'), { recursive: true })
    for (const name of ['open-file', 'open-folder', 'dir'])
      expect(lib(`trusted_tool "${p(name, 'node')}"`).status).toBe(1)
  })

  it('judges where a link leads, not the link', () => {
    tool('open-file', 0o775)
    fs.mkdirSync(p('links'), { mode: 0o755 })
    fs.symlinkSync(p('open-file/node'), p('links/node'))
    expect(lib(`trusted_tool "${p('links/node')}"`).status).toBe(1)
  })

  it('finds the first node that passes, skipping one that does not, and says none when none does', () => {
    tool('bad', 0o777)
    tool('good')
    const found = lib(`trusted_node "${p('bad')}:${p('good')}"`)
    expect(found.status).toBe(0)
    expect(found.stdout).toBe(p('good/node'))
    expect(
      lib(`trusted_node "${p('bad')}"`, { PREVIEW_ACCESS_ROOT_UID: String(UID + 1) }).stdout,
    ).toBe('')
  })
})
