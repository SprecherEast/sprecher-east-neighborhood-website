"""Youth-led project grants, concept B: young neighbors build a raised garden bed and plant it, with
an adult helping. The planted bed is the project and the subject."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 130
GROUND = 815

def scene_youth_garden():
    b = backdrop(horizon=700)
    b += tree(125, 780, h_tree(PPM, 4.3), c="#e2a032", d="#c4762b")
    b += fence(-60, 1000, 780, PPM, 1.5)
    b += f'<rect x="-10" y="780" width="1700" height="140" fill="#c9b08a" stroke="{NAVY}" stroke-width="{SW}"/>'
    plants = (("sunflower", .7, 2.2), ("sunflower", 1.6, 1.7), ("sunflower", 2.5, 2.0), ("tomato", 3.1, 1.3))
    b += focal(raised_bed(340, GROUND, PPM, 3.5, .6, plants), "raised garden bed with sunflowers")
    k = s_person(PPM, 1.35, 15)
    b += person(262, 824, k, shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, hr=15, arm="reach", child=True)
    b += watering_can(262 + 70 * k, 824 - 120 * k, PPM)
    b += person(846, 826, s_person(PPM, 1.7), shirt=GREEN, pants="#3b3f52", skin=SKIN_LIGHTEST, hair="#8a5a2b", flip=True, arm="down")
    b += person(170, 828, s_person(PPM, 1.6), shirt=BLUE, pants="#2b3556", skin=SKIN_LIGHT, hat="beanie", cap=YEL, arm="down")
    b += falling(((560, 200, 30), (700, 150, -20), (420, 130, 40)))
    b += panel(["Youth-led", "project grants"], ["Up to $3,000", "Apply by Dec. 18", "Youth plan and lead", "Awards in March"])
    return b
