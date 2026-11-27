"""Thanksgiving week, concept B: the library is closed. A community library's brick front with its
CLOSED sign out, and neighbors walking by with the holiday meal. The building is the subject and the
calendar page names the day."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 105
GROUND = 800

def scene_thanksgiving_library():
    b = backdrop(horizon=690)
    b += focal(storefront(50, GROUND - 14, PPM, 8.0, "LIBRARY"), "library front")
    b += f'<rect x="-10" y="{GROUND - 14}" width="1700" height="130" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += calendar_page(340, 60, "NOV", "26", w=210, h=230)
    b += hours_sign(420, GROUND + 6, PPM, "CLOSED", RED)
    k = s_person(PPM)
    b += person(720, GROUND + 14, k, shirt=BLUE, pants="#3b3f52", skin=SKIN_LIGHTEST, hair="#8a5a2b", flip=True, arm="reach")
    b += roast_turkey(720 - 62 * k, GROUND + 14 - 134 * k + 8, .3)
    b += person(830, GROUND + 18, s_person(PPM, 1.3, 15), shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, hr=15, flip=True, arm="down", child=True)
    b += falling(((250, 150, 30), (210, 260, -20), (700, 160, 40)))
    b += panel(["Happy", "Thanksgiving"], ["No pickup Thu., Fri.", "Fri. moves to Mon.", "Drop-offs closed", "Libraries closed"])
    return b
