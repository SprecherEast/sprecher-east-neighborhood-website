from ..parts import *
from ..places import *

def scene_winter():
    b=backdrop(sky_top="#f4f8fb",snow=True)+woods(True)
    b+=conifer(900,742,320,True)+conifer(850,752,240,True)
    b+=real_shelter(20,748,.5,snow=True,smoke=True)
    b+=f'<ellipse cx="560" cy="822" rx="250" ry="52" fill="#cfe6f2" stroke="{NAVY}" stroke-width="{SW}"/><path d="M380,822 Q560,846 740,822" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/>'
    b+=person(450,820,.8,shirt=RED,pants=NAVY,skin="#8d5a3b",hat="beanie",cap="#2f7a3f",arm="wave")
    b+=person(700,828,.7,shirt="#4f8fc0",pants="#2b3556",skin="#b9825c",hat="beanie",cap=YEL)
    # ski trail tracks
    b+=f'<g stroke="#9db7c6" stroke-width="4" fill="none" stroke-linecap="round"><path d="M40,862 Q200,850 380,884"/><path d="M40,878 Q200,866 380,899"/></g>'
    b+=person(300,880,.66,shirt="#e8b83b",pants=NAVY,skin="#a8714f",hat="beanie",cap=RED)
    b+=f'<g stroke="{NAVY}" stroke-width="5" stroke-linecap="round"><line x1="250" y1="884" x2="368" y2="884"/><line x1="268" y1="890" x2="386" y2="890"/></g>'
    random_flakes=[(70*i%900+30,(i*97)%360+200) for i in range(1,26)]
    for fx,fy in random_flakes:
        if fx<260 and fy<200: continue
        b+=f'<circle cx="{fx}" cy="{fy}" r="4" fill="#fff" stroke="{NAVY}" stroke-width="1.5" opacity=".85"/>'
    b+=panel(["Winter at","Door Creek"],["Ice rink","Ski trails","Fireplace pavilion","Open once it is cold"])
    return b
