// ops/preview-copy.sh (#1397): the root step of a preview's content copy. It snapshots production's database,
// runs the export from production's release, links the media the export lists and prints the export's file.
// Each guard has a test that fails without it. `payload`, `backup-db.mjs`, `sudo` and `id` are stand-ins that
// work on files in a temp tree shaped like the server's; real root, real sudo and the real export are checked
// on the server and by the export's own tests.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { OPS, write } from './umami-harness.mjs'
import { setUpPreviewAccessHarness } from './preview-access-harness.mjs'

const { p, log, baseEnv } = setUpPreviewAccessHarness()
const UID = String(process.getuid())
// The preview account: the test's own user, or `nobody` when the tests run as root (root's id is never a preview's).
const PREVIEW_USER = process.getuid() === 0 ? 'nobody' : os.userInfo().username
const PREVIEW_UID = Number(execFileSync('id', ['-u', PREVIEW_USER]).toString())
const SECRET_TEXT = 'SECRET-POST-TEXT-9f3'
const SECRET_DB = 'SECRET-DATABASE-BYTES-7c1'
const SECRET_ENV = 'PRODUCTION-ONLY-SETTING-55'

/** Builds the stand-in production: a current release with the export's pieces, a database and media. */
function buildProduction() {
  const release = p('prod/releases/r1')
  write(p('prod/data/payload.db'), SECRET_DB)
  write(p('prod/releases/r1/e2e/previewCopyExport.ts'), '// export\n')
  // The backup script: copies the database, like VACUUM INTO, and says what it ran from.
  write(
    p('prod/releases/r1/ops/backup-db.mjs'),
    `import fs from 'node:fs'
fs.appendFileSync(process.env.STUB_LOG, 'backup ' + process.argv[3].startsWith(process.env.PREVIEW_COPY_TMP + '/run.') + '\\n')
if (process.env.STUB_BACKUP_FAILS) { console.error('${SECRET_DB} boom'); process.exit(1) }
fs.copyFileSync(process.argv[2], process.argv[3])
`,
  )
  // `payload run e2e/previewCopyExport.ts`: records where and how it ran, then writes the file like the export does.
  write(
    p('prod/releases/r1/node_modules/.bin/payload'),
    `const fs = require('node:fs')
// the export runs with an empty environment: what a test sets for it is in this file
const conf = JSON.parse(fs.readFileSync('${p('conf.json')}', 'utf8'))
const e = { ...process.env, ...conf, STUB_LOG: '${p('log')}' }
const snapshot = e.DATABASE_URI.replace('file:', '')
fs.appendFileSync(e.STUB_LOG, ['payload', process.argv.slice(2).join(' '), 'cwd=' + process.cwd(),
  'snapshot=' + (fs.existsSync(snapshot) ? fs.readFileSync(snapshot, 'utf8') : 'missing'),
  'smtp=[' + (e.SMTP_HOST ?? 'unset') + ']', 'secret=' + (e.PAYLOAD_SECRET === 'PROD-SECRET' ? 'production' : 'other'),
  'prodenv=' + (e.PRODUCTION_ONLY ?? 'unset'), 'node_env=' + e.NODE_ENV,
  'workmode=' + (fs.statSync(require('node:path').dirname(snapshot)).mode & 0o777).toString(8)].join(' ') + '\\n')
if (e.STUB_EXPORT_FAILS) {
  console.error('${SECRET_TEXT} ${SECRET_DB} secret@example.com')
  console.log('${SECRET_TEXT} secret@example.com')
  process.exit(1)
}
const names = JSON.parse(e.STUB_MEDIA ?? '[]')
fs.writeFileSync(e.PREVIEW_COPY_FILE, JSON.stringify({ format: 1, collections: { posts: [{ id: 1, title: '${SECRET_TEXT}' }] }, globals: {}, mediaFiles: names }), { flag: 'wx' })
console.log('Environments: .env.local ${SECRET_ENV}')
console.log('preview copy: exported posts 1; 0 references left out')
`,
  )
  fs.symlinkSync('releases/r1', p('prod/current'))
  write(p('prod/public/media/a.jpg'), 'AAA', 0o644)
  write(p('prod/public/media/a-400x300.jpg'), 'AAA-small', 0o644)
  write(p('prod/public/media/unlisted.jpg'), 'UNLISTED', 0o644)
  write(p('prod/public/media/odd mode.jpg'), 'ODD', 0o664)
  write(p('prod/public/media/private.jpg'), 'PRIVATE', 0o600)
  fs.symlinkSync(p('prod/data/payload.db'), p('prod/public/media/link.jpg'))
  void release
  // a file made under the test's umask would not have these modes
  for (const [name, mode] of [
    ['a.jpg', 0o644],
    ['a-400x300.jpg', 0o644],
    ['odd mode.jpg', 0o664],
    ['private.jpg', 0o600],
  ])
    fs.chmodSync(p('prod/public/media', name), mode)
}

/** The preview's folder as the wrapper leaves it: an empty staging folder for media. */
function buildPreview(n = '7') {
  fs.mkdirSync(p(`previews/pr-${n}/.copy-media`), { recursive: true, mode: 0o750 })
  if (process.getuid() === 0)
    fs.chownSync(p(`previews/pr-${n}/.copy-media`), PREVIEW_UID, PREVIEW_UID)
}

const prepare = () => {
  buildProduction()
  buildPreview()
  fs.mkdirSync(p('copytmp'), { mode: 0o700 })
  fs.chmodSync(p('copytmp'), 0o700)
}

const copyEnv = (extra = {}) => {
  fs.writeFileSync(
    p('conf.json'),
    JSON.stringify({
      STUB_MEDIA: JSON.stringify(['a.jpg', 'a-400x300.jpg']),
      CADDY_LOCK_FILE: p('caddy/.lock'),
      ...Object.fromEntries(
        Object.entries(extra).filter(([k]) => k.startsWith('STUB_') && k !== 'STUB_UID'),
      ),
    }),
  )
  return baseEnv({
    PRODUCTION_DIR_FOR_TESTS: p('prod'),
    PREVIEW_COPY_TMP: p('copytmp'),
    PREVIEW_ACCESS_ROOT_UID: UID,
    PREVIEW_USER,
    CADDY_LOCK_FILE: p('caddy/.lock'),
    CADDY_LOCK_WAIT: '1',
    STUB_MEDIA: JSON.stringify(['a.jpg', 'a-400x300.jpg']),
    PRODUCTION_ONLY: SECRET_ENV,
    ...extra,
  })
}

/** Runs the installed copy script, keeping standard output (the export's file) apart from standard error. */
function copy(args = ['7'], extra = {}) {
  return new Promise((resolve) => {
    const child = spawn('/bin/bash', [p('access/ops/preview-copy.sh'), ...args], {
      env: copyEnv(extra),
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end()
  })
}
const staging = () => p('previews/pr-7/.copy-media')
const entries = (dir) => fs.readdirSync(dir).sort()

describe('preview-copy.sh: what it hands out', () => {
  it('prints the export’s file on standard output and nothing else there', async () => {
    prepare()
    const { code, stdout, stderr } = await copy()
    expect(code, stderr).toBe(0)
    const file = JSON.parse(stdout)
    expect(file.format).toBe(1)
    expect(file.collections.posts[0].title).toBe(SECRET_TEXT)
  })

  it('says only numbers and fixed texts on standard error: no content, name, path or password', async () => {
    prepare()
    const { stderr } = await copy()
    expect(stderr).toContain('2 media files linked, 0 copied, 0 left out')
    expect(stderr).toContain('preview copy: exported posts 1')
    for (const secret of [
      SECRET_TEXT,
      SECRET_DB,
      SECRET_ENV,
      'a-400x300',
      p('copytmp'),
      'Environments',
    ]) {
      expect(stderr).not.toContain(secret)
    }
  })

  it('shows no export or backup output on a failure, only a fixed reason', async () => {
    prepare()
    const failed = await copy(['7'], { STUB_EXPORT_FAILS: '1' })
    expect(failed.code).toBe(1)
    expect(failed.stdout).toBe('')
    expect(failed.stderr).toContain('the export failed')
    const backup = await copy(['7'], { STUB_BACKUP_FAILS: '1' })
    expect(backup.code).toBe(1)
    for (const out of [failed, backup]) {
      for (const secret of [SECRET_TEXT, SECRET_DB, 'secret@example.com']) {
        expect(out.stdout + out.stderr).not.toContain(secret)
      }
    }
  })
})

describe('preview-copy.sh: the snapshot', () => {
  it('is made by production’s backup script, into a private folder inside the root-only one, and exported from production’s release', async () => {
    prepare()
    await copy()
    const text = log()
    expect(text).toContain('backup true')
    expect(text).toContain(
      `payload run e2e/previewCopyExport.ts cwd=${fs.realpathSync(p('prod/releases/r1'))}`,
    )
    expect(text).toContain(`snapshot=${SECRET_DB}`)
    expect(text).toContain('workmode=700')
    expect(text).toContain('node_env=production')
  })

  it('runs the export with no mail setting and none of production’s settings or secrets', async () => {
    prepare()
    await copy()
    expect(log()).toContain('smtp=[]')
    expect(log()).toContain('secret=other')
    expect(log()).toContain('prodenv=unset')
  })

  it('leaves the snapshot folder empty after a success', async () => {
    prepare()
    expect((await copy()).code).toBe(0)
    expect(entries(p('copytmp'))).toEqual([])
  })

  it.each([
    ['the snapshot cannot be made', { STUB_BACKUP_FAILS: '1' }],
    ['the export fails', { STUB_EXPORT_FAILS: '1' }],
    ['the export lists nothing a file could be', { STUB_MEDIA: '"not a list"' }],
  ])('leaves the snapshot folder empty when %s', async (_, env) => {
    prepare()
    const { code } = await copy(['7'], env)
    expect(code).not.toBe(0)
    expect(entries(p('copytmp'))).toEqual([])
  })

  it('leaves it empty when the media step fails after the export', async () => {
    prepare()
    fs.rmSync(staging(), { recursive: true })
    const { code } = await copy()
    expect(code).toBe(1)
    expect(entries(p('copytmp'))).toEqual([])
  })

  it('removes the folder of an earlier run that was killed, before it starts', async () => {
    prepare()
    write(p('copytmp/run.OLD/snapshot.db'), SECRET_DB)
    expect((await copy()).code).toBe(0)
    expect(entries(p('copytmp'))).toEqual([])
  })

  it('removes the snapshot as soon as the export ends: the media step runs without it', async () => {
    prepare()
    // a media step that fails leaves nothing, and the export saw the snapshot while it ran
    await copy()
    expect(log()).toContain(`snapshot=${SECRET_DB}`)
    expect(entries(p('copytmp'))).toEqual([])
  })

  it('stops when the snapshot folder is not private to root, is a link, or is missing', async () => {
    prepare()
    fs.chmodSync(p('copytmp'), 0o755)
    expect((await copy()).code).toBe(1)
    fs.chmodSync(p('copytmp'), 0o700)
    fs.renameSync(p('copytmp'), p('real-copytmp'))
    fs.symlinkSync(p('real-copytmp'), p('copytmp'))
    expect((await copy()).code).toBe(1)
    fs.rmSync(p('copytmp'))
    expect((await copy()).code).toBe(1)
    expect(log()).not.toContain('backup')
  })

  it('stops before anything is made when the free disk would fall under production’s floor', async () => {
    prepare()
    const { code, stderr } = await copy(['7'], { PREVIEW_FREE_FLOOR_KB: '9999999999' })
    expect(code).toBe(1)
    expect(stderr).toContain('not enough free disk')
    expect(log()).not.toContain('backup')
  })

  it('stops when production has no current release, no export script or no database', async () => {
    for (const remove of [
      () => fs.rmSync(p('prod/current')),
      () => fs.rmSync(p('prod/releases/r1/e2e/previewCopyExport.ts')),
      () => fs.rmSync(p('prod/data/payload.db')),
    ]) {
      prepare()
      remove()
      expect((await copy()).code).toBe(1)
      expect(log()).not.toContain('backup')
      fs.rmSync(p('prod'), { recursive: true })
      fs.rmSync(p('previews'), { recursive: true })
      fs.mkdirSync(p('previews'))
      fs.rmSync(p('copytmp'), { recursive: true })
    }
  })

  it('refuses a current release outside production’s releases folder', async () => {
    prepare()
    fs.mkdirSync(p('elsewhere'))
    fs.cpSync(p('prod/releases/r1'), p('elsewhere/r1'), { recursive: true })
    fs.rmSync(p('prod/current'))
    fs.symlinkSync(p('elsewhere/r1'), p('prod/current'))
    expect((await copy()).code).toBe(1)
    expect(log()).not.toContain('backup')
  })

  it('runs only a node that root owns and only root can write', async () => {
    prepare()
    const { code, stderr } = await copy(['7'], { PREVIEW_ACCESS_ROOT_UID: String(Number(UID) + 1) })
    expect(code).toBe(1)
    expect(stderr).toContain('node was not found')
    expect(log()).not.toContain('backup')
  })
})

describe('preview-copy.sh: the media', () => {
  const inode = (...parts) => fs.statSync(p(...parts)).ino

  it('hard-links the files the export lists, and only those', async () => {
    prepare()
    await copy()
    expect(entries(staging())).toEqual(['a-400x300.jpg', 'a.jpg'])
    expect(inode('previews/pr-7/.copy-media/a.jpg')).toBe(inode('prod/public/media/a.jpg'))
    expect(fs.statSync(staging() + '/a.jpg').nlink).toBe(2)
    expect(fs.existsSync(staging() + '/unlisted.jpg')).toBe(false)
  })

  it('keeps production’s owner and mode on a link, so the preview can read it and not change it', async () => {
    prepare()
    await copy()
    const link = fs.statSync(staging() + '/a.jpg')
    expect(link.mode & 0o777).toBe(0o644)
    expect(link.uid).toBe(fs.statSync(p('prod/public/media/a.jpg')).uid)
    expect(link.mode & 0o022).toBe(0)
  })

  it('leaves production’s file untouched when the preview deletes its link, and when it replaces it', async () => {
    prepare()
    await copy()
    fs.rmSync(staging() + '/a.jpg')
    expect(fs.readFileSync(p('prod/public/media/a.jpg'), 'utf8')).toBe('AAA')
    expect(fs.statSync(p('prod/public/media/a.jpg')).nlink).toBe(1)
    // the way Payload replaces a picture: delete the old file, then write a new one under the name
    fs.writeFileSync(staging() + '/a.jpg', 'NEW')
    expect(fs.readFileSync(p('prod/public/media/a.jpg'), 'utf8')).toBe('AAA')
  })

  it('refuses an in-place write to a link as any account that is not its owner', async () => {
    if (process.getuid() === 0) return // root writes anything: the account's side is the isolation check's
    prepare()
    fs.chmodSync(p('prod/public/media/a.jpg'), 0o444)
    await copy()
    expect(() => fs.appendFileSync(staging() + '/a.jpg', 'X')).toThrow(/EACCES/)
    expect(fs.readFileSync(p('prod/public/media/a.jpg'), 'utf8')).toBe('AAA')
  })

  it('copies, never links, a file that is writable by others or not readable by them', async () => {
    prepare()
    const { stderr } = await copy(['7'], {
      STUB_MEDIA: JSON.stringify(['a.jpg', 'odd mode.jpg', 'private.jpg']),
    })
    expect(stderr, stderr).toContain('1 media files linked, 2 copied')
    for (const name of ['odd mode.jpg', 'private.jpg']) {
      expect(inode('previews/pr-7/.copy-media', name)).not.toBe(inode('prod/public/media', name))
      expect(fs.statSync(`${staging()}/${name}`).mode & 0o777).toBe(0o644)
    }
    expect(fs.readFileSync(p('prod/public/media/odd mode.jpg'), 'utf8')).toBe('ODD')
  })

  it('counts a copy against the disk floor', async () => {
    prepare()
    write(p('prod/public/media/private.jpg'), Buffer.alloc(4 * 1024 * 1024), 0o600)
    const free = Number(
      (await import('node:child_process'))
        .execFileSync('df', ['-Pk', p('copytmp')])
        .toString()
        .split('\n')[1]
        .trim()
        .split(/\s+/)[3],
    )
    // room for the snapshot, but a floor so close to the free space that no file may be copied
    const { code, stderr } = await copy(['7'], {
      STUB_MEDIA: JSON.stringify(['private.jpg']),
      PREVIEW_FREE_FLOOR_KB: String(free - 2048),
    })
    expect(code).toBe(1)
    expect(stderr).toContain('copy the media')
    expect(entries(staging())).toEqual([])
  })

  it('leaves out a name that is not a plain file name, and one that is not a regular file', async () => {
    prepare()
    write(p('outside.jpg'), 'OUTSIDE')
    const names = [
      '../../outside.jpg',
      '/etc/passwd',
      '-rf',
      'a/b.jpg',
      '.hidden',
      'link.jpg',
      'missing.jpg',
      'a.jpg',
    ]
    const { code, stderr } = await copy(['7'], { STUB_MEDIA: JSON.stringify(names) })
    expect(code).toBe(0)
    expect(stderr).toContain('1 media files linked, 0 copied, 7 left out')
    expect(entries(staging())).toEqual(['a.jpg'])
    expect(entries(p('previews/pr-7')).sort()).toEqual(['.copy-media'])
    expect(fs.readFileSync(p('prod/data/payload.db'), 'utf8')).toBe(SECRET_DB)
  })

  it('lists a name once however often the export names it', async () => {
    prepare()
    const { stderr } = await copy(['7'], { STUB_MEDIA: JSON.stringify(['a.jpg', 'a.jpg']) })
    expect(stderr).toContain('1 media files linked')
  })

  it('hands the staging folder back to the preview account, with the files still not its own to change', async () => {
    prepare()
    await copy()
    const dir = fs.statSync(staging())
    expect(dir.uid).toBe(PREVIEW_UID)
    expect(dir.mode & 0o777).toBe(0o750)
  })

  it('never follows a link where the staging folder should be', async () => {
    prepare()
    fs.mkdirSync(p('victim'))
    fs.rmSync(staging(), { recursive: true })
    fs.symlinkSync(p('victim'), staging())
    const { code } = await copy()
    expect(code).toBe(1)
    expect(entries(p('victim'))).toEqual([])
    expect(fs.lstatSync(staging()).isSymbolicLink()).toBe(true)
  })

  it('does not wait on a pipe put where the staging folder should be', async () => {
    prepare()
    fs.rmSync(staging(), { recursive: true })
    execFileSync('mkfifo', [staging()])
    const { code } = await copy()
    expect(code).toBe(1)
    expect(entries(p('copytmp'))).toEqual([])
  })

  it('refuses a staging folder that already holds something, and empties it before handing it back', async () => {
    prepare()
    write(p('previews/pr-7/.copy-media/planted.jpg'), 'PLANTED')
    const { code } = await copy()
    expect(code).toBe(1)
    expect(entries(staging())).toEqual([])
  })

  it('refuses a preview folder that is a link', async () => {
    prepare()
    fs.renameSync(p('previews/pr-7'), p('real-pr-7'))
    fs.symlinkSync(p('real-pr-7'), p('previews/pr-7'))
    expect((await copy()).code).toBe(1)
    expect(entries(p('real-pr-7/.copy-media'))).toEqual([])
  })

  it('does nothing with media when the export lists none', async () => {
    prepare()
    fs.rmSync(p('prod/public/media'), { recursive: true })
    const { code } = await copy(['7'], { STUB_MEDIA: '[]' })
    expect(code).toBe(0)
    expect(entries(staging())).toEqual([])
  })
})

describe('preview-copy.sh: one number, one at a time, as root', () => {
  it.each([[[]], [['7', '8']], [['0']], [['07']], [['x']], [['7;id']], [['-7']], [['1234567']]])(
    'refuses %j and runs nothing',
    async (args) => {
      prepare()
      const { code, stdout } = await copy(args)
      expect(code).toBe(2)
      expect(stdout).toBe('')
      expect(log()).not.toContain('backup')
    },
  )

  it('runs under the lock the Caddy scripts share: it waits for a held lock, and holds it while it runs', async () => {
    prepare()
    const holder = spawn('flock', [p('caddy/.lock'), 'sleep', '5'])
    await new Promise((r) => setTimeout(r, 300))
    const blocked = await copy()
    expect(blocked.code).toBe(1)
    expect(blocked.stderr).toContain('another change is running')
    expect(log()).not.toContain('backup')
    holder.kill()
  })

  it('holds the lock while the export runs', async () => {
    prepare()
    // the stand-in export tries the lock; a held lock makes `flock -n` fail
    const stub = p('prod/releases/r1/node_modules/.bin/payload')
    fs.appendFileSync(
      stub,
      "fs.appendFileSync(e.STUB_LOG, 'lock-free=' + (require('node:child_process').spawnSync('flock', ['-n', e.CADDY_LOCK_FILE, 'true']).status === 0) + '\\n')\n",
    )
    await copy()
    expect(log()).toContain('lock-free=false')
  })

  // Every variable environment.sh, lib.sh or this script reads from the caller that could redirect it.
  const REFUSED_AS_ROOT = [
    'PREVIEW_ROOT',
    'PREVIEW_DOMAIN',
    'PREVIEW_CADDY_DIR',
    'PREVIEW_PORT_MIN',
    'PREVIEW_PORT_MAX',
    'PREVIEW_MAX_COUNT',
    'PREVIEW_ACCESS_DIR',
    'PREVIEW_USER',
    'PREVIEW_FREE_FLOOR_KB',
    'PREVIEW_COPY_TMP',
    'PREVIEW_COPY_MAX_BYTES',
    'PREVIEW_ACCESS_ROOT_UID',
    'PRODUCTION_DIR_FOR_TESTS',
    'CADDYFILE',
    'CADDY_LOCK_FILE',
    'CADDY_LOCK_WAIT',
    'CODE_DIR',
    'APP_DIR',
  ]
  it('keeps its list of refused variables equal to the one these tests cover', () => {
    const text = fs.readFileSync(path.join(OPS, 'preview-copy.sh'), 'utf8')
    const list = text
      .match(/refuse_environment_as_root ([\s\S]+?)\n\n/)[1]
      .replaceAll('\\\n', ' ')
      .split(/\s+/)
      .filter(Boolean)
    expect(list.sort()).toEqual([...REFUSED_AS_ROOT].sort())
  })

  it.each(REFUSED_AS_ROOT)('run as root, refuses %s from the environment', async (name) => {
    prepare()
    const env = {
      PATH: `${p('bin')}:${process.env.PATH}`,
      STUB_LOG: p('log'),
      STUB_UID: '0',
      [name]: '/tmp/somewhere',
    }
    const { code, out } = await new Promise((resolve) => {
      const child = spawn('/bin/bash', [p('access/ops/preview-copy.sh'), '7'], { env })
      let text = ''
      child.stdout.on('data', (d) => (text += d))
      child.stderr.on('data', (d) => (text += d))
      child.on('close', (c) => resolve({ code: c, out: text }))
      child.stdin.end()
    })
    expect(code).toBe(2)
    expect(out).toContain(`sets ${name}`)
    expect(log()).not.toContain('backup')
  })
})

describe('preview-copy.sh: it runs as root on its own PATH (the caller’s is never used)', () => {
  const text = fs.readFileSync(path.join(OPS, 'preview-copy.sh'), 'utf8')

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

  it('never runs a program planted on the caller’s PATH, for any tool it uses', async () => {
    prepare()
    const names =
      'id realpath dirname readlink basename flock find mktemp cat rm cp ln chmod chown stat df awk grep mapfile env getent bash sort head tail tr date openssl node sudo'.split(
        ' ',
      )
    fs.mkdirSync(p('evil'))
    for (const name of names)
      fs.writeFileSync(p('evil', name), `#!/bin/sh\necho ${name} >> "${p('planted')}"\n`, {
        mode: 0o755,
      })
    await new Promise((resolve) => {
      const child = spawn('/bin/bash', [p('access/ops/preview-copy.sh'), '7'], {
        env: { ...copyEnv(), PATH: `${p('evil')}:${copyEnv().PATH}` },
      })
      child.on('close', resolve)
      child.stdin.end()
    })
    expect(fs.existsSync(p('planted'))).toBe(false)
  })
})
