from ..parts import *
from ..places import *
import math
LEAFC=["#d98a3c","#e8b83b","#c4562f","#e2a032","#b64329"]

def leaf(cx,cy,r,rot,col):
    return (f'<g transform="translate({cx:.1f},{cy:.1f}) rotate({rot})"><path d="M0,{-r} Q{r*.95},{-r*.25} 0,{r} Q{-r*.95},{-r*.25} 0,{-r} Z" fill="{col}" stroke="{NAVY}" stroke-width="2.2" stroke-linejoin="round"/>'
            f'<path d="M0,{-r*.7} L0,{r*1.25}" stroke="{NAVY}" stroke-width="2" fill="none" stroke-linecap="round"/></g>')

def mound(x,y,w,h,uid,seed=1):
    d=f'M{x-w/2},{y} C{x-w/2},{y-h*.95} {x-w*.22},{y-h} {x},{y-h} C{x+w*.22},{y-h} {x+w/2},{y-h*.95} {x+w/2},{y} Z'
    g=f'<ellipse cx="{x}" cy="{y+4}" rx="{w*.62}" ry="12" fill="#000" opacity=".14"/>'
    g+=f'<clipPath id="m{uid}"><path d="{d}"/></clipPath><path d="{d}" fill="#c4762b"/><g clip-path="url(#m{uid})">'
    n=0
    for row in range(7):
        for col in range(9):
            n+=1
            lx=x-w/2+(col+.5*(row%2))*w/8.2+((n*37+seed*11)%14)-7
            ly=y-6-row*h/6.6+((n*53+seed*7)%10)-5
            g+=leaf(lx,ly,15,((n*67+seed*13)%140)-70,LEAFC[(n+seed)%5])
    g+='</g>'+f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
    for i in range(5):
        sx=x+((i*91+seed*40)%int(w*1.5))-w*.75; sy=y+8+((i*29)%12)
        g+=leaf(sx,sy,12,(i*57)%160-80,LEAFC[(i+seed)%5])
    return g

def bag(x,y):
    g=f'<ellipse cx="{x}" cy="{y+4}" rx="62" ry="9" fill="#000" opacity=".14"/>'
    g+=f'<path d="M{x-52},{y} L{x-44},{y-150} L{x+44},{y-150} L{x+52},{y} Z" fill="#d9c7a0" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
    g+=f'<path d="M{x-52},{y} L{x-44},{y-150} L{x-20},{y-150} L{x-26},{y} Z" fill="#fff" opacity=".16"/>'
    for i,(dx,dy,c) in enumerate(((-28,-158,0),(0,-170,1),(26,-160,2),(-10,-182,3),(14,-150,4))):
        g+=leaf(x+dx,y+dy,16,(i*47)%90-45,LEAFC[c])
    g+=f'<path d="M{x-44},{y-150} L{x+44},{y-150}" stroke="{NAVY}" stroke-width="{SW}"/>'
    return g

def rake_between(tx,ty,hx,hy):
    ang=math.degrees(math.atan2(hy-ty,hx-tx))
    return (f'<line x1="{tx}" y1="{ty}" x2="{hx+(hx-tx)*.35}" y2="{hy+(hy-ty)*.35}" stroke="#8b5e3c" stroke-width="9" stroke-linecap="round"/>'
            f'<g transform="translate({tx},{ty}) rotate({ang+90})" stroke="{NAVY}" stroke-width="3" stroke-linecap="round"><path d="M-30,0 L30,0" stroke="#8c96a8" stroke-width="8"/>'
            +"".join(f'<path d="M{k},0 L{k},22" stroke="#8c96a8" stroke-width="5"/>' for k in (-26,-13,0,13,26))+'</g>')

def falling(pts):
    return "".join(leaf(x,y,13,r,LEAFC[i%5]) for i,(x,y,r) in enumerate(pts))

def street(top,sidew=46):
    return (f'<rect x="-10" y="{top}" width="1700" height="{sidew}" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/>')

def scene_trash():
    b=grass()
    b+=street(640,50)+f'<rect x="-10" y="690" width="1700" height="220" fill="#34405f" stroke="{NAVY}" stroke-width="{SW}"/><path d="M0,800 L1700,800" stroke="{YEL}" stroke-width="5" stroke-dasharray="40 26"/>'
    b+=tree(135,640,540)
    b+=cart(300,690,"#2b3556","#1f2a44",1.5)+cart(470,690,BLUE,"#3b7aa5",1.5,True)
    b+=calendar_page(615,330,"NOV","26")
    b+=roast_turkey(730,676,.8)
    b+=panel(["Trash days","move"],["Thu. moves to Wed.","Fri. moves to Mon.","Drop-offs closed","Thursday and Friday"])
    return b

def scene_leaves():
    b=grass()
    b+=street(650,40)+f'<rect x="-10" y="690" width="1700" height="54" fill="#bcd6b4" stroke="{NAVY}" stroke-width="{SW}"/><rect x="-10" y="744" width="1700" height="14" fill="#d8dde6" stroke="{NAVY}" stroke-width="{SW}"/><rect x="-10" y="758" width="1700" height="150" fill="#34405f" stroke="{NAVY}" stroke-width="{SW}"/><path d="M0,840 L1700,840" stroke="{YEL}" stroke-width="5" stroke-dasharray="40 26"/>'
    b+=tree(150,650,500,c="#e2a032",d="#c4762b")+tree(480,650,450,c="#d9583a",d="#b64329")+tree(790,650,410,c="#e8b83b",d="#d0902c")
    b+=mound(270,732,300,150,"a",1)+mound(650,732,260,130,"b",2)+bag(840,736)
    b+=person(460,740,.95,shirt="#4f8fc0",pants="#2b3556",skin="#a8714f",hat="beanie",cap=RED)
    b+=rake_between(395,732,445,625)
    b+=falling(((200,360,30),(350,300,-20),(560,330,50),(700,400,-40),(300,470,20),(620,500,-30),(880,430,40)))
    b+=panel(["Leaf pickup"],["Three rounds","Ends early December","Pile on the terrace","Not in the street"])
    return b
