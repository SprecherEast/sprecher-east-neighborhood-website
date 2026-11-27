# Illustration generator

Makes the pictures for posts and events: a drawn scene on the left and a large text panel on the
right. Python 3 with Pillow and `rsvg-convert` for export; the Poppins font is used when installed.
The procedure is the [`make-illustration`](../../.agents/skills/make-illustration/SKILL.md) skill and the
rules are in [Images made for the site](../../docs/guidelines/images.md).

| File          | What it holds                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.py` | Named settings in one place: canvas, scene width, panel width, panel type sizes, the badge corner of events, line weight, palette.                 |
| `parts.py`    | Shared parts: people, bicycles, trees, cars, carts, calendar page, roast turkey, backdrop, text panel; `place` and `focal` register what is drawn. |
| `props.py`    | Parts drawn at true scale (bin, box bundle, raised bed, sunflower, soil sack...) and the helpers that size every part from one pixels-per-metre.   |
| `checks.py`   | The rules the build judges by itself: one scale, safe area, balance, a large focal subject, a layout of its own.                                   |
| `places.py`   | Established real places (the Door Creek shelter, Pinney Library), reused exactly and never redrawn in a scene.                                     |
| `measure.py`  | Measures text with the Poppins file, so parts centre what they hold by its ink.                                                                    |
| `scenes/`     | One function per picture, registered in `scenes/__init__.py`.                                                                                      |
| `build.py`    | Builds SVGs, checks every panel, exports JPGs.                                                                                                     |

```
python3 -m scripts.illustrations.build --check                 # every scene has a panel and it fits
python3 -m scripts.illustrations.build --out DIR --render      # SVG and JPG for every scene
python3 -m scripts.illustrations.build --out DIR --only winter # one scene
python3 -m scripts.illustrations.build --check --audit         # also judge the pictures made before the rules
```

The check fails a scene with no panel, no title or no bullets, a line wider than the panel, or a
panel taller than the picture. `scripts/illustrations.test.mjs` runs it in CI.

**Scene checks** (`checks.py`, limits in `settings.py`) read what the parts register (`parts.place`),
and apply to every scene not in `PRE_RULES_SCENES`:

- **One scale:** each part stands for a real size (`REAL_SIZE_M`); one pixels-per-metre must fit all
  of them. Size parts with `props.s_person`, `w_car`, `h_tree`.
- **Safe area:** nothing comes within `SAFE_MARGIN` of an edge or runs behind the panel. A surface
  that fills the frame registers `bleed=True`; trees may run off the sides (`"sides"`), never the top.
- **Balance:** no empty band across the safe area wider than `DEAD_BAND_MAX`. A calendar page does not
  count as content; a building rising out of the frame does, a road or ground does not.
- **Focal subject:** exactly one (`parts.focal`, or `parts.focal_group` for a moment of several parts),
  at least `FOCAL_MIN_SHARE` of the safe area and `FOCAL_MIN_HEIGHT` of its height, never only a person
  or a tree. A subject that lies low or is small in a big frame fails.
- **Overlays:** a decorative overlay (`OVERLAY_KINDS`, the calendar page) overlaps no building and not
  the focal subject; a floating object over a real facade looks like a mistake.
- **Text in a part:** the calendar page's number and label, a sign's word and a building's lettering are
  drawn by `parts.text_in`, which registers the ink the font draws; the check fails text off centre by
  more than `TEXT_CENTER_TOL`, or within `TEXT_MIN_PAD` of the edge of its area. Text that is part of a
  place (`role="lettering"`: a building's sign, a notice on its door) must also have capitals at least
  `MIN_LETTERING_PHONE_PX` tall at `PHONE_WIDTH` (the header band of a
  calendar page included). It applies to every scene, old or new, but not to an event's moved scene.
- **Own layout:** where each kind of part sits on a 6 by 4 grid may not overlap another scene's by
  `LAYOUT_REPEAT_MAX` or more, unless both are in one group of `SAME_PLACE`.
- **Badge corner** of an event picture, as before. An event scene is judged for scale and layout only,
  as `parts.lowered` moves its geometry.

A scene drawn before the rules leaves `PRE_RULES_SCENES` when it is redrawn. `--audit` cannot judge the
geometry of a scene that wraps its parts in its own transform (the traffic signal): its boxes are not final.
