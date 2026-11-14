"""Every scene, by name. A new scene is one function that returns SVG (backdrop, drawing, then a
`panel(...)` call) plus one line here."""
from .school import scene_school
from .signal import scene_intersection
from .siren import scene_siren
from .police import scene_police
from .street_days import scene_trash, scene_leaves
from .winter import scene_winter

SCENES = {
    "school": scene_school,
    "signal": scene_intersection,
    "siren": scene_siren,
    "police": scene_police,
    "trash": scene_trash,
    "leaves": scene_leaves,
    "winter": scene_winter,
}
