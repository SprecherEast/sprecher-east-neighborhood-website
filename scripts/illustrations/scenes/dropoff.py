"""The City's drop-off sites: a neighbor unloads flattened boxes and a leaf bag from a car at the
curb, under autumn trees. No site is drawn as a named place; the panel carries the facts."""
from ..parts import *
from ..props import box
from .street_days import bag, falling, road

def scene_dropoff():
    b=grass()
    b+=road(700,44,170,840)
    b+=tree(130,700,560,c="#e2a032",d="#c4762b")+tree(850,700,450,c="#d9583a",d="#b64329")
    b+=car(330,872,body=BLUE,w=310,suv=True)
    b+=box(470,744,110,90)+box(590,744,130,120)+box(500,654,100,80)+bag(790,748)
    b+=person(380,746,1.2,shirt=RED,pants="#2b3556",skin=SKIN_DARKEST,arm="wave")
    b+=falling(((250,300,30),(420,230,-20),(700,360,40),(560,470,-30),(320,430,20)))
    b+=panel(["Last Saturday","for drop-offs"],["Sat., Nov. 28","9 a.m. to 4 p.m.","Winter hours Dec. 4","Proof of address"])
    return b
