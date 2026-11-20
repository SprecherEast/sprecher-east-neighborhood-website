import { execFileSync, spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// The illustration generator is Python (scripts/illustrations/). These tests run it the way the
// skill and CI do, and pin the rule that every picture has a full, fitting text panel.

const run = (code) => spawnSync('python3', ['-c', code], { encoding: 'utf8', cwd: process.cwd() })

const FIND = `
import json
from scripts.illustrations import build as b
from scripts.illustrations import parts
`

describe('illustration generator', () => {
  it('builds every scene and every panel fits', () => {
    const out = execFileSync('python3', ['-m', 'scripts.illustrations.build', '--check'], {
      encoding: 'utf8',
    })
    const summary = JSON.parse(out.trim().split('\n').pop())
    expect(summary.problems).toBe(0)
    expect(summary.scenes.length).toBeGreaterThanOrEqual(7)
  })

  it('fails a scene that has no text panel', () => {
    const r = run(
      FIND +
        `
b.SCENES['no_panel'] = lambda: '<rect width="10" height="10"/>'
_, problems = b.build(['no_panel'])
print(json.dumps(problems))`,
    )
    expect(JSON.parse(r.stdout)[0]).toMatch(/no_panel: expected one text panel, found 0/)
  })

  it('fails a panel whose text is too wide', () => {
    const r = run(
      FIND +
        `
b.SCENES['wide'] = lambda: parts.panel(['Title'], ['This bullet line is far too long to fit the panel'])
_, problems = b.build(['wide'])
print(json.dumps(problems))`,
    )
    expect(JSON.parse(r.stdout)[0]).toMatch(/wide: bullet .* is too wide/)
  })

  it('fails a panel with a title but no bullets', () => {
    const r = run(
      FIND +
        `
b.SCENES['bare'] = lambda: parts.panel(['Title'], [])
_, problems = b.build(['bare'])
print(json.dumps(problems))`,
    )
    expect(JSON.parse(r.stdout).join(' ')).toMatch(/bare: panel has no bullets/)
  })

  it('reads the panel size from the named settings, not from a scene', () => {
    const r = run(
      `from scripts.illustrations import settings as s
print(s.PANEL_W, s.TITLE_SIZE, s.BULLET_SIZE)`,
    )
    expect(r.stdout.trim()).toBe('620 66 44')
  })

  it('stands every tree of the signal scene on the grass, off both roads and their sidewalks', () => {
    const r = run(
      `import json
from scripts.illustrations.scenes import signal as s
spots = [(x, y) for x, y, _ in s.TREE_SPOTS]
print(json.dumps([[x, y] for x, y in spots if not (x < -s.WALK and y > s.WALK)]))`,
    )
    expect(r.stderr).toBe('')
    expect(JSON.parse(r.stdout)).toEqual([])
  })

  it('draws a person without arms when the scene draws its own', () => {
    const r = run(
      `from scripts.illustrations import parts
arms = lambda svg: sum(svg.count(f'<rect x="{x}" y="-165"') for x in (-36, 24))
print(arms(parts.person(0, 0)), arms(parts.person(0, 0, arm="none")), 'circle cx="0" cy="-190"' in parts.person(0, 0, arm="none"))`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim()).toBe('2 0 True')
  })

  it('scales everything drawn in a scene from one named setting', () => {
    const r = run(
      `from scripts.illustrations import settings as s, parts
s.SCENE_SCALE = 1
parts.SCENE_SCALE = 2
print(parts.sc(10), parts.tree(0, 0, 100).count('scale') >= 0)`,
    )
    expect(r.stdout.split(' ')[0]).toBe('20')
  })
})
