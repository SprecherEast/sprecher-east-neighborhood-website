"""Build the illustrations: SVG per scene, an overflow check, and optional JPG export.

  python3 -m scripts.illustrations.build --out DIR            write one SVG per scene
  python3 -m scripts.illustrations.build --out DIR --render   also export JPGs (rsvg-convert + PIL)
  python3 -m scripts.illustrations.build --check              build in memory, check every panel
  python3 -m scripts.illustrations.build --only winter ...    limit to named scenes

Exit code 1 when a check fails, so a test and CI can rely on it.
"""
import argparse, json, subprocess, sys
from pathlib import Path

from . import parts
from .settings import *
from .scenes import SCENES


def wrap(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{body}</svg>'


def text_width(text, size, weight):
    """Rendered width in pixels. Measured with the real Poppins file when it is installed."""
    try:
        from PIL import ImageFont
        font = subprocess.check_output(["fc-match", "-f", "%{file}", f"Poppins:{weight}"]).decode()
        return ImageFont.truetype(font, size).getlength(text)
    except Exception:
        return len(text) * size * GLYPH_EM


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


def build(names):
    out, problems = {}, []
    for name in names:
        parts.PANELS.clear()
        body = SCENES[name]()
        out[name] = wrap(body)
        problems += check_panel(name, list(parts.PANELS))
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
    a = ap.parse_args(argv)
    names = a.only or list(SCENES)
    unknown = [n for n in names if n not in SCENES]
    if unknown:
        print("unknown scene:", ", ".join(unknown), "| known:", ", ".join(SCENES)); return 2
    svgs, problems = build(names)
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
