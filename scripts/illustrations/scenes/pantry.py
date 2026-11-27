"""Thanksgiving week, concept B: ways to give. A community pantry, stocked and open, at the front of
a community building, with neighbors bringing food. The pantry is the subject."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 165
GROUND = 815

def pumpkin(x, y, r):
    return (f'<ellipse cx="{x}" cy="{y - r * .8:g}" rx="{r}" ry="{r * .8:g}" fill="#e2813a" stroke="{NAVY}" stroke-width="{SW}"/>'
            f'<path d="M{x - r * .35:g},{y - r * .75:g} Q{x},{y - r * 1.1:g} {x + r * .35:g},{y - r * .75:g}" fill="none" stroke="#b9682a" stroke-width="4"/>'
            f'<rect x="{x - 4}" y="{y - r * 1.75:g}" width="8" height="{r * .35:g}" fill="{GREEN}" stroke="{NAVY}" stroke-width="2.5"/>')

def scene_thanksgiving_pantry():
    b = backdrop(horizon=690)
    b += fence(-60, 1000, 790, PPM, 1.5)
    b += f'<rect x="-10" y="790" width="1700" height="120" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += focal(pantry(60, GROUND, PPM), "community pantry")
    k = s_person(PPM)
    b += person(660, GROUND + 6, k, shirt=BLUE, pants="#3b3f52", skin=SKIN_LIGHTEST, hair="#8a5a2b", flip=True, arm="reach")
    b += grocery_bag(660 - 62 * k, GROUND + 6 - 134 * k + 14, PPM)
    b += person(800, GROUND + 10, s_person(PPM, 1.3, 15), shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, hr=15, flip=True, arm="down", child=True)
    b += lamp_post(850, 790, PPM, 3.8) + bunting(335, 440, 846, 300, 9, 60)
    b += pumpkin(570, GROUND + 4, 44)
    b += falling(((560, 330, 30), (250, 230, -20), (700, 260, 40)))
    b += panel(["Happy", "Thanksgiving"], ["No pickup Thu., Fri.", "Fri. moves to Mon.", "Drop-offs closed", "Libraries closed"])
    return b
