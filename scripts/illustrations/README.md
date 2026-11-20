# Illustration generator

Makes the pictures for posts and events: a drawn scene on the left and a large text panel on the
right. Python 3 with Pillow and `rsvg-convert` for export; the Poppins font is used when installed.
The procedure is the [`make-illustration`](../../.agents/skills/make-illustration/SKILL.md) skill and the
rules are in [Images made for the site](../../docs/guidelines/images.md).

| File          | What it holds                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `settings.py` | Named settings in one place: canvas, scene width, panel width, panel type sizes, the badge corner of events, line weight, palette. |
| `parts.py`    | Shared parts: people, bicycles, trees, cars, backdrop, text panel.                                                                 |
| `places.py`   | Established real places, reused exactly and never redrawn in a scene.                                                              |
| `scenes/`     | One function per picture, registered in `scenes/__init__.py`.                                                                      |
| `build.py`    | Builds SVGs, checks every panel, exports JPGs.                                                                                     |

```
python3 -m scripts.illustrations.build --check                 # every scene has a panel and it fits
python3 -m scripts.illustrations.build --out DIR --render      # SVG and JPG for every scene
python3 -m scripts.illustrations.build --out DIR --only winter # one scene
```

The check fails a scene with no panel, no title or no bullets, a line wider than the panel, or a
panel taller than the picture. `scripts/illustrations.test.mjs` runs it in CI.
