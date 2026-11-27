"""Props for scenes drawn at true scale: things bigger than a person (a bin, a garden bed) and the helpers that size every part from one pixels-per-metre value.

A scene picks one `ppm` and sizes every part with the helpers here, so a car, a person and a wall
agree. Parts here are drawn in metres inside one group, so a size in the code is a size in life,
and each registers itself for the build's checks (`parts.place`).
"""
from .parts import *


def s_person(ppm, m=1.7, hr=13):
    """The `s` that draws a person m metres tall at ppm pixels per metre."""
    return m * ppm / (190 + hr + 6)

def w_car(ppm, m=4.6):
    """The `w` that draws a car m metres long."""
    return m * ppm * 250 / 240

def h_tree(ppm, m=6):
    """The `h` that draws a tree m metres tall."""
    return m * ppm / .9

def _g(x, y, ppm, flip=False, part=""):
    """Opens a group in metres: origin at (x, y), y down, one unit one metre. `part` names it
    (`data-part`) so a test can find what it drew."""
    tag = f' data-part="{part}"' if part else ""
    return f'<g{tag} transform="translate({x:g},{y:g}) scale({-ppm if flip else ppm:g},{ppm:g})">'

def _o(ppm):
    return f'stroke="{NAVY}" stroke-width="{SW / ppm:.4f}" stroke-linejoin="round"'

def _rect(x, y, w, h, fill, ppm, rx=0, extra=""):
    return f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{rx:g}" fill="{fill}" {_o(ppm)} {extra}/>'

def _poly(pts, fill, ppm):
    return f'<path d="M{" L".join(f"{a:g},{b:g}" for a, b in pts)} Z" fill="{fill}" {_o(ppm)}/>'

def _wheel(cx, cy, r, ppm):
    return (f'<circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="#1a2033" {_o(ppm)}/>'
            f'<circle cx="{cx:g}" cy="{cy:g}" r="{r * .5:g}" fill="#c9d0dc" {_o(ppm)}/>')

def box(x, y, w, h):
    """A cardboard box standing on the ground, its bottom left corner at (x, y), taped along the top."""
    return (f'<rect x="{x}" y="{y-h}" width="{w}" height="{h}" fill="#c9a06a" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<rect x="{x}" y="{y-h}" width="{w}" height="{h*.2:g}" fill="#dcb783" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<rect x="{x+w*.42:g}" y="{y-h}" width="{w*.16:g}" height="{h*.2:g}" fill="#e9d3a8" stroke="{NAVY}" stroke-width="2.5"/>')

def box_bundle(x, y, ppm, h=.9, flip=False):
    """A bundle of flattened cardboard boxes standing on its edge, h m tall, 0.28 m thick and 0.6 m
    wide, tied with string; its bottom left corner is at (x, y)."""
    g = _g(x, y, ppm, flip, "box-bundle")
    g += _poly([(0, 0), (.6, 0), (.6, -h), (0, -h)], "#c9a06a", ppm)
    g += "".join(f'<path d="M0,{-h * k / 7:g} L.6,{-h * k / 7:g}" stroke="#a9824c" stroke-width=".02"/>' for k in range(1, 7))
    g += _poly([(0, -h), (.28, -h - .1), (.88, -h - .1), (.6, -h)], "#dcb783", ppm)
    g += f'<path d="M.3,0 L.3,{-h:g} M.45,0 L.45,{-h:g}" stroke="#6b4b3a" stroke-width=".035"/>'
    return g + '</g>'

def dumpster(x, y, ppm, flip=False, bleed=False):
    """A large green waste bin, 3 m wide and 1.8 m tall, its bottom left corner at (x, y), the lid
    hinged along the back and swung up, and flattened boxes standing in it. `bleed="sides"` lets a close view crop it at the left edge."""
    place("bin", x - (3 * ppm if flip else 0), y - 2.5 * ppm, x + (0 if flip else 3 * ppm), y + .08 * ppm, size=1.8 * ppm, bleed=bleed)
    g = _g(x, y, ppm, flip)
    g += '<ellipse cx="1.5" cy=".05" rx="1.7" ry=".1" fill="#000" opacity=".16"/>'
    g += '<g data-part="bin-lid">' + _poly([(.1, -1.65), (2.9, -1.65), (2.9, -2.45), (.1, -2.45)], "#2c6b46", ppm)   # the lid, hinged along the back and swung up
    g += _rect(.2, -2.35, 2.6, .1, "#3f8f5a", ppm) + _rect(1.2, -2.2, .6, .1, "#1f4d33", ppm, .03) + '</g>'            # a rim and a handle on its face
    g += "".join(_rect(k, -1.72, .3, .12, "#c9d0dc", ppm, .03, 'data-part="bin-hinge"') for k in (.35, 2.35))   # where it meets the bin
    g += _poly([(.3, -1.5), (2.7, -1.5), (2.6, -.1), (.4, -.1)], "#d9c49c", ppm)            # boxes inside
    g += f'<path d="M1.1,-1.5 L1.1,-1.0 M1.9,-1.5 L1.9,-1.0" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
    g += _poly([(0, -1.5), (3, -1.5), (2.9, -.12), (.1, -.12)], "#3f8f5a", ppm)
    g += '<g data-part="bin-rim">' + _poly([(0, -1.5), (3, -1.5), (3, -1.65), (0, -1.65)], "#2c6b46", ppm) + '</g>'
    g += _rect(.2, -.75, 2.6, .12, "#fff", ppm, 0, 'opacity=".5"')
    for cx in (.35, 2.65):
        g += _wheel(cx, -.08, .09, ppm)
    return g + '</g>'

def sunflower(x, y, ppm, h=2.0):
    """A sunflower h metres tall, its foot at (x, y)."""
    g = _g(x, y, ppm)
    g += f'<path d="M0,0 L0,{-h:g}" stroke="{GREEN}" stroke-width=".07"/><path d="M0,{-h * .4:g} Q.3,{-h * .5:g} .35,{-h * .35:g} Q.1,{-h * .35:g} 0,{-h * .4:g} Z" fill="#4f8e56" {_o(ppm)}/>'
    g += "".join(f'<ellipse cx="0" cy="{-h - .22:g}" rx=".07" ry=".22" fill="{YEL}" stroke="{NAVY}" stroke-width=".025" transform="rotate({a} 0 {-h:g})"/>' for a in range(0, 360, 36))
    g += f'<circle cx="0" cy="{-h:g}" r=".16" fill="#6b4b3a" {_o(ppm)}/>'
    return g + '</g>'

def raised_bed(x, y, ppm, w=4.2, h=.6, plants=(), fresh=None):
    """A raised garden bed w metres long and h tall, its bottom left corner at (x, y): a timber frame
    with dark soil, a row of seedlings and the sunflowers given as (metres from the left end,
    height in metres). The registered box takes in the plants. The frame is
    weathered timber; `fresh=(from, to)` metres from the left end shows new pale boards fitted there."""
    top = h + max([p[1] for p in plants] + [0]) + .4
    place("bed", x, y - top * ppm, x + w * ppm, y, size=h * ppm)
    g = ""
    for dx, ph in plants:
        g += sunflower(x + dx * ppm, y - h * ppm, ppm, ph)
    g += _g(x, y, ppm)
    g += '<ellipse cx="%g" cy=".04" rx="%g" ry=".1" fill="#000" opacity=".16"/>' % (w / 2, w / 2 + .2)
    g += _rect(0, -h, w, h, "#a07a52", ppm) + f'<path d="M0,{-h * .5:g} L{w:g},{-h * .5:g}" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
    g += "".join(f'<path d="M{k:g},{-h * .96:g} L{k + .5:g},{-h * .96:g}" stroke="#7d5c3b" stroke-width=".03"/>' for k in (.2, 1.3, 2.6, 3.4) if k + .5 < w)
    if fresh:
        a, b = fresh
        g += _rect(a, -h, b - a, h, "#e6c488", ppm) + f'<path d="M{a:g},{-h * .5:g} L{b:g},{-h * .5:g}" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
        g += "".join(f'<circle cx="{px:g}" cy="{py:g}" r=".022" fill="#7d5c3b"/>' for px in (a + .12, b - .12) for py in (-h * .78, -h * .22))
    g += _rect(.05, -h - .08, w - .1, .14, "#5a3b2a", ppm, .05)
    for i in range(int(w / .35)):
        g += f'<path d="M{.25 + i * .35:g},{-h - .05:g} q-.06,-.12 -.12,-.1 M{.25 + i * .35:g},{-h - .05:g} q.06,-.12 .12,-.1" fill="none" stroke="{GREEN}" stroke-width=".05" stroke-linecap="round"/>'
    return g + '</g>'

def watering_can(x, y, ppm):
    """A watering can, 0.35 m tall, its foot centre at (x, y), spout to the right."""
    g = _g(x, y, ppm)
    g += _rect(-.17, -.3, .34, .3, "#4f8fc0", ppm, .04) + f'<path d="M.17,-.15 L.42,-.34" stroke="{NAVY}" stroke-width=".09" stroke-linecap="round"/><path d="M.17,-.15 L.42,-.34" stroke="#4f8fc0" stroke-width=".05" stroke-linecap="round"/>'
    g += f'<path d="M-.12,-.3 Q0,-.5 .12,-.3" fill="none" stroke="{NAVY}" stroke-width=".05"/>'
    return g + '</g>'

def soil_bag(x, y, ppm):
    """A sack of potting soil, 0.7 m tall and 0.6 m wide, its bottom centre at (x, y): a slumped belly, a
    gathered neck tied with rope and a little soil spilled at the top."""
    g = _g(x, y, ppm)
    g += _poly([(-.3, 0), (-.34, -.28), (-.2, -.52), (-.09, -.6), (-.1, -.68), (.1, -.7), (.09, -.6), (.2, -.5), (.34, -.26), (.3, 0)], "#8a6a4a", ppm)
    g += _poly([(-.3, 0), (-.34, -.28), (-.12, -.3), (-.1, 0)], "#6b4b3a", ppm)
    g += f'<path d="M-.1,-.6 Q0,-.55 .1,-.6" fill="none" stroke="{NAVY}" stroke-width=".04"/>' + _rect(-.11, -.63, .22, .05, "#d9c49c", ppm, .02)
    g += "".join(f'<circle cx="{cx:g}" cy="{cy:g}" r=".03" fill="#5a3b2a"/>' for cx, cy in ((-.07, -.74), (.02, -.76), (.08, -.72)))
    g += f'<path d="M-.22,-.22 Q-.05,-.15 .15,-.26" fill="none" stroke="#5a3b2a" stroke-width=".035" stroke-linecap="round"/>'
    return g + '</g>'

def seedling_pot(x, y, ppm):
    """A terracotta pot with a seedling, 0.3 m tall, its bottom centre at (x, y)."""
    g = _g(x, y, ppm)
    g += _poly([(-.1, -.2), (.1, -.2), (.08, 0), (-.08, 0)], "#c4562f", ppm) + _rect(-.12, -.24, .24, .06, "#d9683a", ppm)
    g += f'<path d="M0,-.24 L0,-.36 M0,-.31 Q-.1,-.33 -.13,-.4 M0,-.31 Q.1,-.33 .13,-.4" fill="none" stroke="{GREEN}" stroke-width=".04" stroke-linecap="round"/>'
    return g + '</g>'
