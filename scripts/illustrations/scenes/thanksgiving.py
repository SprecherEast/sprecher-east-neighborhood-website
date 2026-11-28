"""Thanksgiving weekend: neighbors bring food to a shared table under an autumn tree, with the
trash and recycling carts waiting at the curb for Monday."""
from ..parts import *
from .street_days import falling, road

def pie(x,y,s=1):
    """A pie on the table, its centre at (x, y)."""
    return (f'<g transform="translate({x},{y}) scale({s})"><ellipse cx="0" cy="4" rx="58" ry="12" fill="#fff" stroke="{NAVY}" stroke-width="{SW}"/>'
            f'<path d="M-50,0 Q-50,-30 0,-30 Q50,-30 50,0 Z" fill="#d98a3c" stroke="{NAVY}" stroke-width="{SW}"/>'
            f'<path d="M-30,-14 L30,-14 M-22,-22 L22,-22" stroke="#b9682a" stroke-width="5" stroke-linecap="round"/></g>')

def table(x,y,w):
    """A long table with a cloth, its top's left end at (x, y)."""
    return (f'<rect x="{x+20}" y="{y}" width="14" height="120" fill="#8b5e3c" stroke="{NAVY}" stroke-width="{SW}"/>'
            f'<rect x="{x+w-34}" y="{y}" width="14" height="120" fill="#8b5e3c" stroke="{NAVY}" stroke-width="{SW}"/>'
            f'<path d="M{x},{y} L{x+w},{y} L{x+w-6},{y+52} L{x+6},{y+52} Z" fill="{CREAM}" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<path d="M{x+6},{y+52} L{x+w-6},{y+52}" stroke="{RED}" stroke-width="8"/>')

def scene_thanksgiving():
    b=grass()
    b+=road(700,40,170,830)
    b+=tree(140,700,560,c="#e2a032",d="#c4762b")+tree(820,700,430,c="#d9583a",d="#b64329")
    b+=calendar_page(560,150,"NOV","26",w=190,h=210)
    b+=table(250,520,480)
    b+=roast_turkey(495,512,.95)+pie(345,512,.85)+pie(650,512,.7)
    b+=person(205,690,1.15,shirt=RED,pants="#2b3556",skin=SKIN_DARKEST,arm="wave")
    b+=person(780,690,1.15,shirt=BLUE,pants="#3b3f52",skin=SKIN_LIGHTEST,hair="#8a5a2b",flip=True,arm="wave")
    b+=cart(60,740,"#2b3556","#1f2a44",1.1)+cart(868,740,BLUE,"#3b7aa5",1.1,True)
    b+=falling(((330,250,30),(470,190,-20),(800,330,40),(420,400,-30),(250,380,20)))
    b+=panel(["Happy","Thanksgiving"],["No pickup Thu., Fri.","Fri. moves to Mon.","Drop-offs closed","Libraries closed"])
    return b
