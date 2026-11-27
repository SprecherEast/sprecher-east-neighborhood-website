"""Thanksgiving week: Pinney Library, closed. The real building (places.pinney_library, Madison
Public Library's branch at 516 Cottage Grove Road) fills the frame with a large CLOSED notice in its
entrance glass, and two neighbors stop to read it. The post's own content is the closure, so nothing
else is drawn: the calendar page names the day."""
from ..parts import *
from ..places import pinney_library
from ..props import *
from .street_days import falling

PPM = 68
GROUND = 800

def scene_thanksgiving_library():
    b = backdrop(horizon=690)
    b += f'<rect x="-10" y="{GROUND}" width="1700" height="140" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += focal(pinney_library(48, GROUND, PPM, "CLOSED"), "Pinney Library")
    b += calendar_page(690, 60, "NOV", "26", w=190, h=210)
    b += person(588, 846, s_person(PPM, 1.78), shirt=BLUE, pants="#3b3f52", skin=SKIN_DARKEST, arm="reach")
    b += person(722, 848, s_person(PPM, 1.3, 15), shirt=RED, pants="#2b3556", skin=SKIN_LIGHTEST, hair="#8a5a2b", hr=15, flip=True, arm="down", child=True)
    b += falling(((250, 120, 30), (520, 90, -20), (620, 260, 40)))
    b += panel(["Happy", "Thanksgiving"], ["No pickup Thu., Fri.", "Fri. moves to Mon.", "Drop-offs closed", "Libraries closed"])
    return b
