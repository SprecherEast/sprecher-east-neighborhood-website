from ..parts import *
from ..places import *

def scene_school():
    b=backdrop()
    b+=tree(910,716,300,c="#7fb877",d="#5a9a60")
    b+=cloud(640,150,1.2)
    d=f'stroke="{NAVY}" stroke-width="{SW}" stroke-dasharray="14 10" stroke-linejoin="round"'
    t=f'fill="none" stroke="{NAVY}" stroke-width="3" stroke-dasharray="8 6"'
    b+=f'<g {d} fill="#ffffff" fill-opacity=".62"><rect x="130" y="450" width="620" height="270"/><rect x="330" y="340" width="220" height="380"/><path d="M308,340 L440,262 L572,340 Z"/><rect x="428" y="196" width="24" height="68"/></g>'
    b+=f'<circle cx="440" cy="396" r="36" fill="#fff" stroke="{NAVY}" stroke-width="{SW}"/><path d="M440,396 L440,370 M440,396 L460,404" stroke="{NAVY}" stroke-width="4" stroke-linecap="round"/>'
    b+=f'<path d="M452,196 L506,212 L452,228" fill="#fff" fill-opacity=".7" stroke="{NAVY}" stroke-width="3" stroke-dasharray="8 6"/>'
    for wx in (160,230,300,590,660,730-0):
        if wx>690: continue
        b+=f'<g><rect x="{wx}" y="490" width="46" height="62" {t}/><line x1="{wx+23}" y1="490" x2="{wx+23}" y2="552" stroke="{NAVY}" stroke-width="2" stroke-dasharray="6 5"/><line x1="{wx}" y1="521" x2="{wx+46}" y2="521" stroke="{NAVY}" stroke-width="2" stroke-dasharray="6 5"/></g>'
        b+=f'<g><rect x="{wx}" y="590" width="46" height="62" {t}/></g>'
    for wx in (362,456):
        b+=f'<rect x="{wx}" y="440" width="48" height="66" {t}/><rect x="{wx}" y="530" width="48" height="66" {t}/>'
    b+=f'<rect x="404" y="610" width="72" height="110" {t}/><line x1="440" y1="610" x2="440" y2="720" stroke="{NAVY}" stroke-width="2" stroke-dasharray="6 5"/>'
    b+=f'<path d="M388,720 L388,736 L492,736 L492,720" {t}/>'
    b+=f'<path d="M110,744 L760,744" stroke="{RED}" stroke-width="5" stroke-dasharray="18 12" fill="none"/>'
    for sx in (110,440,760):
        b+=f'<rect x="{sx-3}" y="690" width="6" height="58" fill="#8b5e3c" stroke="{NAVY}" stroke-width="2.5"/><path d="M{sx+3},694 L{sx+38},706 L{sx+3},718 Z" fill="{RED}" stroke="{NAVY}" stroke-width="2.5"/>'
    b+=f'<rect x="56" y="560" width="10" height="190" fill="url(#steel)" stroke="{NAVY}" stroke-width="{SW}"/><rect x="8" y="530" width="156" height="42" rx="4" fill="#2f7a3f" stroke="{NAVY}" stroke-width="{SW}"/><text x="86" y="559" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="22" fill="#fff">Sprecher Rd</text>'
    b+=person(805,800,.92,shirt="#4f8fc0",pants="#2b3556",skin="#a8714f")
    b+=person(862,802,.52,shirt=RED,pants="#3d4f7a",skin="#b9825c",hat="beanie",cap=YEL,hr=17,arm="wave")
    b+=person(748,806,.5,shirt=GREEN,pants="#3d4f7a",skin="#8d5a3b",hat="beanie",cap=BLUE,hr=17)+person(912,808,.46,shirt=YEL,pants="#2b3556",skin="#d09a73",hr=17,arm="wave",flip=True)
    b+=f'<g><circle cx="830" cy="540" r="38" fill="{YEL}" stroke="{NAVY}" stroke-width="{SW}"/><text x="830" y="559" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="56" fill="{NAVY}">?</text></g>'
    b+=panel(["A new school?"],["About 21 acres","Two draft maps","Expected vote: Feb.","Nothing decided yet"])
    return b
