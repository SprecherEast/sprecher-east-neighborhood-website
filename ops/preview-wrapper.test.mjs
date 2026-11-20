// ops/preview-wrapper.sh (#1345): the forced command of the preview deploy key. It must run the
// five actions and refuse everything else, with every value checked before use. Each guard has a
// test that fails without it. Real sshd and `restrict` are checked on the server.
import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { COMMIT, runCommand, setUpPreviewAccessHarness } from './preview-access-harness.mjs'

const { p, log, wrapper, baseEnv } = setUpPreviewAccessHarness()

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
        if m.get("link"):
            info.type = tarfile.SYMTYPE
            info.linkname = m["link"]
            t.addfile(info)
        else:
            data = m.get("data", "x").encode()
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
sys.stdout.buffer.write(buf.getvalue())`
  const child = await import('node:child_process')
  return child.execFileSync('python3', ['-I', '-c', script, JSON.stringify(members)], {
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
    expect(out.trim().split('\n').sort()).toEqual([
      `preview=12 commit=none`,
      `preview=7 commit=${COMMIT}`,
    ])
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
    expect(sudoLines()).toEqual([`sudo -n ${p('access/ops/preview-caddy.sh')} 7`])
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
    expect(fs.readdirSync(p('previews/pr-7/releases'))).toEqual([]) // no half-unpacked leftovers
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
      'df find tar stat mkdir rm mv grep awk readlink dirname cat head sudo pm2 node id bash env realpath xargs wc'.split(
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
    expect(fs.existsSync(p('planted')) ? fs.readFileSync(p('planted'), 'utf8') : '').toBe('')
  })
})
