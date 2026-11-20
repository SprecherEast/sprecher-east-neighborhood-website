"""Live marimba at Pinney Library: the player in three-quarter view from the front-left, at a
marimba drawn in perspective, with seven listeners. A camera, the player's stance and where the
listeners sit; the parts are shared (marimba_parts.py)."""
from ..parts import *
from .marimba_parts import *

PANEL=(["Live marimba"],["Starts at 11 a.m.","Rooms A and B","Monthly series","Older kids to adults"])
WALL="#6f8fb8"; FLOOR="#d4b48a"
PLAYER_X=.82; PLAYER_Y=-.42
NOTES=((610,170,1.0,-8,False),(700,280,1.1,6,False),(790,200,1.2,8,True))

# Seven listeners, half lighter and half darker skinned: (kind, scale, look). Each version places them.
LISTENERS=(
    ("chair",1.0,dict(skin=SKIN_LIGHTEST,shirt=RED,pants="#3d4f7a",hair="#8a5a2b",long_hair=True)),
    ("floor",.62,dict(skin=SKIN_LIGHTEST,shirt=YEL,pants="#2b3556",hair="#8a5a2b",hr=16)),
    ("chair",1.0,dict(skin=SKIN_DARKEST,shirt=TAN,pants="#2b3556",hair="#1f1a17",grey=True)),
    ("chair",1.0,dict(skin=SKIN_LIGHT,shirt="#6f8fb8",pants="#2b3556",hair=TAN,long_hair=True)),
    ("stand",.92,dict(shirt=BLUE,pants="#2b3556",skin=SKIN_DARK,hair="#2a1d17")),
    ("floor",.6,dict(skin=SKIN_MID,shirt=RED,pants="#3d4f7a",hair="#1f1a17",hr=16)),
    ("floor",.58,dict(skin=SKIN_LIGHT,shirt=GREEN,pants="#2b3556",hair="#5a3a22",hr=16,long_hair=True)),
)

VIEW=dict(cam=((-2.0,4.4,3.6),(1.25,0,.5),1250,520,520),
             player=dict(facing=75,lean=.03,spread=.3,heads=(bar_top(4,.35),bar_top(8,.35))),
             seats=((3.25,.9),(2.85,1.35),(3.4,-.15),(3.1,-1.15),(2.2,-1.75),(2.55,1.85),(3.05,2.3)))

def place(cam,kind,s_adult,look,xw,yw):
    x,y=cam.pr((xw,yw,0)); s=cam.k((xw,yw,0))*1.72/203*s_adult
    return person(x,y,s,**look) if kind=="stand" else sitter(x,y,s,pose=kind,**look)

def scene_marimba():
    V=VIEW; cam=Camera(*V["cam"]); wall_line=350
    b=(f'<defs><linearGradient id="bar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e09a5f"/><stop offset="1" stop-color="#b8693a"/></linearGradient>'
       f'<linearGradient id="tube" x1="0" x2="1"><stop offset="0" stop-color="#a7b0bf"/><stop offset=".45" stop-color="#e3e8ef"/><stop offset="1" stop-color="#8c96a8"/></linearGradient></defs>'
       f'<rect width="{W}" height="{H}" fill="{WALL}"/><rect x="0" y="{wall_line}" width="{W}" height="{H-wall_line}" fill="{FLOOR}" {O}/>')
    y=wall_line; gap=26
    while y<H:
        y+=gap; gap*=1.22
        b+=f'<path d="M0,{y:.1f} L{W},{y:.1f}" stroke="{NAVY}" stroke-width="2" opacity=".14"/>'
    b+=shelf(24,wall_line-160,230,160)
    for x,y,sc_,rot,beam in V.get("notes",NOTES): b+=note(x,y,sc_,rot,beamed=beam)
    crowd=[(cam.depth((xw,yw,0)),place(cam,kind,s,look,xw,yw)) for (kind,s,look),(xw,yw) in zip(LISTENERS,V["seats"])]
    for _,svg in sorted(crowd,key=lambda t:-t[0]): b+=svg
    p=V["player"]; front=cam.pos[1]>PLAYER_Y+1  # the camera looks at the player across the instrument
    fig=player(cam,(PLAYER_X,PLAYER_Y,0),split=front,**p)
    if front: b+=fig[0]+marimba(cam)+fig[1]
    else: b+=marimba(cam)+fig
    return b+panel(*PANEL)
