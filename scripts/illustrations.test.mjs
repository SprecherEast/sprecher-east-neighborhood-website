import { execFileSync, spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// The illustration generator is Python (scripts/illustrations/). These tests run it the way the
// skill and CI do, and pin the rule that every picture has a full, fitting text panel.

// The pixel check needs rsvg-convert and Pillow, as the font measure needs Poppins; CI has neither.
const canRender =
  spawnSync(
    'python3',
    [
      '-c',
      'from scripts.illustrations.build import can_render as c; raise SystemExit(0 if c() else 1)',
    ],
    {
      cwd: process.cwd(),
    },
  ).status === 0

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
  it('keeps the date badge corner of an event picture empty, as the real badge measures', () => {
    const r = run(
      `import json
from scripts.illustrations import build as b, settings as s
print(json.dumps([s.CLEAR_ZONE, list(s.EVENT_SCENES), b.build(list(s.EVENT_SCENES))[1]]))`,
    )
    expect(r.stderr).toBe('')
    const [zone, scenes, problems] = JSON.parse(r.stdout)
    expect(zone[2]).toBeGreaterThanOrEqual(420)
    expect(zone[3]).toBeGreaterThanOrEqual(420)
    expect(scenes).toEqual(expect.arrayContaining(['marimba', 'workshop']))
    expect(problems).toEqual([])
  })

  it.skipIf(!canRender)('fails an event picture that draws inside the date badge corner', () => {
    const r = run(
      FIND +
        `
b.SCENES['crowded'] = lambda: parts.lowered('<rect x="0" y="0" width="300" height="300" fill="#f00"/>', 1) + parts.panel(['Title'], ['One'])
_, problems = b.build(['crowded'], event_scenes=['crowded'])
print(json.dumps(problems))`,
    )
    expect(r.stderr).toBe('')
    expect(JSON.parse(r.stdout).join(' ')).toMatch(
      /crowded: drawing reaches into the date badge corner/,
    )
  })

  it('moves the drawn scene down and in by one named scale, anchored at the scene corner', () => {
    const r = run(
      `from scripts.illustrations import settings as s, parts
svg = parts.lowered('<rect/>')
print(s.EVENT_SCENE_SCALE < 1, 'scale(' + str(s.EVENT_SCENE_SCALE) + ')' in svg)`,
    )
    expect(r.stdout.trim()).toBe('True True')
  })

  it('draws the calendar page and the roast turkey once, shared by the scenes that show them', () => {
    const r = run(
      `from scripts.illustrations import parts
from scripts.illustrations.scenes import SCENES
trash, thanks = SCENES['trash'](), SCENES['thanksgiving']()
page = parts.calendar_page(615, 330, 'NOV', '26')
print(page in trash, parts.roast_turkey(730, 676, .8) in trash, 'scale(.8)' in trash)
print('>26</text>' in page, 'y="190"' in page, 'width="230" height="250"' in page)
print(parts.calendar_page(560, 150, 'NOV', '26', w=190, h=210) in thanks, parts.roast_turkey(495, 512, .95) in thanks)`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toEqual(['True True True', 'True True True', 'True True'])
  })

  // Golden hashes of the two published pictures. The trash hash is the scene's output from before
  // the turkey and the calendar page became shared parts, so the refactor changed nothing; any
  // change to a part's drawing changes a published picture and must update these on purpose.
  it('keeps the published trash and Thanksgiving pictures exactly as drawn', () => {
    const r = run(
      `import hashlib
from scripts.illustrations.scenes import SCENES
for name in ('trash', 'thanksgiving'): print(hashlib.sha256(SCENES[name]().encode()).hexdigest())`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toEqual([
      'cfc85dab13029a54b27e99d0bb7e59275905e9b36395ca180aa88949ea9badaf',
      '7128ee7d2ba3f20716f9c8ca4bf216817d2f05589dee6de4801170ce3a35715f',
    ])
  })
})
