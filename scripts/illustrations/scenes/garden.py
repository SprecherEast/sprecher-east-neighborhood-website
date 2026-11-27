"""Youth-led project grants: young neighbors repair a community garden bed, with an adult helping.
The kind of project is one the grant program has funded, "Rooted in Community Gardens" (Rooted Inc.,
announced by United Way of Dane County for By Youth For Youth on May 19, 2026: youth update and fix
existing garden beds that local families use to grow their own produce). One bed, drawn large: new
pale boards fitted into the weathered frame, seedlings and watering, a sack of soil. Nothing here
reads as a fence or wire."""
from ..parts import *
from ..props import *
from .street_days import falling

PPM = 205
GROUND = 782

def scene_youth_garden():
    b = backdrop(horizon=640)
    b += tree(75, 730, h_tree(PPM, 3.1), c="#e2a032", d="#c4762b")
    b += f'<rect x="-10" y="730" width="1700" height="260" fill="#c9b08a" stroke="{NAVY}" stroke-width="{SW}"/>'
    # neighbors stand behind the bed, so draw them first; the bed's frame covers their legs
    t = s_person(PPM, 1.72)
    b += person(215, 770, t, shirt=GREEN, pants="#2b3556", skin=SKIN_DARKEST, hat="beanie", cap=YEL, arm="reach")
    b += seedling_pot(215 + 62 * t, 770 - 134 * t + 22, PPM)
    c = s_person(PPM, 1.35, 15)
    b += person(410, 770, c, shirt=RED, pants="#2b3556", skin=SKIN_LIGHTEST, hair="#8a5a2b", hr=15, arm="reach", child=True)
    b += watering_can(410 + 62 * c, 770 - 134 * c + 8, PPM)
    a = s_person(PPM, 1.8)
    b += person(725, 770, a, shirt=BLUE, pants="#3b3f52", skin=SKIN_LIGHT, hair="#2a1d17", flip=True, arm="reach")
    b += soil_bag(725 - 62 * a - 6, 770 - 134 * a + 140, PPM)
    plants = ((3.2, 2.1),)
    b += focal(raised_bed(130, GROUND, PPM, 3.6, .6, plants, fresh=(2.2, 3.6)), "garden bed being repaired")
    b += falling(((420, 150, 30), (640, 110, -20), (330, 260, 40)))
    b += panel(["Youth-led", "project grants"], ["Up to $3,000", "Apply by Dec. 18", "Youth plan and lead", "Awards in March"])
    return b
