"""Thanksgiving week, concept A: the garbage truck at the curb on the shifted pickup day. The
truck is the subject, drawn at true scale with the carts and the neighbor beside it, and the
calendar page names the day."""
from ..parts import *
from ..props import *
from .street_days import road, falling

PPM = 76  # pixels per metre: one scale for everything in the scene
GROUND = 800

def scene_thanksgiving_pickup():
    b = backdrop(horizon=700)
    b += road(745, 45, 110, 855)
    b += tree(110, 752, h_tree(PPM, 6.6), c="#e2a032", d="#c4762b")
    b += calendar_page(520, 96, "NOV", "25", w=210, h=230)
    b += focal(garbage_truck(332, GROUND, PPM), "garbage truck")
    b += cart(86, 772, "#2b3556", "#1f2a44", s_cart(PPM)) + cart(136, 772, BLUE, "#3b7aa5", s_cart(PPM), True)
    b += person(214, 776, s_person(PPM), shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, arm="reach", hat="beanie", cap=YEL)
    b += falling(((420, 330, 30), (330, 250, -20), (500, 400, 40)))
    b += panel(["Happy", "Thanksgiving"], ["No pickup Thu., Fri.", "Fri. moves to Mon.", "Drop-offs closed", "Libraries closed"])
    return b
