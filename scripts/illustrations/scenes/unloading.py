"""The last drop-off Saturday: a neighbor unloads flattened boxes from the open hatch of an SUV into
a City drop-off bin, close in. The picture is this one moment. The car, the neighbor, the boxes and
the bin share one scale, the bin is cropped by the frame as in a close view, and the calendar page
names the Saturday. No site is drawn as a named place; the panel carries the facts."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 130
GROUND = 824

def scene_dropoff_unload():
    b = backdrop(horizon=700, edge=False)
    b += tree(110, 794, h_tree(PPM, 5.3), c="#e2a032", d="#c4762b") + tree(640, 794, h_tree(PPM, 3.0), c="#d9583a", d="#b64329")
    b += f'<rect x="-10" y="794" width="1700" height="260" fill="#cfc9bd" stroke="{NAVY}" stroke-width="{SW}"/>'
    wc = w_car(PPM)
    kc = wc / 250
    car_x = 905 - 246 * kc                  # the car's right end at the edge of the safe area
    s = s_person(PPM, 1.75)
    px, py = 262, GROUND + 22
    hand = (px - 62 * s, py - 134 * s)      # where the reaching arm ends, facing left toward the bin
    b += focal_group(
        dumpster(205, GROUND, PPM, flip=True, bleed="sides")
        + car(car_x, GROUND + 6, body=BLUE, w=wc, suv=True, hatch=True)
        + box_bundle(car_x + 20 * kc, GROUND + 6 - 46 * kc, PPM, .7)
        + person(px, py, s, shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, flip=True, arm="reach")
        + box_bundle(hand[0] - .3 * PPM, hand[1] + .55 * PPM, PPM, .7), "unloading at the bin", 3)
    b += calendar_page(540, 60, "SAT", "28", w=190, h=210)
    b += falling(((330, 200, 30), (470, 110, -20), (850, 150, 40)))
    b += panel(["Last Saturday", "for drop-offs"], ["Sat., Nov. 28", "9 a.m. to 4 p.m.", "Winter hours Dec. 4", "Proof of address"])
    return b
