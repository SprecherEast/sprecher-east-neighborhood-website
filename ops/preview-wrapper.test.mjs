// ops/preview-wrapper.sh (#1345): the forced command of the preview deploy key. It must run the
// six actions and refuse everything else, with every value checked before use. Each guard has a
// test that fails without it. Real sshd and `restrict` are checked on the server.
import crypto from 'node:crypto'
import fs from 'node:fs'

import { write } from './umami-harness.mjs'

import { describe, expect, it } from 'vitest'

import { beforeEach } from 'vitest'

import { COMMIT, runCommand, setUpPreviewAccessHarness } from './preview-access-harness.mjs'

const { p, stub, log, wrapper, baseEnv } = setUpPreviewAccessHarness()

const COPY_TEXT =
  '{"format":1,"collections":{"posts":[{"id":1,"title":"SECRET-POST-TEXT"}]},"globals":{},"mediaFiles":["a.jpg"]}'
// The root copy script (ops/preview-copy.sh) has its own tests; here it is a stand-in that logs how it was run,
// fills the staging folder like the real one and prints the export's file on standard output.
beforeEach(() => {
  fs.writeFileSync(
    p('access/ops/preview-copy.sh'),
    [
      '#!/usr/bin/env bash',
      'echo "copy-script $* stdout-is-file:$([ "$(stat -L -c %F /proc/$$/fd/1)" = "regular empty file" ] && echo yes || echo no)" >> "$STUB_LOG"',
      '[ -z "${STUB_COPY_FAILS-}" ] || { echo "the content copy step failed" >&2; exit 1; }',
      '[ -n "${STUB_COPY_EMPTY-}" ] || { echo LINKED > "$PREVIEW_ROOT/pr-$1/.copy-media/a.jpg"; chmod 444 "$PREVIEW_ROOT/pr-$1/.copy-media/a.jpg"; }',
      `[ -n "\${STUB_COPY_EMPTY-}" ] || printf '%s' '${COPY_TEXT}'`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
})

/** A .tar.gz made by Python's tarfile, so a member can have any name or type. */
async function archive(members) {
  const script = `
import io, sys, tarfile, json
members = json.loads(sys.argv[1])
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz") as t:
    for m in members:
        info = tarfile.TarInfo(m["name"])
        info.mode = m.get("mode", 0o644)
        info.uid = m.get("uid", 0)
        info.uname = m.get("uname", "root")
        if m.get("link"):
            info.type = tarfile.SYMTYPE
            info.linkname = m["link"]
            t.addfile(info)
        else:
            data = (m["fill"] * m["repeat"] if "repeat" in m else m.get("data", "x")).encode()
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
sys.stdout.buffer.write(buf.getvalue())`
  const child = await import('node:child_process')
  return child.execFileSync('python3', ['-I', '-c', script, JSON.stringify(members)], {
    maxBuffer: 1 << 26,
  })
}
/**
 * A .tar.gz (PAX format) of GNU sparse members that hold no data but claim these real sizes: tar lists the
 * claimed size, and a size near 2^63 would wrap a signed 64-bit sum.
 */
async function sparseArchive(sizes) {
  const script = `
import io, sys, tarfile, json
sizes = json.loads(sys.argv[1])
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.PAX_FORMAT) as t:
    for i, size in enumerate(sizes):
        info = tarfile.TarInfo("GNUSparseFile.0/member%d" % i)
        data = b"0\\n".ljust(512, b"\\0")
        info.size = len(data)
        info.pax_headers = {"GNU.sparse.major": "1", "GNU.sparse.minor": "0",
                            "GNU.sparse.name": "member%d" % i, "GNU.sparse.realsize": str(size)}
        t.addfile(info, io.BytesIO(data))
sys.stdout.buffer.write(buf.getvalue())`
  const child = await import('node:child_process')
  return child.execFileSync('python3', ['-I', '-c', script, JSON.stringify(sizes.map(String))], {
    maxBuffer: 1 << 26,
  })
}
const goodArchive = () =>
  archive([
    { name: '.release-info', data: `sha=${COMMIT}\n` },
    { name: 'node_modules/.bin/next', link: '../next/bin/next' },
    { name: 'node_modules/next/bin/next', data: '#!/bin/sh\n' },
  ])
const release = (n = '7', commit = COMMIT) => p(`previews/pr-${n}/releases/${commit}`)
const sudoLines = () =>
  log()
    .split('\n')
    .filter((l) => l.startsWith('sudo'))

describe('preview-wrapper.sh: the actions', () => {
  it('facts reports public facts and no more', async () => {
    const { code, out } = await wrapper('facts')
    expect(code).toBe(0)
    expect(out).toMatch(/^node=v\d+\./m)
    expect(out).toMatch(/^account=/m)
    expect(out).toMatch(/^free_kb=\d+$/m)
    expect(out.trim().split('\n')).toHaveLength(3)
  })

  it('list shows each preview with its live commit, and skips what is not a preview', async () => {
    fs.mkdirSync(p('previews/pr-7/releases'), { recursive: true })
    fs.symlinkSync(`releases/${COMMIT}`, p('previews/pr-7/current'))
    fs.mkdirSync(p('previews/pr-12'))
    fs.mkdirSync(p('previews/pr-x'))
    fs.mkdirSync(p('previews/pr-012'))
    fs.mkdirSync(p('previews/other'))
    fs.symlinkSync(p('previews/pr-12'), p('previews/pr-99'))
    const { code, out } = await wrapper('list')
    expect(code).toBe(0)
    const lines = out.trim().split('\n')
    expect(lines.map((l) => l.split(' idle=')[0])).toEqual([
      `preview=7 commit=${COMMIT}`,
      `preview=12 commit=none`,
    ])
  })

  it('list does not report a regular file named like a preview', async () => {
    fs.mkdirSync(p('previews/pr-7'))
    fs.writeFileSync(p('previews/pr-8'), 'x')
    const { code, out } = await wrapper('list')
    expect(code).toBe(0)
    expect(out.trim()).toMatch(/^preview=7 commit=none idle=\d+ folder=yes block=no process=none$/)
  })

  it('starts with an absolute shebang and runs on its own with the locale fixed, whatever the caller sets', async () => {
    expect(fs.readFileSync(p('access/ops/preview-wrapper.sh'), 'utf8').split('\n')[0]).toBe(
      '#!/bin/bash',
    )
    // the tools see the locale through this stand-in, which sits first in the account's tool folders
    stub('df', 'echo "locale=$LC_ALL" >> "$STUB_LOG"; exec /bin/df "$@"')
    const { code } = await runCommand(p('access/ops/preview-wrapper.sh'), [], {
      env: baseEnv({ SSH_ORIGINAL_COMMAND: 'facts', LC_ALL: 'de_DE.UTF-8' }),
    })
    expect(code).toBe(0)
    expect(log()).toContain('locale=C\n')
  })

  it('upload unpacks the archive into the preview’s releases folder and leaves nothing else', async () => {
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    expect(code).toBe(0)
    expect(out).toContain('release uploaded')
    expect(fs.readFileSync(`${release()}/.release-info`, 'utf8')).toBe(`sha=${COMMIT}\n`)
    expect(fs.readlinkSync(`${release()}/node_modules/.bin/next`)).toBe('../next/bin/next')
    expect(fs.readdirSync(p('previews/pr-7/releases'))).toEqual([COMMIT])
    expect(sudoLines()).toEqual([])
  })

  it('upload replaces an earlier upload of the same commit', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(`${release()}/stale`, 'old')
    const { code } = await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    expect(code).toBe(0)
    expect(fs.existsSync(`${release()}/stale`)).toBe(false)
  })

  it('upload refuses to replace the release that is live', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.symlinkSync(`releases/${COMMIT}`, p('previews/pr-7/current'))
    fs.writeFileSync(`${release()}/marker`, 'live')
    const { code } = await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    expect(code).toBe(2)
    expect(fs.readFileSync(`${release()}/marker`, 'utf8')).toBe('live')
  })

  it('deploy asks the Caddy script for the block with the number alone, then runs main’s deploy script on the release', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(
      p('access/ops/deploy-release.sh'),
      '#!/usr/bin/env bash\necho "deploy $PREVIEW_NUMBER $CODE_DIR $0 $#" >> "$STUB_LOG"\n',
    )
    const { code } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(code).toBe(0)
    expect(sudoLines()).toEqual([
      `sudo -n ${p('access/ops/preview-caddy.sh')} 7`,
      `sudo -n ${p('access/ops/preview-copy.sh')} 7`,
    ])
    expect(fs.readFileSync(p('caddy/previews/pr-7.caddy'), 'utf8')).toContain(
      'pr-7.dev.sprechereast.com',
    )
    expect(log()).toContain(`deploy 7 ${release()} ${p('access/ops/deploy-release.sh')} 0`)
  })

  it('deploy never runs a script from the release, however it is named', async () => {
    const hostile = await archive([
      { name: '.release-info', data: 'x' },
      { name: 'ops/deploy-release.sh', data: 'echo HOSTILE-DEPLOY >> "$STUB_LOG"\n' },
      { name: 'ops/preview-caddy.sh', data: 'echo HOSTILE-CADDY >> "$STUB_LOG"\n' },
      { name: 'ops/preview-settings.sh', data: 'echo HOSTILE-SETTINGS >> "$STUB_LOG"\n' },
      { name: 'ops/preview-isolation-check.sh', data: 'echo HOSTILE-CHECK >> "$STUB_LOG"\n' },
    ])
    await wrapper(`upload 7 ${COMMIT}`, { input: hostile })
    fs.writeFileSync(
      p('access/ops/deploy-release.sh'),
      '#!/usr/bin/env bash\necho "main deploy" >> "$STUB_LOG"\n',
    )
    await wrapper(`deploy 7 ${COMMIT}`)
    expect(log()).toContain('main deploy')
    expect(log()).not.toContain('HOSTILE')
  })

  it('deploy runs the isolation check from main’s copy before and after the deploy script, and keeps a preview that passes', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(
      p('access/ops/deploy-release.sh'),
      '#!/usr/bin/env bash\necho "deploy-script" >> "$STUB_LOG"\n',
    )
    const { code } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(code).toBe(0)
    const check = `isolation-check ${p('access/ops/preview-isolation-check.sh')}`
    expect(
      log()
        .split('\n')
        .filter(Boolean)
        .filter((l) => l === 'deploy-script' || l === check),
    ).toEqual([check, 'deploy-script', check])
    expect(fs.existsSync(release())).toBe(true)
    expect(fs.existsSync(p('caddy/previews/pr-7.caddy'))).toBe(true)
    expect(log()).not.toContain('pm2 delete')
  })

  it('deploy starts nothing when the isolation check fails first: no block, no deploy script, the preview comes down', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(
      p('access/ops/deploy-release.sh'),
      '#!/usr/bin/env bash\necho "deploy-script" >> "$STUB_LOG"\n',
    )
    const { code, out } = await wrapper(`deploy 7 ${COMMIT}`, {
      env: { STUB_ISOLATION_FAILS: '1' },
    })
    expect(code).toBe(2)
    expect(out).toContain('the isolation check failed, so the preview was taken down')
    expect(log()).not.toContain('deploy-script')
    expect(log().match(/^isolation-check /gm)).toHaveLength(1)
    // the only call to sudo is the one that removes a block (the preview never had one)
    expect(sudoLines()).toEqual([`sudo -n ${p('access/ops/preview-caddy.sh')} 7`])
    expect(fs.existsSync(p('caddy/previews/pr-7.caddy'))).toBe(false)
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('deploy checks again after a deploy script that fails, and keeps that script’s failure', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\nexit 3\n')
    const failed = await wrapper(`deploy 7 ${COMMIT}`)
    expect(failed.code).toBe(3)
    expect(log().match(/^isolation-check /gm)).toHaveLength(2)
    expect(fs.existsSync(release())).toBe(true) // a failed deploy leaves the preview as it was
  })

  it('deploy takes the preview down when the check passes before and fails after a failed deploy', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\nexit 3\n')
    const { code, out } = await wrapper(`deploy 7 ${COMMIT}`, {
      env: { STUB_ISOLATION_PASSES: '1' },
    })
    expect(code).toBe(2)
    expect(out).toContain('the isolation check failed, so the preview was taken down')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('deploy takes the preview down and fails when the isolation check fails', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    await wrapper(`upload 8 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('caddy/previews/pr-8.caddy'), '# block 8\n')
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\nexit 0\n')
    const { code, out } = await wrapper(`deploy 7 ${COMMIT}`, {
      env: { STUB_ISOLATION_FAILS: '1' },
    })
    expect(code).toBe(2)
    expect(out).toContain('the isolation check failed, so the preview was taken down')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false) // folder gone
    expect(fs.existsSync(p('caddy/previews/pr-7.caddy'))).toBe(false) // block gone
    expect(log()).toContain('pm2 delete sprecher-east-pr-7') // process stopped
    expect(fs.existsSync(release('8'))).toBe(true) // another preview untouched
    expect(fs.existsSync(p('caddy/previews/pr-8.caddy'))).toBe(true)
    expect(out).not.toContain(COMMIT)
  })

  it('deploy still says why it failed when removing the Caddy block fails too', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\nexit 0\n')
    // removing the block (the one sudo call on this path) fails
    stub('sudo', 'exit 1')
    const { code, out } = await wrapper(`deploy 7 ${COMMIT}`, {
      env: { STUB_ISOLATION_FAILS: '1' },
    })
    expect(code).toBe(2)
    expect(out).toContain('the isolation check failed, so the preview was taken down')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('deploy takes the preview down when main’s isolation check is missing, rather than trusting it', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\nexit 0\n')
    fs.rmSync(p('access/ops/preview-isolation-check.sh'))
    const { code } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(code).toBe(2)
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('deploy still removes the Caddy block and folder when stopping the process fails', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\nexit 0\n')
    stub('pm2', 'echo "pm2 $*" >> "$STUB_LOG"; exit 1')
    const { code } = await wrapper(`deploy 7 ${COMMIT}`, { env: { STUB_ISOLATION_FAILS: '1' } })
    expect(code).toBe(2)
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
    expect(fs.existsSync(p('caddy/previews/pr-7.caddy'))).toBe(false)
  })

  it('teardown goes on when the process is already gone', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    stub('pm2', 'echo "pm2 $*" >> "$STUB_LOG"; exit 1')
    const { code } = await wrapper('teardown 7')
    expect(code).toBe(0)
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('deploy refuses a release that was never uploaded, and asks Caddy for nothing', async () => {
    fs.mkdirSync(p('previews/pr-7'))
    const { code } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(code).toBe(2)
    expect(sudoLines()).toEqual([])
  })

  it('teardown stops the preview, deletes its folder and its block, and leaves other previews', async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    await wrapper(`upload 8 ${COMMIT}`, { input: await goodArchive() })
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), '# block 7\n')
    fs.writeFileSync(p('caddy/previews/pr-8.caddy'), '# block 8\n')
    const { code, out } = await wrapper('teardown 7')
    expect(code).toBe(0)
    expect(out).toContain('taken down')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
    expect(fs.existsSync(release('8'))).toBe(true)
    expect(fs.existsSync(p('caddy/previews/pr-7.caddy'))).toBe(false)
    expect(fs.existsSync(p('caddy/previews/pr-8.caddy'))).toBe(true)
    expect(log()).toContain('pm2 delete sprecher-east-pr-7')
    expect(log()).toContain('pm2 save --force')
    expect(sudoLines()).toEqual([`sudo -n ${p('access/ops/preview-caddy.sh')} 7`])
  })

  it('takes nothing from the caller’s environment about which folder to act on', async () => {
    fs.mkdirSync(p('victim/pr-7'), { recursive: true })
    fs.mkdirSync(p('previews/pr-7'))
    const { code } = await wrapper('teardown 7', {
      env: {
        APP_DIR: p('victim/pr-7'),
        PREVIEW_NUMBER: '9',
        APP_NAME: 'sprecher-east',
        ENV_FILE: '/etc/passwd',
      },
    })
    expect(code).toBe(0)
    expect(fs.existsSync(p('victim/pr-7'))).toBe(true)
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
    expect(log()).toContain('pm2 delete sprecher-east-pr-7')
    expect(log()).not.toContain('pm2 delete sprecher-east\n')
  })
})

describe('preview-wrapper.sh: production’s published content (#1397)', () => {
  const live = async () => {
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    // what the deploy script sees when it runs: the copy file, the media and no old database
    fs.writeFileSync(
      p('access/ops/deploy-release.sh'),
      [
        '#!/usr/bin/env bash',
        'echo "deploy-script file:$(cat "$APP_DIR/.preview-copy.json" 2>/dev/null | head -c 12) media:$(ls "$APP_DIR/public/media" 2>/dev/null | paste -sd,) data:$(ls "$APP_DIR/data" 2>/dev/null | paste -sd,)" >> "$STUB_LOG"',
        'echo "file-mode:$(stat -c %a "$APP_DIR/.preview-copy.json")" >> "$STUB_LOG"',
        '[ -z "${STUB_DEPLOY_FAILS-}" ] || exit 3',
        '',
      ].join('\n'),
    )
  }
  const folder = (...parts) => p('previews/pr-7', ...parts)

  it('asks the root script with the number alone, after the Caddy block and the first isolation check, before the deploy script', async () => {
    await live()
    const { code } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(code).toBe(0)
    const order = log()
      .split('\n')
      .filter((l) => /^(isolation-check|sudo|copy-script|deploy-script)/.test(l))
      .map((l) => l.split(' ').slice(0, 3).join(' '))
    expect(order).toEqual([
      `isolation-check ${p('access/ops/preview-isolation-check.sh')}`,
      `sudo -n ${p('access/ops/preview-caddy.sh')}`,
      `sudo -n ${p('access/ops/preview-copy.sh')}`,
      'copy-script 7 stdout-is-file:yes',
      'deploy-script file:{"format":1, media:a.jpg',
      `isolation-check ${p('access/ops/preview-isolation-check.sh')}`,
    ])
  })

  it('writes the export’s file itself, as the preview account, private, so root writes no path in the preview’s folder', async () => {
    await live()
    await wrapper(`deploy 7 ${COMMIT}`)
    expect(log()).toContain('stdout-is-file:yes')
    expect(log()).toContain('file-mode:600')
  })

  it('rebuilds the database and the media on every deploy: the old ones are gone, the staged links are in place', async () => {
    await live()
    fs.mkdirSync(folder('data'), { recursive: true })
    fs.writeFileSync(folder('data/payload.db'), 'OLD DATABASE')
    fs.mkdirSync(folder('public/media'), { recursive: true })
    fs.writeFileSync(folder('public/media/uploaded-in-preview.jpg'), 'OLD')
    await wrapper(`deploy 7 ${COMMIT}`)
    expect(log()).toContain('deploy-script file:{"format":1, media:a.jpg data:\n')
    expect(fs.readdirSync(folder('public/media'))).toEqual(['a.jpg'])
    expect(fs.existsSync(folder('data/payload.db'))).toBe(false)
    expect(fs.existsSync(folder('.copy-media'))).toBe(false)
  })

  it('checks the room for the copy file against production’s floor before it asks the root script', async () => {
    await live()
    const { code, out } = await wrapper(`deploy 7 ${COMMIT}`, {
      env: { PREVIEW_FREE_FLOOR_KB: '9999999999' },
    })
    expect(code).not.toBe(0)
    expect(out).toContain('not enough free disk')
    expect(log()).not.toContain('copy-script')
    expect(log()).not.toContain('deploy-script')
  })

  it('removes the copy file and the staging folder after the deploy, also when the deploy script fails', async () => {
    await live()
    const { code } = await wrapper(`deploy 7 ${COMMIT}`, { env: { STUB_DEPLOY_FAILS: '1' } })
    expect(code).toBe(3)
    expect(fs.existsSync(folder('.preview-copy.json'))).toBe(false)
    expect(fs.existsSync(folder('.copy-media'))).toBe(false)
  })

  it('changes nothing when the root script fails: the old database and media stay, no deploy script runs', async () => {
    await live()
    fs.mkdirSync(folder('data'), { recursive: true })
    fs.writeFileSync(folder('data/payload.db'), 'OLD DATABASE')
    fs.mkdirSync(folder('public/media'), { recursive: true })
    fs.writeFileSync(folder('public/media/old.jpg'), 'OLD')
    const { code, out } = await wrapper(`deploy 7 ${COMMIT}`, { env: { STUB_COPY_FAILS: '1' } })
    expect(code).toBe(2)
    expect(out).toContain('the content copy failed, so the preview was not changed')
    expect(log()).not.toContain('deploy-script')
    expect(fs.readFileSync(folder('data/payload.db'), 'utf8')).toBe('OLD DATABASE')
    expect(fs.readdirSync(folder('public/media'))).toEqual(['old.jpg'])
    expect(fs.existsSync(folder('.copy-media'))).toBe(false)
    expect(fs.existsSync(folder('.preview-copy.json'))).toBe(false)
  })

  it('treats a root script that printed nothing as a failure', async () => {
    await live()
    const { code } = await wrapper(`deploy 7 ${COMMIT}`, { env: { STUB_COPY_EMPTY: '1' } })
    expect(code).toBe(2)
    expect(log()).not.toContain('deploy-script')
  })

  it('never prints the export’s file', async () => {
    await live()
    const { out } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(out).not.toContain('SECRET-POST-TEXT')
    const failed = await wrapper(`deploy 7 ${COMMIT}`, { env: { STUB_DEPLOY_FAILS: '1' } })
    expect(failed.out).not.toContain('SECRET-POST-TEXT')
  })

  it('does not run the root script when the first isolation check fails', async () => {
    await live()
    await wrapper(`deploy 7 ${COMMIT}`, { env: { STUB_ISOLATION_FAILS: '1' } })
    expect(log()).not.toContain('copy-script')
  })

  it('teardown removes the preview’s linked media and its passwords file, and leaves production’s file as it was', async () => {
    await live()
    write(p('prod/public/media/a.jpg'), 'PRODUCTION PICTURE')
    fs.mkdirSync(folder('public/media'), { recursive: true })
    fs.linkSync(p('prod/public/media/a.jpg'), folder('public/media/a.jpg'))
    fs.writeFileSync(folder('.preview-accounts'), 'admin=x\n', { mode: 0o600 })
    fs.writeFileSync(folder('.preview-accounts.applied'), 'x')
    const { code } = await wrapper('teardown 7')
    expect(code).toBe(0)
    expect(fs.existsSync(folder())).toBe(false)
    expect(fs.readFileSync(p('prod/public/media/a.jpg'), 'utf8')).toBe('PRODUCTION PICTURE')
    expect(fs.statSync(p('prod/public/media/a.jpg')).nlink).toBe(1)
  })
})

describe('preview-wrapper.sh: credentials (#1394)', () => {
  const ROLES = ['admin', 'editor', 'resident', 'guest']
  const text = () => ROLES.map((r, i) => `${r}=${String(i + 1).repeat(64)}\n`).join('')
  const digest = (t) => crypto.createHash('sha256').update(t).digest('hex')
  const FIXED = 'no test sign-in to hand out'

  /** A preview folder with the passwords file the deploy script writes and, unless told not to, the seed's marker. */
  function previewWith({ body = text(), marker = digest(body), mode = 0o600 } = {}) {
    fs.mkdirSync(p('previews/pr-7'), { recursive: true })
    fs.writeFileSync(p('previews/pr-7/.preview-accounts'), body, { mode })
    fs.chmodSync(p('previews/pr-7/.preview-accounts'), mode)
    if (marker !== null)
      fs.writeFileSync(p('previews/pr-7/.preview-accounts.applied'), `${marker}\n`)
  }

  it('prints the file exactly, once the seed confirmed it, and runs nothing else', async () => {
    previewWith()
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(0)
    expect(out).toBe(text())
    expect(log()).toBe('')
  })

  it('says nothing about another preview’s passwords', async () => {
    previewWith()
    fs.mkdirSync(p('previews/pr-8'))
    const { code, out } = await wrapper('credentials 8')
    expect(code).toBe(2)
    expect(out).not.toContain('1'.repeat(64))
  })

  it('refuses a preview that does not exist, with a fixed text and nothing created', async () => {
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(2)
    expect(out).toContain('there is no such preview')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('refuses a preview whose first deploy has not made the file', async () => {
    fs.mkdirSync(p('previews/pr-7'))
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(2)
    expect(out).toContain(FIXED)
  })

  it('does not hand out passwords the seed never applied (no marker: an older branch, or a failed seed)', async () => {
    previewWith({ marker: null })
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(2)
    expect(out).toContain(FIXED)
    expect(out).not.toContain('1'.repeat(64))
  })

  it('does not hand out a file that changed after the seed confirmed another one', async () => {
    previewWith({ marker: digest(text().replace('1', '9')) })
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(2)
    expect(out).not.toContain('1'.repeat(64))
  })

  it.each([0o644, 0o640, 0o604])(
    'does not hand out a file others can open (mode %o)',
    async (mode) => {
      previewWith({ mode })
      const { code, out } = await wrapper('credentials 7')
      expect(code).toBe(2)
      expect(out).not.toContain('1'.repeat(64))
    },
  )

  it.each([
    ['an extra line', (t) => `${t}root=${'f'.repeat(64)}\n`],
    ['a short password', (t) => t.replace('1'.repeat(64), '1'.repeat(8))],
    ['a stray line', (t) => `${t}::notice::x\n`],
    ['an empty file', () => ''],
    ['empty passwords', () => ROLES.map((r) => `${r}=\n`).join('')],
    [
      'the roles out of order',
      () =>
        ROLES.toReversed()
          .map((r) => `${r}=${'1'.repeat(64)}\n`)
          .join(''),
    ],
    ['a role twice', () => `${text()}${text()}`],
    ['no newline at the end', (t) => t.slice(0, -1)],
    ['a blank line', (t) => `\n${t}`],
    ['upper-case hex', (t) => t.replace('1'.repeat(64), 'A'.repeat(64))],
  ])('does not hand out a file that is not what the deploy writes (%s)', async (_, change) => {
    const body = change(text())
    previewWith({ body })
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(2)
    expect(out).not.toContain('f'.repeat(64))
    expect(out).not.toContain('::notice::x')
  })

  it('never follows a link at the passwords file or the marker', async () => {
    previewWith()
    fs.writeFileSync(p('secret-elsewhere'), text(), { mode: 0o600 })
    fs.rmSync(p('previews/pr-7/.preview-accounts'))
    fs.symlinkSync(p('secret-elsewhere'), p('previews/pr-7/.preview-accounts'))
    const first = await wrapper('credentials 7')
    expect(first.code).toBe(2)
    expect(first.out).not.toContain('1'.repeat(64))

    previewWith()
    fs.rmSync(p('previews/pr-7/.preview-accounts.applied'))
    fs.writeFileSync(p('elsewhere-marker'), `${digest(text())}\n`)
    fs.symlinkSync(p('elsewhere-marker'), p('previews/pr-7/.preview-accounts.applied'))
    const second = await wrapper('credentials 7')
    expect(second.code).toBe(2)
    expect(second.out).not.toContain('1'.repeat(64))
  })

  it('refuses a preview folder that is a link', async () => {
    previewWith()
    fs.renameSync(p('previews/pr-7'), p('real-folder'))
    fs.symlinkSync(p('real-folder'), p('previews/pr-7'))
    const { code, out } = await wrapper('credentials 7')
    expect(code).toBe(2)
    expect(out).not.toContain('1'.repeat(64))
  })

  it('takes nothing from the caller’s environment about which file to read', async () => {
    previewWith()
    fs.mkdirSync(p('victim/pr-7'), { recursive: true })
    fs.writeFileSync(p('victim/pr-7/.preview-accounts'), `admin=${'e'.repeat(64)}\n`, {
      mode: 0o600,
    })
    const { out } = await wrapper('credentials 7', {
      env: { ACCOUNTS_FILE: p('victim/pr-7/.preview-accounts'), APP_DIR: p('victim/pr-7') },
    })
    expect(out).toBe(text())
  })
})

describe('preview-wrapper.sh: it refuses everything else', () => {
  const short = 'a'.repeat(39)
  const requests = [
    undefined, // a shell: sshd sets no command
    '',
    'sh',
    'bash -i',
    'id',
    'cat /etc/passwd',
    'scp -t /tmp',
    'internal-sftp',
    'rsync --server . /',
    'FACTS',
    'Facts',
    'facts ',
    ' facts',
    'facts  ',
    'facts 7',
    'list 7',
    'facts; id',
    'facts && id',
    'facts | id',
    'facts $(id)',
    'facts `id`',
    'facts\nid',
    'facts\r',
    'facts #',
    'facts\tid',
    'upload',
    'upload 7',
    `upload 7 ${short}`,
    `upload 7 ${COMMIT}a`,
    `upload 7 ${COMMIT.toUpperCase()}`,
    `upload 7 ${'g'.repeat(40)}`,
    `upload 07 ${COMMIT}`,
    `upload 0 ${COMMIT}`,
    `upload 1234567 ${COMMIT}`,
    `upload -7 ${COMMIT}`,
    `upload 7 -${COMMIT.slice(1)}`,
    `upload ../7 ${COMMIT}`,
    'upload 7 ../../x',
    `upload 7 ${COMMIT} extra`,
    `upload 7;id ${COMMIT}`,
    `upload $(id) ${COMMIT}`,
    `upload 7 ${COMMIT}\nid`,
    `deploy 7`,
    `deploy a ${COMMIT}`,
    `deploy 7 ${short}`,
    `deploy 1234567 ${COMMIT}`,
    `deploy 7 ${COMMIT} --force`,
    'teardown',
    'teardown 0',
    'teardown 07',
    'teardown -1',
    'teardown 1234567',
    `teardown 7 ${COMMIT}`,
    'teardown 7\nid',
    'teardown 7;rm -rf /',
    'teardown *',
    'teardown ../7',
    'teardown 7/../../x',
    'credentials',
    'credentials 0',
    'credentials 07',
    'credentials 1234567',
    'credentials -7',
    'credentials ../7',
    'credentials 7;id',
    'credentials 7\nid',
    'credentials $(id)',
    `credentials 7 ${COMMIT}`,
    'credentials 7 7',
    'credentials 7 extra',
    '--help',
    '-v',
    '--',
    'zzmarker',
    'upload zzmarker',
    'deploy 7 zzmarker',
    'ssh-add',
    'exit',
  ]
  it.each(requests.map((r) => [JSON.stringify(r), r]))(
    'refuses %s, runs nothing and creates nothing',
    async (_, request) => {
      const { code, out } = await wrapper(request, { input: 'not an archive' })
      expect(code).toBe(2)
      expect(out).toContain('refused')
      expect(fs.readdirSync(p('previews'))).toEqual([])
      expect(log()).toBe('')
    },
  )

  it('says plainly that a shell is not allowed when no command comes', async () => {
    const { out } = await wrapper(undefined)
    expect(out).toContain('no shell')
  })

  it('never prints the request it refuses', async () => {
    const { out } = await wrapper('upload zzmarker')
    expect(out).not.toContain('zzmarker')
    expect(out.trim().split('\n')).toHaveLength(1)
  })
})

describe('preview-wrapper.sh: a hostile release archive', () => {
  const refused = async (members, input, reason = 'refused') => {
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, {
      input: input ?? (await archive(members)),
    })
    expect(code).toBe(2)
    expect(out).toContain(reason)
    expect(fs.existsSync(release())).toBe(false)
    // no half-unpacked leftovers, and a new preview that got no release leaves no empty folder to hold a place
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  }

  it.each([
    ['a path that climbs out', [{ name: '../escape', data: 'x' }]],
    ['a path that climbs out in the middle', [{ name: 'a/../../escape', data: 'x' }]],
    ['an absolute path', [{ name: '/tmp/escape', data: 'x' }]],
    [
      'a link to an absolute path',
      [{ name: 'public/media', link: '/var/www/sprecher-east/public/media' }],
    ],
    ['a link that climbs out', [{ name: 'public', link: '../../../../etc' }]],
    ['a link to production’s folder', [{ name: 'data', link: '/var/www/sprecher-east/data' }]],
  ])('refuses %s', async (name, members) => {
    // a path is refused by the wrapper's own check before tar runs; a link after it is unpacked
    await refused(
      members,
      undefined,
      name.startsWith('a path') || name === 'an absolute path'
        ? 'path that leaves the release'
        : 'refused',
    )
  })

  it('refuses a file written through a link in the same archive', async () => {
    await refused([
      { name: 'public', link: p('victim') },
      { name: 'public/pwned', data: 'x' },
    ])
    expect(fs.existsSync(p('victim/pwned'))).toBe(false)
  })

  it('refuses an archive that lists fine but cannot be unpacked', async () => {
    await refused([
      { name: 'a', data: 'x' },
      { name: 'a/b', data: 'x' },
    ])
  })

  it('refuses stdin that is not a .tar.gz', async () => {
    await refused(null, Buffer.from('this is not an archive'))
  })

  it('refuses an archive over the limit, and one cut off', async () => {
    const big = await archive([{ name: 'big', data: 'y'.repeat(5000) }])
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, {
      input: big,
      env: { PREVIEW_UPLOAD_MAX_BYTES: String(big.length - 1) },
    })
    expect(code).toBe(2)
    expect(out).toContain('too big')
    const fits = await wrapper(`upload 7 ${COMMIT}`, {
      input: big,
      env: { PREVIEW_UPLOAD_MAX_BYTES: String(big.length) },
    })
    expect(fits.code).toBe(0)
    fs.rmSync(p('previews/pr-7'), { recursive: true })
    await refused(null, big.subarray(0, 40))
  })

  it('refuses an archive that unpacks to more than the limit, and writes nothing', async () => {
    const big = await archive([{ name: 'big', data: 'y'.repeat(5000) }])
    const over = await wrapper(`upload 7 ${COMMIT}`, {
      input: big,
      env: { PREVIEW_UNPACK_MAX_BYTES: '4999' },
    })
    expect(over.code).toBe(2)
    expect(over.out).toContain('unpacks to more than is allowed')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false) // nothing unpacked, nothing left
    const exact = await wrapper(`upload 7 ${COMMIT}`, {
      input: big,
      env: { PREVIEW_UNPACK_MAX_BYTES: '5000' },
    })
    expect(exact.code).toBe(0)
  })

  it('refuses sizes that would wrap a 64-bit sum: a sparse member claiming 2^62 bytes, twice, in a tiny archive', async () => {
    const sparse = await sparseArchive([2n ** 62n, 2n ** 62n])
    expect(sparse.length).toBeLessThan(5000)
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, { input: sparse })
    expect(code).toBe(2)
    expect(out).toContain('unpacks to more than is allowed')
    expect(fs.existsSync(release())).toBe(false)
  })

  it('refuses at the first member that passes the limit, and a size with more digits than the limit', async () => {
    const big = await sparseArchive([5000n, 5000n])
    const over = await wrapper(`upload 7 ${COMMIT}`, {
      input: big,
      env: { PREVIEW_UNPACK_MAX_BYTES: '9999' },
    })
    expect(over.code).toBe(2)
    expect(over.out).toContain('unpacks to more than is allowed')
    const digits = await wrapper(`upload 8 ${COMMIT}`, {
      input: await sparseArchive([10n ** 12n]),
      env: { PREVIEW_UNPACK_MAX_BYTES: '999999' },
    })
    expect(digits.code).toBe(2)
    expect(digits.out).toContain('unpacks to more than is allowed')
  })

  it('refuses the largest size tar will list after a small one, which would wrap the running sum negative', async () => {
    // tar itself refuses a claimed size over 2^63 - 1; this one plus 1000 bytes is over it
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, {
      input: await sparseArchive([1000n, 2n ** 63n - 1n]),
    })
    expect(code).toBe(2)
    expect(out).toContain('unpacks to more than is allowed')
    expect(fs.existsSync(release())).toBe(false)
  })

  it('counts every member: a small archive of many files over the limit is refused', async () => {
    const many = await archive(
      Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, data: 'z'.repeat(100) })),
    )
    const { code } = await wrapper(`upload 7 ${COMMIT}`, {
      input: many,
      env: { PREVIEW_UNPACK_MAX_BYTES: '1999' },
    })
    expect(code).toBe(2)
  })

  it('refuses a highly compressed archive by its unpacked size, though it is tiny to upload', async () => {
    const bomb = await archive([{ name: 'zeros', fill: '0', repeat: 4_000_000 }])
    expect(bomb.length).toBeLessThan(20_000)
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, {
      input: bomb,
      env: { PREVIEW_UNPACK_MAX_BYTES: '1000000' },
    })
    expect(code).toBe(2)
    expect(out).toContain('unpacks to more than is allowed')
  })

  it('measures an archive whose owner name has a space, by numeric owner', async () => {
    const odd = await archive([{ name: 'file', data: 'y'.repeat(100), uname: 'two words' }])
    const { code } = await wrapper(`upload 7 ${COMMIT}`, { input: odd })
    expect(code).toBe(0)
    const over = await wrapper(`upload 8 ${COMMIT}`, {
      input: odd,
      env: { PREVIEW_UNPACK_MAX_BYTES: '99' },
    })
    expect(over.code).toBe(2)
  })

  it('measures a member name with a newline by tar’s escaped listing, and unpacks it', async () => {
    const tricky = await archive([{ name: 'a\nb', data: 'y' }])
    const { code } = await wrapper(`upload 7 ${COMMIT}`, { input: tricky })
    expect(code).toBe(0)
  })

  it('refuses an archive whose measuring listing fails part way, though the first listing worked', async () => {
    // a listing that starts well (one small member) and then fails, as a cut-off archive would
    stub(
      'tar',
      'case "$1" in --numeric-owner) echo "-rw-r--r-- 0/0 10 2026-01-01 00:00 a"; exit 1 ;; *) exec /usr/bin/tar "$@" ;; esac',
    )
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    expect(code).toBe(2)
    expect(out).toContain("can't be measured")
  })

  it('refuses an archive with no members', async () => {
    const { code } = await wrapper(`upload 7 ${COMMIT}`, { input: await archive([]) })
    expect(code).toBe(2)
  })

  it('refuses an archive whose listing has a line that is not a member line, and adds up the ones that are', async () => {
    const real = await goodArchive()
    const listing = (lines) =>
      stub(
        'tar',
        `case "$1" in --numeric-owner) printf '%s\\n' ${lines} ;; *) exec /usr/bin/tar "$@" ;; esac`,
      )
    listing("'-rw-r--r-- 0/0 1500 2026-01-01 00:00 a' 'not a member line'")
    const odd = await wrapper(`upload 7 ${COMMIT}`, { input: real })
    expect(odd.code).toBe(2)
    expect(odd.out).toContain("can't be measured")
    listing("'-rw-r--r-- 0/0 1500 2026-01-01 00:00 a' '-rw-r--r-- 0/0 600 2026-01-01 00:00 b'")
    const small = await wrapper(`upload 7 ${COMMIT}`, {
      input: real,
      env: { PREVIEW_UNPACK_MAX_BYTES: '2099' },
    })
    expect(small.code).toBe(2)
    const fits = await wrapper(`upload 7 ${COMMIT}`, {
      input: real,
      env: { PREVIEW_UNPACK_MAX_BYTES: '2100' },
    })
    expect(fits.code).toBe(0)
  })

  it('writes nothing through a link at the preview’s folder or at releases', async () => {
    fs.mkdirSync(p('victim'))
    fs.symlinkSync(p('victim'), p('previews/pr-7'))
    const first = await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    expect(first.code).toBe(2)
    fs.rmSync(p('previews/pr-7'))
    fs.mkdirSync(p('previews/pr-7'))
    fs.symlinkSync(p('victim'), p('previews/pr-7/releases'))
    const second = await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive() })
    expect(second.code).toBe(2)
    expect(fs.readdirSync(p('victim'))).toEqual([])
  })

  it('teardown never follows a link at the preview’s folder', async () => {
    fs.mkdirSync(p('victim'))
    fs.writeFileSync(p('victim/keep'), 'x')
    fs.symlinkSync(p('victim'), p('previews/pr-7'))
    const { code } = await wrapper('teardown 7')
    expect(code).toBe(2)
    expect(fs.readFileSync(p('victim/keep'), 'utf8')).toBe('x')
    expect(sudoLines()).toEqual([])
  })
})

describe('preview-wrapper.sh: how it unpacks', () => {
  const modeOf = (file) => (fs.statSync(file).mode & 0o7777).toString(8)

  it('keeps no setuid bit or owner from the archive, and nothing readable by others (umask 027)', async () => {
    const input = await archive([
      { name: 'suid', data: 'x', mode: 0o4777, uid: 12345 },
      { name: 'plain', data: 'x', mode: 0o666 },
    ])
    const { code } = await wrapper(`upload 7 ${COMMIT}`, { input })
    expect(code).toBe(0)
    expect(modeOf(`${release()}/suid`)).toBe('750')
    expect(modeOf(`${release()}/plain`)).toBe('640')
    expect(modeOf(release())).toBe('750')
    expect(fs.statSync(`${release()}/suid`).uid).toBe(process.getuid())
  })

  it('reads at most the limit from stdin: an endless stream does not fill the disk', async () => {
    // `ulimit -f` kills a process that writes a file over 4 KiB, so a wrapper that wrote everything it read dies
    const script = 'ulimit -f 4; yes | head -c 3000000 | /bin/bash "$0"'
    const { code, out } = await runCommand(
      '/bin/bash',
      ['-c', script, p('access/ops/preview-wrapper.sh')],
      {
        env: baseEnv({
          SSH_ORIGINAL_COMMAND: `upload 7 ${COMMIT}`,
          PREVIEW_UPLOAD_MAX_BYTES: '1000',
        }),
      },
    )
    expect(code).toBe(2)
    expect(out).toContain('too big')
  })

  it('refuses a release folder that is a link, and asks Caddy for nothing', async () => {
    fs.mkdirSync(p('victim'))
    fs.mkdirSync(p('previews/pr-7/releases'), { recursive: true })
    fs.symlinkSync(p('victim'), release())
    const { code } = await wrapper(`deploy 7 ${COMMIT}`)
    expect(code).toBe(2)
    expect(sudoLines()).toEqual([])
  })

  it('allows only so many previews: a new one is refused beyond the maximum, an existing one is not', async () => {
    fs.mkdirSync(p('previews/pr-1'))
    fs.mkdirSync(p('previews/pr-2'))
    const env = { PREVIEW_MAX_COUNT: '2' }
    const refused = await wrapper(`upload 3 ${COMMIT}`, { input: await goodArchive(), env })
    expect(refused.code).toBe(2)
    expect(refused.out).toContain('as many previews as are allowed')
    expect(fs.existsSync(p('previews/pr-3'))).toBe(false)
    const existing = await wrapper(`upload 2 ${COMMIT}`, { input: await goodArchive(), env })
    expect(existing.code).toBe(0)
  })
})

describe('preview-wrapper.sh: its tools come from fixed folders', () => {
  it.each([
    ['relative', 'bin'],
    ['with a semicolon', '/bin;id'],
    ['with a space', '/bin /tmp'],
    ['empty', ''],
  ])('refuses a tools path file that is %s', async (_, content) => {
    fs.writeFileSync(p('access/tools-path'), `${content}\n`)
    const { code, out } = await wrapper('facts')
    expect(code).toBe(2)
    expect(out).toContain('tools path file')
  })

  it('never runs a program planted on the caller’s PATH, for any action', async () => {
    const names =
      'df find tar stat mkdir rm mv grep awk readlink dirname cat head sudo pm2 node id bash env realpath xargs wc sha256sum'.split(
        ' ',
      )
    fs.mkdirSync(p('evil'))
    for (const name of names)
      fs.writeFileSync(p('evil', name), `#!/bin/sh\necho ${name} >> "${p('planted')}"\n`, {
        mode: 0o755,
      })
    const env = { PATH: `${p('evil')}:${p('bin')}:/usr/bin:/bin` }
    fs.writeFileSync(p('access/ops/deploy-release.sh'), '#!/usr/bin/env bash\ntrue\n')
    for (const [request, input] of [
      ['facts'],
      ['list'],
      [`upload 7 ${COMMIT}`, await goodArchive()],
      [`deploy 7 ${COMMIT}`],
      ['teardown 7'],
    ]) {
      const { code, out } = await wrapper(request, { input, env })
      expect(code, `${request}: ${out}`).toBe(0)
    }
    // credentials, with a confirmed file in place
    await wrapper(`upload 7 ${COMMIT}`, { input: await goodArchive(), env })
    const body = ['admin', 'editor', 'resident', 'guest']
      .map((r) => `${r}=${'1'.repeat(64)}\n`)
      .join('')
    fs.writeFileSync(p('previews/pr-7/.preview-accounts'), body, { mode: 0o600 })
    fs.writeFileSync(
      p('previews/pr-7/.preview-accounts.applied'),
      `${crypto.createHash('sha256').update(body).digest('hex')}\n`,
    )
    const creds = await wrapper('credentials 7', { env })
    expect(creds.out).toBe(body)
    expect(fs.existsSync(p('planted')) ? fs.readFileSync(p('planted'), 'utf8') : '').toBe('')
  })
})
