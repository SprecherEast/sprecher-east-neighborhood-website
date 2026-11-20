from ..parts import *

PANEL=(["Live marimba"],["Starts at 11 a.m.","Rooms A and B","Monthly series","Older kids to adults"])
O=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'
WALL="#6f8fb8"; FLOOR="#d4b48a"; FRAME="#5a4030"; RAIL="#8b6a46"; NOTE="#fff3b8"

# ---- A simple camera. World in metres: x along the marimba (low notes at 0), y away from the
# player, z up. The camera stands behind the player's left shoulder, a little above.
CAM=(-1.2,-4.0,3.8); LOOK=(1.25,1.1,0.4); FOCAL=1250; CX,CY=470,520

def _sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def _dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def _cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def _norm(a):
    l=math.sqrt(_dot(a,a)); return (a[0]/l,a[1]/l,a[2]/l)
_F=_norm(_sub(LOOK,CAM)); _R=_norm(_cross(_F,(0,0,1))); _U=_cross(_R,_F)

def pr(p):
    """Screen point of a world point."""
    d=_sub(p,CAM); z=_dot(d,_F)
    return (CX+FOCAL*_dot(d,_R)/z, CY-FOCAL*_dot(d,_U)/z)

def px_per_m(p):
    """How many pixels one metre measures at a world point."""
    return FOCAL/_dot(_sub(p,CAM),_F)

def poly(pts,fill,extra=""):
    return f'<path d="M'+" L".join(f"{x:.1f},{y:.1f}" for x,y in (pr(p) for p in pts))+f' Z" fill="{fill}" {O} {extra}/>'

def box(x0,x1,y0,y1,z0,z1,top,side,front=None):
    """A solid block seen from the camera: the faces that face it, far ones first."""
    front=front or side
    g=poly([(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)],front)      # near face (toward the player side)
    g+=poly([(x0,y0,z0),(x0,y1,z0),(x0,y1,z1),(x0,y0,z1)],side)      # low-note end face
    g+=poly([(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],top)       # top
    return g

def limb(a,b,col,w):
    (x1,y1),(x2,y2)=a,b
    return (f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}" stroke="{NAVY}" stroke-width="{w+SW*2:.1f}" stroke-linecap="round"/>'
            f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}" stroke="{col}" stroke-width="{w:.1f}" stroke-linecap="round"/>')

# ---- The marimba
L=2.3; N=15; P=L/N; BW=P*.84; ZB=.9
def nat_len(i): return .5-.24*i/(N-1)
def sharp_len(i): return .4-.18*i/(N-1)
NAT_Y=.32; SHARP_Y=.84

def marimba():
    """A concert marimba in three-quarter view: frame and legs on casters, resonator tubes hanging
    under each bar, natural-note bars near the player and the raised sharp-note row behind them."""
    g=""
    sharps=[i for i in range(N-1) if i%7 in (0,1,3,4,5)]
    # shadow on the floor
    g+=f'<path d="M'+" L".join(f"{x:.1f},{y:.1f}" for x,y in (pr(p) for p in ((-.2,-.1,0),(L+.2,-.1,0),(L+.2,1.2,0),(-.2,1.2,0))))+'Z" fill="#000" opacity=".14"/>'
    # far legs and the low crossbar
    for x in (L+.04,-.12):
        g+=box(x,x+.08,1.02,1.1,0.06,ZB-.1,RAIL,FRAME)
        cx,cy=pr((x+.04,1.06,.04)); g+=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{.05*px_per_m((x,1,0)):.1f}" fill="#1a2033" {O}/>'
    g+=box(-.08,L+.08,.5,.56,.2,.27,RAIL,FRAME)
    # resonators: far row (sharps) then near row (naturals), high notes first so nearer tubes overlap
    def tube(xc,yc,length):
        top=(xc,yc,ZB-.08); bot=(xc,yc,ZB-.08-length)
        r=P*.36; (tx,ty),(bx,by)=pr(top),pr(bot); w=r*px_per_m(top); wb=r*px_per_m(bot)
        return (f'<path d="M{tx-w:.1f},{ty:.1f} L{bx-wb:.1f},{by:.1f} Q{bx:.1f},{by+wb*.9:.1f} {bx+wb:.1f},{by:.1f} L{tx+w:.1f},{ty:.1f} Z" fill="url(#tube)" {O}/>'
                f'<path d="M{tx-w*.45:.1f},{ty+4:.1f} L{bx-wb*.45:.1f},{by-6:.1f}" stroke="#fff" stroke-width="{max(2,w*.22):.1f}" opacity=".45" stroke-linecap="round"/>')
    for i in reversed(sharps): g+=tube((i+1)*P,SHARP_Y,.62-.38*i/(N-1))
    # far rail and end boards
    g+=box(-.1,L+.1,1.0,1.08,ZB-.12,ZB-.04,RAIL,FRAME)
    for i in reversed(range(N)): g+=tube(i*P+P/2,NAT_Y,.7-.44*i/(N-1))
    g+=box(L+.02,L+.12,.0,1.08,ZB-.3,ZB-.04,RAIL,FRAME)
    # sharp-note bars, raised
    for i in reversed(sharps):
        xc=(i+1)*P; l=sharp_len(i)
        g+=box(xc-BW/2,xc+BW/2,SHARP_Y-l/2,SHARP_Y+l/2,ZB+.02,ZB+.06,"url(#bar)","#a95f32","#8f4f2a")
    # near rail, then natural-note bars
    g+=box(-.1,L+.1,.02,.1,ZB-.12,ZB-.04,RAIL,FRAME)
    for i in reversed(range(N)):
        xc=i*P+P/2; l=nat_len(i)
        g+=box(xc-BW/2,xc+BW/2,NAT_Y-l/2,NAT_Y+l/2,ZB-.04,ZB,"url(#bar)","#a95f32","#8f4f2a")
    # near legs and the low-note end board (closest to the camera)
    for x in (L+.04,-.12):
        g+=box(x,x+.08,.0,.08,0.06,ZB-.1,RAIL,FRAME)
        cx,cy=pr((x+.04,.04,.04)); g+=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{.05*px_per_m((x,0,0)):.1f}" fill="#1a2033" {O}/>'
    g+=box(-.14,-.04,.0,1.08,ZB-.3,ZB-.04,RAIL,FRAME)
    return g

def bar_top(i,frac=.5,sharp=False):
    """World point on the top of a bar (frac 0 near the player, 1 away)."""
    if sharp: xc=(i+1)*P; l=sharp_len(i); y=SHARP_Y-l/2+l*frac; z=ZB+.06
    else: xc=i*P+P/2; l=nat_len(i); y=NAT_Y-l/2+l*frac; z=ZB
    return (xc,y,z)

# ---- The player, seen from behind and a little from the side, both mallets on the bars
def player(x):
    skin=SKIN_DARKEST; shirt=GREEN; pants="#2b3556"; hair="#1f1a17"
    yb=-.42; k=px_per_m((x,yb,1))
    g=""
    sh_l,sh_r=(x-.2,yb,1.42),(x+.2,yb+.02,1.42); hip_l,hip_r=(x-.13,yb,.92),(x+.13,yb,.92)
    for hx,fx in ((-.11,-.15),(.11,.13)):
        g+=limb(pr((x+hx,yb,.9)),pr((x+fx,yb-.02,.06)),pants,.17*k)
        fxp,fyp=pr((x+fx,yb-.02,.02)); g+=f'<ellipse cx="{fxp:.1f}" cy="{fyp:.1f}" rx="{.08*k:.1f}" ry="{.04*k:.1f}" fill="#2b2b36" {O}/>'
    # torso
    a,b,c,d=pr(sh_l),pr(sh_r),pr(hip_r),pr(hip_l)
    g+=f'<path d="M{a[0]-.03*k:.1f},{a[1]+.02*k:.1f} Q{(a[0]+b[0])/2:.1f},{a[1]-.06*k:.1f} {b[0]+.03*k:.1f},{b[1]+.02*k:.1f} L{c[0]+.02*k:.1f},{c[1]:.1f} Q{(c[0]+d[0])/2:.1f},{c[1]+.03*k:.1f} {d[0]-.02*k:.1f},{d[1]:.1f} Z" fill="{shirt}" {O}/>'
    g+=f'<path d="M{(a[0]+b[0])/2:.1f},{a[1]:.1f} L{(c[0]+d[0])/2:.1f},{c[1]:.1f}" stroke="#000" stroke-width="{.006*k:.1f}" opacity=".18"/>'
    # mallets: heads resting on natural bars, a little motion above each
    strikes=((sh_l,(x-.3,yb+.06,1.12),(x-.32,yb+.4,1.0),bar_top(3,.5)),(sh_r,(x+.32,yb+.06,1.12),(x+.42,yb+.38,1.0),bar_top(12,.4)))
    for sh,el,hand,head in strikes:
        g+=limb(pr(sh),pr(el),shirt,.11*k)+limb(pr(el),pr(hand),shirt,.09*k)
        g+=limb(pr(hand),pr(head),TAN,.022*k)
        hx,hy=pr(head); r=.06*px_per_m(head)
        g+=f'<circle cx="{hx:.1f}" cy="{hy-r*.15:.1f}" r="{r:.1f}" fill="{YEL}" {O}/>'
        g+=f'<g stroke="{NOTE}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M{hx-r*2.2:.1f},{hy-r*1.4:.1f} Q{hx-r*1.6:.1f},{hy-r*2.6:.1f} {hx-r*.8:.1f},{hy-r*3:.1f}"/><path d="M{hx+r*2.2:.1f},{hy-r*1.2:.1f} L{hx+r*3.2:.1f},{hy-r*1.8:.1f}"/></g>'
        hxp,hyp=pr(hand); g+=f'<circle cx="{hxp:.1f}" cy="{hyp:.1f}" r="{.045*k:.1f}" fill="{skin}" {O}/>'
    # head from behind: hair covers it, an ear shows on the side
    nx,ny=pr((x,yb,1.48)); hx,hy=pr((x,yb,1.6)); r=.11*k
    g+=f'<rect x="{nx-.045*k:.1f}" y="{ny-.04*k:.1f}" width="{.09*k:.1f}" height="{.07*k:.1f}" fill="{skin}" {O}/>'
    g+=f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{r:.1f}" fill="{skin}" {O}/>'
    g+=f'<path d="M{hx-r:.1f},{hy+r*.25:.1f} Q{hx-r*1.05:.1f},{hy-r*1.12:.1f} {hx+r*.1:.1f},{hy-r*1.05:.1f} Q{hx+r*1.02:.1f},{hy-r*.8:.1f} {hx+r*.62:.1f},{hy+r*.35:.1f} Q{hx:.1f},{hy+r*.82:.1f} {hx-r:.1f},{hy+r*.25:.1f} Z" fill="{hair}" {O}/>'
    g+=f'<ellipse cx="{hx+r*.9:.1f}" cy="{hy+r*.1:.1f}" rx="{r*.18:.1f}" ry="{r*.3:.1f}" fill="{skin}" {O}/>'
    return g

# ---- Listeners facing the player
def upper(dy,skin,shirt,hair,hr=13,long_hair=False,grey=False):
    """Torso, arms resting on the lap, and head of a person facing us, lowered by dy (person() units)."""
    o=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'
    g=f'<g transform="translate(0,{dy})">'
    if long_hair: g+=f'<path d="M{-hr-4},-170 L{-hr-4},-192 Q0,{-190-hr-8} {hr+4},-192 L{hr+4},-170 Z" fill="{hair}" {o}/>'
    g+=f'<path d="M-23,-166 Q0,-175 23,-166 L20,-100 Q0,-94 -20,-100 Z" fill="{shirt}" {o}/>'
    g+=f'<path d="M-24,-162 L-28,-118 L-12,-104" fill="none" stroke="{NAVY}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M-24,-162 L-28,-118 L-12,-104" fill="none" stroke="{shirt}" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>'
    g+=f'<path d="M24,-162 L28,-118 L12,-104" fill="none" stroke="{NAVY}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M24,-162 L28,-118 L12,-104" fill="none" stroke="{shirt}" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>'
    g+=f'<circle cx="-10" cy="-103" r="6" fill="{skin}" {o}/><circle cx="10" cy="-103" r="6" fill="{skin}" {o}/>'
    g+=f'<rect x="-6" y="-182" width="12" height="14" fill="{skin}" {o}/><circle cx="0" cy="-190" r="{hr}" fill="{skin}" {o}/>'
    hc="#c6cdd9" if grey else hair
    g+=f'<path d="M{-hr},-191 Q{-hr+1},{-190-hr-3} 0,{-190-hr-3} Q{hr+1},{-190-hr-3} {hr},-191 Q{hr-3},-198 0,-197 Q{-hr+3},-198 {-hr},-191 Z" fill="{hc}" {o}/>'
    return g+'</g>'

def sitter(x,y,s,skin,shirt,pants,hair,pose="chair",**kw):
    """A listener facing us, on a chair or cross-legged on the floor; (x, y) is where they meet the floor."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=f'<g transform="translate({x},{y}) scale({s})"><ellipse cx="0" cy="1" rx="38" ry="6" fill="#000" opacity=".12"/>'
    if pose=="chair":
        g+=f'<rect x="-30" y="-150" width="60" height="70" rx="4" fill="#8c96a8" {o}/>'
        g+=f'<path d="M-30,0 L-28,-56 M30,0 L28,-56" stroke="{NAVY}" stroke-width="6" stroke-linecap="round"/>'
        g+=f'<rect x="-34" y="-62" width="68" height="10" rx="3" fill="#8c96a8" {o}/>'
        g+=f'<rect x="-20" y="-72" width="18" height="22" rx="5" fill="{pants}" {o}/><rect x="2" y="-72" width="18" height="22" rx="5" fill="{pants}" {o}/>'
        g+=f'<rect x="-19" y="-54" width="15" height="50" rx="5" fill="{pants}" {o}/><rect x="4" y="-54" width="15" height="50" rx="5" fill="{pants}" {o}/>'
        g+=f'<ellipse cx="-12" cy="-4" rx="12" ry="5.5" fill="#2b2b36" {o}/><ellipse cx="12" cy="-4" rx="12" ry="5.5" fill="#2b2b36" {o}/>'
        g+=upper(42,skin,shirt,hair,**kw)
    else:
        g+=f'<path d="M-44,-6 Q-44,-26 -14,-24 L0,-16 L14,-24 Q44,-26 44,-6 Q44,4 30,2 L-30,2 Q-44,4 -44,-6 Z" fill="{pants}" {o}/>'
        g+=upper(86,skin,shirt,hair,**kw)
    return g+'</g>'

def at(xw,yw,s_adult=1.0):
    """Floor point and person() scale for someone standing at a world position."""
    x,y=pr((xw,yw,0)); return x,y,px_per_m((xw,yw,0))*1.72/203*s_adult

def shelf(x,y,w,h):
    """One calm, low library shelf: two rows of books in muted tones."""
    cols=("#d9b27c","#c6cdd9","#8c96a8","#e3dcc8","#a8714f")
    g=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#b98f62" {O}/>'
    rh=(h-24)/2
    for r in range(2):
        ry=y+8+r*(rh+8)
        g+=f'<rect x="{x+8}" y="{ry}" width="{w-16}" height="{rh}" fill="#8b6a46" {O}/>'
        cx=x+14; i=r*3
        while cx<x+w-40:
            bw=20+(i*5)%10; bh=rh-8-(i*7)%16
            g+=f'<rect x="{cx}" y="{ry+rh-bh}" width="{bw}" height="{bh}" fill="{cols[i%len(cols)]}" {O}/>'
            cx+=bw+3; i+=1
    return g

def note(x,y,s=1,rot=0):
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            f'<path d="M12,-4 L12,-66 Q36,-58 40,-34 Q30,-46 20,-46 L20,-4 Z" fill="{NOTE}" {o}/>'
            f'<ellipse cx="0" cy="0" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20)" {o}/></g>')

def beamed(x,y,s=1,rot=0):
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            f'<path d="M12,-4 L12,-70 L66,-80 L66,-14 L58,-14 L58,-66 L20,-59 L20,-4 Z" fill="{NOTE}" {o}/>'
            f'<path d="M12,-70 L66,-80 L66,-66 L12,-56 Z" fill="{NOTE}" {o}/>'
            f'<ellipse cx="0" cy="0" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20)" {o}/>'
            f'<ellipse cx="46" cy="-10" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20 46 -10)" {o}/></g>')

WALL_LINE=350  # the back wall meets the floor here; the room is square to the camera, the marimba sits at an angle in it

def depth(p): return _dot(_sub(p,CAM),_F)

def scene_marimba():
    """Pinney Library: a marimbist plays, seen from behind; neighbors of all ages listen across the instrument."""
    b=(f'<defs><linearGradient id="bar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e09a5f"/><stop offset="1" stop-color="#b8693a"/></linearGradient>'
       f'<linearGradient id="tube" x1="0" x2="1"><stop offset="0" stop-color="#a7b0bf"/><stop offset=".45" stop-color="#e3e8ef"/><stop offset="1" stop-color="#8c96a8"/></linearGradient></defs>'
       f'<rect width="{W}" height="{H}" fill="{WALL}"/>'
       f'<rect x="0" y="{WALL_LINE}" width="{W}" height="{H-WALL_LINE}" fill="{FLOOR}" {O}/>')
    y=WALL_LINE; gap=26
    while y<H:
        y+=gap; gap*=1.22
        b+=f'<path d="M0,{y:.1f} L{W},{y:.1f}" stroke="{NAVY}" stroke-width="2" opacity=".14"/>'
    b+=shelf(24,WALL_LINE-160,230,160)
    for nx,ny,s,r,fn in ((610,170,1.0,-8,note),(700,280,1.1,6,note),(790,200,1.2,8,beamed)):
        b+=fn(nx,ny,s,r)
    # listeners across the instrument, drawn far ones first
    crowd=[]
    def standing(xw,yw,s_adult,**kw):
        x,y,s=at(xw,yw,s_adult); crowd.append((depth((xw,yw,0)),person(x,y,s,**kw)))
    def seated(xw,yw,s_adult,**kw):
        x,y,s=at(xw,yw,s_adult); crowd.append((depth((xw,yw,0)),sitter(x,y,s,**kw)))
    seated(-.5,2.3,1.0,skin=SKIN_LIGHTEST,shirt=RED,pants="#3d4f7a",hair="#8a5a2b",long_hair=True)
    seated(-.4,1.6,.62,skin=SKIN_LIGHTEST,shirt=YEL,pants="#2b3556",hair="#8a5a2b",pose="floor",hr=16)
    seated(.5,2.6,1.0,skin=SKIN_DARKEST,shirt="#d9b27c",pants="#2b3556",hair="#1f1a17",grey=True)
    seated(1.4,2.7,1.0,skin=SKIN_LIGHT,shirt="#6f8fb8",pants="#2b3556",hair=TAN,long_hair=True)
    standing(2.3,2.8,.92,shirt=BLUE,pants="#2b3556",skin=SKIN_DARK,hair="#2a1d17")
    seated(3.45,1.7,.6,skin=SKIN_MID,shirt=RED,pants="#3d4f7a",hair="#1f1a17",pose="floor",hr=16)
    seated(3.3,.7,.58,skin=SKIN_LIGHT,shirt=GREEN,pants="#2b3556",hair="#5a3a22",pose="floor",hr=16,long_hair=True)
    for _,svg in sorted(crowd,key=lambda t:-t[0]): b+=svg
    b+=marimba()
    b+=player(.82)
    return b+panel(*PANEL)
