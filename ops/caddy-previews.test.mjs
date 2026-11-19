// Tests for the pull request preview Caddy base (#1072): the import line script, the headers
// snippet and the site block template. `caddy`, `curl` and the Caddy reload are stubs; real Caddy
// is checked on the server (ops/README.md, "Pull request previews").
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OPS = path.dirname(fileURLToPath(import.meta.url))
const IMPORT = (dir) => `import ${dir}/*.caddy`
const SITE = 'sprechereast.com {\n\treverse_proxy localhost:3000\n}\n'

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const write = (file, text, mode) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, { mode })
}
const stub = (name, body) => write(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
const caddyfile = () => fs.readFileSync(p('caddy/Caddyfile'), 'utf8')
const previewDir = () => p('caddy/previews')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'previews-'))
  for (const f of ['lib.sh', 'caddy-previews.sh', 'caddy-limits.sh'])
    write(p('code/ops', f), fs.readFileSync(path.join(OPS, f)))
  for (const f of ['preview-headers.caddy', 'preview-site.caddy', 'form-limits.caddy'])
    write(p('code/ops/caddy', f), fs.readFileSync(path.join(OPS, 'caddy', f)))
  write(p('app/.env.local'), 'NEXT_PUBLIC_SERVER_URL=https://sprechereast.com\n')
  write(p('caddy/Caddyfile'), SITE)
  write(p('caddy/sprecher-east-form-limits.caddy'), '# the form limits\n')
  fs.writeFileSync(p('log'), '')
  // `caddy validate` fails for a config that has the word in STUB_CADDY_REJECTS, and a reload
  // after it fails when STUB_RELOAD_FAILS is set; both only while the new import is in place.
  stub(
    'caddy',
    [
      '[ "$1" = validate ] || exit 0',
      'echo "validate $(basename "$3")" >> "$STUB_LOG"',
      '[ -z "$STUB_KEEP_VALIDATED" ] || cat "$3" >> "$STUB_KEEP_VALIDATED"',
      '[ -z "$STUB_CADDY_REJECTS" ] && exit 0',
      'grep -q "$STUB_CADDY_REJECTS" "$3" && exit 1',
      // a file the config imports by name (not a glob) counts as part of it
      'for f in $(sed -n "s/^[[:space:]]*import[[:space:]]\\{1,\\}\\([^[:space:]*]*\\)$/\\1/p" "$3"); do',
      '  [ ! -f "$f" ] || ! grep -q "$STUB_CADDY_REJECTS" "$f" || exit 1',
      'done',
    ].join('\n'),
  )
  // The home page answers 200 unless STUB_STATUS says otherwise; after the reload STUB_DOWN_AFTER
  // makes it stop answering. A POST body over 256 KB gets 413, as through the form limit.
  stub(
    'curl',
    [
      'case "$*" in',
      '  *-X\\ POST*) n=$(wc -c); if [ "$n" -gt 262144 ]; then echo 413; else echo 400; fi ;;',
      '  *) if [ -n "$STUB_DOWN_AFTER" ] && grep -q reload "$STUB_LOG"; then echo 502; else echo "${STUB_STATUS:-200}"; fi ;;',
      'esac',
    ].join('\n'),
  )
  // Copying a backup over the Caddyfile (the rollback) fails when STUB_CP_RESTORE_FAILS is set.
  stub(
    'cp',
    'case "$1" in *bak-previews-*) [ -z "$STUB_CP_RESTORE_FAILS" ] || exit 1 ;; esac; exec /bin/cp "$@"',
  )
  stub(
    'reload-caddy',
    'echo reload >> "$STUB_LOG"; [ -z "$STUB_RELOAD_FAILS" ] || ! grep -q "previews/" "$CADDYFILE"',
  )
})

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const run = (script, env = {}) =>
  new Promise((resolve) => {
    const child = spawn('bash', [p('code/ops', script)], {
      env: {
        PATH: `${p('bin')}:${process.env.PATH}`,
        HOME: dir,
        APP_DIR: p('app'),
        CODE_DIR: p('code'),
        CADDYFILE: p('caddy/Caddyfile'),
        PREVIEW_CADDY_DIR: previewDir(),
        PREVIEW_HEADERS_FILE: p('caddy/sprecher-east-preview-headers.caddy'),
        LIMITS_FILE: p('caddy/sprecher-east-form-limits.caddy'),
        RELOAD_CADDY: p('bin/reload-caddy'),
        UP_WAIT: '1',
        UP_WAIT_AFTER: '1',
        STUB_LOG: p('log'),
        ...env,
      },
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out, log: fs.readFileSync(p('log'), 'utf8') }))
  })

describe('caddy-previews.sh: the import line', () => {
  it('adds one import line for the preview folder, and nothing else, to the Caddyfile', async () => {
    const { code, out, log } = await run('caddy-previews.sh')
    expect(code).toBe(0)
    expect(out).toContain('Pull request previews prepared')
    const lines = caddyfile().split('\n')
    expect(lines.filter((l) => l.trim().startsWith('import ')).join('\n')).toBe(
      IMPORT(previewDir()),
    )
    // The old Caddyfile is still there, untouched, in front of the addition.
    expect(caddyfile().startsWith(SITE)).toBe(true)
    expect(caddyfile().slice(SITE.length)).toBe(
      `\n# Pull request previews (ops/caddy-previews.sh, #1072)\n${IMPORT(previewDir())}\n`,
    )
    expect(log).toContain('reload')
    expect(fs.readdirSync(p('caddy')).some((f) => f.startsWith('Caddyfile.bak-previews-'))).toBe(
      true,
    )
  })

  it('creates the preview folder (empty) and installs the headers snippet', async () => {
    await run('caddy-previews.sh')
    expect(fs.readdirSync(previewDir())).toEqual([])
    expect(fs.readFileSync(p('caddy/sprecher-east-preview-headers.caddy'), 'utf8')).toBe(
      fs.readFileSync(path.join(OPS, 'caddy/preview-headers.caddy'), 'utf8'),
    )
  })

  it('adds the line once however many times the production deploy runs it', async () => {
    await run('caddy-previews.sh')
    const after = caddyfile()
    fs.writeFileSync(p('log'), '')
    const second = await run('caddy-previews.sh')
    expect(second.code).toBe(0)
    expect(second.out).toContain('already prepared')
    expect(caddyfile()).toBe(after)
    expect(second.log).not.toContain('reload') // nothing changed, so no reload
    expect(caddyfile().split(IMPORT(previewDir())).length).toBe(2)
  })

  it('recognizes a line that was indented, spaced differently or followed by a comment by hand', async () => {
    write(p('caddy/Caddyfile'), `${SITE}\n  import   ${previewDir()}/*.caddy  # by hand\n`)
    const before = caddyfile()
    const { code } = await run('caddy-previews.sh')
    expect(code).toBe(0)
    expect(caddyfile()).toBe(before)
  })

  it('reloads Caddy and keeps the Caddyfile when only the headers snippet changed', async () => {
    await run('caddy-previews.sh')
    const after = caddyfile()
    fs.writeFileSync(p('caddy/sprecher-east-preview-headers.caddy'), '# an older copy\n')
    fs.writeFileSync(p('log'), '')
    const { code, out, log } = await run('caddy-previews.sh')
    expect(code).toBe(0)
    expect(out).toContain('headers updated')
    expect(caddyfile()).toBe(after)
    expect(log).toContain('reload')
  })
})

describe('caddy-previews.sh: it never leaves Caddy worse off', () => {
  it('changes nothing and fails when Caddy rejects the new Caddyfile', async () => {
    const { code, out } = await run('caddy-previews.sh', { STUB_CADDY_REJECTS: 'previews/' })
    expect(code).toBe(1)
    expect(out).toContain('Caddy rejected')
    expect(caddyfile()).toBe(SITE)
    expect(fs.existsSync(p('caddy/sprecher-east-preview-headers.caddy'))).toBe(false)
  })

  it('puts the Caddyfile and the headers file back when Caddy will not reload', async () => {
    const { code, out } = await run('caddy-previews.sh', { STUB_RELOAD_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('would not reload')
    expect(out).toContain('the previous Caddy config is back')
    expect(caddyfile()).toBe(SITE)
    expect(fs.existsSync(p('caddy/sprecher-east-preview-headers.caddy'))).toBe(false)
  })

  it('puts everything back, and reloads Caddy again, when the site stops answering after the reload', async () => {
    const { code, out, log } = await run('caddy-previews.sh', { STUB_DOWN_AFTER: '1' })
    expect(code).toBe(1)
    expect(out).toContain('stopped answering')
    expect(caddyfile()).toBe(SITE)
    expect(log.match(/^reload$/gm)).toHaveLength(2) // the change, and the rollback that makes Caddy load the old files
  })

  it('says what it could not put back, and where its backup is, when the rollback itself fails', async () => {
    const { code, out } = await run('caddy-previews.sh', {
      STUB_DOWN_AFTER: '1',
      STUB_CP_RESTORE_FAILS: '1',
    })
    expect(code).toBe(1)
    expect(out).toContain('Could not put back the Caddyfile (backup:')
    expect(out).toContain('Caddyfile.bak-previews-')
  })

  it('puts the previous headers file back, not just removes one, when Caddy will not reload', async () => {
    write(p('caddy/sprecher-east-preview-headers.caddy'), '# the earlier headers\n')
    write(p('caddy/Caddyfile'), `${SITE}\n${IMPORT(previewDir())}\n`) // the line is there, only the headers differ
    const { code } = await run('caddy-previews.sh', { STUB_RELOAD_FAILS: '1' })
    // The stub fails a reload only while the Caddyfile has the import; here it always has, so it fails.
    expect(code).toBe(1)
    expect(fs.readFileSync(p('caddy/sprecher-east-preview-headers.caddy'), 'utf8')).toBe(
      '# the earlier headers\n',
    )
  })

  it('rejects a broken headers snippet before any reload, and keeps the one that works', async () => {
    await run('caddy-previews.sh')
    const working = fs.readFileSync(p('caddy/sprecher-east-preview-headers.caddy'), 'utf8')
    write(p('code/ops/caddy/preview-headers.caddy'), 'garbage {{{\n')
    fs.writeFileSync(p('log'), '')
    const { code, out, log } = await run('caddy-previews.sh', { STUB_CADDY_REJECTS: 'garbage' })
    expect(code).toBe(1)
    expect(out).toContain('Caddy rejected the pull request preview headers')
    expect(fs.readFileSync(p('caddy/sprecher-east-preview-headers.caddy'), 'utf8')).toBe(working)
    expect(log).not.toContain('reload')
  })

  it('validates a sample preview block made from the template, with the headers and the form limits', async () => {
    await run('caddy-previews.sh', { STUB_KEEP_VALIDATED: p('validated') })
    const seen = fs.readFileSync(p('validated'), 'utf8')
    expect(seen).toContain('http://preview-check.invalid {')
    expect(seen).toContain(`import ${p('caddy/sprecher-east-preview-headers.caddy')}`)
    expect(seen).toContain(`import ${p('caddy/sprecher-east-form-limits.caddy')}`)
    expect(seen).not.toMatch(/__[A-Z_]+__/) // every placeholder was filled in
  })

  it('does nothing, with a warning, when the form limits are not in place yet', async () => {
    fs.rmSync(p('caddy/sprecher-east-form-limits.caddy'))
    const { code, out } = await run('caddy-previews.sh')
    expect(code).toBe(0)
    expect(out).toContain('WARNING')
    expect(caddyfile()).toBe(SITE)
  })

  it('leaves everything alone, with a warning, when the site is not answering to begin with', async () => {
    const { code, out } = await run('caddy-previews.sh', { STUB_STATUS: '502' })
    expect(code).toBe(0)
    expect(out).toContain('WARNING')
    expect(caddyfile()).toBe(SITE)
  })

  it('leaves everything alone, with a warning, when the current Caddyfile does not validate', async () => {
    const { code, out } = await run('caddy-previews.sh', { STUB_CADDY_REJECTS: 'reverse_proxy' })
    expect(code).toBe(0)
    expect(out).toContain('does not validate')
    expect(caddyfile()).toBe(SITE)
  })

  it('warns and does nothing when there is no Caddyfile', async () => {
    fs.rmSync(p('caddy/Caddyfile'))
    const { code, out } = await run('caddy-previews.sh')
    expect(code).toBe(0)
    expect(out).toContain('WARNING')
  })
})

describe('the other Caddy script is unaffected by the new line', () => {
  it('caddy-limits.sh makes the same decision with the preview import line present', async () => {
    const withLine = `${SITE}\n# Pull request previews (ops/caddy-previews.sh, #1072)\n${IMPORT(previewDir())}\n`
    write(p('caddy/Caddyfile'), withLine)
    const { code, out } = await run('caddy-limits.sh')
    expect(code).toBe(0)
    expect(out).toContain('request body limit added')
    // One new line inside the production block, and the preview import line untouched.
    const limitsImport = `import ${p('caddy/sprecher-east-form-limits.caddy')}`
    expect(caddyfile()).toBe(
      `sprechereast.com {\n\t${limitsImport}\n\treverse_proxy localhost:3000\n}\n\n# Pull request previews (ops/caddy-previews.sh, #1072)\n${IMPORT(previewDir())}\n`,
    )
  })
})

describe('caddy-limits.sh still rolls back as before, now through the shared helper', () => {
  it('puts the Caddyfile and the limit back, and says so, when Caddy will not reload', async () => {
    const withLine = `${SITE}\n${IMPORT(previewDir())}\n`
    write(p('caddy/Caddyfile'), withLine)
    fs.rmSync(p('caddy/sprecher-east-form-limits.caddy')) // a first install of the limit
    const { code, out } = await run('caddy-limits.sh', { STUB_RELOAD_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('Caddy would not reload with the request body limit')
    expect(out).toContain('The previous files are back, but Caddy would not reload them.')
    expect(caddyfile()).toBe(withLine)
    expect(fs.existsSync(p('caddy/sprecher-east-form-limits.caddy'))).toBe(false)
  })
})

describe('the preview headers snippet and site block template', () => {
  const read = (f) => fs.readFileSync(path.join(OPS, 'caddy', f), 'utf8')
  const code = (text) => text.replace(/^\s*#.*$/gm, '') // the files' comments mention what they leave out

  it('sets noindex, nofollow and answers /robots.txt with a blanket disallow', () => {
    const headers = code(read('preview-headers.caddy'))
    expect(headers).toContain('header >X-Robots-Tag "noindex, nofollow"')
    expect(headers).toMatch(/respond \/robots\.txt `User-agent: \*\nDisallow: \/\n` 200/)
  })

  it('never sends Strict-Transport-Security', () => {
    expect(code(read('preview-headers.caddy'))).not.toMatch(/strict-transport-security/i)
    expect(code(read('preview-site.caddy'))).not.toMatch(/strict-transport-security/i)
  })

  it('imports the preview headers and the form limits, and never the HSTS file', () => {
    const site = code(read('preview-site.caddy'))
    const imports = site.match(/^\s*import\s+\S+/gm).map((l) => l.trim().split(/\s+/)[1])
    expect(imports.sort()).toEqual(['__LIMITS_FILE__', '__PREVIEW_HEADERS_FILE__'].sort())
    expect(site).not.toMatch(/hsts/i)
    expect(site).toContain('reverse_proxy 127.0.0.1:__PREVIEW_PORT__')
    expect(site).toMatch(/^__PREVIEW_HOST__ \{$/m)
  })

  it('leaves production HSTS without includeSubDomains, so it cannot bind a preview name', () => {
    expect(code(read('hsts.caddy'))).not.toMatch(/includeSubDomains/i)
  })
})
