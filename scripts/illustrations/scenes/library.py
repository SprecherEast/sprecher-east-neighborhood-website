"""Thanksgiving week: Pinney Library, closed. The real building (places.pinney_library, Madison
Public Library's branch at 516 Cottage Grove Road) is the subject, close in on its ground floor:
the large lettering, the entrance and a CLOSED notice dated as the post gives it (Pinney Library,
closed Nov. 26-27). A notice is a thing that exists on a library door, so nothing floats over the
building: no calendar page here, the panel carries the rest. Two neighbors at true scale read it."""
from ..parts import *
from ..places import pinney_library
from ..props import *

PPM = 80
GROUND = 790

def scene_thanksgiving_library():
    b = backdrop(horizon=690)
    b += f'<rect x="-10" y="{GROUND}" width="1700" height="140" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += focal(pinney_library(44, GROUND, PPM, "CLOSED|Nov. 26–27"), "Pinney Library")
    pv = 44 + 6.4 * PPM + 2.0 * PPM
    b += person(pv - 52, 848, s_person(PPM, 1.78), shirt=BLUE, pants="#3b3f52", skin=SKIN_DARKEST, arm="reach")
    b += person(pv + 78, 850, s_person(PPM, 1.3, 15), shirt=RED, pants="#2b3556", skin=SKIN_LIGHTEST, hair="#8a5a2b", hr=15, flip=True, arm="down", child=True)
    b += panel(["Happy", "Thanksgiving"], ["No pickup Thu., Fri.", "Fri. moves to Mon.", "Drop-offs closed", "Libraries closed"])
    return b
