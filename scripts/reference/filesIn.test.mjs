import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { SERVER_SCRIPTS, WORKFLOW_FILES, filesIn } from './loadFacts.mjs'

describe('filesIn and the file types the loader reads (#1461)', () => {
  it('reads the files of a folder that match, sorted, with their text', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sena1461-filesin-'))
    fs.mkdirSync(path.join(root, 'f'))
    for (const name of ['b.yml', 'a.yaml', 'c.txt']) {
      fs.writeFileSync(path.join(root, 'f', name), `text of ${name}`)
    }
    // a file system may list names in any order
    const list = vi.spyOn(fs, 'readdirSync').mockReturnValue(['b.yml', 'c.txt', 'a.yaml'])
    const found = filesIn(root, 'f', WORKFLOW_FILES)
    list.mockRestore()
    fs.rmSync(root, { recursive: true, force: true })
    expect(found).toEqual([
      { file: 'f/a.yaml', text: 'text of a.yaml' },
      { file: 'f/b.yml', text: 'text of b.yml' },
    ])
  })

  it('takes .yml and .yaml as workflows and .sh as server scripts, whole names only', () => {
    expect(
      ['a.yml', 'a.yaml', 'a.yml.bak', 'a.txt', 'yml'].filter((n) => WORKFLOW_FILES.test(n)),
    ).toEqual(['a.yml', 'a.yaml'])
    expect(['run.sh', 'run.sh.md', 'sh', 'run.bash'].filter((n) => SERVER_SCRIPTS.test(n))).toEqual(
      ['run.sh'],
    )
  })
})
