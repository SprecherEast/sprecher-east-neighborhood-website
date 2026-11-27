"""The last drop-off Saturday, concept B: a vehicle drives in through a City drop-off site's entrance
arch under its OPEN board, with an attendant at the gate. The arch is the subject."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 100
GROUND = 810

def scene_dropoff_entrance():
    b = backdrop(horizon=720)
    b += fence(-60, 1000, 800, PPM, 1.8)
    b += f'<rect x="-10" y="800" width="1700" height="130" fill="#cfc9bd" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += focal(gate_arch(80, GROUND + 10, PPM, 6.9), "entrance arch")
    b += car(137, GROUND + 4, body="#c4562f", w=w_car(PPM))
    b += flat_boxes(137 + 80 * 1.92, GROUND + 4 - 84 * 1.92, PPM, 3)
    b += f'<circle cx="{137 + 150 * 1.92:g}" cy="{GROUND + 4 - 64 * 1.92:g}" r="17" fill="{SKIN_LIGHT}" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += person(692, GROUND + 8, s_person(PPM), shirt=GREEN, pants="#2b3556", skin=SKIN_DARKEST, arm="pad", hat="beanie", cap=BLUE)
    b += traffic_cone(770, GROUND + 6, PPM)
    b += calendar_page(700, 70, "SAT", "28", w=190, h=210)
    b += falling(((330, 250, 30), (520, 180, -20), (640, 340, 40)))
    b += panel(["Last Saturday", "for drop-offs"], ["Sat., Nov. 28", "9 a.m. to 4 p.m.", "Winter hours Dec. 4", "Proof of address"])
    return b
