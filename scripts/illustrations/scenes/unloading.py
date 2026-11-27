"""The last drop-off Saturday, concept A: a neighbor unloads flattened boxes from the open hatch of
an SUV into a large City bin. The SUV, the neighbor and the bin share one scale, and the calendar
page above the hours sign names the Saturday."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 90
GROUND = 812

def scene_dropoff_unload():
    b = backdrop(horizon=690)
    b += tree(150, 760, h_tree(PPM, 6.6), c="#e2a032", d="#c4762b")
    b += fence(-60, 1000, 790, PPM, 1.8)
    b += f'<rect x="-10" y="790" width="1700" height="140" fill="#cfc9bd" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += hours_sign(520, 790, PPM)
    b += calendar_page(640, 70, "SAT", "28", w=190, h=210)
    b += dumpster(40, GROUND, PPM)
    k = s_person(PPM)
    b += focal(car(412, GROUND + 4, body=BLUE, w=w_car(PPM), suv=True, hatch=True), "SUV with open hatch")
    b += person(362, GROUND + 6, k, shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, flip=True, arm="reach")
    b += flat_boxes(362 - 62 * k - 50, GROUND + 6 - 134 * k + 8, PPM, 3)
    b += falling(((300, 250, 30), (520, 330, -20), (880, 380, 40)))
    b += panel(["Last Saturday", "for drop-offs"], ["Sat., Nov. 28", "9 a.m. to 4 p.m.", "Winter hours Dec. 4", "Proof of address"])
    return b
