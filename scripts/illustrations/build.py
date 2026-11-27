"""Build the illustrations: SVG per scene, an overflow check, and optional JPG export.

  python3 -m scripts.illustrations.build --out DIR            write one SVG per scene
  python3 -m scripts.illustrations.build --out DIR --render   also export JPGs (rsvg-convert + PIL)
  python3 -m scripts.illustrations.build --check              build in memory, check every panel
  python3 -m scripts.illustrations.build --only winter ...    limit to named scenes
  python3 -m scripts.illustrations.build --audit              also judge the pictures made before the rules

Exit code 1 when a check fails, so a test and CI can rely on it.
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

from . import checks, measure, parts
from .settings import *
from .scenes import SCENES


def wrap(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{body}</svg>'


def text_width(text, size, weight):
    """Rendered width in pixels. Measured with the real Poppins file when it is installed."""
    return measure.text_width(text, size, weight)


def check_panel(name, panels):
    """Problems with a scene's text panel, as readable strings. Empty list when it is fine."""
    if len(panels) != 1:
        return [f"{name}: expected one text panel, found {len(panels)}"]
    p = panels[0]
    problems = []
    if not p["title"]:
        problems.append(f"{name}: panel has no title")
    if not p["bullets"]:
        problems.append(f"{name}: panel has no bullets")
    for line in p["bullets"]:
        if text_width(line, BULLET_SIZE, "semibold") > PANEL_W - BULLET_INDENT - 40 - PANEL_RIGHT_MARGIN:
            problems.append(f"{name}: bullet '{line}' is too wide for the panel")
    for line in p["title"]:
        if text_width(line, TITLE_SIZE, "bold") > PANEL_W - PANEL_PAD - PANEL_RIGHT_MARGIN:
            problems.append(f"{name}: title line '{line}' is too wide for the panel")
    if p["h"] > PANEL_MAX_HEIGHT:
        problems.append(f"{name}: panel is {p['h']:.0f}px tall, over {PANEL_MAX_HEIGHT}")
    if p["x"] + p["w"] > W:
        problems.append(f"{name}: panel runs past the right edge")
    return problems


def can_render():
    """True when the pixel check can run: rsvg-convert and Pillow are installed."""
    try:
        import PIL  # noqa: F401
    except ImportError:
        return False
    return shutil.which("rsvg-convert") is not None


def check_clear_zone(name, lowered):
    """The drawn scene of an event picture must leave the date badge corner empty: draw it alone on
    a transparent page and look for any ink inside CLEAR_ZONE."""
    if not lowered:
        return [f"{name}: an event picture must draw its scene through parts.lowered()"]
    if not can_render():
        return []  # like the font measure, the pixel look needs the tools; CI has neither
    from io import BytesIO
    from PIL import Image
    shapes = "".join(f'<g transform="translate({SCENE_WIDTH*(1-k):g},{H*(1-k):g}) scale({k:g})">{c}</g>' for c, k in lowered)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{shapes}</svg>'
    png = subprocess.run(["rsvg-convert", "-w", str(W)], input=svg.encode(), capture_output=True, check=True).stdout
    alpha = Image.open(BytesIO(png)).convert("RGBA").getchannel("A").crop(CLEAR_ZONE)
    if alpha.getextrema()[1] > 8:
        return [f"{name}: drawing reaches into the date badge corner {CLEAR_ZONE}"]
    return []


def draw(name):
    """One scene's SVG, with the panel, the parts it drew and the pieces lowered for the badge."""
    parts.PANELS.clear()
    parts.LOWERED.clear()
    parts.PLACED.clear()
    parts.TEXTS.clear()
    body = SCENES[name]()
    return body, list(parts.PANELS), list(parts.PLACED), list(parts.LOWERED), list(parts.TEXTS)


def build(names, event_scenes=EVENT_SCENES, strict=False):
    """SVGs and problems. Scenes in PRE_RULES_SCENES skip the scene checks unless `strict` (the audit).
    A scene's layout is compared with every other scene's, so each is drawn once here."""
    out, problems, placed, panels, texts = {}, [], {}, {}, {}
    for name in names:
        body, panels[name], placed[name], lowered, texts[name] = draw(name)
        out[name] = wrap(body)
        problems += check_panel(name, panels[name])
        if name not in event_scenes:  # an event's scene is moved after the parts drew their text
            problems += checks.check_text(name, texts[name])
        if name in event_scenes:
            problems += check_clear_zone(name, lowered)
    sigs = {n: checks.signature(p) for n, p in placed.items()}
    for n in SCENES:
        if n not in sigs:
            sigs[n] = checks.signature(draw(n)[2])
    for name in names:
        if name in PRE_RULES_SCENES and not strict:
            continue
        problems += checks.check_text_registered(name, out[name], panels[name], texts[name])
        problems += checks.check_scene(name, placed[name], geometry=name not in event_scenes)
        problems += checks.check_variety(name, sigs[name], sigs, SAME_PLACE)
    return out, problems


def render(svg_path, jpg_path):
    from PIL import Image
    png = svg_path.with_suffix(".png")
    subprocess.run(["rsvg-convert", "-w", "1600", str(svg_path), "-o", str(png)], check=True)
    Image.open(png).convert("RGB").resize((EXPORT_WIDTH, round(EXPORT_WIDTH * H / W))).save(jpg_path, quality=90)
    png.unlink()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--audit", action="store_true", help="also run the scene checks on pictures made before the rules")
    a = ap.parse_args(argv)
    names = a.only or list(SCENES)
    unknown = [n for n in names if n not in SCENES]
    if unknown:
        print("unknown scene:", ", ".join(unknown), "| known:", ", ".join(SCENES)); return 2
    svgs, problems = build(names, strict=a.audit)
    for p in problems:
        print("FAIL", p)
    if a.out:
        a.out.mkdir(parents=True, exist_ok=True)
        for n, svg in svgs.items():
            (a.out / f"{n}.svg").write_text(svg)
            if a.render:
                render(a.out / f"{n}.svg", a.out / f"{n}.jpg")
    print(json.dumps({"scenes": names, "problems": len(problems)}))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
