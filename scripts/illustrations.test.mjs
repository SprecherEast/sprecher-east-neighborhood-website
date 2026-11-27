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

// The golden hashes below depend on the font's real measures (a centred calendar page); CI has no Poppins.
const hasFont =
  spawnSync(
    'python3',
    [
      '-c',
      'from scripts.illustrations.measure import has_font as h; raise SystemExit(0 if h() else 1)',
    ],
    { cwd: process.cwd() },
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
print('>26</text>' in page, 'font-size="' in page, 'width="230" height="250"' in page)
print(parts.calendar_page(560, 150, 'NOV', '26', w=190, h=210) in thanks, parts.roast_turkey(495, 512, .95) in thanks)`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toEqual(['True True True', 'True True True', 'True True'])
  })

  // Golden hashes of the two published pictures that show a calendar page. They changed once, on
  // purpose, when the calendar page's number and label were centred by their ink (#1561, the owner's
  // direction of 2026-11-27); any later change to a part's drawing must update these on purpose.
  it.skipIf(!hasFont)(
    'keeps the published trash and Thanksgiving pictures exactly as drawn',
    () => {
      const r = run(
        `import hashlib
from scripts.illustrations.scenes import SCENES
for name in ('trash', 'thanksgiving'): print(hashlib.sha256(SCENES[name]().encode()).hexdigest())`,
      )
      expect(r.stderr).toBe('')
      expect(r.stdout.trim().split('\n')).toEqual([
        '274cdc7bea2c89ce77d8ec16fc876502a4079add9059acd161f2ffeb38ac1a19',
        '5ad2fe2309ec6d1680835bd3b6aec5e71049dd86e27e85289aa17589784f84af',
      ])
    },
  )

  // Golden hashes of the drop-off and youth grants pictures, pinned before the shared road part
  // replaced the road each of them drew itself, so that refactor changed nothing.
  it('keeps the published drop-off and youth grants pictures exactly as drawn', () => {
    const r = run(
      `import hashlib
from scripts.illustrations.scenes import SCENES
for name in ('dropoff', 'youth'): print(hashlib.sha256(SCENES[name]().encode()).hexdigest())`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toEqual([
      'ef9a26247a2ae5be089429b746760c98b2e60e2533a79f1d301a95c771eb4724',
      'd9efa10428624bbe2ae23f507c37f7705493f1d1cc0d888283203bb1c276376b',
    ])
  })

  it('keeps the wording of the drop-off and youth grants panels', () => {
    const r = run(
      `import json
from scripts.illustrations import parts
from scripts.illustrations.scenes import SCENES
out = {}
for name in ('dropoff', 'youth'):
    parts.PANELS.clear()
    SCENES[name]()
    out[name] = [[p['title'], p['bullets']] for p in parts.PANELS]
print(json.dumps(out))`,
    )
    expect(r.stderr).toBe('')
    expect(JSON.parse(r.stdout)).toEqual({
      dropoff: [
        [
          ['Last Saturday', 'for drop-offs'],
          ['Sat., Nov. 28', '9 a.m. to 4 p.m.', 'Winter hours Dec. 4', 'Proof of address'],
        ],
      ],
      youth: [
        [
          ['Youth-led', 'project grants'],
          ['Up to $3,000', 'Apply by Dec. 18', 'Youth plan and lead', 'Awards in March'],
        ],
      ],
    })
  })

  it('draws the road once, as a shared part, in every scene that shows that road', () => {
    const r = run(
      `from scripts.illustrations.scenes import SCENES
from scripts.illustrations.scenes.street_days import road
r = road(700, 44, 170, 840)
print(r.count('stroke-dasharray="40 26"'), r.count('fill="#34405f"'), 'y="744"' in r, 'M0,840 L1700,840' in r)
print([road(*a) in SCENES[n]() for n, a in (('dropoff', (700, 44, 170, 840)), ('youth', (700, 44, 170, 840)), ('trash', (640, 50, 220, 800)), ('thanksgiving', (700, 40, 170, 830)))])
print([SCENES[n]().count('stroke-dasharray="40 26"') for n in ('dropoff', 'youth')])`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toEqual([
      '1 1 True True',
      '[True, True, True, True]',
      '[1, 1]',
    ])
  })
  // Rules the build checks by itself (checks.py): one scale, a safe area, no dead area, one large
  // focal subject, and a layout of its own. Each runs on a throwaway scene registered under a name
  // that is not a legacy one.
  describe('scene checks', () => {
    const CHECK = `
import json, re
from scripts.illustrations import build as b, parts
from scripts.illustrations.parts import *
PANEL = lambda: parts.panel(['Title'], ['One'])
def problems(fn, name='probe'):
    b.SCENES[name] = fn
    return b.build([name])[1]
`
    const probe = (scene, extra = '') =>
      run(CHECK + extra + `\nprint(json.dumps(problems(${scene})))`)

    it('fails parts that do not share one real-world scale', () => {
      const r = probe(`lambda: person(300, 800, 1) + car(500, 820, w=250) + PANEL()`)
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout).join(' ')).toMatch(/probe: .* share one scale/)
    })

    it('accepts a person, a car and a cart drawn at one scale', () => {
      const r = probe(
        `lambda: person(150, 800, 1) + car(220, 830, w=500) + cart(800, 800, '#2b3556', '#1f2a44', .6) + PANEL()`,
      )
      expect(JSON.parse(r.stdout).join(' ')).not.toMatch(/share one scale/)
    })

    it('fails a part outside the safe margin or touching an edge', () => {
      const r = probe(`lambda: person(20, 800, 1) + PANEL()`)
      expect(JSON.parse(r.stdout).join(' ')).toMatch(/probe: person .* outside the safe area/)
    })

    it('fails a part that runs behind the text panel', () => {
      const r = probe(`lambda: person(930, 800, 1) + PANEL()`)
      expect(JSON.parse(r.stdout).join(' ')).toMatch(/probe: person .* outside the safe area/)
    })

    it('lets scenery trees run off the sides but not off the top', () => {
      const side = probe(`lambda: tree(30, 800, 500) + PANEL()`)
      expect(JSON.parse(side.stdout).join(' ')).not.toMatch(/tree .* outside the safe area/)
      const top = probe(`lambda: tree(400, 800, 900) + PANEL()`)
      expect(JSON.parse(top.stdout).join(' ')).toMatch(/tree .* outside the safe area/)
    })

    it('fails content that leaves a large empty band in the frame', () => {
      const r = probe(`lambda: person(450, 800, 1) + PANEL()`)
      expect(JSON.parse(r.stdout).join(' ')).toMatch(/probe: large empty (band|area)/)
    })

    it('fails a scene with no focal subject, or with a small or a person-only one', () => {
      const none = JSON.parse(probe(`lambda: person(450, 800, 1) + PANEL()`).stdout).join(' ')
      expect(none).toMatch(/probe: no focal subject/)
      const small = JSON.parse(
        probe(
          `lambda: person(450, 800, 1) + focal(cart(300, 800, '#2b3556', '#1f2a44', .6), 'cart') + PANEL()`,
        ).stdout,
      ).join(' ')
      expect(small).toMatch(/probe: focal subject .* too small/)
      const people = JSON.parse(
        probe(`lambda: focal(person(450, 800, 3), 'person') + PANEL()`).stdout,
      ).join(' ')
      expect(people).toMatch(/probe: focal subject .* people/)
    })

    it('fails a focal subject that lies low or is small in its frame, however wide', () => {
      const low = JSON.parse(
        probe(
          `lambda: person(700, 830, 1) + focal(car(100, 830, w=640), 'car') + tree(420, 760, 700) + PANEL()`,
        ).stdout,
      ).join(' ')
      expect(low).toMatch(/probe: focal subject car is too small/)
    })

    it('does not count a calendar page as content that fills the sky', () => {
      const r = probe(
        `lambda: calendar_page(300, 60, 'NOV', '26') + focal(car(100, 830, w=800), 'car') + PANEL()`,
      )
      expect(JSON.parse(r.stdout).join(' ')).toMatch(/probe: large empty band from top to bottom/)
    })

    it('counts a building that rises out of the frame as content, and a road as none', () => {
      const r = probe(
        `lambda: focal(__import__('scripts.illustrations.places', fromlist=['x']).pinney_library(60, 800, 58, 'CLOSED'), 'library') + person(300, 840, 1.0) + PANEL()`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout).join(' ')).not.toMatch(/empty band|too small|outside/)
    })

    it('passes a scene of one large focal subject with the rest at its scale', () => {
      const r = probe(
        `lambda: tree(120, 820, 700) + focal(car(180, 830, w=800), 'car') + person(120, 820, 1.25) + PANEL()`,
      )
      const text = JSON.parse(r.stdout).join(' ')
      expect(text).not.toMatch(/focal|scale/)
    })

    it("fails a new scene that repeats another scene's layout, unless it is the same place", () => {
      const r = run(
        CHECK +
          `
scene = lambda: tree(120, 820, 700) + focal(car(180, 830, w=640), 'car') + person(120, 820, 1.0) + PANEL()
b.SCENES['first'] = scene
b.SCENES['second'] = scene
same = b.build(['first', 'second'])[1]
b.SAME_PLACE = (('first', 'second'),)
settled = b.build(['first', 'second'])[1]
print(json.dumps([same, settled]))`,
      )
      const [same, settled] = JSON.parse(r.stdout)
      expect(same.join(' ')).toMatch(/second: layout repeats first/)
      expect(settled.join(' ')).not.toMatch(/layout repeats/)
    })

    it('leaves the pictures made before the rules alone, and lists them to be redrawn', () => {
      const r = run(
        `import json
from scripts.illustrations import settings as s
from scripts.illustrations.scenes import SCENES
print(json.dumps([sorted(set(s.PRE_RULES_SCENES) - set(SCENES)), 'thanksgiving' in s.PRE_RULES_SCENES]))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout)).toEqual([[], true])
    })

    it('registers what the parts draw: kind, size on the canvas and the real size it stands for', () => {
      const r = run(
        `import json
from scripts.illustrations import parts
parts.PLACED.clear()
parts.person(300, 800, 1); parts.car(100, 800, w=500); parts.tree(0, 800, 500)
print(json.dumps([[p['kind'], p['bleed']] for p in parts.PLACED]))`,
      )
      expect(JSON.parse(r.stdout)).toEqual([
        ['person', false],
        ['car', false],
        ['tree', 'sides'],
      ])
    })
  })
  // Text inside a part (the calendar page, a sign board) is centred in the area meant for it and
  // clear of its edges and header (checks.check_text), judged from the ink the font really draws.
  describe('text inside parts', () => {
    const CHECK = `
import json
from scripts.illustrations import build as b, checks, parts
from scripts.illustrations.parts import *
PANEL = lambda: parts.panel(['Title'], ['One'])
def texts(fn):
    parts.PLACED.clear(); parts.TEXTS.clear(); fn()
    return list(parts.TEXTS)
`
    it('centres the day number of a calendar page at every size, for one and two digits', () => {
      const r = run(
        CHECK +
          `
out = []
for w, h in ((230, 250), (190, 210), (120, 140), (300, 300)):
    for day in ('5', '26', '28', '11'):
        t = texts(lambda: calendar_page(100, 100, 'NOV', day, w=w, h=h))
        out.append(checks.check_text('cal', t))
print(json.dumps(out))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout).flat()).toEqual([])
    })

    it('registers the month and the day, each with the area it must sit in', () => {
      const r = run(
        CHECK +
          `
t = texts(lambda: calendar_page(100, 100, 'SAT', '28'))
print(json.dumps([[x['text'], x['area'][1] >= 100] for x in t]))`,
      )
      expect(JSON.parse(r.stdout)).toEqual([
        ['SAT', true],
        ['28', true],
      ])
    })

    it('fails text that is off centre, touches the edge of its area, or leaves it', () => {
      const r = run(
        CHECK +
          `
area = (100, 160, 300, 350)
def ink(x0, y0, x1, y1): return [{'text': '26', 'area': area, 'ink': (x0, y0, x1, y1)}]
print(json.dumps([checks.check_text('t', ink(160, 200, 240, 310)),   # centred
                  checks.check_text('t', ink(130, 200, 210, 310)),   # off to the left
                  checks.check_text('t', ink(160, 162, 240, 272)),   # touches the header side
                  checks.check_text('t', ink(160, 250, 240, 380))])) # runs out of the area`,
      )
      const [ok, left, top, out] = JSON.parse(r.stdout)
      expect(ok).toEqual([])
      expect(left.join(' ')).toMatch(/t: text "26" is off centre/)
      expect(top.join(' ')).toMatch(/t: text "26" .* (touches|crowds) /)
      expect(out.join(' ')).toMatch(/t: text "26" .*(outside|leaves)/)
    })

    it('draws the number below the header band of a short calendar page, where it once collided', () => {
      const r = run(
        CHECK +
          `
t = texts(lambda: calendar_page(100, 100, 'NOV', '26', w=190, h=210))
day = [x for x in t if x['text'] == '26'][0]
print(day['ink'][1] > 100 + 60 + 10, day['ink'][3] < 100 + 210 - 10)`,
      )
      expect(r.stdout.trim()).toBe('True True')
    })

    it('has the build fail a scene whose text sits off centre in its part', () => {
      const r = run(
        CHECK +
          `
def bad():
    parts.TEXTS.append({'text': 'X', 'area': (100, 100, 300, 300), 'ink': (110, 120, 150, 180)})
    return parts.focal(parts.car(100, 830, w=800), 'car') + PANEL()
b.SCENES['probe'] = bad
print(json.dumps(b.build(['probe'])[1]))`,
      )
      expect(JSON.parse(r.stdout).join(' ')).toMatch(/probe: text "X" is off centre/)
    })
  })
  describe('true-scale scenes', () => {
    it('sizes every part from one pixels-per-metre, so a person, a car and a tree agree', () => {
      const r = run(
        `import json
from scripts.illustrations import parts, props, settings as s
parts.PLACED.clear()
ppm = 100
parts.person(100, 800, props.s_person(ppm)); parts.car(200, 800, w=props.w_car(ppm))
parts.tree(800, 800, props.h_tree(ppm, 6))
print(json.dumps([round(p['size'] / ppm, 2) for p in parts.PLACED]))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout)).toEqual([1.7, 4.6, 6])
    })

    it('registers every prop a new scene uses, each with a real size to check', () => {
      const r = run(
        `import json
from scripts.illustrations import parts, places, props, settings as s
parts.PLACED.clear()
props.dumpster(40, 800, 90); props.raised_bed(330, 815, 130, plants=((1, 2),), fresh=(1, 2))
places.pinney_library(40, 800, 68, 'CLOSED')
print(json.dumps(sorted({p['kind'] for p in parts.PLACED} - set(s.REAL_SIZE_M))))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout)).toEqual([])
    })

    it('draws Pinney Library once, as an agreed real outline, and a notice only when asked', () => {
      const r = run(
        `import json
from scripts.illustrations import parts, places
a = places.pinney_library(48, 800, 68, 'CLOSED')
parts.PLACED.clear()
b = places.pinney_library(48, 800, 68, 'CLOSED')
c = places.pinney_library(48, 800, 68)
print(json.dumps([a == b, 'CLOSED' in b, 'CLOSED' in c, 'MADISON PUBLIC LIBRARY' in c, 'ROYSTER COMMONS' in c, 'Cottage Grove' in (places.pinney_library.__doc__ or ''), [p['label'] for p in parts.PLACED][-3:]]))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout)).toEqual([
        true,
        true,
        false,
        true,
        true,
        true,
        ['Pinney Library', 'Pinney upper floors', 'Pinney Library'],
      ])
    })

    it('marks a group of parts as one focal subject', () => {
      const r = run(
        `import json
from scripts.illustrations import parts
parts.PLACED.clear()
parts.person(100, 800, 1); parts.car(200, 800, w=500); parts.person(700, 800, 1)
parts.focal_group('', 'unloading', 2)
print(json.dumps([[p['label'], p['focal'] and True] for p in parts.PLACED]))`,
      )
      expect(JSON.parse(r.stdout)).toEqual([
        ['person', false],
        ['unloading', true],
        ['unloading', true],
      ])
    })

    it('draws nothing in the redrawn scenes that reads as a fence or wire mesh', () => {
      const r = run(
        `from scripts.illustrations.scenes import SCENES
print([('mesh' in SCENES[n]() or 'chain' in SCENES[n]().lower()) for n in ('thanksgiving_library', 'dropoff_unload', 'youth_garden')])`,
      )
      expect(r.stdout.trim()).toBe('[False, False, False]')
    })

    it('keeps the wording of the panels the redrawn pictures carry', () => {
      const r = run(
        `import json
from scripts.illustrations import parts
from scripts.illustrations.scenes import SCENES
out = {}
for name in ('thanksgiving_library', 'dropoff_unload', 'youth_garden'):
    parts.PANELS.clear()
    SCENES[name]()
    out[name] = [[p['title'], p['bullets']] for p in parts.PANELS]
print(json.dumps(out))`,
      )
      expect(r.stderr).toBe('')
      const thanks = [
        [
          ['Happy', 'Thanksgiving'],
          ['No pickup Thu., Fri.', 'Fri. moves to Mon.', 'Drop-offs closed', 'Libraries closed'],
        ],
      ]
      const drop = [
        [
          ['Last Saturday', 'for drop-offs'],
          ['Sat., Nov. 28', '9 a.m. to 4 p.m.', 'Winter hours Dec. 4', 'Proof of address'],
        ],
      ]
      const youth = [
        [
          ['Youth-led', 'project grants'],
          ['Up to $3,000', 'Apply by Dec. 18', 'Youth plan and lead', 'Awards in March'],
        ],
      ]
      expect(JSON.parse(r.stdout)).toEqual({
        thanksgiving_library: thanks,
        dropoff_unload: drop,
        youth_garden: youth,
      })
    })

    it('holds the redrawn scenes to every scene check, each with its own layout', () => {
      const r = run(
        `import json
from scripts.illustrations import build as b, settings as s
from scripts.illustrations.scenes import SCENES
new = [n for n in SCENES if n not in s.PRE_RULES_SCENES]
print(json.dumps([new, b.build(new)[1]]))`,
      )
      expect(r.stderr).toBe('')
      const [names, problems] = JSON.parse(r.stdout)
      expect(names).toHaveLength(3)
      expect(problems).toEqual([])
    })

    it('audits the earlier pictures against the rules on request, and fails the ones that break them', () => {
      const r = spawnSync(
        'python3',
        ['-m', 'scripts.illustrations.build', '--check', '--audit', '--only', 'dropoff'],
        { encoding: 'utf8' },
      )
      expect(r.status).toBe(1)
      expect(r.stdout).toMatch(/FAIL dropoff: parts do not share one scale/)
    })
  })
})
