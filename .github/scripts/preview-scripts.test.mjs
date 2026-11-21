// The scripts the pull request preview workflow runs on the runner (#1075), against a stand-in `ssh`
// that records what it is asked and what it is sent on stdin.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))
const OPS = path.join(SCRIPTS, '..', '..', 'ops')
const SHA = 'a'.repeat(40)
const TAKEN_DOWN = 'the isolation check failed, so the preview was taken down'

let dir
let output
const p = (...parts) => path.join(dir, ...parts)

/** `ssh` that logs the request word and the stdin it got, and answers from STUB_* variables. */
function writeSsh() {
  fs.mkdirSync(p('bin'))
  fs.writeFileSync(
    p('bin/ssh'),
    `#!/usr/bin/env bash
request="\${@: -1}"
action=\${request%% *}
echo "ssh $request" >> "$STUB_LOG"
if [ "$action" = upload ]; then wc -c >> "$STUB_LOG"; fi
case "$action" in
  facts) echo "$STUB_FACTS" ;;
  list)
    # after a teardown the server's answer can change (STUB_LIST_AFTER), as it does once the preview is gone
    if [ "$(grep -c '^ssh list' "$STUB_LOG")" -ge 2 ] && [ -n "\${STUB_LIST_NEXT+x}" ]; then printf '%s' "$STUB_LIST_NEXT"
    elif grep -q '^ssh upload' "$STUB_LOG" && [ -n "\${STUB_LIST_AFTER_UPLOAD+x}" ]; then printf '%s' "$STUB_LIST_AFTER_UPLOAD"
    elif grep -q '^ssh teardown' "$STUB_LOG" && [ -n "\${STUB_LIST_AFTER+x}" ]; then printf '%s' "$STUB_LIST_AFTER"; else printf '%s' "$STUB_LIST"; fi ;;
  upload) printf '%s' "$STUB_UPLOAD_TEXT" ;;
  deploy) printf '%s' "$STUB_DEPLOY_TEXT" ;;
esac
code_var="STUB_EXIT_$(echo "$action" | tr a-z A-Z)"
exit "\${!code_var:-0}"
`,
    { mode: 0o755 },
  )
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-scripts-'))
  output = p('out')
  fs.writeFileSync(output, '')
  fs.writeFileSync(p('log'), '')
  writeSsh()
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function run(script, env) {
  const r = spawnSync('bash', [path.join(SCRIPTS, script)], {
    encoding: 'utf8',
    env: {
      PATH: `${p('bin')}:${process.env.PATH}`,
      GITHUB_OUTPUT: output,
      STUB_LOG: p('log'),
      OPS_DIR: OPS,
      ...env,
    },
  })
  return {
    code: r.status,
    out: r.stdout + r.stderr,
    written: fs.readFileSync(output, 'utf8'),
    log: fs.readFileSync(p('log'), 'utf8'),
  }
}

describe('preview-facts.sh', () => {
  const facts = (env = {}) =>
    run('preview-facts.sh', {
      VALUES_SET: 'true',
      STUB_FACTS: 'node=v22.12.0\naccount=sprecher-preview\nfree_kb=9999',
      ...env,
    })

  it('reports the server’s Node version', () => {
    const r = facts()
    expect(r.code).toBe(0)
    expect(r.written).toBe('available=yes\nnode=v22.12.0\n')
    expect(r.log).toBe('ssh facts\n')
  })

  it('says previews are unavailable, without asking the server, while the environment lacks its values', () => {
    const r = facts({ VALUES_SET: 'false' })
    expect(r.code).toBe(0)
    expect(r.written).toBe('available=no\n')
    expect(r.log).toBe('')
    expect(r.out).toContain('unavailable')
  })

  it('says previews are unavailable, once and without a retry, when the server won’t take the key', () => {
    const r = facts({ STUB_EXIT_FACTS: '255' })
    expect(r.code).toBe(0)
    expect(r.written).toBe('available=no\n')
    expect(r.log).toBe('ssh facts\n') // asked once
    expect(r.out).toContain('did not accept the preview key')
  })

  it('fails when the wrapper refuses, and when the Node version is not one', () => {
    expect(facts({ STUB_EXIT_FACTS: '2' }).code).toBe(1)
    const r = facts({ STUB_FACTS: 'node=$(id)' })
    expect(r.code).toBe(1)
    expect(r.written).toBe('')
  })
})

describe('preview-deploy.sh', () => {
  const archive = () => {
    fs.mkdirSync(p('release'), { recursive: true })
    fs.writeFileSync(p('release/a.txt'), 'hello')
    spawnSync('tar', ['-czf', p('release.tar.gz'), '-C', p('release'), '.'])
    return p('release.tar.gz')
  }
  const deploy = (env = {}) =>
    run('preview-deploy.sh', {
      NUMBER: '7',
      SHA,
      ARCHIVE: archive(),
      STUB_LIST: '',
      ...env,
    })

  it('lists, uploads the archive on stdin and deploys, in that order, through the wrapper’s actions only', () => {
    const r = deploy()
    expect(r.code, r.out).toBe(0)
    expect(r.written).toBe('url=https://pr-7.dev.sprechereast.com\nresult=live\n')
    const asked = r.log.split('\n').filter((l) => l.startsWith('ssh '))
    expect(asked).toEqual(['ssh list', `ssh upload 7 ${SHA}`, `ssh deploy 7 ${SHA}`])
    expect(Number(r.log.split('\n')[2])).toBe(fs.statSync(p('release.tar.gz')).size)
  })

  it('redeploys a pull request that already has a preview', () => {
    const r = deploy({
      STUB_LIST: `preview=7 commit=${'b'.repeat(40)} idle=5 folder=yes block=yes process=online\n`,
    })
    expect(r.written).toMatch(/result=live\n$/)
  })

  it('reports a preview that is already live at this commit as live, without uploading or deploying', () => {
    const r = deploy({
      STUB_LIST: `preview=7 commit=${SHA} idle=5 folder=yes block=yes process=online\n`,
      STUB_EXIT_UPLOAD: '2',
    })
    expect(r.code).toBe(0)
    expect(r.written).toBe('url=https://pr-7.dev.sprechereast.com\nresult=live\n')
    expect(r.log).toBe('ssh list\n')
  })

  it('does not take another pull request live at the same commit for its own', () => {
    const r = deploy({
      STUB_LIST: `preview=9 commit=${SHA} idle=5 folder=yes block=yes process=online\n`,
      PREVIEW_MAX_COUNT: '2',
    })
    expect(r.log).toContain(`ssh upload 7 ${SHA}`)
  })

  it('reports an already-live preview as live even when another preview is up (before the limit)', () => {
    const r = deploy({
      STUB_LIST: `preview=3 commit=${'b'.repeat(40)} idle=5 folder=yes block=yes process=online\npreview=7 commit=${SHA} idle=5 folder=yes block=yes process=online\n`,
    })
    expect(r.written).toMatch(/result=live\n$/)
    expect(r.log).toBe('ssh list\n')
  })

  it('still deploys when the live commit is another one', () => {
    const r = deploy({
      STUB_LIST: `preview=7 commit=${'b'.repeat(40)} idle=5 folder=yes block=yes process=online\n`,
    })
    expect(r.log).toContain(`ssh upload 7 ${SHA}`)
  })

  it('refuses a new preview at the cap, naming the cap and who holds the places, without failing', () => {
    const r = deploy({
      STUB_LIST: `preview=3 commit=${'b'.repeat(40)} idle=5 folder=yes block=yes process=online\npreview=9 commit=none idle=5 folder=yes block=no process=none\n`,
      PREVIEW_MAX_COUNT: '2',
    })
    expect(r.code).toBe(0)
    expect(r.written).toBe('cap=2\nholders=3,9\nresult=limit\n')
    expect(r.log).not.toContain('upload')
    expect(r.log).not.toContain('deploy')
  })

  it('redeploys a preview that already holds a place, even with the cap reached', () => {
    const r = deploy({
      STUB_LIST: `preview=3 commit=${'b'.repeat(40)} idle=5 folder=yes block=yes process=online\npreview=7 commit=${'c'.repeat(40)} idle=5 folder=yes block=yes process=online\n`,
      PREVIEW_MAX_COUNT: '1',
    })
    expect(r.written).toMatch(/result=live\n$/)
    expect(r.log).toContain(`ssh upload 7 ${SHA}`)
  })

  it('counts a place by its folder, as the server does: a leftover with only a block or a process holds none', () => {
    const r = deploy({
      STUB_LIST: 'preview=3 commit=none idle=1 folder=no block=yes process=online\n',
      PREVIEW_MAX_COUNT: '1',
    })
    expect(r.written).toMatch(/result=live\n$/)
  })

  it('stops, and asks for nothing more, when the server’s list is in a form it does not know', () => {
    const r = deploy({ STUB_LIST: `preview=3 commit=${SHA}\n` })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=failed\n')
    expect(r.log).toBe('ssh list\n')
  })

  it('says a generic cap line, not a failure, when the list can’t be read again after a cap race', () => {
    const r = deploy({
      STUB_EXIT_UPLOAD: '2',
      STUB_UPLOAD_TEXT:
        '::error title=Preview access::refused: there are already as many previews as are allowed\n',
      STUB_LIST_AFTER_UPLOAD: 'not a list',
    })
    expect(r.code).toBe(0)
    expect(r.written).toBe('cap=1\nholders=\nresult=limit\n')
  })

  it('says so, without failing, when the server refuses for the cap after a race', () => {
    const r = deploy({
      STUB_EXIT_UPLOAD: '2',
      STUB_UPLOAD_TEXT:
        '::error title=Preview access::refused: there are already as many previews as are allowed\n',
      STUB_LIST_AFTER_UPLOAD: `preview=9 commit=none idle=1 folder=yes block=no process=none\n`,
    })
    expect(r.code).toBe(0)
    expect(r.written).toBe('cap=1\nholders=9\nresult=limit\n')
    expect(r.log).not.toContain('ssh deploy')
  })

  it('says so, without failing, when the server refuses for the disk floor', () => {
    const r = deploy({
      STUB_EXIT_UPLOAD: '2',
      STUB_UPLOAD_TEXT:
        "::error title=Preview access::refused: there is not enough free disk to put this preview up and keep production's floor\n",
    })
    expect(r.code).toBe(0)
    expect(r.written).toBe('result=disk-low\n')
    expect(r.out).toContain('not enough free disk')
    expect(r.log).not.toContain('ssh deploy')
  })

  it('lets as many start as the limit says', () => {
    const r = deploy({
      PREVIEW_MAX_COUNT: '2',
      STUB_LIST: `preview=3 commit=${'b'.repeat(40)} idle=5 folder=yes block=yes process=online\n`,
    })
    expect(r.written).toMatch(/result=live\n$/)
  })

  it('reports "taken down" when the wrapper says the isolation check took the preview down', () => {
    const r = deploy({
      STUB_EXIT_DEPLOY: '2',
      STUB_DEPLOY_TEXT: `::error title=Preview access::refused: ${TAKEN_DOWN}\n`,
    })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=taken-down\n')
  })

  it('reports a failed deploy without retrying it', () => {
    const r = deploy({ STUB_EXIT_DEPLOY: '1', STUB_DEPLOY_TEXT: 'ERROR: nothing answered\n' })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=failed\n')
    expect(r.log.match(/ssh deploy/g)).toHaveLength(1)
  })

  it('reports a failed upload and does not deploy', () => {
    const r = deploy({ STUB_EXIT_UPLOAD: '2' })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=failed\n')
    expect(r.log).not.toContain('ssh deploy')
  })

  it('refuses an archive over the upload limit before anything is sent', () => {
    const r = deploy({ PREVIEW_UPLOAD_MAX_BYTES: '10' })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=too-big\n')
    expect(r.log).toBe('')
  })

  it('refuses an archive that unpacks to more than the limit, before anything is sent (3 GiB on the server)', () => {
    const r = deploy({ PREVIEW_UNPACK_MAX_BYTES: '4' })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=too-big\n')
    expect(r.log).toBe('')
  })

  it('refuses an archive it can’t measure', () => {
    fs.writeFileSync(p('bad.tar.gz'), 'not an archive')
    const r = run('preview-deploy.sh', { NUMBER: '7', SHA, ARCHIVE: p('bad.tar.gz') })
    expect(r.code).toBe(1)
    expect(r.written).toBe('result=unreadable\n')
    expect(r.log).toBe('')
  })

  it.each([
    ['a number with a sign', { NUMBER: '-7' }],
    ['a number with a leading zero', { NUMBER: '07' }],
    ['a number that is a command', { NUMBER: '7; id' }],
    ['a short commit', { SHA: 'abc123' }],
    ['a commit in capitals', { SHA: 'A'.repeat(40) }],
  ])('refuses %s, and asks the server nothing', (_name, env) => {
    const r = deploy(env)
    expect(r.code).toBe(1)
    expect(r.log).toBe('')
  })

  it('never calls the deploy script directly: only the wrapper’s actions are used', () => {
    // `list` is called in the one helper the three scripts share (preview-list-lib.sh)
    const text = ['preview-deploy.sh', 'preview-list-lib.sh']
      .map((name) => fs.readFileSync(path.join(SCRIPTS, name), 'utf8'))
      .join('\n')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
    expect(text).not.toMatch(/deploy-release\.sh/)
    const words = [...text.matchAll(/ssh (?:-o \S+ )*vps "?(\w+)/g)].map((m) => m[1])
    expect(new Set(words)).toEqual(new Set(['list', 'upload', 'deploy']))
  })
})

describe('preview-teardown.sh (#1076)', () => {
  const live = `preview=7 commit=${SHA} idle=5 folder=yes block=yes process=online\n`
  const teardown = (env = {}) =>
    run('preview-teardown.sh', { NUMBER: '7', STUB_LIST: live, STUB_LIST_AFTER: '', ...env })

  it('removes a preview through the wrapper’s teardown, checks it is gone, and says so', () => {
    const r = teardown()
    expect(r.code, r.out).toBe(0)
    expect(r.written).toBe('removed=yes\n')
    expect(r.log.split('\n').filter(Boolean)).toEqual(['ssh list', 'ssh teardown 7', 'ssh list'])
  })

  it('asks for no removal when the pull request never had a preview (no Caddy lock, no reload)', () => {
    const r = teardown({
      STUB_LIST: `preview=8 commit=${SHA} idle=5 folder=yes block=yes process=online\n`,
    })
    expect(r.code).toBe(0)
    expect(r.written).toBe('removed=no\n')
    expect(r.log).toBe('ssh list\n')
  })

  it('does not take a longer number for this one', () => {
    const r = teardown({
      STUB_LIST: `preview=77 commit=${SHA} idle=5 folder=yes block=yes process=online\npreview=17 commit=${SHA} idle=5 folder=yes block=yes process=online\n`,
    })
    expect(r.written).toBe('removed=no\n')
  })

  it('removes a leftover that has only a block or a process', () => {
    const r = teardown({
      STUB_LIST: 'preview=7 commit=none idle=0 folder=no block=yes process=none\n',
    })
    expect(r.written).toBe('removed=yes\n')
  })

  it('fails, and says so, when the removal fails or something stays', () => {
    expect(teardown({ STUB_EXIT_TEARDOWN: '2' }).code).toBe(1)
    const left = teardown({ STUB_LIST_AFTER: live })
    expect(left.code).toBe(1)
    expect(left.written).toBe('')
  })

  it('fails when the server does not list its previews', () => {
    const r = teardown({ STUB_EXIT_LIST: '2' })
    expect(r.code).toBe(1)
    expect(r.log).not.toContain('teardown')
  })

  it.each(['-7', '07', '7; id', '', '1234567'])(
    'refuses the number %j, and asks the server nothing',
    (number) => {
      const r = teardown({ NUMBER: number })
      expect(r.code).toBe(1)
      expect(r.log).toBe('')
    },
  )
})

describe('preview-sweep.sh (#1076)', () => {
  const day = 86400
  const line = (
    n,
    { commit = SHA, idle = 60, folder = 'yes', block = 'yes', process = 'online' } = {},
  ) =>
    `preview=${n} commit=${commit} idle=${idle} folder=${folder} block=${block} process=${process}\n`
  /** `gh` that answers the open pull requests from STUB_OPEN (or fails), and logs that it was asked. */
  const writeGh = () =>
    fs.writeFileSync(
      p('bin/gh'),
      `#!/usr/bin/env bash
echo "gh $*" >> "$STUB_LOG"
[ -z "\${STUB_GH_FAILS-}" ] || exit 1
printf '%s' "$STUB_OPEN"
`,
      { mode: 0o755 },
    )
  const sweep = (env = {}) => {
    writeGh()
    const summary = p('summary')
    fs.writeFileSync(summary, '')
    const r = run('preview-sweep.sh', {
      GITHUB_REPOSITORY: 'Org/site',
      GITHUB_STEP_SUMMARY: summary,
      STUB_OPEN: '',
      STUB_LIST: '',
      ...env,
    })
    return {
      ...r,
      summary: fs.readFileSync(summary, 'utf8'),
      asked: r.log.split('\n').filter(Boolean),
    }
  }

  it('removes previews whose pull request is closed, with the reason, and keeps the open ones', () => {
    const r = sweep({ STUB_LIST: line(3) + line(7), STUB_OPEN: '7\n' })
    expect(r.code, r.out).toBe(0)
    expect(r.asked.filter((l) => l.startsWith('ssh teardown'))).toEqual(['ssh teardown 3'])
    expect(r.summary).toContain('Removed 1, kept 1, failed 0, left alone 0.')
    expect(r.summary).toContain('| #3 | removed | its pull request is not open |')
  })

  it('removes a planted stray: a folder, a block and a process that match no open pull request', () => {
    const r = sweep({
      STUB_LIST:
        line(40, { folder: 'no', block: 'yes', process: 'none' }) +
        line(41, { folder: 'no', block: 'no', process: 'online' }) +
        line(42, { block: 'no', process: 'none' }),
      STUB_OPEN: '7\n',
    })
    expect(r.asked.filter((l) => l.startsWith('ssh teardown'))).toEqual([
      'ssh teardown 40',
      'ssh teardown 41',
      'ssh teardown 42',
    ])
    for (const n of [40, 41, 42]) expect(r.summary).toContain(`| #${n} | removed |`)
  })

  it('removes a leftover with no folder even when its pull request is open', () => {
    const r = sweep({ STUB_LIST: line(7, { folder: 'no' }), STUB_OPEN: '7\n' })
    expect(r.asked).toContain('ssh teardown 7')
    expect(r.summary).toContain('left over without its folder')
  })

  it('removes a preview nobody deployed for longer than the idle limit, and keeps one inside it', () => {
    const r = sweep({
      STUB_LIST: line(7, { idle: 7 * day + 1 }) + line(8, { idle: 7 * day }),
      STUB_OPEN: '7\n8\n',
    })
    expect(r.asked.filter((l) => l.startsWith('ssh teardown'))).toEqual(['ssh teardown 7'])
    expect(r.summary).toContain('not deployed for more than 7 days')
  })

  it('lists a stopped preview and removes nothing for it', () => {
    const r = sweep({ STUB_LIST: line(7, { process: 'stopped' }), STUB_OPEN: '7\n' })
    expect(r.asked.some((l) => l.startsWith('ssh teardown'))).toBe(false)
    expect(r.summary).toContain('Stopped, not removed')
    expect(r.summary).toContain('#7')
  })

  it('reads the server first and the open pull requests after, so a new preview is never a stray', () => {
    const r = sweep({ STUB_LIST: line(7), STUB_OPEN: '7\n' })
    expect(r.asked[0]).toBe('ssh list')
    expect(r.asked[1]).toMatch(/^gh api --paginate repos\/Org\/site\/pulls\?state=open/)
  })

  it('removes nothing, and fails, when either list can’t be read', () => {
    const noServer = sweep({ STUB_LIST: line(3), STUB_EXIT_LIST: '2' })
    expect(noServer.code).toBe(1)
    const noGithub = sweep({ STUB_LIST: line(3), STUB_GH_FAILS: '1' })
    expect(noGithub.code).toBe(1)
    for (const r of [noServer, noGithub])
      expect(r.asked.some((l) => l.includes('teardown'))).toBe(false)
  })

  it('removes nothing when a list has a line or a number it does not know', () => {
    const odd = sweep({ STUB_LIST: 'preview=3; id commit=none\n' })
    expect(odd.code).toBe(1)
    const oddOpen = sweep({ STUB_LIST: line(3), STUB_OPEN: 'x\n' })
    expect(oddOpen.code).toBe(1)
    for (const r of [odd, oddOpen]) expect(r.asked.some((l) => l.includes('teardown'))).toBe(false)
  })

  it('validates every line before removing: a valid first line and an unknown second line remove nothing, and the summary says why', () => {
    const r = sweep({ STUB_LIST: line(3) + 'preview=4; id\n', STUB_OPEN: '7\n' })
    expect(r.code).toBe(1)
    expect(r.asked.some((l) => l.includes('teardown'))).toBe(false)
    expect(r.summary).toContain('The sweep stopped before removing anything')
    expect(r.summary).toContain('a line this sweep does not know')
  })

  it('writes the summary when the open pull requests can’t be read', () => {
    const r = sweep({ STUB_LIST: line(3), STUB_GH_FAILS: '1' })
    expect(r.summary).toContain('stopped before removing anything')
    expect(r.summary).toContain('open pull requests could not be listed')
  })

  it('reads the number’s line again before removing it, and leaves it alone if it was deployed meanwhile', () => {
    const r = sweep({
      STUB_LIST: line(7, { idle: 7 * day + 1 }),
      STUB_LIST_NEXT: line(7, { idle: 3 }),
      STUB_OPEN: '7\n',
    })
    expect(r.code).toBe(0)
    expect(r.asked.some((l) => l.includes('teardown'))).toBe(false)
    expect(r.summary).toContain('| #7 | left alone | it changed since the sweep began |')
  })

  it('leaves a preview alone that is already gone when it looks again', () => {
    const r = sweep({ STUB_LIST: line(3), STUB_LIST_NEXT: '', STUB_OPEN: '' })
    expect(r.asked.some((l) => l.includes('teardown'))).toBe(false)
    expect(r.summary).toContain('| #3 | already gone |')
  })

  it('tries every removal and fails after, naming the one that failed', () => {
    const r = sweep({ STUB_LIST: line(3) + line(4), STUB_EXIT_TEARDOWN: '2' })
    expect(r.code).toBe(1)
    expect(r.asked.filter((l) => l.startsWith('ssh teardown'))).toEqual([
      'ssh teardown 3',
      'ssh teardown 4',
    ])
    expect(r.summary).toContain('failed 2')
  })

  it('does nothing, and says so, when the server holds no preview', () => {
    const r = sweep({ STUB_OPEN: '7\n' })
    expect(r.code).toBe(0)
    expect(r.summary).toContain('Removed 0, kept 0, failed 0, left alone 0.')
  })
})
