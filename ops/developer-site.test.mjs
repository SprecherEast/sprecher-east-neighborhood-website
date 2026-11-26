// ops/developer-site.sh and ops/caddy/developer-site.caddy (#1459): publishing the developer site. The
// real scripts run against a server-shaped tree in a temp folder; `caddy`, `curl` and the Caddy reload
// are stand-ins (real Caddy, the certificate and a phone are checked on the server after the first
// deploy, ops/README.md). Each condition and guard has a test that fails without it.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SEES_AND_DUPLICATES } from './preview-access-harness.mjs'
import { OPS } from './umami-harness.mjs'

const SCRIPTS = [
  'developer-site.sh',
  'developer-site-check.sh',
  'lib.sh',
  'environment.sh',
  'caddy-lock-lib.sh',
  'caddy-block-lib.sh',
  'releases-lib.sh',
]
const HOST = 'dev.sprechereast.com'
const PROD = 'https://sprechereast.com'

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const write = (file, text, mode) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, { mode })
}
const read = (...parts) => fs.readFileSync(p(...parts), 'utf8')
const log = () => read('log')
const lines = (prefix) =>
  log()
    .split('\n')
    .filter((l) => l.startsWith(prefix))
const reloads = () => lines('reload').length
const stub = (name, body) => write(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
const block = () => read('caddy/previews/developer.caddy')
const current = () => fs.readlinkSync(p('dev/current'))
const releases = () => fs.readdirSync(p('dev/releases')).sort()
const caddyfile = () => read('caddy/Caddyfile')

/** A release folder as the production deploy leaves it: the repo's ops files, a built showcase, a live link. */
function makeRelease(name, { live = true, showcase = true } = {}) {
  const code = p('app/releases', name)
  for (const f of SCRIPTS) write(path.join(code, 'ops', f), fs.readFileSync(path.join(OPS, f)))
  for (const f of ['developer-site.caddy', 'preview-headers.caddy'])
    write(path.join(code, 'ops/caddy', f), fs.readFileSync(path.join(OPS, 'caddy', f)))
  for (const f of ['index.html', '404.html', 'style.css'])
    write(
      path.join(code, 'ops/developer-site', f),
      fs.readFileSync(path.join(OPS, 'developer-site', f)),
    )
  if (showcase) {
    for (const f of ['index.html', 'iframe.html'])
      write(
        path.join(code, 'developer-site/showcase', f),
        `<!doctype html><title>${name}</title>\n`,
      )
    write(path.join(code, 'developer-site/showcase/assets/app.js'), `console.log("${name}")\n`)
    write(path.join(code, 'developer-site/showcase/assets/poppins-latin-400-normal.woff2'), 'wOF2')
  }
  if (live) {
    fs.rmSync(p('app/current'), { force: true })
    fs.symlinkSync(`releases/${name}`, p('app/current'))
  }
  return code
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'developer-site-'))
  fs.writeFileSync(p('log'), '')
  fs.mkdirSync(p('state'))
  write(p('app/.env.local'), `NEXT_PUBLIC_SERVER_URL=${PROD}\n`)
  write(
    p('caddy/Caddyfile'),
    `sprechereast.com {\n\treverse_proxy localhost:3000\n}\nimport ${p('caddy/previews')}/*.caddy\n`,
  )
  fs.mkdirSync(p('caddy/previews'))
  write(
    p('caddy/sprecher-east-preview-headers.caddy'),
    fs.readFileSync(path.join(OPS, 'caddy/preview-headers.caddy')),
  )
  makeRelease('r1')
  // `caddy validate --config <file>` fails for a file that has STUB_CADDY_REJECTS in it, and for the
  // Caddyfile when a block in the previews' folder has STUB_WHOLE_REJECTS in it.
  stub(
    'caddy',
    [
      '[ "$1" != version ] || { echo "v2.10.0 h1:x"; exit 0; }',
      '[ "$1" = validate ] || exit 0',
      'echo "validate $(basename "$3")" >> "$STUB_LOG"',
      '[ -z "$STUB_CADDYFILE_BAD" ] || [ "$(basename "$3")" != Caddyfile ] || exit 1',
      '[ "$(basename "$3")" != Caddyfile ] || { ' + SEES_AND_DUPLICATES + '; } || exit 1',
      '[ -z "$STUB_CADDY_REJECTS" ] || ! grep -q "$STUB_CADDY_REJECTS" "$3" || exit 1',
      '[ -z "$STUB_WHOLE_REJECTS" ] || [ "$(basename "$3")" != Caddyfile ] || ! cat "$STUB_PREVIEW_DIR"/*.caddy 2>/dev/null | grep -q "$STUB_WHOLE_REJECTS" || exit 1',
      'exit 0',
    ].join('\n'),
  )
  stub(
    'reload-caddy',
    [
      'echo reload >> "$STUB_LOG"',
      SEES_AND_DUPLICATES + ' || exit 1',
      '[ -z "$STUB_PAUSE" ] || { touch "$STUB_STATE/paused"; /bin/sleep 1; }',
      '[ -z "$STUB_RELOAD_FAILS" ] || ! cat "$STUB_PREVIEW_DIR"/*.caddy 2>/dev/null | grep -q "$STUB_RELOAD_FAILS" || exit 1',
    ].join('\n'),
  )
  stub('sleep', 'exec /bin/sleep 0.02')
  // Production answers 200 (502 when STUB_PROD_DOWN is set, or after a reload when STUB_DOWN_AFTER_RELOAD
  // is). The developer address answers only when its block is in the folder and `current` holds files,
  // as Caddy would; STUB_DEV_FAIL_FIRST makes the first n asks for `/` fail (the certificate on its way).
  // The other STUB_* values spoil one thing a visitor would get.
  stub(
    'curl',
    [
      'echo "curl $*" >> "$STUB_LOG"',
      'url="${@: -1}"; rest="${url#https://}"; host="${rest%%/*}"; path="/${rest#*/}"; [ "$rest" != "$host" ] || path=/',
      'mode=body; case "$*" in *"-D -"*) mode=headers ;; *-w*) mode=status ;; esac',
      'if [ "$host" = sprechereast.com ]; then',
      '  code=200; [ -z "$STUB_PROD_DOWN" ] || code=502',
      '  [ -z "$STUB_DOWN_AFTER_RELOAD" ] || ! grep -q "^reload" "$STUB_LOG" || code=502',
      '  [ "$mode" = status ] && echo "$code" || echo ok; exit 0',
      'fi',
      'served=no; [ -f "$STUB_PREVIEW_DIR/developer.caddy" ] && [ -f "$STUB_DEV_ROOT/current/index.html" ] && served=yes',
      'if [ "$path" = / ] && [ "$mode" = status ]; then',
      '  n=$(( $(cat "$STUB_STATE/asks" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$STUB_STATE/asks"',
      '  [ "$n" -gt "${STUB_DEV_FAIL_FIRST:-0}" ] || served=no',
      'fi',
      '[ "$served" = yes ] || { [ "$mode" = status ] && echo 000; exit 1; }',
      'code=404; file=""',
      'case "$path" in / ) code=200; file=index.html ;; /showcase/index.html) code=200; file=showcase/index.html ;; /robots.txt) code=200 ;; esac',
      '[ -z "$STUB_LEAK" ] || case " $STUB_LEAK " in *" $path "*) code=200 ;; esac',
      '[ -z "$STUB_BAD_PATHS" ] || case " $STUB_BAD_PATHS " in *" $path "*) code=500 ;; esac',
      'if [ "$mode" = status ]; then echo "$code"; exit 0; fi',
      'if [ "$mode" = headers ]; then',
      '  echo "HTTP/2 $code"',
      '  [ -n "$STUB_NO_NOINDEX" ] || echo "X-Robots-Tag: noindex, nofollow"',
      '  [ -z "$STUB_HSTS" ] || echo "Strict-Transport-Security: max-age=31536000"',
      '  exit 0',
      'fi',
      'if [ "$path" = /robots.txt ]; then printf "User-agent: *\\n%s\\n" "${STUB_ROBOTS_LINE:-Disallow: /}"; exit 0; fi',
      'cat "$STUB_DEV_ROOT/current/$file" 2>/dev/null',
    ].join('\n'),
  )
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const spawnRun = (release, env) => {
  const child = spawn('bash', [p('app/releases', release, 'ops/developer-site.sh')], {
    env: {
      PATH: `${p('bin')}:${process.env.PATH}`,
      HOME: dir,
      APP_DIR: p('app'),
      CODE_DIR: p('app/releases', release),
      CADDYFILE: p('caddy/Caddyfile'),
      PREVIEW_CADDY_DIR: p('caddy/previews'),
      PREVIEW_HEADERS_FILE: p('caddy/sprecher-east-preview-headers.caddy'),
      DEVELOPER_ROOT: p('dev'),
      RELOAD_CADDY: p('bin/reload-caddy'),
      UP_WAIT: '1',
      UP_WAIT_AFTER: '1',
      DEVELOPER_UP_SECONDS: '0',
      DEVELOPER_UP_SECONDS_NEW: '0',
      DEVELOPER_LOCK_WAIT: '1',
      STUB_LOG: p('log'),
      STUB_STATE: p('state'),
      STUB_PREVIEW_DIR: p('caddy/previews'),
      STUB_DEV_ROOT: p('dev'),
      ...env,
    },
  })
  const done = new Promise((resolve) => {
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
  })
  return { child, done }
}
const run = (release = 'r1', env = {}) => spawnRun(release, env).done

/** A developer site already published from r1, then a newer live release r2 ready to publish. */
async function publishedThenNewRelease() {
  const first = await run('r1')
  expect(first.code, first.out).toBe(0)
  makeRelease('r2')
  fs.writeFileSync(p('log'), '')
}
const stays = (name = 'r1') => {
  expect(current()).toBe(`releases/${name}`)
  expect(fs.readFileSync(p('dev/current/showcase/index.html'), 'utf8')).toContain(`<title>${name}`)
}

describe('developer-site.sh: the first publish', () => {
  it('serves the index page, the 404 page and the showcase from the release folder `current` points at', async () => {
    const { code, out } = await run()
    expect(code, out).toBe(0)
    expect(out).toContain(`Developer site published: https://${HOST} serves release r1`)
    expect(current()).toBe('releases/r1')
    expect(fs.readdirSync(p('dev/current')).sort()).toEqual([
      '404.html',
      'index.html',
      'showcase',
      'style.css',
    ])
    expect(read('dev/current/index.html')).toContain('Sprecher East developer site')
    expect(read('dev/current/showcase/assets/app.js')).toContain('"r1"')
    expect(releases()).toEqual(['r1'])
  })

  it('writes the block from the template: the name, the folder `current`, the shared headers; Caddy checks it alone, then whole', async () => {
    await run()
    expect(block()).toContain(`${HOST} {`)
    expect(block()).toContain(`import ${p('caddy/sprecher-east-preview-headers.caddy')}`)
    expect(block()).toContain(`root * ${p('dev/current')}`)
    expect(block()).not.toContain('__')
    expect(fs.readdirSync(p('caddy/previews'))).toEqual(['developer.caddy'])
    expect((fs.statSync(p('caddy/previews/developer.caddy')).mode & 0o777).toString(8)).toBe('644')
    const checks = lines('validate')
    expect(checks.map((l) => l.replace(/\.[A-Za-z0-9]{6}$/, '.<temp>'))).toEqual([
      'validate Caddyfile', // before anything: the current config is fine
      'validate developer.caddy.<temp>', // the block, alone, before it is in the folder
      'validate Caddyfile', // the whole config with it
    ])
    expect(reloads()).toBe(1)
  })

  it('never edits the Caddyfile: the previews’ import is already there', async () => {
    const before = caddyfile()
    await run()
    expect(caddyfile()).toBe(before)
  })

  it(`leaves no temporary file in the previews' folder or the releases folder`, async () => {
    await run()
    expect(fs.readdirSync(p('caddy/previews'))).toEqual(['developer.caddy'])
    expect(fs.readdirSync(p('dev/releases'))).toEqual(['r1'])
  })

  it('asks the address for what a visitor gets, through Caddy on this machine', async () => {
    await run()
    const asks = lines('curl').filter((l) => l.includes(`https://${HOST}`))
    for (const path of [
      '/',
      '/showcase/index.html',
      '/robots.txt',
      '/api/version',
      '/admin',
      '/.env.local',
    ])
      expect(
        asks.some((l) => l.endsWith(`https://${HOST}${path}`)),
        path,
      ).toBe(true)
    expect(asks.every((l) => l.includes(`--resolve ${HOST}:443:127.0.0.1`))).toBe(true)
  })
})

describe('developer-site.sh: a newer release replaces the developer site in one step', () => {
  it('points `current` at the new release, keeps the old one, and reloads Caddy no more (the block is the same)', async () => {
    await publishedThenNewRelease()
    const { code, out } = await run('r2')
    expect(code, out).toBe(0)
    expect(current()).toBe('releases/r2')
    expect(read('dev/current/showcase/index.html')).toContain('r2')
    expect(releases()).toEqual(['r1', 'r2'])
    expect(reloads()).toBe(0)
    expect(lines('validate').length).toBe(2) // the Caddyfile, the block alone (it is the same, so no move)
  })

  it('keeps the newest releases and removes older ones, never the live one or the one before it', async () => {
    await publishedThenNewRelease()
    fs.utimesSync(p('dev/releases/r1'), 100, 100)
    await run('r2')
    makeRelease('r3')
    await run('r3')
    expect(releases()).toEqual(['r2', 'r3'])
    expect(current()).toBe('releases/r3')
  })

  it('removes a staging folder an earlier run left behind', async () => {
    await publishedThenNewRelease()
    fs.mkdirSync(p('dev/releases/.incoming-old'))
    await run('r2')
    expect(releases()).toEqual(['r1', 'r2'])
  })

  it('replaces a block that changed, with the previous one put back if anything goes wrong', async () => {
    await publishedThenNewRelease()
    const old = '# an older block\n' + block()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), old)
    const { code } = await run('r2')
    expect(code).toBe(0)
    expect(block()).not.toContain('an older block')
    expect(reloads()).toBe(1)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual(['developer.caddy'])
  })

  it('is a no-op for the files when asked again for the release that is already served, and still checks the block', async () => {
    await publishedThenNewRelease()
    await run('r2')
    fs.writeFileSync(p('log'), '')
    const again = await run('r2')
    expect(again.code, again.out).toBe(0)
    expect(current()).toBe('releases/r2')
    expect(releases()).toEqual(['r1', 'r2'])
  })
})

describe('developer-site.sh: it changes nothing, and says why, when it should not run', () => {
  const unchanged = () => {
    expect(fs.existsSync(p('dev'))).toBe(false)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual([])
    expect(reloads()).toBe(0)
  }

  it('without a built showcase in the release', async () => {
    fs.rmSync(p('app/releases/r1/developer-site'), { recursive: true })
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('has no built showcase')
    unchanged()
  })

  it('and keeps the previous developer site when the new release has none', async () => {
    await publishedThenNewRelease()
    fs.rmSync(p('app/releases/r2/developer-site'), { recursive: true })
    const { code, out } = await run('r2')
    expect(code).toBe(0)
    expect(out).toContain('has no built showcase')
    stays()
  })

  it('when the release is not the live one any more', async () => {
    makeRelease('r2')
    const { code, out } = await run('r1')
    expect(code).toBe(0)
    expect(out).toContain('not the live release any more')
    unchanged()
  })

  it('when nothing is live at all', async () => {
    fs.rmSync(p('app/current'))
    const { out } = await run()
    expect(out).toContain('not the live release any more')
    unchanged()
  })

  it('without the pages or the block template in the release', async () => {
    fs.rmSync(p('app/releases/r1/ops/developer-site/404.html'))
    expect((await run()).out).toContain('pages or block template are missing')
    makeRelease('r1')
    fs.rmSync(p('app/releases/r1/ops/caddy/developer-site.caddy'))
    expect((await run()).out).toContain('pages or block template are missing')
    unchanged()
  })

  it('when Caddy is not installed', async () => {
    fs.rmSync(p('bin/caddy'))
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('Caddy or')
    expect(out).toContain('was not found')
    unchanged()
  })

  it('when there is no Caddyfile', async () => {
    fs.rmSync(p('caddy/Caddyfile'))
    expect((await run()).out).toContain('was not found')
    unchanged()
  })

  it(`when the Caddyfile does not import the previews' folder (caddy-previews.sh adds the line)`, async () => {
    write(p('caddy/Caddyfile'), 'sprechereast.com {\n\treverse_proxy localhost:3000\n}\n')
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('does not import')
    expect(caddyfile()).not.toContain('import')
    unchanged()
  })

  it('when the headers file on the server is not this release’s copy', async () => {
    fs.appendFileSync(p('caddy/sprecher-east-preview-headers.caddy'), '# edited by hand\n')
    expect((await run()).out).toContain(`is not this release's copy`)
    unchanged()
  })

  it('when the current Caddyfile does not validate', async () => {
    const { out } = await run('r1', { STUB_CADDYFILE_BAD: '1' })
    expect(out).toContain('does not validate')
    unchanged()
  })

  it('when production does not answer before it starts, so a failure afterwards means this change', async () => {
    const { out } = await run('r1', { STUB_PROD_DOWN: '1' })
    expect(out).toContain('did not answer 200 through Caddy')
    unchanged()
  })

  it('for a pull request preview, which never publishes it', async () => {
    const { code, out } = await run('r1', { PREVIEW_NUMBER: '7' })
    expect(code).toBe(0)
    expect(out).toContain('never publishes the developer site')
    unchanged()
  })

  it('when another change to Caddy holds the lock, without waiting for it long', async () => {
    const lock = p('caddy/.sprecher-east-caddy.lock')
    const holder = spawn('flock', [lock, 'sleep', '5'])
    await new Promise((r) => setTimeout(r, 300))
    try {
      const { code, out } = await run()
      expect(code).toBe(0)
      expect(out).toContain('another change to Caddy is running')
      unchanged()
    } finally {
      holder.kill()
    }
  })

  for (const [what, env, says] of [
    ['a release name with a space', null, 'release name'],
    ['a release name that starts with a dot', 'name:.hidden', 'release name'],
    ['a release name that starts with a dash', 'name:-x', 'release name'],
    ['a developer root with a brace', () => ({ DEVELOPER_ROOT: p('dev {x}') }), "can't hold"],
    [
      'a headers path with a brace',
      () => ({ PREVIEW_HEADERS_FILE: p('caddy/he {x}.caddy') }),
      "can't hold",
    ],
    [
      'a host that is not a host name',
      () => ({ PREVIEW_DOMAIN: 'dev.example.com {x}' }),
      'not a host name',
    ],
  ])
    it(`refuses ${what}`, async () => {
      if (typeof env !== 'function') {
        const odd = typeof env === 'string' ? env.slice(5) : 'r 1'
        fs.renameSync(p('app/releases/r1'), p('app/releases', odd))
        fs.rmSync(p('app/current'))
        fs.symlinkSync(`releases/${odd}`, p('app/current'))
        const { out } = await run(odd)
        expect(out).toContain(says)
      } else {
        const set = env()
        if (set.PREVIEW_HEADERS_FILE)
          fs.copyFileSync(p('caddy/sprecher-east-preview-headers.caddy'), set.PREVIEW_HEADERS_FILE)
        const { code, out } = await run('r1', set)
        expect(code).toBe(0)
        expect(out).toContain(says)
      }
      unchanged()
    })
})

describe('developer-site.sh: what is served is judged first', () => {
  it('serves nothing from a showcase that holds a link, and keeps the previous developer site', async () => {
    await publishedThenNewRelease()
    fs.symlinkSync('/etc/hostname', p('app/releases/r2/developer-site/showcase/assets/x.txt'))
    const { code, out } = await run('r2')
    expect(code).toBe(1)
    expect(out).toContain('did not pass its check')
    expect(out).toContain('a link: assets/x.txt')
    stays()
    expect(releases()).toEqual(['r1']) // the staging folder is gone too
    expect(reloads()).toBe(0)
  })

  it('serves nothing from a showcase that names a third-party font host', async () => {
    await publishedThenNewRelease()
    write(
      p('app/releases/r2/developer-site/showcase/assets/a.css'),
      'url(https://fonts.gstatic.com/x)',
    )
    const { code, out } = await run('r2')
    expect(code).toBe(1)
    expect(out).toContain('names a third-party font host')
    stays()
  })

  it('serves nothing from a showcase that carries no font file, and keeps the previous developer site', async () => {
    await publishedThenNewRelease()
    fs.rmSync(p('app/releases/r2/developer-site/showcase/assets/poppins-latin-400-normal.woff2'))
    const { code, out } = await run('r2')
    expect(code).toBe(1)
    expect(out).toContain('the showcase carries no font file')
    stays()
  })

  it('copies a link as a link, never what it points at, so a planted link to a secret file is refused, not read', async () => {
    fs.writeFileSync(path.join(dir, 'secret.txt'), 'TOP-SECRET')
    fs.symlinkSync(
      path.join(dir, 'secret.txt'),
      p('app/releases/r1/developer-site/showcase/leak.txt'),
    )
    const { out } = await run()
    expect(out).toContain('a link: leak.txt')
    expect(out).not.toContain('TOP-SECRET')
    expect(fs.existsSync(p('dev/current'))).toBe(false)
  })

  it('copies no ownership or odd mode from the release', async () => {
    fs.chmodSync(p('app/releases/r1/developer-site/showcase/assets/app.js'), 0o666)
    await run()
    expect((fs.statSync(p('dev/current/showcase/assets/app.js')).mode & 0o777).toString(8)).toBe(
      '644',
    )
  })
})

describe('developer-site.sh: Caddy is never left worse off', () => {
  it('a block Caddy rejects alone never reaches the folder, nothing reloads, the files are not switched', async () => {
    await publishedThenNewRelease()
    const before = block()
    const { code, out } = await run('r2', { STUB_CADDY_REJECTS: 'root' })
    expect(code).toBe(1)
    expect(out).toContain(`Caddy rejected the developer site's block`)
    expect(block()).toBe(before)
    expect(reloads()).toBe(0)
    stays()
  })

  it('a first block that Caddy rejects leaves no block and no `current`', async () => {
    const { code } = await run('r1', { STUB_CADDY_REJECTS: 'root' })
    expect(code).toBe(1)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual([])
    expect(fs.existsSync(p('dev/current'))).toBe(false)
  })

  it('a block Caddy accepts alone but not with the rest is taken out again, the old one put back', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block\n')
    const { code, out } = await run('r2', { STUB_WHOLE_REJECTS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(
      `rejected the config with the developer site's block; the previous block is back`,
    )
    expect(block()).toBe('# old block\n')
    expect(fs.readdirSync(p('caddy/previews'))).toEqual(['developer.caddy'])
    stays()
  })

  it('a reload that fails puts the previous block back and reloads again', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block\n')
    const { code, out } = await run('r2', { STUB_RELOAD_FAILS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(`would not reload with the developer site's block`)
    expect(out).toContain('the previous block is back')
    expect(block()).toBe('# old block\n')
    expect(reloads()).toBe(2) // the failed one, then the one that restores Caddy
    stays()
  })

  it('a config Caddy rejects, with the previous block that cannot be put back, says so and keeps its copy', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block\n')
    stub(
      'mv',
      'case "$*" in *developer.caddy.*" "*developer.caddy) echo x >> "$STUB_STATE/mvs"; [ "$(wc -l < "$STUB_STATE/mvs")" -lt 2 ] || exit 1 ;; esac; exec /bin/mv "$@"',
    )
    const { code, out } = await run('r2', { STUB_WHOLE_REJECTS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(
      "rejected the config with the developer site's block; the previous block could not be put back as it was",
    )
    expect(
      fs.readdirSync(p('caddy/previews')).filter((n) => n.startsWith('developer.caddy.')),
    ).toHaveLength(1)
  })

  it('a first block that Caddy rejects is taken out again, and the message says that', async () => {
    const { code, out } = await run('r1', { STUB_WHOLE_REJECTS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(
      "rejected the config with the developer site's block; the new block is taken out",
    )
    expect(fs.readdirSync(p('caddy/previews'))).toEqual([])
  })

  // the line ends with the block's own name: the temp file has the block's name as a prefix, so a prefix check is not enough
  const staysAs = (out, file) =>
    expect(out).toMatch(
      new RegExp(`the new block could not be taken out and stays as ${file}(;|$)`, 'm'),
    )

  it('a first block that cannot be taken out stays, and the message names it and no copy', async () => {
    stub('rm', 'case "$*" in *" "*/developer.caddy) exit 1 ;; esac; exec /bin/rm "$@"')
    const { code, out } = await run('r1', { STUB_WHOLE_REJECTS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(
      "rejected the config with the developer site's block; the new block could",
    )
    staysAs(out, p('caddy/previews/developer.caddy'))
    expect(out).not.toContain('a copy stays')
  })

  it('a first block whose reload fails and that cannot be taken out stays, and the message names it', async () => {
    stub('rm', 'case "$*" in *" "*/developer.caddy) exit 1 ;; esac; exec /bin/rm "$@"')
    const { code, out } = await run('r1', { STUB_RELOAD_FAILS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain('or the site stopped answering after it; the new block could')
    staysAs(out, p('caddy/previews/developer.caddy'))
  })

  it('a previous block that goes back but cannot be reloaded says so', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block, file_server\n')
    const { code, out } = await run('r2', { STUB_RELOAD_FAILS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(
      `the developer site's block, or the site stopped answering after it; the previous block is back, but Caddy would not reload it`,
    )
    expect(block()).toBe('# old block, file_server\n')
  })

  it('a previous block that cannot be put back after a failed reload says so, and its copy stays', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block\n')
    stub(
      'mv',
      'case "$*" in *developer.caddy.*" "*developer.caddy) echo x >> "$STUB_STATE/mvs"; [ "$(wc -l < "$STUB_STATE/mvs")" -lt 2 ] || exit 1 ;; esac; exec /bin/mv "$@"',
    )
    const { code, out } = await run('r2', { STUB_RELOAD_FAILS: 'file_server' })
    expect(code).toBe(1)
    expect(out).toContain(
      'or the site stopped answering after it; the previous block could not be put back as it was',
    )
    expect(out).not.toContain('is back')
    expect(
      fs.readdirSync(p('caddy/previews')).filter((n) => n.startsWith('developer.caddy.')),
    ).toHaveLength(1)
  })

  it('a first block whose reload fails is removed, with nothing left behind', async () => {
    const { code } = await run('r1', { STUB_RELOAD_FAILS: 'file_server' })
    expect(code).toBe(1)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual([])
    expect(reloads()).toBe(2)
  })

  it('production that stops answering after the reload gets the previous block back at once', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block\n')
    const { code, out } = await run('r2', { STUB_DOWN_AFTER_RELOAD: '1' })
    expect(code).toBe(1)
    expect(out).toContain('or the site stopped answering after it; the previous block is back')
    expect(block()).toBe('# old block\n')
    expect(reloads()).toBe(2)
    stays()
  })

  it('reports a failure as a warning, never an error, so the deploy does not turn red', async () => {
    const { out } = await run('r1', { STUB_CADDY_REJECTS: 'root' })
    expect(out).toContain('::warning title=Server::')
    expect(out).not.toContain('::error')
  })
})

describe('developer-site.sh: no copy or temp file is ever a block Caddy reads', () => {
  // The stand-in Caddy reads the folder's `*.caddy` and rejects two blocks naming one site, as real Caddy does.
  const sees = () =>
    fs
      .readFileSync(p('log'), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('sees:'))

  it('replacing the block, and putting it back after a failed reload, show Caddy one block', async () => {
    await publishedThenNewRelease()
    const old = `${HOST} {\n\t# old block, whole\n}\n`
    fs.writeFileSync(p('caddy/previews/developer.caddy'), old)
    fs.writeFileSync(p('log'), '')
    expect((await run('r2')).code).toBe(0)
    expect(sees().length).toBeGreaterThan(0)
    expect([...new Set(sees())]).toEqual(['sees: developer.caddy '])
    fs.writeFileSync(p('caddy/previews/developer.caddy'), old)
    fs.writeFileSync(p('log'), '')
    expect((await run('r2', { STUB_RELOAD_FAILS: 'file_server' })).code).toBe(1)
    expect(block()).toBe(old)
    expect([...new Set(sees())]).toEqual(['sees: developer.caddy '])
  })
})

describe('developer-site.sh: a step of putting the block in place that fails', () => {
  const old = '# old block, whole\n'
  const settled = async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), old)
  }
  const only = (what) =>
    expect(fs.readdirSync(p('caddy/previews')).filter((n) => !n.startsWith('.'))).toEqual(what)

  it('a copy of the previous block that stops half way leaves the previous block exactly as it was', async () => {
    await settled()
    // `cp -p` is the copy of the block; the staging copy (`cp -r`) is not affected
    stub('cp', 'case "$1" in -p) head -c 4 "$2" > "$3"; exit 1 ;; esac; exec /bin/cp "$@"')
    const { code, out } = await run('r2')
    expect(code).toBe(1)
    expect(out).toContain('could not be put in place; nothing was changed')
    expect(block()).toBe(old)
    only(['developer.caddy'])
    expect(reloads()).toBe(0)
    stays()
  })

  it('a rename of the new block that fails leaves the previous block exactly as it was, and reloads nothing', async () => {
    await settled()
    stub(
      'mv',
      'case "$*" in *developer.caddy.*" "*developer.caddy) exit 1 ;; esac; exec /bin/mv "$@"',
    )
    const { code, out } = await run('r2')
    expect(code).toBe(1)
    expect(out).toContain('could not be put in place; nothing was changed')
    expect(block()).toBe(old)
    only(['developer.caddy'])
    expect(reloads()).toBe(0)
    stays()
  })
})

describe('developer-site.sh: the release’s showcase is judged before it is copied', () => {
  it('refuses a file that is a hard link to something outside the showcase, which a copy would hide', async () => {
    fs.writeFileSync(p('app/.env.local.copy'), 'TOP-SECRET\n')
    fs.linkSync(
      p('app/.env.local.copy'),
      p('app/releases/r1/developer-site/showcase/assets/settings.txt'),
    )
    const { code, out } = await run()
    expect(code).toBe(1)
    expect(out).toContain('a file with another name elsewhere: assets/settings.txt')
    expect(out).toContain("the release's showcase did not pass its check")
    expect(out).not.toContain('TOP-SECRET')
    expect(fs.existsSync(p('dev/current'))).toBe(false)
    expect(fs.readdirSync(p('dev/releases'))).toEqual([])
  })
})

describe('developer-site.sh: the folder and the block file are the script’s own', () => {
  const refuses = async (env, says) => {
    const { code, out } = await run('r1', env)
    expect(code, out).toBe(0)
    expect(out).toContain(says)
    expect(fs.existsSync(p('dev/current'))).toBe(false)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual([])
    expect(reloads()).toBe(0)
    return out
  }

  it('refuses a folder inside production’s', async () => {
    await refuses({ DEVELOPER_ROOT: p('app/developer') }, 'is inside')
    expect(fs.existsSync(p('app/developer'))).toBe(false)
  })

  it('refuses production’s own folder, and one that reaches it through `..`', async () => {
    await refuses({ DEVELOPER_ROOT: p('app') }, 'is inside')
    await refuses({ DEVELOPER_ROOT: p('dev/../app/x') }, 'is inside')
  })

  it('refuses a folder that holds production’s, such as the folder above it', async () => {
    await refuses({ DEVELOPER_ROOT: dir }, 'holds')
  })

  it('refuses a folder reached through a link that leads into production’s', async () => {
    fs.symlinkSync(p('app'), p('sneaky'))
    await refuses({ DEVELOPER_ROOT: p('sneaky/inner') }, 'is inside')
  })

  it('refuses a folder inside the previews’ folder, and one inside Caddy’s own', async () => {
    await refuses({ PREVIEW_ROOT: p('previews'), DEVELOPER_ROOT: p('previews/dev') }, 'is inside')
    await refuses({ DEVELOPER_ROOT: p('caddy/dev') }, 'is inside')
  })

  it('refuses a folder inside Caddy’s storage folder, where its certificates and keys are', async () => {
    fs.mkdirSync(p('caddy-storage'))
    await refuses(
      { CADDY_STORAGE_DIR: p('caddy-storage'), DEVELOPER_ROOT: p('caddy-storage/dev') },
      'is inside',
    )
  })

  // `developer-site` of the release being published is a link into another release's folder.
  const linkedInto = async (other) => {
    makeRelease(other, { live: false })
    fs.rmSync(p('app/releases/r1/developer-site'), { recursive: true })
    fs.symlinkSync(p('app/releases', other, 'developer-site'), p('app/releases/r1/developer-site'))
    await refuses({}, 'is not inside the release')
  }

  it('refuses a showcase that is another release’s, so the check is the release’s folder and not the folder of releases', async () => {
    await linkedInto('r0')
  })

  it('refuses a showcase in a release whose name starts with this one’s (r10 for r1)', async () => {
    await linkedInto('r10')
  })

  it('accepts the release’s own showcase when its folder is reached through a link', async () => {
    fs.mkdirSync(p('alias'))
    fs.symlinkSync(p('app/releases/r1'), p('alias/r1'))
    const { code, out } = await run('r1', { CODE_DIR: p('alias/r1') })
    expect(code, out).toBe(0)
    expect(out).toContain('Developer site published')
  })

  it('refuses a showcase folder that is a link leading out of the release’s folder', async () => {
    const real = p('elsewhere/showcase')
    fs.mkdirSync(path.dirname(real), { recursive: true })
    fs.cpSync(p('app/releases/r1/developer-site/showcase'), real, { recursive: true })
    fs.rmSync(p('app/releases/r1/developer-site/showcase'), { recursive: true })
    fs.symlinkSync(real, p('app/releases/r1/developer-site/showcase'))
    await refuses({}, 'is not inside the release')
  })

  it('refuses a folder inside the previews’ block folder when that is not Caddy’s own folder', async () => {
    fs.mkdirSync(p('other/previews'), { recursive: true })
    await refuses(
      { PREVIEW_CADDY_DIR: p('other/previews'), DEVELOPER_ROOT: p('other/previews/dev') },
      'is inside',
    )
  })

  it('compares the previews’ folder after links are resolved too', async () => {
    fs.mkdirSync(p('previews'))
    fs.symlinkSync(p('previews'), p('previews-link'))
    await refuses(
      { PREVIEW_ROOT: p('previews-link'), DEVELOPER_ROOT: p('previews/dev') },
      'is inside',
    )
  })

  it('refuses the root of the disk', async () => {
    await refuses({ DEVELOPER_ROOT: '//' }, 'the root of the disk')
  })

  it('takes the block file from the previews’ folder only, whatever the environment names', async () => {
    const before = caddyfile()
    const { code, out } = await run('r1', { DEVELOPER_CADDY_FILE: p('caddy/Caddyfile') })
    expect(code, out).toBe(0)
    expect(caddyfile()).toBe(before)
    expect(block()).toContain(HOST)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual(['developer.caddy'])
  })
})

describe('developer-site.sh: what the release must hold, and what it keeps', () => {
  it('skips, changing nothing, when the release has no style sheet for its pages', async () => {
    fs.rmSync(p('app/releases/r1/ops/developer-site/style.css'))
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('pages or block template are missing')
    expect(fs.existsSync(p('dev'))).toBe(false)
  })

  it('keeps as many releases as DEVELOPER_KEEP_RELEASES says', async () => {
    await publishedThenNewRelease()
    await run('r2')
    for (const [i, name] of ['r3', 'r4'].entries()) {
      makeRelease(name)
      fs.utimesSync(p('dev/releases/r1'), 10, 10)
      fs.utimesSync(p('dev/releases/r2'), 20 + i, 20 + i)
      await run(name, { DEVELOPER_KEEP_RELEASES: '3' })
    }
    expect(releases()).toEqual(['r2', 'r3', 'r4'])
  })

  it('leaves the copy of the previous block in the folder, named, when it cannot be put back after a failed live check', async () => {
    await publishedThenNewRelease()
    fs.appendFileSync(p('app/releases/r2/ops/caddy/developer-site.caddy'), '# a later change\n')
    // the first move into the folder is the new block; the second is the previous one coming back
    stub(
      'mv',
      'case "$*" in *developer.caddy.*" "*developer.caddy) echo x >> "$STUB_STATE/mvs"; [ "$(wc -l < "$STUB_STATE/mvs")" -lt 2 ] || exit 1 ;; esac; exec /bin/mv "$@"',
    )
    const { code, out } = await run('r2', { STUB_NO_NOINDEX: '1' })
    expect(code).toBe(1)
    expect(out).toContain('its files are back on r1')
    expect(out).toContain(
      'its files are back on r1; the previous block could not be put back as it was',
    )
    expect(
      fs.readdirSync(p('caddy/previews')).filter((n) => n.startsWith('developer.caddy.')),
    ).toHaveLength(1)
    expect(current()).toBe('releases/r1')
  })
})

describe('developer-site.sh: the live check, and going back', () => {
  const spoils = [
    ['`/` that does not answer 200', { STUB_BAD_PATHS: '/' }, '/ answered 500'],
    [
      'a showcase that does not answer 200',
      { STUB_BAD_PATHS: '/showcase/index.html' },
      '/showcase/index.html answered 500',
    ],
    ['no noindex header', { STUB_NO_NOINDEX: '1' }, 'does not send noindex'],
    ['an HSTS header', { STUB_HSTS: '1' }, 'sends HSTS'],
    [
      'a robots.txt that allows something',
      { STUB_ROBOTS_LINE: 'Disallow: /private' },
      'robots.txt does not disallow',
    ],
    [
      'an `/api/version` that answers (the app is behind the name)',
      { STUB_LEAK: '/api/version' },
      '/api/version answered 200',
    ],
    ['an `/admin` that answers', { STUB_LEAK: '/admin' }, '/admin answered 200'],
    [
      'an `/api/version` that fails',
      { STUB_BAD_PATHS: '/api/version' },
      '/api/version answered 500',
    ],
    ['an `/admin` that fails', { STUB_BAD_PATHS: '/admin' }, '/admin answered 500'],
    ['an `/.env.local` that fails', { STUB_BAD_PATHS: '/.env.local' }, '/.env.local answered 500'],
    ['an `/.env.local` that answers', { STUB_LEAK: '/.env.local' }, '/.env.local answered 200'],
  ]
  for (const [what, env, says] of spoils) {
    it(`goes back to the previous developer site on ${what}`, async () => {
      await publishedThenNewRelease()
      const { code, out } = await run('r2', env)
      expect(code).toBe(1)
      expect(out).toContain(says)
      expect(out).toContain('back on r1')
      stays()
    })

    it(`with no earlier version, warns on ${what} and leaves the new files`, async () => {
      const { code, out } = await run('r1', env)
      expect(code).toBe(1)
      expect(out).toContain(says)
      expect(out).toContain('no earlier version to go back to')
      expect(current()).toBe('releases/r1')
    })
  }

  it('puts the block it replaced back too when the live check fails, and the files with it', async () => {
    await publishedThenNewRelease()
    const before = block()
    const template = p('app/releases/r2/ops/caddy/developer-site.caddy')
    fs.appendFileSync(template, '# a later change to the template\n')
    const { code, out } = await run('r2', { STUB_NO_NOINDEX: '1' })
    expect(code).toBe(1)
    expect(out).toContain('its files are back on r1; the previous block is back')
    expect(block()).toBe(before)
    expect(fs.readdirSync(p('caddy/previews'))).toEqual(['developer.caddy'])
    expect(reloads()).toBe(2) // the new block, then the previous one
    stays()
  })

  it('says so when the block it replaced goes back but Caddy will not reload it', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('caddy/previews/developer.caddy'), '# old block, rejectme\n')
    const { code, out } = await run('r2', { STUB_NO_NOINDEX: '1', STUB_RELOAD_FAILS: 'rejectme' })
    expect(code).toBe(1)
    expect(out).toContain(
      'its files are back on r1; the previous block is back, but Caddy would not reload it',
    )
  })

  it('leaves the block alone when the live check fails and the block did not change', async () => {
    await publishedThenNewRelease()
    const { out } = await run('r2', { STUB_NO_NOINDEX: '1' })
    expect(out).toContain('its files are back on r1')
    expect(reloads()).toBe(0)
  })

  it('waits longer for the address when its block is new (the certificate is ordered then)', async () => {
    const { code, out } = await run('r1', {
      STUB_DEV_FAIL_FIRST: '1',
      DEVELOPER_UP_SECONDS_NEW: '10',
    })
    expect(code, out).toBe(0)
    expect(lines('curl').filter((l) => l.endsWith(`https://${HOST}/`)).length).toBeGreaterThan(1)
  })

  it('does not give a new block’s time to a block already in place', async () => {
    await publishedThenNewRelease()
    fs.writeFileSync(p('state/asks'), '0')
    const { code, out } = await run('r2', {
      STUB_DEV_FAIL_FIRST: '1',
      DEVELOPER_UP_SECONDS_NEW: '10',
      DEVELOPER_UP_SECONDS: '0',
    })
    expect(code).toBe(1)
    expect(out).toContain('back on r1')
    stays()
  })

  it('does not give the usual time to a first block either', async () => {
    const { code, out } = await run('r1', {
      STUB_DEV_FAIL_FIRST: '1',
      DEVELOPER_UP_SECONDS_NEW: '0',
      DEVELOPER_UP_SECONDS: '10',
    })
    expect(code).toBe(1)
    expect(out).toContain('no earlier version to go back to')
  })
})

describe('developer-site.sh: leftovers, the folder being served, and what is kept', () => {
  it('starts from an empty staging folder, so an earlier run’s leftovers are never published', async () => {
    write(p('dev/releases/.incoming-r1/leftover.txt'), 'old\n')
    const { code, out } = await run()
    expect(code, out).toBe(0)
    expect(fs.existsSync(p('dev/current/leftover.txt'))).toBe(false)
    expect(fs.readdirSync(p('dev/current')).sort()).toEqual([
      '404.html',
      'index.html',
      'showcase',
      'style.css',
    ])
  })

  it('replaces a release folder of the same name that an earlier, failed run left (not served)', async () => {
    const failed = await run('r1', { STUB_CADDY_REJECTS: 'root' })
    expect(failed.code).toBe(1)
    expect(releases()).toEqual(['r1']) // moved in before the block was tried, never switched to
    write(p('dev/releases/r1/stale.txt'), 'stale\n')
    const { code, out } = await run()
    expect(code, out).toBe(0)
    expect(fs.existsSync(p('dev/releases/r1/stale.txt'))).toBe(false)
    expect(current()).toBe('releases/r1')
  })

  it('never replaces the folder that is being served when the same release is published again', async () => {
    await publishedThenNewRelease()
    await run('r2')
    write(p('dev/releases/r2/marker.txt'), 'the served folder, untouched\n')
    const { code } = await run('r2')
    expect(code).toBe(0)
    expect(read('dev/releases/r2/marker.txt')).toContain('untouched')
  })

  it('does not go back to itself when the same release fails its live check: there is no earlier version', async () => {
    await publishedThenNewRelease()
    await run('r2')
    const { code, out } = await run('r2', { STUB_NO_NOINDEX: '1' })
    expect(code).toBe(1)
    expect(out).toContain('no earlier version to go back to')
    expect(out).not.toContain('it is back on')
    expect(current()).toBe('releases/r2')
  })

  it('leaves a hidden folder in the releases folder alone, whatever its age', async () => {
    await publishedThenNewRelease()
    fs.mkdirSync(p('dev/releases/.notes'))
    fs.utimesSync(p('dev/releases/.notes'), 50, 50)
    await run('r2', { DEVELOPER_KEEP_RELEASES: '2' })
    expect(fs.existsSync(p('dev/releases/.notes'))).toBe(true)
  })

  it('serves a file readable by Caddy when the build left it readable only by its owner', async () => {
    fs.chmodSync(p('app/releases/r1/developer-site/showcase/index.html'), 0o600)
    fs.chmodSync(p('app/releases/r1/developer-site/showcase'), 0o700)
    const { code, out } = await run()
    expect(code, out).toBe(0)
    const mode = (f) => fs.statSync(p('dev/current', f)).mode & 0o777
    expect(mode('showcase/index.html')).toBe(0o644)
    expect(mode('showcase')).toBe(0o755)
  })

  it('keeps going when the terminal hangs up, so a dropped SSH session never stops it between a change and its rollback', async () => {
    const { child, done } = spawnRun('r1', { STUB_PAUSE: '1' })
    for (let i = 0; i < 100 && !fs.existsSync(p('state/paused')); i++)
      await new Promise((r) => setTimeout(r, 50))
    expect(fs.existsSync(p('state/paused'))).toBe(true)
    child.kill('SIGHUP')
    const { code, out } = await done
    expect(code, out).toBe(0)
    expect(current()).toBe('releases/r1')
  })

  it('keeps at least two releases whatever the setting says', async () => {
    await publishedThenNewRelease()
    await run('r2', { DEVELOPER_KEEP_RELEASES: '1' })
    expect(releases()).toEqual(['r1', 'r2'])
    makeRelease('r3')
    fs.utimesSync(p('dev/releases/r1'), 100, 100)
    await run('r3', { DEVELOPER_KEEP_RELEASES: 'nonsense' })
    expect(releases()).toEqual(['r2', 'r3'])
  })

  it('never removes the release just published or the one served before it, even when two newer folders push them out', async () => {
    await publishedThenNewRelease()
    await run('r2')
    makeRelease('r3')
    fs.utimesSync(p('dev/releases/r1'), 100, 100)
    fs.utimesSync(p('dev/releases/r2'), 200, 200) // served until now, and older than the two below
    const future = Date.now() / 1000 + 10000
    for (const name of ['rA', 'rB']) {
      fs.mkdirSync(p('dev/releases', name))
      fs.utimesSync(p('dev/releases', name), future, future)
    }
    await run('r3', { DEVELOPER_KEEP_RELEASES: '2' })
    // r3 (just published, older than rA and rB by time) and r2 (served before it) stay; only r1 goes
    expect(releases()).toEqual(['r2', 'r3', 'rA', 'rB'])
    expect(current()).toBe('releases/r3')
  })

  it('makes the developer folder and its releases folder readable by Caddy and writable only by their owner', async () => {
    await run()
    for (const where of ['dev', 'dev/releases', 'dev/releases/r1'])
      expect((fs.statSync(p(where)).mode & 0o777).toString(8), where).toBe('755')
  })

  it('refuses a template with a placeholder it does not fill, of either family', async () => {
    for (const placeholder of ['__DEVELOPER_NOPE__', '__PREVIEW_NOPE__']) {
      fs.appendFileSync(p('app/releases/r1/ops/caddy/developer-site.caddy'), `# ${placeholder}\n`)
      const { code, out } = await run()
      expect(code, placeholder).toBe(1)
      expect(out).toContain(`has a placeholder this script doesn't fill`)
      expect(fs.readdirSync(p('caddy/previews'))).toEqual([])
      makeRelease('r1')
    }
  })

  it('has the settings environment.sh names, in one place', () => {
    const values = spawnSync(
      'bash',
      [
        '-c',
        `. ${path.join(OPS, 'environment.sh')}; echo "$DEVELOPER_ROOT $DEVELOPER_KEEP_RELEASES $DEVELOPER_MAX_BYTES $DEVELOPER_UP_SECONDS_NEW $DEVELOPER_UP_SECONDS $DEVELOPER_LOCK_WAIT"`,
      ],
      { encoding: 'utf8', env: { PATH: process.env.PATH } },
    ).stdout.trim()
    expect(values).toBe('/var/www/sprecher-east-developer 2 104857600 120 20 30')
  })
})

describe('developer-site.sh: it touches only its own places', () => {
  it('writes only under the developer root and the one block file', async () => {
    const snapshot = (root) =>
      spawnSync('find', [root, '-printf', '%p %y %l\\n'], { encoding: 'utf8' }).stdout
    const before = snapshot(p('app'))
    await run()
    expect(snapshot(p('app'))).toBe(before)
    expect(fs.readdirSync(p('caddy')).sort()).toEqual([
      '.sprecher-east-caddy.lock',
      'Caddyfile',
      'previews',
      'sprecher-east-preview-headers.caddy',
    ])
  })

  it('leaves the preview scripts’ count alone: the block is not `pr-*.caddy`', async () => {
    await run()
    expect(fs.readdirSync(p('caddy/previews')).filter((f) => /^pr-.*\.caddy$/.test(f))).toEqual([])
  })
})

describe('the developer site’s block template', () => {
  const template = fs.readFileSync(path.join(OPS, 'caddy/developer-site.caddy'), 'utf8')
  const directives = template
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean)

  it('serves static files only: no proxy, no application, no form limits', () => {
    expect(directives.join('\n')).not.toMatch(
      /reverse_proxy|php_fastcgi|forward_auth|exec|\bimport .*limits/,
    )
    expect(directives).toContain('file_server')
  })

  it('imports only the previews’ headers snippet, never the HSTS file, for a page and for an error', () => {
    const imports = directives.filter((l) => l.startsWith('import '))
    expect(imports).toEqual(['import __PREVIEW_HEADERS_FILE__', 'import __PREVIEW_HEADERS_FILE__'])
    // one in the site, before it serves anything, and one in handle_errors
    expect(template.indexOf('import __PREVIEW_HEADERS_FILE__')).toBeLessThan(
      template.indexOf('handle_errors'),
    )
    expect(template).not.toMatch(/^[^#]*(hsts\.caddy|Strict-Transport-Security)/m)
  })

  it('compresses what it sends', () => {
    expect(directives).toContain('encode zstd gzip')
  })

  it('serves one root, the placeholder the script fills with the developer folder', () => {
    expect(directives.filter((l) => l.startsWith('root '))).toEqual(['root * __DEVELOPER_ROOT__'])
  })

  it('has one site address, the placeholder for the host', () => {
    expect(directives.filter((l) => l.endsWith('{') && !/^(handle_errors|encode)/.test(l))).toEqual(
      ['__DEVELOPER_HOST__ {'],
    )
  })

  it('sends the noindex header on a wrong path too, and the 404 page keeps its status', () => {
    const errors = template.slice(template.indexOf('handle_errors'))
    expect(errors).toContain('import __PREVIEW_HEADERS_FILE__')
    expect(errors).toContain('rewrite * /404.html')
    expect(errors).toContain('file_server')
  })

  it('has every placeholder the script fills, and no other', () => {
    expect([...new Set(template.match(/__[A-Z_]+__/g))].sort()).toEqual([
      '__DEVELOPER_HOST__',
      '__DEVELOPER_ROOT__',
      '__PREVIEW_HEADERS_FILE__',
    ])
  })

  it('answers for the one name every preview address hangs from, which is not a preview’s own', () => {
    const env = spawnSync(
      'bash',
      [
        '-c',
        `. ${path.join(OPS, 'environment.sh')}; echo "$DEVELOPER_HOST $PREVIEW_DOMAIN $DEVELOPER_CADDY_FILE $PREVIEW_CADDY_DIR"`,
      ],
      {
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
      },
    )
      .stdout.trim()
      .split(' ')
    expect(env[0]).toBe(env[1])
    expect(env[2]).toBe(`${env[3]}/developer.caddy`)
    expect(path.basename(env[2])).not.toMatch(/^pr-/)
  })
})

describe('the developer site’s pages', () => {
  const index = fs.readFileSync(path.join(OPS, 'developer-site/index.html'), 'utf8')
  const notFound = fs.readFileSync(path.join(OPS, 'developer-site/404.html'), 'utf8')
  const stylesheet = fs.readFileSync(path.join(OPS, 'developer-site/style.css'), 'utf8')
  const text = (html) =>
    html
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')

  it('says it is unofficial tooling for the people building the site, and that it needs no sign-in', () => {
    expect(text(index)).toContain('workshop for the people building the Sprecher East website')
    expect(text(index)).toContain('unofficial tooling')
    expect(text(index)).toContain('without signing in')
  })

  it('links to the showcase by a path that works under the folder it is served from', () => {
    expect(index).toContain('<a href="showcase/index.html">Component showcase</a>')
  })

  it('marks a place for the system map with no link, so nothing leads nowhere', () => {
    const map = index.slice(
      index.indexOf('id="system-map"'),
      index.indexOf('</li>', index.indexOf('id="system-map"')),
    )
    expect(map).toContain('System map')
    expect(map).toContain('Coming soon')
    expect(map).not.toContain('<a')
  })

  it('points to the neighborhood site and asks for nothing from a third party', () => {
    const urls = [...(index + notFound).matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map((m) => m[1])
    expect(urls).toEqual(['https://sprechereast.com'])
    expect(index + notFound).not.toMatch(/<script|@import|url\(/)
    expect(stylesheet).not.toMatch(/@import|url\(/)
  })

  it('has one stylesheet, from the same place, that both pages link and neither repeats', () => {
    for (const page of [index, notFound]) {
      expect(page.match(/<link[^>]*>/g)).toEqual(['<link rel="stylesheet" href="/style.css" />'])
      expect(page).not.toContain('<style')
    }
    expect(stylesheet).toContain('body {')
  })

  it('keeps itself out of search engines and follows the visitor’s light or dark setting', () => {
    for (const page of [index, notFound]) {
      expect(page).toContain('<meta name="robots" content="noindex, nofollow" />')
      expect(page).toContain('<meta name="color-scheme" content="light dark" />')
      expect(page).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      )
      expect(page).toContain('<html lang="en">')
    }
  })

  it('follows the brand voice: we, no I or me, no model name, the name in full', () => {
    for (const page of [index, notFound]) {
      expect(text(page)).not.toMatch(/\b(I|me|my)\b/)
      expect(text(page)).not.toMatch(/Claude|Gemini|Grok|GPT|SENA/)
    }
    expect(text(index)).toContain('made with AI tools')
  })

  it('has a 404 page that leads back to the index page', () => {
    expect(text(notFound)).toContain("We can't find that page")
    expect(notFound).toContain('<a class="back" href="/">Back to the developer site</a>')
  })

  it('uses system colors, so the pages need no color value and follow dark mode', () => {
    for (const page of [index, notFound, stylesheet])
      expect(page).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/)
  })
})
