from ..parts import *
from ..places import *
import math
K=1.15; ZK=K/0.9; A=K*math.cos(math.radians(30)); B=K*.5
CX,CY=470,490
def P(x,y,z=0): return (CX+A*x-A*y, CY+B*x+B*y-z*ZK)
def poly(pts,**kw):
    d=" ".join(f"{x:.1f},{y:.1f}" for x,y in pts); a=" ".join(f'{k.replace("_","-")}="{v}"' for k,v in kw.items())
    return f'<polygon points="{d}" {a}/>'
def flat(x0,y0,x1,y1,**kw): return poly([P(x0,y0),P(x1,y0),P(x1,y1),P(x0,y1)],**kw)

# Road: two lanes each way plus a centre turn lane, measured in ground-plane units.
LANE=38
ROAD=LANE*5//2         # half the width of the car lanes
BIKE=28                # bike lane on each side
HALF=ROAD+BIKE         # half the road width, bike lanes included
WALK=HALF+34           # outer edge of the sidewalk
WHITE="#f4f6fa"
SLOPE=B/A              # screen slope of a road running along an axis
# Trees as (ground x, ground y, height), far to near. The grass corner is x < -WALK, y > WALK:
# everything else is a road or its sidewalk, so a spot there is checked by the illustration test.
TREE_SPOTS=((-WALK-72,WALK+28,110),(-WALK-30,WALK+30,125),(-WALK-28,WALK+72,105))

def r(x,y,w,h,swap,**kw):
    """A rectangle in ground-plane units; swap=True draws it on the crossing road."""
    if swap: x,y,w,h=y,x,h,w
    a=" ".join(f'{k.replace("_","-")}="{v}"' for k,v in kw.items())
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" {a}/>'

def ground():
    g=[f'<rect width="{W}" height="{H}" fill="{MINT}"/>']
    m=f'matrix({A},{B},{-A},{B},{CX},{CY})'
    L=1500
    g.append(f'<g transform="{m}"><rect x="{-L}" y="{-L}" width="{2*L}" height="{2*L}" fill="#cfe3c9"/>')
    for s in (False,True):
        g.append(r(-L,-WALK,2*L,2*WALK,s,fill="#d8dde6"))
    for s in (False,True):
        g.append(r(-L,-HALF,2*L,2*HALF,s,fill="#34405f"))
    g.append(r(-HALF,-HALF,2*HALF,2*HALF,False,fill="#34405f"))
    for s in (False,True):
        for v0 in (-HALF,ROAD):
            g.append(r(-L,v0,2*L,BIKE,s,fill="#4f8a62"))
            g.append(r(-L,(ROAD-2) if v0>0 else -ROAD-2,2*L,4,s,fill=WHITE))
    g.append(r(-HALF,-HALF,2*HALF,2*HALF,False,fill="#34405f"))
    for s in (False,True):
        for v in (-HALF,HALF):
            g.append(r(-L,v-2,2*L,4,s,fill=NAVY))
    g.append(r(-HALF,-HALF,2*HALF,2*HALF,False,fill="#34405f"))
    for s in (False,True):
        for sgn in (-1,1):
            start=HALF+40
            for d in range(start,1400,70):
                x0=sgn*d-(0 if sgn>0 else 36)
                for v in (-LANE*1.5,LANE*1.5):      # white lane dividers
                    g.append(r(x0,v-3,36,6,s,fill=WHITE))
            for v in (-LANE/2,LANE/2):               # solid yellow edges of the turn lane
                g.append(r(sgn*(HALF+40)-(0 if sgn>0 else L-HALF-40),v-3,L-HALF-40,6,s,fill=YEL))
            for yy in range(-HALF+8,HALF-8,24):   # crosswalk
                g.append(r(sgn*(HALF+14)-(0 if sgn>0 else 34),yy-8,34,16,s,fill=WHITE))
            g.append(r(sgn*(HALF+60)-(0 if sgn>0 else 8),-HALF if sgn>0 else 0,8,HALF,s,fill=WHITE))
    g.append('</g>')
    return "".join(g)

def shade(hexc,f):
    """A colour lightened (f>1) or darkened (f<1)."""
    r,g,b=(int(hexc[k:k+2],16) for k in (1,3,5))
    return "#%02x%02x%02x"%tuple(max(0,min(255,round(c*f))) for c in (r,g,b))

def quad(pts,fill,**kw):
    return poly(pts,fill=fill,stroke=NAVY,stroke_width=2.5,stroke_linejoin="round",**kw)

def block(x0,x1,y0,y1,z0,z1,top,sx,sy):
    """A solid box in the ground plane. Only the faces the viewer sees are drawn: +y side, +x side, top."""
    return (quad([P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)],sy)
            +quad([P(x1,y0,z0),P(x1,y1,z0),P(x1,y1,z1),P(x1,y0,z1)],sx)
            +quad([P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)],top))

def wheel(plane_at,axis,u,r=11,z=11):
    """A wheel drawn on the side face the viewer sees (axis x: face y=plane_at; axis y: face x=plane_at)."""
    pts=[]
    for k in range(18):
        a=k*math.pi/9; du,dz=r*math.cos(a),r*math.sin(a)
        pts.append(P(u+du,plane_at,z+dz) if axis=="x" else P(plane_at,u+du,z+dz))
    hub=[]
    for k in range(12):
        a=k*math.pi/6; du,dz=r*.45*math.cos(a),r*.45*math.sin(a)
        hub.append(P(u+du,plane_at,z+dz) if axis=="x" else P(plane_at,u+du,z+dz))
    return poly(pts,fill="#1a2033",stroke=NAVY,stroke_width=2)+poly(hub,fill="#c9d0dc",stroke=NAVY,stroke_width=1.5)

def icar(cx,cy,axis,sign,color,length=104,width=34,suv=False):
    """A solid car in the ground plane with a hood, windshield, roof and trunk, heading toward `sign`."""
    h=length/2; w=width/2
    W3=lambda a,c,z:P(cx+a,cy+c,z) if axis=="x" else P(cx+c,cy+a,z)
    # top line of the body from rear to front, as (position along the car, height); mirrored when heading -1
    top=[(-1,22),(-.62,25),(-.40,43),(.02,44),(.30,29),(1,24)] if not suv else [(-1,26),(-.8,28),(-.62,46),(.12,47),(.36,30),(1,25)]
    pr=sorted(((sign*a*h,z,k) for k,(a,z) in enumerate(top)),key=lambda q:q[0])
    prof=[(a,z) for a,z,_ in pr]
    side=shade(color,.84); end=shade(color,.68); roof=shade(color,1.1)
    glass="#a9cfe2"; glass_top="#8fb9d0"
    c0=P(cx,cy)
    g=f'<ellipse cx="{c0[0]:.1f}" cy="{c0[1]:.1f}" rx="{length*.55*K:.0f}" ry="{width*.5*K:.0f}" fill="#000" opacity=".2"/>'
    sp=w+.4
    base=cx if axis=="x" else cy
    wcy=cy+sp if axis=="x" else cx+sp
    g+=wheel(wcy,axis,base-h+26,r=12,z=12)+wheel(wcy,axis,base+h-26,r=12,z=12)
    # visible side (+across) and end (+along)
    zb=9
    side_pts=[W3(prof[0][0],w,zb)]+[W3(a,w,z) for a,z in prof]+[W3(prof[-1][0],w,zb)]
    g+=quad(side_pts,side)
    # windows on the side: the cabin part of the profile, inset
    cab=[(a,z) for a,z in prof if z>=29]
    if len(cab)>=2:
        a0,a1=cab[0][0],cab[-1][0]
        win=[W3(a0+(4 if a0<a1 else -4),w+.2,29),W3(cab[1][0] if sign>0 else cab[-2][0],w+.2,min(z for a,z in cab[1:-1])-3 if len(cab)>2 else 40)]
        pts=[(a,z) for a,z in cab]
        poly_pts=[W3(a,w+.2,z-(0 if i in (0,len(pts)-1) else 3)) for i,(a,z) in enumerate(pts)]
        poly_pts=[W3(pts[0][0]*.97+pts[1][0]*.03,w+.2,28)]+poly_pts[1:-1]+[W3(pts[-1][0]*.97+pts[-2][0]*.03,w+.2,28)]
        g+=poly(poly_pts,fill=glass,stroke=NAVY,stroke_width=1.8,stroke_linejoin="round")
    # visible end (+along): front if heading +, rear if heading -
    ze=prof[-1][1]
    g+=quad([W3(prof[-1][0],-w,zb),W3(prof[-1][0],w,zb),W3(prof[-1][0],w,ze),W3(prof[-1][0],-w,ze)],end)
    col="#ffe89a" if sign>0 else "#e0453a"
    for off in (-w*.62,w*.62):
        a=W3(prof[-1][0],off,17); g+=f'<circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="3.4" fill="{col}" stroke="{NAVY}" stroke-width="1.5"/>'
    # top surfaces, rear to front
    for (a0,z0),(a1,z1) in zip(prof,prof[1:]):
        sl=abs(z1-z0)/max(1e-6,abs(a1-a0))
        f=glass_top if sl>.5 else (roof if abs(z1-z0)<2 and z0>40 else color)
        g+=quad([W3(a0,-w,z0),W3(a1,-w,z1),W3(a1,w,z1),W3(a0,w,z0)],f)
    return g

def flat_sprite(sx,sy,axis,svg,s_len):
    """A billboard figure laid along a road: skewed to the road's direction, still standing upright."""
    slope=SLOPE if axis=="x" else -SLOPE
    return f'<g transform="translate({sx:.1f},{sy:.1f}) matrix({.87},{slope*.87:.3f},0,1,0,0)">{svg}</g>'

def cyclist(wx,wy,axis,faces_pos,color):
    sx,sy=P(wx,wy)
    flip=(axis=="x")!=faces_pos
    return flat_sprite(sx,sy,axis,bike(0,0,.4*ZK,flip=flip,shirt=color),0)

def walker(wx,wy,shirt,hat=None):
    sx,sy=P(wx,wy)
    return person(sx,sy,.33*ZK,shirt=shirt,pants="#2b3556",skin="#b9825c",hat=hat,cap=YEL if hat else None)

def facing_head(wx,wy,z,axis,lit):
    """A signal head that faces along its own road: its face is flat to that road, not to the viewer."""
    p=P(wx,wy,z); s=.27*ZK
    a,bb=(A*.95*s,B*s) if axis=="y" else (A*.95*s,-B*s)   # face on a +y-facing / +x-facing plane
    return f'<g transform="translate({p[0]:.1f},{p[1]:.1f}) matrix({a:.3f},{bb:.3f},0,{s},0,0)">{head(0,0,lit)}</g>'

def mast(px,py,ex,ey,xs,axis,lit,z=300):
    """A mast with an arm that reaches across the lanes it controls; heads hang over each lane."""
    base=P(px,py,0); top=P(px,py,z); arm0=P(px,py,z-20); arm1=P(ex,ey,z-20)
    g=f'<ellipse cx="{base[0]:.1f}" cy="{base[1]:.1f}" rx="26" ry="9" fill="#000" opacity=".18"/>'
    for w,c in ((20,NAVY),(13,"#b6bfcd")):
        g+=f'<line x1="{base[0]:.1f}" y1="{base[1]:.1f}" x2="{top[0]:.1f}" y2="{top[1]:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
    for w,c in ((16,NAVY),(9,"#b6bfcd")):
        g+=f'<line x1="{arm0[0]:.1f}" y1="{arm0[1]:.1f}" x2="{arm1[0]:.1f}" y2="{arm1[1]:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
    for v,lt in zip(xs,lit):
        hx,hy=(px,v) if axis=="x" else (v,py)
        g+=facing_head(hx,hy,z-20,"y" if axis=="y" else "x",lt)
    return g

def scene_intersection():
    b=ground()
    # trees stand in the grass corner, set back from the sidewalk so none stands on a road
    for gx,gy,h in TREE_SPOTS:
        sx,sy=P(gx,gy)
        b+=tree(round(sx),round(sy),h,c="#7fb877",d="#5a9a60")
    # far mast: faces +x, hangs over the lanes of traffic heading -x
    b+=mast(HALF+30,-HALF-30,HALF+30,12,[-LANE*2,-LANE,0],"x",["g","g","g"])
    # pedestrians crossing and a cyclist on the far sidewalk
    b+=walker(-HALF-30,-20,"#4f8fc0")+walker(-40,HALF+30,"#d9532f","beanie")
    b+=cyclist(-330,-ROAD-BIKE/2,"x",False,"#2f7a3f")
    # green road (heading -x): cars driving
    b+=icar(230,-LANE*2,"x",-1,"#e8b83b")+icar(-300,-LANE,"x",-1,"#6c8f5a",suv=True)
    # crossing road (heading -y): cars waiting at the red
    b+=icar(LANE*2,150,"y",-1,BLUE)+icar(LANE*2,290,"y",-1,RED)
    b+=cyclist(ROAD+BIKE/2,420,"y",False,"#e8b83b")
    # near mast: faces +y, over the lanes of traffic heading -y, with the street blades
    b+=mast(HALF+30,HALF+30,12,HALF+30,[LANE*2,LANE,0],"y",["r","r","r"])
    bp=P(HALF+30,HALF+30,278)
    b+=f'<g transform="translate({bp[0]+30:.0f},{bp[1]:.0f})"><rect x="-6" y="0" width="150" height="38" rx="4" fill="#2f7a3f" stroke="{NAVY}" stroke-width="{SW}"/><text x="69" y="26" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="19" fill="#fff">Milwaukee St</text><rect x="-6" y="42" width="150" height="38" rx="4" fill="#2f7a3f" stroke="{NAVY}" stroke-width="{SW}"/><text x="69" y="68" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="19" fill="#fff">Sprecher Rd</text></g>'
    b+=panel(["The signal","is on"],["Built in 2026","Signal trouble?","Tell the City"])
    return b
