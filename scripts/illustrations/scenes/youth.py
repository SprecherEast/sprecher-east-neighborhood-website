"""Youth-led project grants: young neighbors around a board of project ideas, with a light bulb
over it. No real place is drawn; the panel carries the facts."""
from ..parts import *
from .street_days import road

def note(x,y,col,rot=0):
    """A sticky note with two lines of text, its top left corner at (x, y)."""
    return (f'<g transform="rotate({rot} {x+34} {y+34})"><rect x="{x}" y="{y}" width="68" height="68" fill="{col}" stroke="{NAVY}" stroke-width="2.5"/>'
            f'<path d="M{x+12},{y+24} L{x+56},{y+24} M{x+12},{y+42} L{x+44},{y+42}" stroke="{NAVY}" stroke-width="4" stroke-linecap="round"/></g>')

def bulb(x,y,s=1):
    """A light bulb, its glass centred at (x, y)."""
    return (f'<g transform="translate({x},{y}) scale({s})"><circle cx="0" cy="0" r="62" fill="{YEL}" opacity=".3"/>'
            f'<path d="M-30,24 Q-48,-8 -34,-34 Q-16,-60 0,-60 Q16,-60 34,-34 Q48,-8 30,24 Z" fill="{YEL}" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<rect x="-22" y="24" width="44" height="12" fill="#c9d0dc" stroke="{NAVY}" stroke-width="{SW}"/><rect x="-16" y="36" width="32" height="10" rx="4" fill="#c9d0dc" stroke="{NAVY}" stroke-width="{SW}"/></g>')

def scene_youth():
    b=grass()
    b+=road(700,44,170,840)
    b+=tree(110,700,520)+tree(880,700,420,c="#7fb877",d="#5a9a60")
    b+=f'<rect x="268" y="480" width="12" height="230" fill="#8b5e3c" stroke="{NAVY}" stroke-width="{SW}"/><rect x="600" y="480" width="12" height="230" fill="#8b5e3c" stroke="{NAVY}" stroke-width="{SW}"/>'
    b+=f'<rect x="230" y="250" width="420" height="300" fill="#fff" stroke="{NAVY}" stroke-width="{SW}"/>'
    b+=note(262,282,YEL,-4)+note(352,290,"#9fd3a4",3)+note(446,278,"#f2a99a",-2)+note(540,288,"#9cc6e6",4)
    b+=note(272,380,"#9cc6e6",3)+note(366,386,"#f2a99a",-3)+note(458,376,YEL,2)+note(550,384,"#9fd3a4",-4)
    b+=f'<path d="M262,490 L420,490 M262,516 L360,516" stroke="{NAVY}" stroke-width="5" stroke-linecap="round"/>'
    b+=bulb(440,160,1.15)
    b+=person(180,746,1.0,shirt=RED,pants="#2b3556",skin=SKIN_DARKEST,hat="beanie",cap=YEL,hr=15,arm="wave")
    b+=person(720,746,1.05,shirt=BLUE,pants="#3b3f52",skin=SKIN_LIGHTEST,hair="#8a5a2b",hr=15,flip=True,arm="wave")
    b+=person(790,750,.9,shirt=GREEN,pants="#2b3556",skin=SKIN_DARK,hr=15,flip=True)
    b+=panel(["Youth-led","project grants"],["Up to $3,000","Apply by Dec. 18","Youth plan and lead","Awards in March"])
    return b
