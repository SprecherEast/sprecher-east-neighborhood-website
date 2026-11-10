/**
 * The pull request labeler may add area labels and markers from changed paths, never a type label.
 * A pull request carries exactly one type label (`.github/label-policy.json`), set by the author
 * from the issue; a path rule that adds a second one is re-added on every push.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const policy = JSON.parse(read('.github/label-policy.json'))
const rules = yaml.load(read('.github/labeler.yml'))

describe('labeler path rules', () => {
  it('loads at least one rule', () => {
    expect(Object.keys(rules).length).toBeGreaterThan(0)
  })

  it('never add a type label', () => {
    const typeLabels = Object.keys(rules).filter((label) => policy.types.includes(label))
    expect(typeLabels).toEqual([])
  })

  it('only add labels the policy knows as an area or a marker', () => {
    const known = [...policy.areas, ...Object.keys(policy.markers)]
    expect(Object.keys(rules).filter((label) => !known.includes(label))).toEqual([])
  })
})
