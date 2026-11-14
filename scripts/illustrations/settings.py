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

# The card overlays a date badge here on events: keep it empty in every picture.
CLEAR_ZONE = (0, 0, 230, 170)

# Line work
OUTLINE_WIDTH = 3

# Palette
NAVY = "#1f2a44"; MINT = "#e6f0e6"; HILL1 = "#d6e8d1"; HILL2 = "#c6ddc0"
GROUND = "#cfe3c9"; GROUND2 = "#bcd6b4"
CREAM = "#f5ede1"; GREEN = "#2f7a3f"; RED = "#d9532f"; BLUE = "#4f8fc0"
TAN = "#d9b27c"; YEL = "#f2b632"; GLASS = "#bcd9e8"
