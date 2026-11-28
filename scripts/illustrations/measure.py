"""Measure text with the real Poppins file when it is installed, so a part can centre what it
holds by the ink the font draws, not by a guess. Without the font, a rough fallback is used."""
import subprocess
from functools import lru_cache

from .settings import *

CAP_EM = .7  # fallback height of capitals and digits, in em


@lru_cache(maxsize=None)
def _font(weight, size):
    try:
        from PIL import ImageFont
        path = subprocess.check_output(["fc-match", "-f", "%{file}", f"Poppins:{weight}"]).decode()
        return ImageFont.truetype(path, size)
    except Exception:
        return None


def has_font():
    """True when the Poppins file is installed, so measures are real and not the fallback."""
    return _font("bold", 10) is not None


def ink_box(text, size, weight="bold"):
    """The ink of `text` as (left, top, right, bottom) relative to the point where its baseline
    starts, in pixels of `size`. Top is negative: ink rises above the baseline."""
    font = _font(weight, max(1, round(size * 4)))  # measured large, then scaled: sub-pixel accuracy
    if font is None:
        return (0, -CAP_EM * size, len(text) * size * GLYPH_EM, 0)
    l, t, r, b = font.getbbox(text, anchor="ls")
    return (l / 4, t / 4, r / 4, b / 4)


def text_width(text, size, weight="bold"):
    """Advance width in pixels: what the panel checks against its edge."""
    font = _font(weight, size)
    return font.getlength(text) if font else len(text) * size * GLYPH_EM
