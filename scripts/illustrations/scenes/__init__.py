"""Every scene, by name. A new scene is one function that returns SVG (backdrop, drawing, then a
`panel(...)` call) plus one line here."""
from .school import scene_school
from .signal import scene_intersection
from .siren import scene_siren
from .police import scene_police
from .street_days import scene_trash, scene_leaves
from .winter import scene_winter
from .parking import scene_parking
from .marimba import scene_marimba
from .workshop import scene_workshop
from .thanksgiving import scene_thanksgiving
from .dropoff import scene_dropoff
from .youth import scene_youth
from .pickup_day import scene_thanksgiving_pickup
from .pantry import scene_thanksgiving_pantry
from .unloading import scene_dropoff_unload
from .entrance import scene_dropoff_entrance
from .mural import scene_youth_mural
from .garden import scene_youth_garden

SCENES = {
    "school": scene_school,
    "signal": scene_intersection,
    "siren": scene_siren,
    "police": scene_police,
    "trash": scene_trash,
    "leaves": scene_leaves,
    "winter": scene_winter,
    "parking": scene_parking,
    "marimba": scene_marimba,
    "workshop": scene_workshop,
    "thanksgiving": scene_thanksgiving,
    "dropoff": scene_dropoff,
    "youth": scene_youth,
    "thanksgiving_pickup": scene_thanksgiving_pickup,
    "thanksgiving_pantry": scene_thanksgiving_pantry,
    "dropoff_unload": scene_dropoff_unload,
    "dropoff_entrance": scene_dropoff_entrance,
    "youth_mural": scene_youth_mural,
    "youth_garden": scene_youth_garden,
}
