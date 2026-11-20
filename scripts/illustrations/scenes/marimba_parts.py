"""Parts for the marimba scenes: a small camera, the marimba and the player built as a jointed
figure (the room and the listeners are in marimba_room.py). World units are metres: x along the marimba (low notes at 0), y away from the
player's side, z up. Every part takes the camera, so one scene can be drawn from several angles."""
import math
from ..parts import *

FRAME="#5a4030"; RAIL="#8b6a46"; NOTE="#fff3b8"; BAR_SIDE="#a95f32"; BAR_FRONT="#8f4f2a"

def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def add(a,b,k=1): return (a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k)
def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def norm(a):
    l=math.sqrt(dot(a,a)); return (a[0]/l,a[1]/l,a[2]/l)

class Camera:
    def __init__(self,pos,look,focal,cx,cy):
        self.pos=pos; self.focal=focal; self.cx=cx; self.cy=cy
        self.f=norm(sub(look,pos)); self.r=norm(cross(self.f,(0,0,1))); self.u=cross(self.r,self.f)
    def depth(self,p): return dot(sub(p,self.pos),self.f)
    def pr(self,p):
        d=sub(p,self.pos); z=dot(d,self.f)
        return (self.cx+self.focal*dot(d,self.r)/z, self.cy-self.focal*dot(d,self.u)/z)
    def k(self,p):
        """Pixels per metre at a world point."""
        return self.focal/self.depth(p)
    def faces(self,p,n):
        """True when a surface at p with outward normal n faces the camera."""
        return dot(n,sub(self.pos,p))>0

def path(cam,pts,fill,close=True):
    return f'<path d="M'+" L".join(f"{x:.1f},{y:.1f}" for x,y in (cam.pr(p) for p in pts))+(' Z' if close else '')+f'" fill="{fill}" {O}/>'

def block(cam,c,ax,ay,az,fills):
    """A box with centre c and half-axes ax, ay, az (vectors); draws the faces that face the camera.
    fills: (top, sides, front) where front is the face along -ay."""
    top,side,front=fills; g=""
    for n,col in ((az,top),(ay,side),((-ay[0],-ay[1],-ay[2]),front),(ax,side),((-ax[0],-ax[1],-ax[2]),side),((-az[0],-az[1],-az[2]),side)):
        fc=add(c,n);
        if not cam.faces(fc,n): continue
        # the two axes spanning this face
        a,b=[v for v in (ax,ay,az) if abs(dot(norm(v),norm(n)))<.5]
        g+=path(cam,[add(add(fc,a),b),add(add(fc,a),b,-1),add(add(fc,a,-1),b,-1),add(add(fc,a,-1),b)],col)
    return g

def abox(cam,x0,x1,y0,y1,z0,z1,fills):
    """An axis-aligned block from its extents."""
    return block(cam,((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),((x1-x0)/2,0,0),(0,(y1-y0)/2,0),(0,0,(z1-z0)/2),fills)

def stroke(cam,pts,col,w):
    """A rounded limb or shaft along world points, outlined like the people in parts.py."""
    d="M"+" L".join(f"{x:.1f},{y:.1f}" for x,y in (cam.pr(p) for p in pts))
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w+SW*2:.1f}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')

# ---- The marimba
L=2.3; N=15; P=L/N; BW=P*.84; ZB=.9
NAT_Y=.32; SHARP_Y=.84
SHARPS=[i for i in range(N-1) if i%7 in (0,1,3,4,5)]
def nat_len(i): return .5-.24*i/(N-1)
def sharp_len(i): return .4-.18*i/(N-1)

def bar_top(i,frac=.5,sharp=False):
    """World point on top of a bar (frac 0 at the player's side, 1 away from it)."""
    if sharp: xc=(i+1)*P; l=sharp_len(i); return (xc,SHARP_Y-l/2+l*frac,ZB+.06)
    xc=i*P+P/2; l=nat_len(i); return (xc,NAT_Y-l/2+l*frac,ZB)

def marimba(cam):
    """A concert marimba: frame and legs on casters, a resonator tube under each bar, the natural-note
    bars on the player's side and the raised sharp-note row behind. Ordered far to near for any camera
    that looks down on it: the far end board, then legs, rails and tubes by distance, then the bars,
    then the near end board."""
    near_end=-.09 if cam.pos[0]<L/2 else L+.09
    far_end=L+.09 if near_end<0 else -.09
    fr=(RAIL,FRAME,FRAME); fb=("url(#bar)",BAR_SIDE,BAR_FRONT)
    def yd(y): return abs(y-cam.pos[1])
    def xd(x): return abs(x-cam.pos[0])
    def tube(xc,yc,length):
        top=(xc,yc,ZB-.08); bot=(xc,yc,ZB-.08-length); r=P*.36
        (tx,ty),(bx,by)=cam.pr(top),cam.pr(bot); w=r*cam.k(top); wb=r*cam.k(bot)
        return (f'<path d="M{tx-w:.1f},{ty:.1f} L{bx-wb:.1f},{by:.1f} Q{bx:.1f},{by+wb*.9:.1f} {bx+wb:.1f},{by:.1f} L{tx+w:.1f},{ty:.1f} Z" fill="url(#tube)" {O}/>'
                f'<path d="M{tx-w*.45:.1f},{ty+4:.1f} L{bx-wb*.45:.1f},{by-6:.1f}" stroke="#fff" stroke-width="{max(2,w*.22):.1f}" opacity=".45" stroke-linecap="round"/>')
    shadow=[cam.pr(p) for p in ((-.2,-.1,0),(L+.2,-.1,0),(L+.2,1.2,0),(-.2,1.2,0))]
    g=f'<path d="M'+" L".join(f"{x:.1f},{y:.1f}" for x,y in shadow)+'Z" fill="#000" opacity=".14"/>'
    g+=abox(cam,far_end-.05,far_end+.05,0,1.08,ZB-.3,ZB-.04,fr)
    low=[]
    for x in (-.12,L+.04):
        for y in (0,1.02):
            leg=abox(cam,x,x+.08,y,y+.08,.06,ZB-.1,fr)
            cx,cy=cam.pr((x+.04,y+.04,.04)); leg+=f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{.05*cam.k((x,y,0)):.1f}" fill="#1a2033" {O}/>'
            low.append((yd(y+.04),xd(x),leg))
    low.append((yd(.53),0,abox(cam,-.08,L+.08,.5,.56,.2,.27,fr)))
    for y in (.02,1.0): low.append((yd(y+.04),0,abox(cam,-.1,L+.1,y,y+.08,ZB-.12,ZB-.04,fr)))
    for i in SHARPS: low.append((yd(SHARP_Y),xd((i+1)*P),tube((i+1)*P,SHARP_Y,.62-.38*i/(N-1))))
    for i in range(N): low.append((yd(NAT_Y),xd(i*P+P/2),tube(i*P+P/2,NAT_Y,.7-.44*i/(N-1))))
    for _,_,svg in sorted(low,key=lambda t:(-t[0],-t[1])): g+=svg
    bars=[]
    for i in SHARPS:
        xc=(i+1)*P; l=sharp_len(i)
        bars.append((yd(SHARP_Y),xd(xc),abox(cam,xc-BW/2,xc+BW/2,SHARP_Y-l/2,SHARP_Y+l/2,ZB+.02,ZB+.06,fb)))
    for i in range(N):
        xc=i*P+P/2; l=nat_len(i)
        bars.append((yd(NAT_Y),xd(xc),abox(cam,xc-BW/2,xc+BW/2,NAT_Y-l/2,NAT_Y+l/2,ZB-.04,ZB,fb)))
    for _,_,svg in sorted(bars,key=lambda t:(-t[0],-t[1])): g+=svg
    g+=abox(cam,near_end-.05,near_end+.05,0,1.08,ZB-.3,ZB-.04,fr)
    return g

def hull(pts):
    """Convex hull of screen points (monotone chain)."""
    pts=sorted(set(pts))
    def half(seq):
        h=[]
        for p in seq:
            while len(h)>=2 and (h[-1][0]-h[-2][0])*(p[1]-h[-2][1])-(h[-1][1]-h[-2][1])*(p[0]-h[-2][0])<=0: h.pop()
            h.append(p)
        return h
    lo=half(pts); hi=half(reversed(pts)); return lo[:-1]+hi[:-1]

def rounded_body(cam,c,ax,ay,az,rad,col):
    """A soft-cornered solid (a torso): the outline of a box, grown by rad with round corners."""
    pts=[cam.pr(add(add(add(c,ax,i),ay,j),az,kk)) for i in (-1,1) for j in (-1,1) for kk in (-1,1)]
    d="M"+" L".join(f"{x:.1f},{y:.1f}" for x,y in hull([(round(x,1),round(y,1)) for x,y in pts]))+" Z"
    return (f'<path d="{d}" fill="{NAVY}" stroke="{NAVY}" stroke-width="{2*rad+SW*2:.1f}" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="{col}" stroke="{col}" stroke-width="{2*rad:.1f}" stroke-linejoin="round"/>')

# ---- The player: a jointed figure, so the arms are always shoulder, elbow, wrist, fist, mallet
UPPER_ARM=.3; FOREARM=.29; SHAFT=.37; GRIP=.28

def elbow(sh,hand,pole):
    """Where the elbow sits for a shoulder and a hand, bending toward pole (two-bone solve)."""
    d=sub(hand,sh); D=math.sqrt(dot(d,d)); u=norm(d)
    D=min(D,UPPER_ARM+FOREARM-.01)
    cos_a=(UPPER_ARM**2+D**2-FOREARM**2)/(2*UPPER_ARM*D); a=math.acos(max(-1,min(1,cos_a)))
    v=sub(pole,(u[0]*dot(pole,u),u[1]*dot(pole,u),u[2]*dot(pole,u))); v=norm(v)
    return add(add(sh,u,UPPER_ARM*math.cos(a)),v,UPPER_ARM*math.sin(a))

def player(cam,base,facing,heads,lean=.06,spread=.34,skin=SKIN_DARKEST,shirt=GREEN,pants="#2b3556",hair="#1f1a17",split=False):
    """A marimbist standing at base and facing the direction `facing` (degrees, 90 = toward +y),
    with each mallet head resting on a bar top (heads: the left hand's point, the right hand's point).
    Parts are depth-sorted, so the figure reads from behind, the side or the front. With split, the
    legs come back separately (drawn before an instrument that stands in front of them)."""
    t=math.radians(facing); f=(math.cos(t),math.sin(t),0); r=(math.sin(t),-math.cos(t),0); Z=(0,0,1)
    k=cam.k(add(base,Z,1))
    def at(fw,side,z): return add(add(add(base,f,fw),r,side),Z,z)
    parts=[]; legs=""
    for s in (-1,1):
        hip=at(0,s*.11,.9); foot=at(.02,s*spread/2,.06)
        svg=stroke(cam,[hip,foot],pants,.16*k)
        tip=at(.12,s*spread/2,.03); svg+=stroke(cam,[at(-.02,s*spread/2,.03),tip],"#2b2b36",.07*k)
        if split: legs+=svg
        else: parts.append((cam.depth(at(0,s*.11,.45)),svg))
    # torso: a block leaning forward from the hips
    hipc=at(0,0,.92); shc=at(lean,0,1.42); up=norm(sub(shc,hipc)); mid=add(hipc,sub(shc,hipc),.5)
    hl=math.sqrt(dot(sub(shc,hipc),sub(shc,hipc)))/2
    torso=rounded_body(cam,mid,(r[0]*.15,r[1]*.15,0),(f[0]*.07,f[1]*.07,0),(up[0]*(hl-.04),up[1]*(hl-.04),up[2]*(hl-.04)),.045*k,shirt)
    parts.append((cam.depth(mid),torso))
    # arms with fists around the mallet shafts, thumb side up
    for s,head in zip((-1,1),heads):
        sh=at(lean,s*.2,1.4)
        back=norm((sh[0]-head[0],sh[1]-head[1],0))  # level direction from the mallet head back toward the shoulder
        dshaft=norm((back[0]*.95,back[1]*.95,.3))
        fist=add(head,dshaft,GRIP); tail=add(head,dshaft,SHAFT)
        el=elbow(sh,fist,add(add((0,0,-1),r,s*.55),f,-.25))
        svg=stroke(cam,[sh,el],shirt,.1*k)+stroke(cam,[el,fist],shirt,.085*k)
        svg+=stroke(cam,[tail,head],TAN,.022*k)
        hx,hy=cam.pr(head); rr=.06*cam.k(head)
        svg+=f'<circle cx="{hx:.1f}" cy="{hy-rr*.2:.1f}" r="{rr:.1f}" fill="{YEL}" {O}/>'
        svg+=(f'<g stroke="{NOTE}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M{hx-rr*2.1:.1f},{hy-rr*1.3:.1f} L{hx-rr*3.1:.1f},{hy-rr*2:.1f}"/>'
              f'<path d="M{hx+rr*2.1:.1f},{hy-rr*1.3:.1f} L{hx+rr*3.1:.1f},{hy-rr*2:.1f}"/></g>')
        fx,fy=cam.pr(fist); fr_=.05*k
        svg+=f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="{fr_:.1f}" fill="{skin}" {O}/>'
        tx,ty=cam.pr(add(add(fist,Z,.035),dshaft,-.03))
        svg+=f'<ellipse cx="{tx:.1f}" cy="{ty:.1f}" rx="{fr_*.45:.1f}" ry="{fr_*.32:.1f}" fill="{skin}" {O}/>'
        parts.append((cam.depth(el),svg))
    # head: hair sits toward the back, so the face shows when he turns toward the camera
    hc=at(lean+.03,0,1.62); hx,hy=cam.pr(hc); hr=.12*k
    nx,ny=cam.pr(at(lean+.01,0,1.49))
    svg=f'<rect x="{nx-.045*k:.1f}" y="{ny-.05*k:.1f}" width="{.09*k:.1f}" height="{.08*k:.1f}" fill="{skin}" {O}/>'
    svg+=f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{hr:.1f}" fill="{skin}" {O}/>'
    cid=f"hd{int(hx)}{int(hy)}"
    bx,by=cam.pr(add(add(hc,f,-.06),Z,.045))
    svg+=f'<defs><clipPath id="{cid}"><circle cx="{hx:.1f}" cy="{hy:.1f}" r="{hr:.1f}"/></clipPath></defs>'
    svg+=f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{hr*.96:.1f}" fill="{hair}" clip-path="url(#{cid})"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="{hr:.1f}" fill="none" {O}/>'
    for s in (-1,1):
        e=at(lean+.03+.095,s*.04,1.63)
        if cam.faces(e,f) and dot(norm(sub(cam.pos,e)),f)>.15:
            ex,ey=cam.pr(e); svg+=f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{.012*k+1:.1f}" fill="{NAVY}"/>'
        ear=at(lean+.03,s*.105,1.61)
        if cam.faces(ear,(r[0]*s,r[1]*s,0)):
            ex,ey=cam.pr(ear); svg+=f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{hr*.16:.1f}" ry="{hr*.26:.1f}" fill="{skin}" {O}/>'
    parts.append((cam.depth(hc),svg))
    body="".join(svg for _,svg in sorted(parts,key=lambda t:-t[0]))
    return (legs,body) if split else body
