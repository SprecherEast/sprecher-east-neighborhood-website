import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { checkKnowledge } from './check.mjs'
import { schema } from './testkit.mjs'

describe('this repository', () => {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
    .split('\0')
    .filter((file) => file && fs.existsSync(file))
  const found = checkKnowledge({
    schema,
    mapJson: fs.readFileSync('docs/knowledge/map.json', 'utf8'),
    files,
    read: (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined),
  })

  it('has no blocking finding: every note follows the structure', () => {
    expect(found.filter((f) => f.severity === 'error')).toEqual([])
  })

  it('blocks every structure rule; only the path and coverage rules still warn (#1004 closes them)', () => {
    const warn = Object.entries(schema.rules).filter(([, state]) => state === 'warn')
    expect(warn.map(([id]) => id).sort()).toEqual([
      'COVERAGE-CODE',
      'COVERAGE-SECTION',
      'NOTE-PATH',
    ])
  })
})
