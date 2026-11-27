"""The rules a picture must follow that a machine can judge: one real-world scale, a safe area,
balance in the frame, one large focal subject, and a layout of its own.

The parts register what they draw (`parts.place`); these functions read that list. Each returns
readable problem strings, an empty list when the scene is fine. Sizes and limits are the named
values in settings.py. A scene wrapped in a transform (`parts.lowered`, an event picture) is judged
for scale and layout only: its geometry is moved after the parts registered it.
"""
from .settings import *

GRID = (6, 4)


def _px(v):
    return f"{v:.0f}px"


def check_scale(name, placed):
    """Every part that stands for a real object fits one pixels-per-metre. Each part allows a range
    of scales (its pixels over its smallest and largest real size); the ranges must share a value."""
    spans = [(p, p["size"] / REAL_SIZE_M[p["kind"]][1], p["size"] / REAL_SIZE_M[p["kind"]][0])
             for p in placed if p["size"] and p["kind"] in REAL_SIZE_M]
    if len(spans) < 2:
        return []
    small = max(spans, key=lambda s: s[1])  # needs the most pixels per metre
    large = min(spans, key=lambda s: s[2])  # allows the fewest
    if small[1] <= large[2]:
        return []
    a, b = small[0], large[0]
    return [f"{name}: parts do not share one scale: {a['label']} ({a['kind']}, {_px(a['size'])}) and "
            f"{b['label']} ({b['kind']}, {_px(b['size'])}) cannot both be true to life"]


def _safe():
    return SAFE_MARGIN, SAFE_MARGIN, PANEL_X - SAFE_MARGIN, H - SAFE_MARGIN


def _outside(p, safe):
    x0, y0, x1, y1 = p["box"]
    sx0, sy0, sx1, sy1 = safe
    if p["bleed"] is True:
        return False
    sides = p["bleed"] == "sides"
    return (y0 < sy0 or y1 > sy1 or (not sides and (x0 < sx0 or x1 > sx1))
            or (sides and x1 > sx1 and x0 > sx0))


def check_safe_area(name, placed):
    """Nothing touches or crowds an edge, and nothing runs behind the text panel."""
    safe = _safe()
    return [f"{name}: {p['label']} ({p['kind']}) is outside the safe area {safe}: box "
            f"({', '.join(_px(v) for v in p['box'])})" for p in placed if _outside(p, safe)]


def _largest_gap(spans, lo, hi):
    """The largest stretch of [lo, hi] that none of the spans covers."""
    edge, gap = lo, 0
    for a, b in sorted((max(a, lo), min(b, hi)) for a, b in spans if b > lo and a < hi):
        gap = max(gap, a - edge)
        edge = max(edge, b)
    return max(gap, hi - edge)


def check_balance(name, placed):
    """The content fills its frame: no empty band across the safe area wider than DEAD_BAND_MAX."""
    boxes = [p["box"] for p in placed if p["bleed"] is not True]
    if not boxes:
        return []
    sx0, sy0, sx1, sy1 = _safe()
    out = []
    for axis, lo, hi, label in ((0, sx0, sx1, "across"), (1, sy0, sy1, "from top to bottom")):
        gap = _largest_gap([(b[axis], b[axis + 2]) for b in boxes], lo, hi)
        if gap > DEAD_BAND_MAX * (hi - lo):
            out.append(f"{name}: large empty band {label}: {_px(gap)} of {_px(hi - lo)} holds nothing")
    return out


def check_focal(name, placed):
    """One focal subject, drawn large, and not a person or a tree."""
    marked = [p for p in placed if p["focal"]]
    if len(marked) != 1:
        return [f"{name}: no focal subject marked (parts.focal)" if not marked
                else f"{name}: {len(marked)} focal subjects marked, expected one"]
    f = marked[0]
    sx0, sy0, sx1, sy1 = _safe()
    x0, y0, x1, y1 = f["box"]
    share = (min(x1, sx1) - max(x0, sx0)) * (min(y1, sy1) - max(y0, sy0)) / ((sx1 - sx0) * (sy1 - sy0))
    if f["kind"] in ("person", "child", "tree"):
        return [f"{name}: focal subject {f['label']} is {f['kind']}, not the thing the post is about: "
                "generic people or trees say nothing without the panel"]
    if share < FOCAL_MIN_SHARE:
        return [f"{name}: focal subject {f['label']} is too small: {share:.0%} of the safe area, "
                f"at least {FOCAL_MIN_SHARE:.0%}"]
    return []


def signature(placed):
    """Where each kind of part sits on a coarse grid of the canvas, as a set. A surface that fills the
    frame (the road, the ground) says nothing about the composition and is left out."""
    cols, rows = GRID
    sig = set()
    for p in placed:
        if p["bleed"] is True:
            continue
        x0, y0, x1, y1 = p["box"]
        for cx in range(cols):
            for cy in range(rows):
                gx0, gx1, gy0, gy1 = cx * W / cols, (cx + 1) * W / cols, cy * H / rows, (cy + 1) * H / rows
                if (min(x1, gx1) - max(x0, gx0)) * (min(y1, gy1) - max(y0, gy0)) > .25 * (gx1 - gx0) * (gy1 - gy0):
                    sig.add((p["kind"], cx, cy))
    return sig


def overlap(a, b):
    return len(a & b) / len(a | b) if a | b else 0


def check_variety(name, sig, others, same_place=()):
    """The layout of `name` is not another scene's, unless both draw the same place."""
    out = []
    for other, osig in others.items():
        if other == name or any(name in g and other in g for g in same_place):
            continue
        if overlap(sig, osig) >= LAYOUT_REPEAT_MAX:
            out.append(f"{name}: layout repeats {other} ({overlap(sig, osig):.0%} of what sits where); "
                       "draw a new composition around its own subject")
    return out


def check_scene(name, placed, geometry=True):
    """Scale, safe area, balance and focal subject of one scene. `geometry` is False for a scene
    wrapped in a transform, where boxes are not the final ones."""
    out = check_scale(name, placed) + check_focal(name, placed)
    if geometry:
        out += check_safe_area(name, placed) + check_balance(name, placed)
    return out
