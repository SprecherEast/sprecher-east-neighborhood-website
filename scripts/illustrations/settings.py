"""Named settings for every illustration. Change a size here, never inside a scene.

The picture is a drawn scene on the left and a large cream text panel on the right. The panel is
sized for a phone: its text stays this large, and a scene never gets a smaller panel to fit more
words. A fixed setting, not a per-picture choice.
"""

# Canvas (pixels). Exported JPGs are 1670 px wide.
W, H = 1600, 900
EXPORT_WIDTH = 1670

# Scene: the drawn part. It fills the canvas behind the panel; this is the width left visible.
PANEL_X = 945
SCENE_WIDTH = PANEL_X

# Scene scale: one multiplier for everything drawn in the scene (people, bicycles, trees, cars,
# carts, the shelter). 1 is the approved size; the panel and the canvas never change with it.
SCENE_SCALE = 1

# Text panel
PANEL_W = 620
TITLE_SIZE = 66
TITLE_LINE = 80
BULLET_SIZE = 44
BULLET_LINE = 74
PANEL_PAD = 40          # inner padding on the left
PANEL_RIGHT_MARGIN = 24 # text may not come closer than this to the panel's right edge
BULLET_INDENT = 48      # bullet text starts this far in from the panel's left edge
GLYPH_EM = 0.53         # fallback glyph width in em when the font cannot be measured
PANEL_MAX_HEIGHT = H - 80

# The card overlays a date badge on an event's picture, top left. Measured on the live events page
# at desktop width (the narrowest card, so the largest share of the picture): 12 px in from each
# edge and 64 px square, about 26% of the width and 45% of the height. In canvas pixels, left,
# top, right, bottom, with a little to spare.
CLEAR_ZONE = (0, 0, 420, 420)
# The pictures of events: nothing of the drawn scene may reach into CLEAR_ZONE (build.py checks).
# Posts have no badge, so their scenes are not listed here and use the whole canvas.
EVENT_SCENES = ("marimba", "workshop")
# How an event's scene is drawn so it clears the badge: scaled by this, anchored at the bottom
# right corner of the scene, which moves it down and to the right, away from the badge.
EVENT_SCENE_SCALE = 0.72

# Line work
OUTLINE_WIDTH = 3

# Palette
NAVY = "#1f2a44"; MINT = "#e6f0e6"; HILL1 = "#d6e8d1"; HILL2 = "#c6ddc0"
GROUND = "#cfe3c9"; GROUND2 = "#bcd6b4"
CREAM = "#f5ede1"; GREEN = "#2f7a3f"; RED = "#d9532f"; BLUE = "#4f8fc0"
TAN = "#d9b27c"; YEL = "#f2b632"; GLASS = "#bcd9e8"; BROWN = "#a8714f"

# Skin tones for people, lightest first. A crowd mixes the lighter and the darker ones about evenly.
SKIN_LIGHTEST = "#f0d6b0"; SKIN_LIGHT = "#d09a73"; SKIN_MID = "#b9825c"; SKIN_DARK = "#a8714f"; SKIN_DARKEST = "#8d5a3b"

# Rules the build checks by itself (checks.py). Parts register what they draw (parts.place), and
# these named values decide what fails. Change one here, never in a scene.
#
# Real size each kind of part stands for, in metres, as a (smallest, largest) range of the one
# dimension the part measures (people and trees their height, cars and trucks their length, and so
# on). A scene has one scale if some pixels-per-metre fits every part in it at once.
REAL_SIZE_M = {
    "person": (1.5, 1.95), "child": (1.0, 1.5), "car": (4.0, 5.3), "cart": (0.95, 1.2),
    "bike": (1.5, 2.0), "tree": (3, 22), "building": (3, 14), "bin": (1.0, 2.6), "bed": (0.3, 0.8),
}
# The safe area: nothing registered comes closer to an edge than this, and nothing runs behind the panel.
SAFE_MARGIN = 40
# Largest empty band across the safe area, as a share of its width or height. Beyond it the
# content is not balanced in its frame.
DEAD_BAND_MAX = 0.20
# Kinds that do not fill a frame: a calendar page floating in empty sky is a label, not content.
# Bleeding surfaces count toward balance only when their kind is a building (a facade rising out of
# the frame is the scene); the road and the ground never do.
LABEL_KINDS = ("calendar",)
FILLING_BLEED_KINDS = ("building",)
# The focal subject is at least this share of the safe area and of its height, and is never a person
# or a tree. A subject that lies low under open sky, or is a small thing in a big frame, fails.
FOCAL_MIN_SHARE = 0.25
FOCAL_MIN_HEIGHT = 0.30
# Layouts count as repeated at this overlap (0 to 1) of what sits where, on a 6 by 4 grid.
LAYOUT_REPEAT_MAX = 0.5
# Scenes of one real place that may share a layout, as tuples of scene names.
SAME_PLACE = ()
# Pictures drawn before these rules. The checks skip them until one is redrawn, then its name leaves
# this list. `build --audit` shows what each would fail.
PRE_RULES_SCENES = (
    "school", "signal", "siren", "police", "trash", "leaves", "winter", "parking", "marimba",
    "workshop", "thanksgiving", "dropoff", "youth",
)

# Text inside a part (calendar page, sign board): its ink is centred in the area meant for it within
# this share of the area's width and height, and keeps at least TEXT_MIN_PAD of the area's shorter
# side clear of every edge of that area.
TEXT_CENTER_TOL = 0.03
TEXT_MIN_PAD = 0.08
