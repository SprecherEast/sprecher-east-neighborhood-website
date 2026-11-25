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
  spawnSync(
    'bash',
    [
      '-c',
      `. "${OPS}/lib.sh"\n. "${OPS}/caddy-block-lib.sh"\n. "${OPS}/releases-lib.sh"\n${script}`,
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: `${p('bin')}:${process.env.PATH}`,
        APP_DIR: p('app'),
        CADDYFILE: p('Caddyfile'),
        ...env,
      },
    },
  )

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

describe('caddy_place_block: the optional wait for the site', () => {
  beforeEach(() => {
    stub('caddy', 'exit 0')
    stub('reload', 'echo reload >> "$STUB_LOG"')
    fs.writeFileSync(p('blocks/a.caddy'), 'old\n')
    fs.writeFileSync(p('blocks/a.tmp'), 'new\n')
  })
  const place = (seconds, down) =>
    lib(
      `site_is_up() { ${down ? 'return 1' : 'return 0'}; }; sleep() { :; }\ncaddy_place_block "${p('blocks/a.tmp')}" "${p('blocks/a.caddy')}" ${seconds}; echo "status=$? problem=$CADDY_BLOCK_PROBLEM"`,
      { RELOAD_CADDY: p('bin/reload'), STUB_LOG: p('log') },
    )

  it('keeps the new block when the site answers within the seconds it is given', () => {
    expect(place(1, false).stdout).toContain('status=0 problem=\n')
    expect(fs.readFileSync(p('blocks/a.caddy'), 'utf8')).toBe('new\n')
  })

  it('puts the previous block back, and reloads again, when the site does not answer', () => {
    const r = place(1, true)
    expect(r.stdout).toContain('status=1 problem=reload')
    expect(fs.readFileSync(p('blocks/a.caddy'), 'utf8')).toBe('old\n')
    expect(fs.readFileSync(p('log'), 'utf8')).toBe('reload\nreload\n')
  })

  it('does not wait for the site when no seconds are given', () => {
    const r = place('', true)
    expect(r.stdout).toContain('status=0 problem=\n')
  })
})

describe('caddy_place_block: a step that fails leaves the previous block as it was', () => {
  // The function is called from an `if`, where `set -e` is off, so every step must be checked by hand.
  beforeEach(() => {
    stub('caddy', 'exit 0')
    stub('reload', 'echo reload >> "$STUB_LOG"')
    fs.writeFileSync(p('blocks/a.caddy'), 'the previous block, complete\n')
    fs.writeFileSync(p('blocks/a.tmp'), 'the new block\n')
  })
  const place = (env = {}, extra = '') =>
    lib(
      `caddy_place_block "${p('blocks/a.tmp')}" "${p('blocks/a.caddy')}" ${extra}; echo "status=$? problem=$CADDY_BLOCK_PROBLEM previous=[$CADDY_BLOCK_PREVIOUS]"`,
      { RELOAD_CADDY: p('bin/reload'), STUB_LOG: p('log'), ...env },
    )
  const blockIsUntouched = () => {
    expect(fs.readFileSync(p('blocks/a.caddy'), 'utf8')).toBe('the previous block, complete\n')
    // no leftover copy of any name; the temporary block is still there, for its caller to remove
    expect(fs.readdirSync(p('blocks')).sort()).toEqual(['a.caddy', 'a.tmp'])
  }

  it('a copy that stops half way (a full disk) is never put back, and the block stays as it was', () => {
    // the copy writes part of the block, then fails; Caddy rejects the whole config with the new block
    stub('cp', 'head -c 5 "$2" > "$3"; echo "cp: No space left on device" >&2; exit 1')
    stub(
      'caddy',
      'if cat "$STUB_DIR"/*.caddy 2>/dev/null | grep -q "the new block"; then exit 1; fi; exit 0',
    )
    const r = place({ STUB_DIR: p('blocks') })
    expect(r.stdout).toContain('status=1')
    expect(r.stdout).toContain('problem=backup')
    blockIsUntouched()
  })

  it('a copy that exits well but is not the block (the disk lied) is refused too', () => {
    stub('cp', 'head -c 5 "$2" > "$3"; exit 0')
    const r = place()
    expect(r.stdout).toContain('status=1 problem=backup')
    blockIsUntouched()
  })

  it('a failed temporary file for the copy leaves the block as it was', () => {
    stub('mktemp', 'exit 1')
    const r = place()
    expect(r.stdout).toContain('status=1 problem=backup')
    blockIsUntouched()
  })

  it('a rename that fails leaves the block as it was, says so, and never reports success', () => {
    stub(
      'mv',
      'case "$*" in *a.tmp*) echo "mv: cannot move" >&2; exit 1 ;; esac; exec /bin/mv "$@"',
    )
    const r = place()
    expect(r.stdout).toContain('status=1 problem=move')
    expect(r.stdout).toContain('previous=[]')
    blockIsUntouched()
    expect(fs.existsSync(p('log'))).toBe(false) // Caddy was not reloaded for a change that did not happen
  })

  it('does not report a failure of the previous block’s return as success: a failed restore is reported', () => {
    // the whole-config check rejects the new block, and putting the previous copy back fails
    stub(
      'caddy',
      'if cat "$STUB_DIR"/a.caddy 2>/dev/null | grep -q "the new block"; then exit 1; fi; exit 0',
    )
    stub('mv', 'case "$*" in *a.caddy.*" "*a.caddy) exit 1 ;; esac; exec /bin/mv "$@"')
    const r = place({ STUB_DIR: p('blocks') })
    expect(r.stdout).toContain('status=1 problem=rejected')
    expect(r.stdout).toContain('ERROR: the previous block could not be put back')
    // the copy is the only one left: it stays, and the caller is told to forget it so no cleanup deletes it
    expect(r.stdout).toContain('previous=[]')
    expect(fs.readdirSync(p('blocks')).filter((n) => n.startsWith('a.caddy.'))).toHaveLength(1)
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

describe('how long the site gets to answer: one definition, in environment.sh', () => {
  const seconds = (script, env = {}) => {
    const r = lib(
      `site_is_up() { return 1; }; sleep() { command sleep 0.2; }; report() { :; }\ns=$SECONDS; ${script}; echo "took=$((SECONDS - s))"`,
      env,
    )
    return Number(/took=(\d+)/.exec(r.stdout)[1])
  }

  it('has the defaults every script shares, and lets a test shorten them', () => {
    const values = (env) => lib('echo "$SITE_UP_WAIT $SITE_UP_WAIT_AFTER"', env).stdout.trim()
    expect(values({})).toBe('90 20')
    expect(values({ UP_WAIT: '5', UP_WAIT_AFTER: '3' })).toBe('5 3')
  })

  it('wait_until_up waits for SITE_UP_WAIT when no number is given, and for the number when one is', () => {
    const taken = seconds('wait_until_up', { UP_WAIT: '2' })
    expect(taken).toBeGreaterThanOrEqual(2)
    expect(taken).toBeLessThan(5)
    expect(seconds('wait_until_up 1', { UP_WAIT: '30' })).toBeLessThan(4)
  })

  it('caddy_reload_problem waits for SITE_UP_WAIT_AFTER when no number is given, and for the number when one is', () => {
    stub('reload', 'exit 0')
    const env = { RELOAD_CADDY: p('bin/reload'), UP_WAIT_AFTER: '2' }
    const taken = seconds('caddy_reload_problem x', env)
    expect(taken).toBeGreaterThanOrEqual(2)
    expect(taken).toBeLessThan(5)
    expect(seconds('caddy_reload_problem x 1', { ...env, UP_WAIT_AFTER: '30' })).toBeLessThan(4)
  }, 30000)
})

describe('prune_releases', () => {
  const made = (names) => {
    names.forEach((n, i) => {
      fs.mkdirSync(p('releases', n), { recursive: true })
      fs.utimesSync(p('releases', n), 1000 + i, 1000 + i) // later in the list = newer
    })
  }
  const left = () => fs.readdirSync(p('releases')).sort()
  const prune = (args) => lib(`prune_releases ${args}`)

  it('keeps the newest ones and removes the rest, oldest first out', () => {
    made(['a', 'b', 'c', 'd', 'e'])
    expect(prune(`"${p('releases')}" 3 e releases/d`).status).toBe(0)
    expect(left()).toEqual(['c', 'd', 'e'])
  })

  it('never keeps fewer than two, whatever it is told', () => {
    made(['a', 'b', 'c'])
    prune(`"${p('releases')}" 1 c releases/b`)
    expect(left()).toEqual(['b', 'c'])
    fs.mkdirSync(p('releases/d'))
    fs.utimesSync(p('releases/d'), 2000, 2000)
    prune(`"${p('releases')}" nonsense d releases/c`)
    expect(left()).toEqual(['c', 'd'])
  })

  it('never removes the release just published or the one before it, however old', () => {
    made(['a', 'b', 'c', 'd', 'e'])
    prune(`"${p('releases')}" 2 a releases/b`)
    expect(left()).toEqual(['a', 'b', 'd', 'e'])
  })

  it('keeps at least two even when told to keep one and nothing is protected but the new release', () => {
    made(['a', 'b', 'c'])
    prune(`"${p('releases')}" 1 c`)
    expect(left()).toEqual(['b', 'c'])
  })

  it('works with no previous release', () => {
    made(['a', 'b', 'c'])
    expect(prune(`"${p('releases')}" 2 c`).status).toBe(0)
    expect(left()).toEqual(['b', 'c'])
  })

  it('removes what an interrupted publish left, and leaves other hidden folders and files alone', () => {
    made(['a', 'b'])
    fs.mkdirSync(p('releases/.incoming-x'))
    fs.mkdirSync(p('releases/.kept'))
    fs.utimesSync(p('releases/.kept'), 1, 1) // older than everything, and still left alone
    fs.writeFileSync(p('releases/note.txt'), 'x')
    prune(`"${p('releases')}" 2 b releases/a`)
    expect(fs.readdirSync(p('releases')).sort()).toEqual(['.kept', 'a', 'b', 'note.txt'])
  })
})

describe('caddy_restore_block', () => {
  beforeEach(() => {
    fs.writeFileSync(p('blocks/a.caddy'), 'the new block\n')
    fs.writeFileSync(p('blocks/copy'), 'the previous block\n')
    stub('reload', 'echo reload >> "$STUB_LOG"')
  })
  const restore = (copy, env = {}) =>
    lib(
      `report() { echo "$*"; }\ncaddy_restore_block "${p('blocks/a.caddy')}" ${copy}; echo "status=$?"`,
      {
        RELOAD_CADDY: p('bin/reload'),
        STUB_LOG: p('log'),
        ...env,
      },
    )

  it('puts the previous block back, reloads, and succeeds', () => {
    const r = restore(`"${p('blocks/copy')}"`)
    expect(r.stdout).toContain('status=0')
    expect(fs.readFileSync(p('blocks/a.caddy'), 'utf8')).toBe('the previous block\n')
    expect(fs.readFileSync(p('log'), 'utf8')).toBe('reload\n')
  })

  it('removes the block when there was none before, reloads, and succeeds', () => {
    const r = restore('""')
    expect(r.stdout).toContain('status=0')
    expect(fs.existsSync(p('blocks/a.caddy'))).toBe(false)
    expect(fs.readFileSync(p('log'), 'utf8')).toBe('reload\n')
  })

  it('says so and fails when the copy cannot be put back, naming the copy it keeps', () => {
    stub('mv', 'exit 1')
    const r = restore(`"${p('blocks/copy')}"`)
    expect(r.stdout).toContain('ERROR: the previous block could not be put back')
    expect(r.stdout).toContain(p('blocks/copy'))
    expect(r.stdout).toContain('status=1')
    expect(fs.readFileSync(p('blocks/copy'), 'utf8')).toBe('the previous block\n')
    expect(fs.existsSync(p('log'))).toBe(false)
  })

  it('says so and fails when the new block cannot be removed', () => {
    stub('rm', 'exit 1')
    const r = restore('""')
    expect(r.stdout).toContain('ERROR: the new block could not be removed')
    expect(r.stdout).toContain('status=1')
  })

  it('says so and fails when Caddy will not reload the block that is back', () => {
    stub('reload', 'exit 1')
    const r = restore(`"${p('blocks/copy')}"`)
    expect(r.stdout).toContain('but Caddy would not reload it')
    expect(r.stdout).toContain('status=1')
  })
})
