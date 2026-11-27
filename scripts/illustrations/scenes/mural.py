"""Youth-led project grants, concept A: young neighbors paint a mural on a wall while an adult
supports with a plan. The half-painted wall is the project and the subject."""
from ..parts import *
from ..props import *

PPM = 125
GROUND = 815

def scene_youth_mural():
    b = backdrop(horizon=700)
    b += f'<rect x="-10" y="790" width="1700" height="140" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/>'
    b += focal(mural_wall(70, 790, PPM, 5.4, 4.2, .6), "mural wall")
    b += ladder(500, 800, PPM, 3.2, .45)
    t = s_person(PPM, 1.6)
    rung = 800 - 2.0 * PPM
    px = 500 + .25 * PPM + .45 * 2.0 / 3.2 * PPM
    b += f'<rect x="{px + 41 * t - 70:g}" y="{rung - 238 * t - 30:g}" width="140" height="95" fill="#9cc6e6" opacity=".95"/>'
    b += person(px, rung, t, shirt=RED, pants="#2b3556", skin=SKIN_DARKEST, hat="beanie", cap=YEL, arm="up")
    b += roller(px + 41 * t - 28, rung - 238 * t + 4, PPM, BLUE)
    k = s_person(PPM, 1.35, 15)
    b += person(250, 818, k, shirt=GREEN, pants="#3b3f52", skin=SKIN_LIGHTEST, hair="#8a5a2b", hr=15, arm="reach", child=True)
    b += roller(250 + 62 * k, 818 - 134 * k, PPM, BLUE)
    b += paint_can(160, 822, PPM, RED) + paint_can(190, 826, PPM, YEL) + paint_can(690, 824, PPM, BLUE)
    b += person(790, 818, s_person(PPM, 1.78), shirt=BLUE, pants="#3b3f52", skin=SKIN_LIGHT, hair="#2a1d17", flip=True, arm="pad")
    b += panel(["Youth-led", "project grants"], ["Up to $3,000", "Apply by Dec. 18", "Youth plan and lead", "Awards in March"])
    return b
