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

  // The same two pictures drawn with the deterministic fallback measure (no font file), so CI, which has
  // no Poppins, still pins them: a change to a part's drawing or to the fallback metrics fails here. CI does
  // not pin the real-font centring; the font-present test above does that wherever Poppins is installed.
  it('keeps the trash and Thanksgiving pictures as drawn with the fallback measure', () => {
    const r = run(
      `import hashlib
from scripts.illustrations import measure
measure._font = lambda *a, **k: None
from scripts.illustrations.scenes import SCENES
for name in ('trash', 'thanksgiving'): print(hashlib.sha256(SCENES[name]().encode()).hexdigest())`,
    )
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toEqual([
      '4823ac58bdfb2ed2e33bd56a3b73d3254bf898b623d2df522f5b371265863e0f',
      'c75f821c9024ab608968474aaa59234b42ae9ece84d8101a220a09b8e9c1d80e',
    ])
  })

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
        `lambda: focal(__import__('scripts.illustrations.places', fromlist=['x']).pinney_library(44, 790, 80, 'CLOSED'), 'library') + person(300, 848, .65) + PANEL()`,
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
  // A decorative overlay (a calendar page) floating over a real building or the focal subject looks
  // like a mistake; lettering that is part of a place must still be readable on a phone.
  describe('overlays and lettering', () => {
    const CHECK = `
import json
from scripts.illustrations import build as b, checks, parts, places
from scripts.illustrations.parts import *
PANEL = lambda: parts.panel(['Title'], ['One'])
def problems(fn, name='probe'):
    b.SCENES[name] = fn
    return b.build([name])[1]
`
    const probe = (scene) => run(CHECK + `\nprint(json.dumps(problems(${scene})))`)
    const LIB = `focal(places.pinney_library(44, 800, 80, 'CLOSED'), 'library')`

    it('fails a calendar page over a building, and passes one clear of it', () => {
      const over = probe(
        `lambda: ${LIB} + calendar_page(700, 60, 'NOV', '26', w=190, h=210) + PANEL()`,
      )
      expect(over.stderr).toBe('')
      expect(JSON.parse(over.stdout).join(' ')).toMatch(
        /probe: calendar overlaps .*(building|Pinney)/,
      )
      const clear = probe(`lambda: ${LIB} + PANEL()`)
      expect(JSON.parse(clear.stdout).join(' ')).not.toMatch(/overlaps/)
    })

    it('fails a calendar page over the focal subject', () => {
      const r = probe(
        `lambda: focal(car(100, 800, w=800), 'car') + calendar_page(300, 500, 'NOV', '26', w=190, h=210) + PANEL()`,
      )
      expect(JSON.parse(r.stdout).join(' ')).toMatch(
        /probe: calendar overlaps the focal subject car/,
      )
    })

    it('fails lettering of a place that would be too small to read on a phone', () => {
      const r = run(
        CHECK +
          `
parts.TEXTS.clear()
small = parts.text_in('LIBRARY', (100, 100, 400, 160), 24, role='lettering')
big = parts.text_in('LIBRARY', (100, 100, 700, 200), 60, role='lettering')
print(json.dumps([checks.check_text('t', parts.TEXTS[:1]), checks.check_text('t', parts.TEXTS[1:])]))`,
      )
      const [small, big] = JSON.parse(r.stdout)
      expect(small.join(' ')).toMatch(/t: text "LIBRARY" is too small to read on a phone/)
      expect(big).toEqual([])
    })

    it('draws the Pinney picture with no calendar page, its lettering large and the notice dated from the post', () => {
      const r = run(
        `import json
from scripts.illustrations import build as b, parts
from scripts.illustrations.scenes import SCENES
svg = SCENES['thanksgiving_library']()
cal = [p for p in parts.PLACED if p['kind'] == 'calendar']
letters = [t for t in parts.TEXTS if t['text'] in ('MADISON PUBLIC', 'LIBRARY', 'CLOSED', 'Nov. 26–27')]
print(json.dumps([len(cal), sorted(t['text'] for t in letters), b.build(['thanksgiving_library'])[1]]))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout)).toEqual([
        0,
        ['CLOSED', 'LIBRARY', 'MADISON PUBLIC', 'Nov. 26–27'],
        [],
      ])
    })
  })
  // Each limit and rule of checks.py is pinned from both sides on synthetic parts, so changing a
  // number, a kind list or a comparison makes a test fail (the review's mutations).
  describe('check boundaries', () => {
    const PRE = `
import json
from scripts.illustrations import checks, settings as s
def P(kind, box, size=None, bleed=False, focal=False, label=None):
    return {'kind': kind, 'box': box, 'size': size, 'bleed': bleed, 'focal': focal, 'label': label or kind}
def out(fn, *a): return json.dumps(fn(*a))
`
    const py = (body) => {
      const r = run(PRE + body)
      expect(r.stderr).toBe('')
      return JSON.parse(r.stdout.trim().split('\n').pop())
    }

    it('keeps parts SAFE_MARGIN from every edge, and accepts a part just inside it', () => {
      const [inside, left, top, right, bottom] = py(`
c = lambda box: checks.check_safe_area('t', [P('car', box, 100)])
print(json.dumps([c((60, 100, 200, 200)), c((20, 100, 200, 200)), c((100, 20, 200, 200)), c((100, 100, 890 + 30, 200)), c((100, 100, 200, 880))]))`)
      expect(inside).toEqual([])
      for (const f of [left, top, right, bottom])
        expect(f.join(' ')).toMatch(/outside the safe area/)
    })

    it('fails an empty band wider than DEAD_BAND_MAX of the frame, and accepts a narrower one', () => {
      const [wide, narrow] = py(`
a = [P('car', (40, 40, 905, 300)), P('car', (40, 600, 905, 860))]
b = [P('car', (40, 40, 905, 400)), P('car', (40, 520, 905, 860))]
print(json.dumps([checks.check_balance('t', a), checks.check_balance('t', b)]))`)
      expect(wide.join(' ')).toMatch(/empty band/)
      expect(narrow).toEqual([])
    })

    it('does not count a calendar page as content, nor a road; it does count a building that bleeds', () => {
      const [cal, road, building] = py(`
fill = lambda kind, bleed: [P('car', (40, 500, 905, 860)), P(kind, (40, 40, 905, 500), bleed=bleed)]
print(json.dumps([checks.check_balance('t', fill('calendar', False)), checks.check_balance('t', fill('road', True)), checks.check_balance('t', fill('building', True))]))`)
      expect(cal.join(' ')).toMatch(/empty band from top to bottom/)
      expect(road.join(' ')).toMatch(/empty band from top to bottom/)
      expect(building).toEqual([])
    })

    it('holds the focal subject to FOCAL_MIN_SHARE of the area and FOCAL_MIN_HEIGHT of its height', () => {
      const [small, flat, ok] = py(`
f = lambda box: checks.check_focal('t', [P('car', box, focal=True, label='car')])
print(json.dumps([f((40, 40, 480, 300)), f((40, 600, 905, 830)), f((40, 40, 480, 520))]))`)
      expect(small.join(' ')).toMatch(/too small/) // 16% of the area, tall enough
      expect(flat.join(' ')).toMatch(/too small/) // 28% of the area, but only 28% of its height
      expect(ok).toEqual([])
    })

    it('does not let a focal group qualify through its union box, or contain a tree', () => {
      const [lead, tree, moment] = py(`
g = lambda parts: checks.check_focal('t', parts)
car = lambda box: P('car', box, focal=True, label='moment')
print(json.dumps([
  g([car((40, 700, 200, 860)), P('person', (700, 40, 900, 200), focal=True, label='moment')]),
  g([car((40, 300, 905, 860)), P('tree', (300, 40, 600, 300), focal=True, label='moment')]),
  g([car((40, 300, 600, 860)), P('person', (600, 400, 700, 860), focal=True, label='moment')])]))`)
      expect(lead.join(' ')).toMatch(/moment .*(too small|largest part)/)
      expect(tree.join(' ')).toMatch(/moment .*tree/)
      expect(moment).toEqual([])
    })

    it('repeats a layout only from LAYOUT_REPEAT_MAX of what sits where', () => {
      const [alike, apart] = py(`
a = {('car', i, 0) for i in range(10)}
b = {('car', i, 0) for i in range(8)} | {('tree', i, 1) for i in range(2)}
c = {('car', i, 0) for i in range(3)} | {('tree', i, 1) for i in range(8)}
print(json.dumps([checks.check_variety('n', a, {'o': b}), checks.check_variety('n', a, {'o': c})]))`)
      expect(alike.join(' ')).toMatch(/layout repeats o/) // 8 of 12 shared: 67%
      expect(apart).toEqual([])
    })

    it('judges text centred on both axes within TEXT_CENTER_TOL, and inside the canvas', () => {
      const [ok, x, y, onlyY, offcanvas] = py(`
area = (100, 100, 300, 300)
t = lambda ink, area=area: checks.check_text('t', [{'text': 'T', 'area': area, 'ink': ink, 'role': 'label'}])
print(json.dumps([t((155, 155, 235, 235)), t((153, 160, 233, 240)), t((160, 153, 240, 233)), t((160, 153, 240, 233)),
                  t((10, 160, 50, 240), (-40, 100, 100, 300))]))`)
      expect(ok).toEqual([]) // 5px off on each axis, within 3% of 200px
      expect(x.join(' ')).toMatch(/off centre/)
      expect(y.join(' ')).toMatch(/-7px down/)
      expect(onlyY.join(' ')).toMatch(/off centre/)
      expect(offcanvas.join(' ')).toMatch(/runs off the canvas/)
    })

    it('fails a calendar page touching or overlapping any drawn object, not only a building', () => {
      const [car, touching, tree, road, clear, focalBuilding] = py(`
cal = P('calendar', (300, 100, 500, 300))
o = lambda *others: checks.check_overlays('t', [cal, *others])
print(json.dumps([
  o(P('car', (400, 250, 700, 400), 100)),
  o(P('car', (500, 100, 700, 300), 100)),
  o(P('tree', (300, 200, 600, 700), 300, bleed='sides')),
  o(P('road', (0, 250, 1600, 900), bleed=True)),
  o(P('car', (600, 400, 800, 500), 100)),
  checks.check_overlays('t', [cal, P('building', (200, 200, 900, 800), 300, focal=True, label='library')])]))`)
      expect(car.join(' ')).toMatch(/calendar overlaps car/)
      expect(touching.join(' ')).toMatch(/calendar overlaps car/)
      expect(tree.join(' ')).toMatch(/calendar overlaps tree/)
      expect(road).toEqual([])
      expect(clear).toEqual([])
      expect(focalBuilding).toHaveLength(1) // reported once, as the focal subject
      expect(focalBuilding[0]).toMatch(/focal subject library/)
    })

    // One test per kind in REAL_SIZE_M, with the metres written here (not read from the limits, so
    // widening a limit fails): beside a person of 1.7 m at 100 px a metre, a part that is far too small
    // or too large fails, one of a believable size passes.
    it.each([
      ['tree', 0.3, 40, 8],
      ['building', 0.5, 40, 8],
      ['bin', 0.2, 8, 1.5],
      ['bike', 0.3, 6, 1.7],
      ['cart', 0.2, 4, 1.0],
      ['bed', 0.05, 3, 0.5],
      ['car', 0.8, 15, 4.5],
      ['child', 0.3, 4, 1.2],
    ])('fails a %s of %s m or %s m beside a person, passes %s m', (kind, small, big, fine) => {
      const [tooSmall, tooBig, ok] = py(`
person = P('person', (0, 0, 1, 1), 170)
t = lambda metres: checks.check_scale('t', [person, P('${kind}', (0, 0, 1, 1), 100 * metres)])
print(json.dumps([t(${small}), t(${big}), t(${fine})]))`)
      expect(tooSmall.join(' ')).toMatch(/share one scale/)
      expect(tooBig.join(' ')).toMatch(/share one scale/)
      expect(ok).toEqual([])
    })
  })

  describe('text drawn outside parts', () => {
    const CHECK = `
import json
from scripts.illustrations import build as b, parts
from scripts.illustrations.parts import *
PANEL = lambda: parts.panel(['Title'], ['One'])
def problems(fn, name='probe'):
    b.SCENES[name] = fn
    return b.build([name])[1]
`
    const probe = (scene) =>
      JSON.parse(run(CHECK + `\nprint(json.dumps(problems(${scene})))`).stdout)

    it('fails a scene that draws a raw text element instead of using parts.text_in', () => {
      const raw = probe(
        `lambda: '<text x="100" y="100">Raw</text>' + focal(car(100, 800, w=800), 'car') + PANEL()`,
      )
      expect(raw.join(' ')).toMatch(/probe: 1 text element is drawn outside parts.text_in/)
    })

    it('passes text drawn through parts.text_in, and the panel text', () => {
      const ok = probe(
        `lambda: text_in('Hi', (100, 100, 300, 200), 40) + focal(car(100, 800, w=800), 'car') + PANEL()`,
      )
      expect(ok.join(' ')).not.toMatch(/outside parts.text_in/)
    })

    it('leaves the pictures made before the rules alone', () => {
      const r = run(
        `from scripts.illustrations import build as b
print(b.build(['trash'])[1])`,
      )
      expect(r.stdout.trim()).toBe('[]')
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
places.pinney_library(44, 790, 80, 'CLOSED')
print(json.dumps(sorted({p['kind'] for p in parts.PLACED} - set(s.REAL_SIZE_M))))`,
      )
      expect(r.stderr).toBe('')
      expect(JSON.parse(r.stdout)).toEqual([])
    })

    it('draws Pinney Library once, as an agreed real outline, and a notice only when asked', () => {
      const r = run(
        `import json
from scripts.illustrations import parts, places
a = places.pinney_library(44, 790, 80, 'CLOSED')
parts.PLACED.clear()
b = places.pinney_library(44, 790, 80, 'CLOSED')
c = places.pinney_library(44, 790, 80)
print(json.dumps([a == b, 'CLOSED' in b, 'CLOSED' in c, 'MADISON PUBLIC' in c, 'ROYSTER' in c, 'Cottage Grove' in (places.pinney_library.__doc__ or ''), [p['label'] for p in parts.PLACED][-3:]]))`,
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
