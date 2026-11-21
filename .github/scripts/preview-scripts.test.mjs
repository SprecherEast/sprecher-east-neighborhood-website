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
  list) printf '%s' "$STUB_LIST" ;;
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
    const r = deploy({ STUB_LIST: `preview=7 commit=${'b'.repeat(40)}\n` })
    expect(r.written).toMatch(/result=live\n$/)
  })

  it('reports a preview that is already live at this commit as live, without uploading or deploying', () => {
    const r = deploy({ STUB_LIST: `preview=7 commit=${SHA}\n`, STUB_EXIT_UPLOAD: '2' })
    expect(r.code).toBe(0)
    expect(r.written).toBe('url=https://pr-7.dev.sprechereast.com\nresult=live\n')
    expect(r.log).toBe('ssh list\n')
  })

  it('does not take another pull request live at the same commit for its own', () => {
    const r = deploy({ STUB_LIST: `preview=9 commit=${SHA}\n`, PREVIEWS_AT_ONCE: '2' })
    expect(r.log).toContain(`ssh upload 7 ${SHA}`)
  })

  it('reports an already-live preview as live even when another preview is up (before the limit)', () => {
    const r = deploy({ STUB_LIST: `preview=3 commit=${'b'.repeat(40)}\npreview=7 commit=${SHA}\n` })
    expect(r.written).toMatch(/result=live\n$/)
    expect(r.log).toBe('ssh list\n')
  })

  it('still deploys when the live commit is another one', () => {
    const r = deploy({ STUB_LIST: `preview=7 commit=${'b'.repeat(40)}\n` })
    expect(r.log).toContain(`ssh upload 7 ${SHA}`)
  })

  it('refuses a second preview while another is up, and says so without failing', () => {
    const r = deploy({ STUB_LIST: `preview=3 commit=${'b'.repeat(40)}\npreview=9 commit=none\n` })
    expect(r.code).toBe(0)
    expect(r.written).toBe('result=limit\n')
    expect(r.log).not.toContain('upload')
    expect(r.log).not.toContain('deploy')
  })

  it('lets as many start as the limit says', () => {
    const r = deploy({
      PREVIEWS_AT_ONCE: '2',
      STUB_LIST: `preview=3 commit=${'b'.repeat(40)}\n`,
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

  it('never calls the deploy script directly: only the wrapper’s five words are used', () => {
    const text = fs
      .readFileSync(path.join(SCRIPTS, 'preview-deploy.sh'), 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
    expect(text).not.toMatch(/deploy-release\.sh/)
    const words = [...text.matchAll(/ssh (?:-o \S+ )*vps "?(\w+)/g)].map((m) => m[1])
    expect(new Set(words)).toEqual(new Set(['list', 'upload', 'deploy']))
  })
})
