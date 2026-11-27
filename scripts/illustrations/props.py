"""Props for scenes drawn at true scale: things bigger than a person (a truck, a wall, a bin, a
garden bed) and the helpers that size every part from one pixels-per-metre value.

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

def s_cart(ppm, m=1.1):
    """The `s` that draws a cart m metres tall."""
    return m * ppm / 210

def h_tree(ppm, m=6):
    """The `h` that draws a tree m metres tall."""
    return m * ppm / .9

def _g(x, y, ppm, flip=False):
    """Opens a group in metres: origin at (x, y), y down, one unit one metre."""
    return f'<g transform="translate({x:g},{y:g}) scale({-ppm if flip else ppm:g},{ppm:g})">'

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

def flat_boxes(x, y, ppm, n=3, flip=False):
    """A stack of n flattened boxes, 1 m wide and 5 cm thick each, its bottom left corner at (x, y)."""
    g = _g(x, y, ppm, flip)
    for i in range(n):
        g += _rect(0.06 * (i % 2), -.09 * (i + 1), 1.0, .09, "#c9a06a" if i % 2 else "#dcb783", ppm)
        g += f'<path d="M.45,{-.09 * (i + 1):g} L.55,{-.09 * (i + 1):g} L.55,{-.09 * i:g} L.45,{-.09 * i:g} Z" fill="#e9d3a8" stroke="{NAVY}" stroke-width="{SW / ppm * .7:.4f}"/>'
    return g + '</g>'

def garbage_truck(x, y, ppm, flip=False, lift=True):
    """A rear-loading garbage truck, 7.5 m long and 3.3 m tall, its rear bottom corner at (x, y), the
    cab to the right (the left when flipped). With lift, a cart hangs tipped over the hopper."""
    place("truck", x - (7.5 * ppm if flip else 0), y - 3.4 * ppm, x + (0 if flip else 7.5 * ppm), y + .1 * ppm, size=7.5 * ppm)
    g = _g(x, y, ppm, flip)
    g += '<ellipse cx="3.9" cy=".08" rx="4.1" ry=".13" fill="#000" opacity=".16"/>'
    g += _rect(.1, -1.05, 7.3, .35, "#4a5266", ppm)                                  # chassis
    g += _poly([(.1, -3.25), (4.9, -3.25), (5.25, -3.0), (5.25, -1.0), (.55, -1.0), (.1, -1.5)], "#3f8f5a", ppm)  # body
    g += f'<path d="M.1,-2.3 L5.25,-2.3 L5.25,-2.05 L.1,-2.05 Z" fill="#fff" opacity=".85"/><path d="M2.7,-3.0 L3.1,-2.45 L2.3,-2.45 Z" fill="none" stroke="#fff" stroke-width=".1" stroke-linejoin="round"/>'
    g += _poly([(5.3, -3.0), (6.5, -3.0), (7.05, -1.95), (7.45, -1.9), (7.45, -1.0), (5.3, -1.0)], "#f2f4f8", ppm)  # cab
    g += _poly([(5.55, -2.8), (6.4, -2.8), (6.8, -2.0), (5.55, -2.0)], GLASS, ppm)
    g += f'<rect x="7.3" y="-1.5" width=".25" height=".35" fill="#ffe89a" {_o(ppm)}/><circle cx="2.4" cy="-3.4" r=".13" fill="{YEL}" {_o(ppm)}/><circle cx="2.9" cy="-3.4" r=".13" fill="{RED}" {_o(ppm)}/>'
    g += _poly([(.1, -1.5), (-.25, -1.45), (-.25, -.95), (.55, -.95)], "#2f7a3f", ppm)  # the hopper's lip
    g += _wheel(1.3, -.55, .55, ppm) + _wheel(2.5, -.55, .55, ppm) + _wheel(6.5, -.55, .55, ppm)
    g += f'<circle cx="6.15" cy="-2.35" r=".26" fill="#d09a73" {_o(ppm)}/><rect x="5.9" y="-2.1" width=".5" height=".25" fill="#2f7a3f"/>'  # the driver
    if lift:
        g += f'<path d="M.25,-2.25 L-.9,-2.0" stroke="{NAVY}" stroke-width=".2" stroke-linecap="round"/><path d="M.25,-2.25 L-.9,-2.0" stroke="#e89a1f" stroke-width=".12" stroke-linecap="round"/>'
        g += (f'<g transform="translate(-.9,-2.0) rotate(128)">'
              + _poly([(-.3, -1.0), (.3, -1.0), (.25, 0), (-.25, 0)], "#2b3556", ppm)
              + _rect(-.34, -1.1, .68, .12, "#1f2a44", ppm, .03) + '</g>')
    return g + '</g>'

def dumpster(x, y, ppm, flip=False):
    """A large green waste bin, 3 m wide and 1.8 m tall, its bottom left corner at (x, y), the lid
    propped open and flattened boxes standing in it."""
    place("bin", x - (3 * ppm if flip else 0), y - 2.1 * ppm, x + (0 if flip else 3 * ppm), y + .08 * ppm, size=1.8 * ppm)
    g = _g(x, y, ppm, flip)
    g += '<ellipse cx="1.5" cy=".05" rx="1.7" ry=".1" fill="#000" opacity=".16"/>'
    g += _poly([(.45, -1.85), (1.15, -2.15), (1.3, -1.95), (.65, -1.7)], "#2c6b46", ppm)   # propped lid
    g += _poly([(.3, -1.5), (2.7, -1.5), (2.6, -.1), (.4, -.1)], "#d9c49c", ppm)            # boxes inside
    g += f'<path d="M1.1,-1.5 L1.1,-1.0 M1.9,-1.5 L1.9,-1.0" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
    g += _poly([(0, -1.5), (3, -1.5), (2.9, -.12), (.1, -.12)], "#3f8f5a", ppm)
    g += _poly([(0, -1.5), (3, -1.5), (3, -1.65), (0, -1.65)], "#2c6b46", ppm)
    g += _rect(.2, -.75, 2.6, .12, "#fff", ppm, 0, 'opacity=".5"')
    for cx in (.35, 2.65):
        g += _wheel(cx, -.08, .09, ppm)
    return g + '</g>'

def fence(x0, x1, y, ppm, h=1.8):
    """A chain-link fence from x0 to x1, its foot at y, h metres tall, with a post every 3 m."""
    place("fence", x0, y - h * ppm, x1, y, size=h * ppm, bleed="sides")
    n = max(1, round((x1 - x0) / ppm / 3))
    w = (x1 - x0) / ppm
    g = _g(x0, y, ppm)
    g += f'<defs><pattern id="mesh{int(x0)}" width=".22" height=".22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0 L.22,0 M0,0 L0,.22" stroke="#8c96a8" stroke-width=".03"/></pattern></defs>'
    g += f'<rect x="0" y="{-h:g}" width="{w:g}" height="{h:g}" fill="url(#mesh{int(x0)})" opacity=".9"/>'
    g += f'<path d="M0,{-h:g} L{w:g},{-h:g}" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
    for i in range(n + 1):
        px = i * w / n
        g += _rect(px - .05, -h - .05, .1, h + .05, "#a7b0bf", ppm)
    return g + '</g>'

def hours_sign(x, y, ppm, word="OPEN"):
    """A sign board on two posts, 1.8 m wide and 1.1 m tall, 2.6 m off the ground; (x, y) is the
    foot of its left post. The board is green with one large word."""
    place("wall", x, y - 3.7 * ppm, x + 1.9 * ppm, y, size=3.7 * ppm)
    g = _g(x, y, ppm)
    g += _rect(.1, -2.6, .1, 2.6, "#6b4b3a", ppm) + _rect(1.7, -2.6, .1, 2.6, "#6b4b3a", ppm)
    g += _rect(0, -3.7, 1.9, 1.1, "#2f7a3f", ppm, .06)
    g += f'<text x=".95" y="-3.0" text-anchor="middle" font-family="Poppins" font-weight="700" font-size=".52" fill="#fff">{word}</text>'
    return g + '</g>'

def storefront(x, y, ppm, w=8.0):
    """A community building's front: a brick wall 4.4 m tall and w wide with a door and a window, its
    bottom left corner at (x, y). Fills the frame behind the scene, so it may run off the sides."""
    place("building", x, y - 4.4 * ppm, x + w * ppm, y, size=4.4 * ppm, bleed="sides")
    g = _g(x, y, ppm)
    g += _rect(0, -4.4, w, 4.4, "#d9c49c", ppm) + f'<g>{brick_lines_m(0, -4.4, w, 4.4)}</g>'
    g += _rect(0, -4.6, w, .25, "#8c96a8", ppm)
    g += _rect(.4, -2.1, 1.1, 2.1, "#2c3a4c", ppm) + _rect(.4, -2.1, 1.1, .2, "#f4f6fa", ppm)  # door
    g += _rect(w - 2.4, -3.0, 1.9, 1.5, GLASS, ppm) + _rect(w - 2.4, -1.5, 1.9, .12, "#8c96a8", ppm)
    return g + '</g>'

def brick_lines_m(x, y, w, h, step=.22, off=.45):
    out, rows = [], int(h / step)
    for i in range(rows):
        yy = y + i * step
        out.append(f'<line x1="{x}" y1="{yy:g}" x2="{x + w}" y2="{yy:g}" stroke="#b7a07a" stroke-width=".02"/>')
        for xx in [x + (i % 2) * off / 2 + k * off for k in range(int(w / off) + 1)]:
            out.append(f'<line x1="{xx:g}" y1="{yy:g}" x2="{xx:g}" y2="{yy + step:g}" stroke="#b7a07a" stroke-width=".02"/>')
    return "".join(out)

def can(x, y, w, h, col, ppm):
    """A tin can or jar on a shelf, in metres inside a group: bottom left corner at (x, y)."""
    return (_rect(x, y - h, w, h, col, ppm, .02) + f'<rect x="{x:g}" y="{y - h * .65:g}" width="{w:g}" height="{h * .3:g}" fill="#fff" opacity=".8"/>')

def pantry(x, y, ppm):
    """A free community pantry: a wooden cabinet 2.9 m wide and 2.3 m tall with a pitched roof, a
    heart on its gable and shelves of cans, jars, bread and apples. Bottom left corner at (x, y)."""
    place("bin", x, y - 2.3 * ppm, x + 2.9 * ppm, y + .1 * ppm, size=2.3 * ppm)
    g = _g(x, y, ppm)
    g += '<ellipse cx="1.45" cy=".05" rx="1.7" ry=".1" fill="#000" opacity=".16"/>'
    g += _rect(.1, -2.0, 2.7, 2.0, "#b98f5c", ppm) + _rect(.25, -1.85, 2.4, 1.7, "#6b4b3a", ppm)   # frame, the dark inside
    g += _poly([(-.05, -2.0), (1.45, -2.3), (2.95, -2.0), (2.95, -1.9), (-.05, -1.9)], "#a8714f", ppm)
    g += f'<path d="M1.45,-2.0 C1.0,-2.3 1.9,-2.3 1.45,-1.95 Z" fill="{RED}" {_o(ppm)}/>'
    for sy in (-1.25, -.7):
        g += _rect(.25, sy, 2.4, .08, "#d9a25a", ppm)
    cols = [BLUE, RED, "#e8b83b", GREEN, "#c4562f"]
    for i in range(8):                                                              # top shelf: tins
        g += can(.38 + i * .28, -1.27, .22, .4, cols[i % 5], ppm)
    g += _rect(.45, -.98, .5, .28, "#e0a257", ppm, .1) + _rect(1.05, -1.0, .5, .3, "#d9c49c", ppm)  # bread and a bag of rice
    for i in range(5):
        g += f'<circle cx="{1.85 + i * .15:g}" cy="-.8" r=".07" fill="#d9583a" {_o(ppm)}/>'
    for i in range(7):                                                              # bottom shelf: jars and boxes
        g += can(.38 + i * .3, -.72, .24, .36 if i % 2 else .3, cols[(i + 2) % 5], ppm)
    g += _rect(1.25, -.5, .6, .5, "#c9a06a", ppm) + _rect(1.95, -.5, .6, .5, "#dcb783", ppm)         # crates on the floor
    return g + '</g>'

def grocery_bag(x, y, ppm):
    """A paper grocery bag with a loaf and a leek standing out, its bottom centre at (x, y)."""
    g = _g(x, y, ppm)
    g += _poly([(-.22, 0), (-.25, -.5), (.25, -.5), (.22, 0)], "#c9a06a", ppm)
    g += f'<path d="M-.1,-.5 L-.12,-.72 M.08,-.5 L.14,-.78" stroke="{GREEN}" stroke-width=".07" stroke-linecap="round"/>' + _rect(-.15, -.62, .3, .14, "#e0a257", ppm, .06)
    return g + '</g>'

def lamp_post(x, y, ppm, h=3.8):
    """A street lamp, h metres tall, its foot at (x, y), with the lamp head leaning toward the left."""
    place("pole", x - .8 * ppm, y - h * ppm, x + .2 * ppm, y, size=h * ppm)
    g = _g(x, y, ppm)
    g += _rect(-.07, -h, .14, h, "#4a5266", ppm) + _rect(-.18, -.35, .36, .35, "#4a5266", ppm)
    g += _poly([(-.07, -h), (-.45, -h - .02), (-.45, -h + .1), (-.07, -h + .1)], "#4a5266", ppm)
    g += _poly([(-.7, -h + .1), (-.2, -h + .1), (-.25, -h + .3), (-.65, -h + .3)], YEL, ppm)
    return g + '</g>'

def bunting(x0, y0, x1, y1, n=9, sag=60, cols=("#d9583a", "#e8b83b", "#c4762b", "#2f7a3f")):
    """A string of pennant flags hung from (x0, y0) to (x1, y1), drooping by sag pixels."""
    g = f'<path d="M{x0},{y0} Q{(x0 + x1) / 2:g},{(y0 + y1) / 2 + 2 * sag:g} {x1},{y1}" fill="none" stroke="{NAVY}" stroke-width="3"/>'
    for i in range(n):
        t = (i + .5) / n
        px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * (x0 + x1) / 2 + t * t * x1
        py = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + 2 * sag) + t * t * y1
        g += f'<path d="M{px - 22:g},{py:g} L{px + 22:g},{py:g} L{px:g},{py + 56:g} Z" fill="{cols[i % len(cols)]}" stroke="{NAVY}" stroke-width="3" stroke-linejoin="round"/>'
    return g

def gate_arch(x, y, ppm, w=6.4, h=4.4, word="OPEN"):
    """An entrance arch: two posts w metres apart (its left foot at (x, y)), h metres tall, with a
    crossbar and a green board hung from it carrying one large word."""
    place("wall", x - .2 * ppm, y - h * ppm, x + (w + .35) * ppm, y, size=h * ppm)
    g = _g(x, y, ppm)
    for px in (0, w - .35):
        g += _rect(px, -h, .35, h, "#a7b0bf", ppm) + _rect(px - .08, -.25, .51, .25, "#8c96a8", ppm)
    g += _rect(-.1, -h - .1, w + .35 - .0, .4, "#8c96a8", ppm)
    cx = w / 2
    g += f'<path d="M{cx - .9:g},{-h + .3:g} L{cx - .9:g},{-h + .8:g} M{cx + .9:g},{-h + .3:g} L{cx + .9:g},{-h + .8:g}" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
    g += _rect(cx - 1.2, -h + .8, 2.4, 1.0, "#2f7a3f", ppm, .06)
    g += f'<text x="{cx:g}" y="{-h + 1.5:g}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size=".5" fill="#fff">{word}</text>'
    return g + '</g>'

def traffic_cone(x, y, ppm):
    """An orange traffic cone, 0.7 m tall, its foot centre at (x, y)."""
    g = _g(x, y, ppm)
    g += _poly([(-.2, 0), (-.04, -.7), (.04, -.7), (.2, 0)], "#e2813a", ppm)
    g += f'<path d="M-.1,-.38 L.1,-.38 L.08,-.48 L-.08,-.48 Z" fill="#fff"/>' + _rect(-.26, -.05, .52, .05, "#c4562f", ppm)
    return g + '</g>'

def mural_wall(x, y, ppm, w=5.4, h=3.3, done=.6):
    """A plaster wall w metres wide and h tall, its bottom left corner at (x, y), with a mural painted
    across the left `done` share (sky, sun, hills, flowers) and the rest still a pencil sketch."""
    place("wall", x, y - h * ppm, x + w * ppm, y, size=h * ppm)
    g = _g(x, y, ppm)
    g += _rect(0, -h, w, h, "#ece6da", ppm)
    cw = w * done
    g += f'<clipPath id="mural{int(x)}"><rect x="0" y="{-h:g}" width="{cw:g}" height="{h:g}"/></clipPath><g clip-path="url(#mural{int(x)})">'
    g += f'<rect x="0" y="{-h:g}" width="{w:g}" height="{h:g}" fill="#9cc6e6"/>'
    g += f'<circle cx="{cw * .68:g}" cy="{-h * .68:g}" r=".55" fill="{YEL}"/>'
    g += "".join(f'<path d="M{cw * .68 + math.cos(a) * .7:g},{-h * .68 + math.sin(a) * .7:g} L{cw * .68 + math.cos(a) * 1.0:g},{-h * .68 + math.sin(a) * 1.0:g}" stroke="{YEL}" stroke-width=".1" stroke-linecap="round"/>' for a in [i * math.pi / 5 for i in range(10)])
    g += f'<path d="M0,{-h * .38:g} Q{cw * .25:g},{-h * .62:g} {cw * .55:g},{-h * .4:g} T{w:g},{-h * .45:g} L{w:g},0 L0,0 Z" fill="#7fb877"/>'
    g += f'<path d="M0,{-h * .2:g} Q{cw * .3:g},{-h * .42:g} {cw * .7:g},{-h * .22:g} T{w:g},{-h * .25:g} L{w:g},0 L0,0 Z" fill="#4f8e56"/>'
    for i, c in enumerate((RED, "#f2a99a", YEL, "#fff", RED, "#f2a99a")):
        fx = .35 + i * cw / 6.4
        g += f'<path d="M{fx:g},-.1 L{fx:g},-.75" stroke="{GREEN}" stroke-width=".07"/><circle cx="{fx:g}" cy="-.85" r=".16" fill="{c}" stroke="{NAVY}" stroke-width=".03"/>'
    g += '</g>'
    g += f'<path d="M{cw:g},{-h:g} L{cw:g},0" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}" opacity=".35"/>'
    g += f'<path d="M{cw + .15:g},{-h * .45:g} Q{(cw + w) / 2:g},{-h * .62:g} {w - .2:g},{-h * .45:g} M{cw + .3:g},{-h * .8:g} L{cw + .3:g},{-h * .55:g} M{w - .6:g},{-h * .2:g} Q{w - 1:g},{-h * .35:g} {w - 1.4:g},{-h * .2:g}" fill="none" stroke="#9aa3b2" stroke-width=".05" stroke-dasharray=".18 .12"/>'
    g += f'<rect x="0" y="{-h:g}" width="{w:g}" height="{h:g}" fill="none" {_o(ppm)}/>'
    return g + '</g>'

def ladder(x, y, ppm, h=3.6, lean=.45):
    """A leaning ladder h metres tall, its feet at (x, y), the top leaning right by `lean` metres."""
    g = _g(x, y, ppm)
    for ox in (0, .5):
        g += f'<path d="M{ox:g},0 L{ox + lean:g},{-h:g}" stroke="{NAVY}" stroke-width=".11" stroke-linecap="round"/><path d="M{ox:g},0 L{ox + lean:g},{-h:g}" stroke="#d9a25a" stroke-width=".07" stroke-linecap="round"/>'
    for i in range(1, int(h / .33)):
        t = i * .33 / h
        g += f'<path d="M{lean * t:g},{-h * t:g} L{.5 + lean * t:g},{-h * t:g}" stroke="{NAVY}" stroke-width=".07" stroke-linecap="round"/>'
    return g + '</g>'

def paint_can(x, y, ppm, col=RED):
    """A paint can, 0.3 m tall, its foot centre at (x, y), the colour dripping down its side."""
    g = _g(x, y, ppm)
    g += _rect(-.14, -.3, .28, .3, "#c9d0dc", ppm, .02) + _rect(-.14, -.3, .28, .09, col, ppm, .02)
    g += f'<path d="M-.05,-.21 L-.05,-.14" stroke="{col}" stroke-width=".05" stroke-linecap="round"/>'
    return g + '</g>'

def roller(x, y, ppm, col=BLUE):
    """A paint roller held horizontally, its handle end at (x, y), pointing right, 0.45 m long."""
    g = _g(x, y, ppm)
    g += f'<path d="M0,0 L.3,0" stroke="{NAVY}" stroke-width=".05" stroke-linecap="round"/>' + _rect(.28, -.07, .22, .14, col, ppm, .05)
    return g + '</g>'

def sunflower(x, y, ppm, h=2.0):
    """A sunflower h metres tall, its foot at (x, y)."""
    g = _g(x, y, ppm)
    g += f'<path d="M0,0 L0,{-h:g}" stroke="{GREEN}" stroke-width=".07"/><path d="M0,{-h * .4:g} Q.3,{-h * .5:g} .35,{-h * .35:g} Q.1,{-h * .35:g} 0,{-h * .4:g} Z" fill="#4f8e56" {_o(ppm)}/>'
    g += "".join(f'<ellipse cx="0" cy="{-h - .22:g}" rx=".07" ry=".22" fill="{YEL}" stroke="{NAVY}" stroke-width=".025" transform="rotate({a} 0 {-h:g})"/>' for a in range(0, 360, 36))
    g += f'<circle cx="0" cy="{-h:g}" r=".16" fill="#6b4b3a" {_o(ppm)}/>'
    return g + '</g>'

def tomato_cage(x, y, ppm, h=1.3):
    """A tomato plant in a cage h metres tall, its foot at (x, y), with ripe tomatoes."""
    g = _g(x, y, ppm)
    g += f'<path d="M-.25,0 L-.25,{-h:g} M.25,0 L.25,{-h:g} M0,0 L0,{-h:g}" stroke="#8c96a8" stroke-width=".04"/>'
    for i in range(1, 5):
        g += f'<path d="M-.25,{-h * i / 5:g} L.25,{-h * i / 5:g}" stroke="#8c96a8" stroke-width=".04"/>'
    g += f'<ellipse cx="0" cy="{-h * .55:g}" rx=".34" ry="{h * .5:g}" fill="#4f8e56" opacity=".95" {_o(ppm)}/>'
    for tx, ty in ((-.15, .45), (.14, .6), (-.05, .8)):
        g += f'<circle cx="{tx:g}" cy="{-h * ty:g}" r=".07" fill="#e24a33" {_o(ppm)}/>'
    return g + '</g>'

def raised_bed(x, y, ppm, w=4.2, h=.6, plants=()):
    """A raised garden bed w metres long and h tall, its bottom left corner at (x, y): a timber frame
    with dark soil, a row of seedlings and the tall plants given as (kind, metres from the left end,
    height in metres), kind "sunflower" or "tomato". The registered box takes in the plants."""
    top = h + max([p[2] for p in plants] + [0]) + (.4 if any(p[0] == "sunflower" for p in plants) else 0)
    place("bed", x, y - top * ppm, x + w * ppm, y, size=h * ppm)
    g = ""
    for kind, dx, ph in plants:
        draw = sunflower if kind == "sunflower" else tomato_cage
        g += draw(x + dx * ppm, y - h * ppm, ppm, ph)
    g += _g(x, y, ppm)
    g += '<ellipse cx="%g" cy=".04" rx="%g" ry=".1" fill="#000" opacity=".16"/>' % (w / 2, w / 2 + .2)
    g += _rect(0, -h, w, h, "#b98f5c", ppm) + f'<path d="M0,{-h * .5:g} L{w:g},{-h * .5:g}" stroke="{NAVY}" stroke-width="{SW / ppm:.4f}"/>'
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
