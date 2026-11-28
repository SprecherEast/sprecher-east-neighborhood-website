import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { checkKnowledge } from './check.mjs'
import { listFiles } from './cli.mjs'
import { realSchema as schema } from './testkit.mjs'

describe('this repository', () => {
  const files = listFiles('.')
  const found = checkKnowledge({
    schema,
    mapJson: fs.readFileSync('docs/knowledge/map.json', 'utf8'),
    files,
    read: (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined),
  })

  it('has no blocking finding: every note follows the structure', () => {
    expect(found.filter((f) => f.severity === 'error')).toEqual([])
  })

  it('has no finding at all, so a warning rule has nothing left to hide', () => {
    expect(found).toEqual([])
  })

  it('blocks every rule: none is left as a warning (#1004)', () => {
    const warn = Object.entries(schema.rules).filter(([, state]) => state !== 'block')
    expect(warn).toEqual([])
  })
})
