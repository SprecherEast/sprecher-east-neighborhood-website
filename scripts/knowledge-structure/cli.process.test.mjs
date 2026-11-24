/** The real entry run as a process, in a throwaway repository with its own copy of the scripts. */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { NOTE_PATH, fixture, fixtureRoots, removeFixtures } from './testkit.mjs'

describe('cli.mjs as a process', () => {
  afterEach(removeFixtures)

  /** The real entry as a process: its own copy of the scripts sits in the throwaway repository. */
  const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const spawnEntry = (root, args = []) => {
    fs.cpSync(SCRIPTS, path.join(root, 'scripts'), {
      recursive: true,
      filter: (src) => !/\.test\.mjs$|testkit\.mjs$/.test(src),
    })
    fs.symlinkSync(path.join(SCRIPTS, '../node_modules'), path.join(root, 'node_modules'))
    return spawnSync('node', [path.join(root, 'scripts/knowledge-structure/cli.mjs'), ...args], {
      cwd: os.tmpdir(),
      encoding: 'utf8',
    })
  }

  it('as a process: exits 1 on an error, with the findings on stdout', () => {
    const result = spawnEntry(fixture({ note: '# Demo\n' }))
    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`error [NOTE-FRONTMATTER] ${NOTE_PATH}`)
  })

  it('as a process: passes its arguments on, so --skeleton prints a note', () => {
    const result = spawnEntry(fixture(), ['--skeleton', 'feature'])
    expect(result.status).toBe(0)
    expect(result.stdout.startsWith('---\nname: TODO\ntype: feature\n')).toBe(true)
  })

  it('does nothing when evaluated from the command line, where there is no script path', () => {
    const entry = pathToFileURL(path.join(SCRIPTS, 'knowledge-structure/cli.mjs')).href
    const result = spawnSync('node', ['--input-type=module', '-e', `import '${entry}'`], {
      cwd: os.tmpdir(),
      encoding: 'utf8',
    })
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe('')
    expect(result.status).toBe(0)
  })

  it('does nothing when another file imports it', () => {
    const entry = pathToFileURL(path.join(SCRIPTS, 'knowledge-structure/cli.mjs')).href
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'importer-'))
    fixtureRoots.push(dir)
    fs.writeFileSync(path.join(dir, 'importer.mjs'), `import '${entry}'\n`)
    const result = spawnSync('node', [path.join(dir, 'importer.mjs')], {
      cwd: os.tmpdir(),
      encoding: 'utf8',
    })
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe('')
    expect(result.status).toBe(0)
  })

  it('as a process: exits 0 when there are only warnings', () => {
    const result = spawnEntry(fixture())
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/warning \[COVERAGE-SECTION\]/)
  })
})
