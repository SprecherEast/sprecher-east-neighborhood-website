import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { HOT_SPOTS } from './overlap-hot-spots.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('the hot spot list', () => {
  const text = fs.readFileSync(path.join(root, 'docs/process/project-management.md'), 'utf8')
  const paragraph = text.split(/\n(?=- )/).find((entry) => entry.includes('**Shared hot spots**'))
  const normalized = (paragraph ?? '').replace(/\s+/g, ' ')
  const written = [...normalized.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\/$/, ''))
  const listed = HOT_SPOTS.flatMap((group) => group.paths)
  const covers = (p, item) => p === item || p.endsWith(`/${item}`)

  it('has a name, a rule phrase and at least one path for every group', () => {
    for (const group of HOT_SPOTS) {
      expect(group.name).toBeTruthy()
      expect(group.rule).toBeTruthy()
      expect(group.paths.length).toBeGreaterThan(0)
    }
  })

  it('finds the written rule', () => {
    expect(paragraph).toBeTruthy()
    expect(written.length).toBeGreaterThan(5)
  })

  it('has one group for each item of the written rule, and each rule phrase is in it', () => {
    const items = normalized.slice(normalized.indexOf('):') + 2).split(';')
    expect(HOT_SPOTS).toHaveLength(items.length)
    for (const group of HOT_SPOTS) {
      expect(normalized, `"${group.rule}" is not in the written rule`).toContain(group.rule)
    }
  })

  it('names every path the written rule lists', () => {
    for (const item of written) {
      const found = listed.some((p) => covers(p, item))
      expect(found, `${item} is in the written rule but not in overlap-hot-spots.mjs`).toBe(true)
    }
  })

  it('lists only paths the rule names, or marks them as spelled out in prose', () => {
    for (const group of HOT_SPOTS) {
      for (const p of group.paths) {
        const inRule = written.some((item) => covers(p, item))
        const prose = (group.prose ?? []).includes(p)
        expect(inRule || prose, `${p} is listed but the written rule does not name it`).toBe(true)
        expect(inRule && prose, `${p} is marked as prose but the rule names it`).toBe(false)
      }
    }
  })

  it('covers the layout, header and navigation the rule names in prose', () => {
    const shell = HOT_SPOTS.find((group) => group.rule.includes('layout')).paths.join(' ')
    for (const word of [/layout/, /Header/, /nav/i, /globals/]) expect(shell).toMatch(word)
    expect(listed).toContain('src/modules/site/cms/navGlobal.ts')
    expect(listed).toContain('src/modules/site/data/globals.ts')
  })
})
