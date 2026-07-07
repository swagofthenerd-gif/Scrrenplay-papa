"""
Production project model. Wraps the Screenplay plus all production modules
(shot list, call sheets, schedule strips, contacts, budget) into a single
project that serializes to one .slt JSON file.

This is the data layer for the StudioBinder-style tabs. Each module is a plain
list of dict rows so the UI tables can bind to them directly and so the JSON
stays human-readable and forward-compatible.
"""

import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any

from .model import Screenplay


# ---- column schemas (mirror StudioBinder's real fields) ----

SHOT_COLUMNS = [
    "Scene", "Shot #", "Setup", "Subject", "Shot Size", "Camera Angle",
    "Movement", "Equipment", "Lens", "Sound", "Location", "Lighting",
    "Est. Takes", "Time (min)", "Description", "Done",
]

# StudioBinder's standard dropdown vocabularies
SHOT_SIZES = ["EWS", "VWS", "WS", "MWS", "MS", "MCU", "CU", "ECU", "Insert"]
CAMERA_ANGLES = ["Eye Level", "Low Angle", "High Angle", "Overhead",
                 "Dutch Angle", "Over-the-Shoulder", "POV", "Aerial"]
MOVEMENTS = ["Static", "Pan", "Tilt", "Dolly", "Truck", "Pedestal",
             "Zoom", "Rack Focus", "Handheld", "Steadicam", "Crane/Jib",
             "Gimbal", "Tracking"]

CALL_SHEET_FIELDS = [
    "title", "date", "general_call", "shoot_day", "location", "address",
    "nearest_hospital", "weather", "sunrise", "sunset", "notes", "bulletins",
]

SCHEDULE_COLUMNS = [
    "Day", "Scene", "INT/EXT", "Set / Location", "D/N", "Pages",
    "Cast", "Est. Time", "Description",
]

CONTACT_COLUMNS = [
    "Name", "Role", "Department", "Phone", "Email", "Call Time", "Notes",
]
DEPARTMENTS = ["Cast", "Production", "Direction", "Camera", "G&E (Grip/Electric)",
               "Sound", "Art", "Wardrobe", "Hair & Makeup", "Locations",
               "Stunts", "VFX", "Post", "Transport", "Catering"]

BUDGET_COLUMNS = [
    "Category", "Item", "Qty", "Unit", "Rate", "Subtotal", "Notes",
]
BUDGET_CATEGORIES = ["Above the Line", "Production", "Post-Production",
                     "Other / Below the Line"]


# ---- Storyboard: detailed per-frame pre-production spec ----
# A storyboard frame is richer than a shot-list row: it carries the full
# camera package, lens, lighting, grip, sound, and VFX intent for one setup.

STORYBOARD_FIELDS = [
    "scene", "shot", "setup", "frame_image",
    "shot_size", "camera_angle", "movement", "subject", "description",
    "camera_body", "lens", "focal_length", "aperture", "filter",
    "frame_rate", "shutter", "iso", "white_balance", "resolution_codec",
    "support", "lighting_setup", "key_light", "fill_light", "background_light",
    "sound", "vfx", "props", "wardrobe_makeup", "location",
    "est_takes", "est_time_min", "notes",
]

CAMERA_BODIES = ["ARRI Alexa Mini LF", "ARRI Alexa 35", "RED V-Raptor",
                 "RED Komodo", "Sony VENICE 2", "Sony FX6", "Sony FX3",
                 "Blackmagic URSA 12K", "Blackmagic Pocket 6K",
                 "Canon C500 Mk II", "Canon C70", "Panasonic VariCam"]

LENS_SERIES = ["ARRI Signature Prime", "ARRI Master Prime", "ARRI Ultra Prime",
               "Cooke S4/i", "Cooke S7/i", "Cooke Anamorphic/i",
               "Zeiss Supreme Prime", "Zeiss Master Anamorphic",
               "Leica Summilux-C", "Angénieux Optimo Zoom",
               "Sigma Cine Prime", "Canon CN-E Prime", "Vintage / Rehoused"]

FOCAL_LENGTHS = ["12mm", "14mm", "16mm", "18mm", "21mm", "25mm", "27mm",
                 "32mm", "35mm", "40mm", "50mm", "65mm", "75mm", "85mm",
                 "100mm", "135mm", "150mm", "180mm", "Zoom"]

APERTURES = ["T1.3", "T1.4", "T1.8", "T2", "T2.8", "T4", "T5.6", "T8",
             "T11", "T16", "T22"]

FILTERS = ["None", "ND 0.3", "ND 0.6", "ND 0.9", "ND 1.2", "Pola/CPL",
           "Black Pro-Mist 1/8", "Black Pro-Mist 1/4", "Black Pro-Mist 1/2",
           "Glimmerglass", "Diffusion", "Grad ND", "IR ND"]

FRAME_RATES = ["23.976", "24", "25", "29.97", "30", "48", "50", "60",
               "96", "120", "240"]

SHUTTERS = ["45°", "90°", "144°", "172.8°", "180°", "270°", "360°",
            "1/48", "1/50", "1/96", "1/125"]

SUPPORTS = ["Sticks (Tripod)", "Handheld", "Shoulder Rig", "Steadicam",
            "Gimbal (Ronin)", "Dolly", "Dolly + Track", "Jib / Crane",
            "Technocrane", "Car Mount", "Drone", "Slider", "Easyrig",
            "Cable Cam", "Underwater Housing"]

LIGHTING_SETUPS = ["Available / Natural", "Three-Point", "High-Key", "Low-Key",
                   "Motivated Practical", "Soft Wrap", "Hard Light",
                   "Silhouette / Backlit", "Day Exterior (Negative Fill)",
                   "Night Exterior", "Day-for-Night", "Interview"]

LIGHT_UNITS = ["ARRI SkyPanel S60", "ARRI SkyPanel S360", "ARRI M18",
               "ARRI 650 Tungsten", "Aputure 600d", "Aputure 1200d",
               "Aputure 300x", "Astera Titan Tube", "Litemat 4",
               "HMI 1.2K", "HMI 4K", "Quasar Tube", "China Ball",
               "Bounce / Negative Fill", "Practical"]

VFX_TYPES = ["None", "Green Screen", "Blue Screen", "Set Extension",
             "CG Element", "Wire Removal", "Rig Removal", "Cleanup",
             "Compositing", "Motion Tracking", "Crowd Tiling",
             "Muzzle Flash", "Sky Replacement", "Match Move"]

STORYBOARD_DROPDOWNS = {
    "shot_size": SHOT_SIZES, "camera_angle": CAMERA_ANGLES,
    "movement": MOVEMENTS, "camera_body": CAMERA_BODIES,
    "lens": LENS_SERIES, "focal_length": FOCAL_LENGTHS,
    "aperture": APERTURES, "filter": FILTERS, "frame_rate": FRAME_RATES,
    "shutter": SHUTTERS, "support": SUPPORTS,
    "lighting_setup": LIGHTING_SETUPS, "key_light": LIGHT_UNITS,
    "fill_light": LIGHT_UNITS, "background_light": LIGHT_UNITS,
    "vfx": VFX_TYPES,
}


def new_storyboard_frame():
    return {k: "" for k in STORYBOARD_FIELDS}


# ---- Smart-autofill inheritance rules ----
# How each field carries over when a NEW storyboard frame is created.
#
#   "project"   -> copied from the most recent frame anywhere in the project
#                  (one-time project setup: you don't swap camera bodies mid-show)
#   "scene"     -> copied from the previous shot *in the same scene only*
#                  (per-scene setup: lens, lighting, location reset each new scene)
#   "shot"      -> never inherited; unique to each shot
#
# This mirrors a real set: the camera package is locked for the project, the
# lens/lighting/location are dialed in per scene and held across its coverage,
# and the shot size/angle/subject change every setup.

FIELD_INHERITANCE = {
    # project-wide
    "camera_body": "project",
    "resolution_codec": "project",
    # scene-persistent (one-time setup per scene/location)
    "lens": "scene",
    "focal_length": "scene",
    "aperture": "scene",
    "filter": "scene",
    "frame_rate": "scene",
    "shutter": "scene",
    "iso": "scene",
    "white_balance": "scene",
    "support": "scene",
    "lighting_setup": "scene",
    "key_light": "scene",
    "fill_light": "scene",
    "background_light": "scene",
    "location": "scene",
    "wardrobe_makeup": "scene",
    "sound": "scene",
    # everything else (shot_size, camera_angle, movement, subject, description,
    # vfx, props, est_takes, est_time_min, notes, frame_image, scene, shot,
    # setup) is per-shot and never auto-filled.
}


def autofill_frame(storyboard, new_frame, scene_value):
    """Populate empty inherited fields on `new_frame` from prior frames.

    - project-wide fields come from the most recent frame that has a value
      anywhere in the storyboard.
    - scene-persistent fields come from the most recent frame whose 'scene'
      matches `scene_value`.
    Only fills fields that are currently empty on new_frame, so an explicit
    value the user already set is never overwritten. Returns the list of
    field keys that were filled (for UI feedback)."""
    filled = []
    scene_value = str(scene_value).strip()

    def latest_value(field, same_scene):
        for fr in reversed(storyboard):
            if fr is new_frame:
                continue
            if same_scene and str(fr.get("scene", "")).strip() != scene_value:
                continue
            val = fr.get(field, "")
            if val:
                return val
        return ""

    for field, mode in FIELD_INHERITANCE.items():
        if new_frame.get(field):
            continue  # respect an already-set value
        if mode == "project":
            val = latest_value(field, same_scene=False)
        elif mode == "scene":
            if not scene_value:
                continue
            val = latest_value(field, same_scene=True)
        else:
            val = ""
        if val:
            new_frame[field] = val
            filled.append(field)
    return filled


def project_camera_default(storyboard):
    """Return the project's working camera body (most recent non-empty),
    used to keep the body consistent across the project."""
    for fr in reversed(storyboard):
        if fr.get("camera_body"):
            return fr["camera_body"]
    return ""


# ---- Lighting: schematic lighting-diagram / "lighting breakdown" ----
# A lighting plan is a top-down schematic of one setup: a room with a camera,
# a subject, and numbered fixtures (key / fill / back / practical / flags /
# diffusion / ambient). It mirrors the breakdown a DP or gaffer hands off so a
# setup is reproducible — each fixture carries its modifier, intensity and gel,
# and the legend + set notes read straight off what is on the plan.
#
# Positions are stored normalized (0..1) inside the plan area so the diagram is
# resolution-independent and the .slt stays small and human-readable.

FIXTURE_TYPES = {
    "key":       {"label": "Key Light",       "color": "#4d8dff", "aims": True},
    "fill":      {"label": "Fill / Bounce",   "color": "#ffb14d", "aims": True},
    "back":      {"label": "Back / Rim",      "color": "#b07cff", "aims": True},
    "diffusion": {"label": "Diffusion Frame", "color": "#7fd0d8", "aims": False},
    "practical": {"label": "Practical",       "color": "#ffd24d", "aims": False},
    "flag":      {"label": "Neg Fill / Flag", "color": "#4a4a4a", "aims": False},
    "ambient":   {"label": "Ambient / Spill", "color": "#7fd18c", "aims": False},
}
# order fixtures are offered in the toolbar / used for the numbered legend
FIXTURE_ORDER = ["key", "fill", "back", "diffusion", "practical", "flag", "ambient"]

FIXTURE_MODIFIERS = ["Bare", "Fresnel / Spot", "Softbox", "Book Light",
                     "Silk / Diffusion", "Full Grid Cloth", "China Ball / Lantern",
                     "Bounce (Ultrabounce)", "Foam Core / Floppy", "Solid Flag",
                     "Negative Fill", "Grid / Egg Crate", "Snoot", "Umbrella"]

FIXTURE_INTENSITIES = ["Key", "+2 stops", "+1 stop", "-1 stop", "-2 stops",
                       "100%", "75%", "50%", "25%", "10%", "Low fill"]

GELS = ["None", "Full CTO", "1/2 CTO", "1/4 CTO", "Full CTB", "1/2 CTB",
        "1/4 CTB", "Plus Green", "Minus Green", "3200K", "4300K", "5600K",
        "Warm (practical)", "Lavender", "Steel Blue", "Straw"]

CAMERA_HEIGHTS = ["Floor", "Low", "Below eye", "Eye level",
                  "Slightly above eye", "High", "Overhead"]

LIGHTPLAN_FIELDS = ["name", "scene", "shot", "reference_image",
                    "camera_body", "lens", "focal_length", "aperture",
                    "camera_height", "camera_angle", "set_notes"]

# reuse the storyboard vocabularies so a lighting plan speaks the same language
LIGHTPLAN_DROPDOWNS = {
    "camera_body": CAMERA_BODIES, "lens": LENS_SERIES,
    "focal_length": FOCAL_LENGTHS, "aperture": APERTURES,
    "camera_height": CAMERA_HEIGHTS, "camera_angle": CAMERA_ANGLES,
}


def new_fixture(ftype="key", x=0.30, y=0.34):
    return {
        "type": ftype,
        "label": FIXTURE_TYPES.get(ftype, {}).get("label", ftype),
        "unit": "",          # fixture model (from LIGHT_UNITS)
        "modifier": "",      # softbox / bounce / grid cloth …
        "intensity": "",     # relative level or %
        "gel": "",           # colour temp / correction
        "x": float(x), "y": float(y),
        "notes": "",
    }


def new_lightplan(name="Lighting Setup"):
    lp = {k: "" for k in LIGHTPLAN_FIELDS}
    lp["name"] = name
    lp["camera_height"] = "Eye level"
    lp["fixtures"] = []
    # camera at bottom-centre shooting up the plan; subject in the middle
    lp["camera"] = {"x": 0.50, "y": 0.86}
    lp["subject"] = {"x": 0.50, "y": 0.50}
    return lp


# Starter fixture layouts keyed to the storyboard's Lighting Setup names, so
# "Generate from Storyboard" seeds a sensible diagram you then refine.
_STARTER_SETUPS = {
    "Three-Point": [("key", 0.26, 0.30), ("fill", 0.74, 0.40), ("back", 0.58, 0.15)],
    "High-Key": [("key", 0.28, 0.32), ("fill", 0.72, 0.36), ("back", 0.50, 0.15),
                 ("ambient", 0.86, 0.68)],
    "Low-Key": [("key", 0.24, 0.30), ("flag", 0.76, 0.42), ("back", 0.60, 0.15)],
    "Motivated Practical": [("practical", 0.80, 0.28), ("key", 0.28, 0.34),
                            ("fill", 0.70, 0.44)],
    "Soft Wrap": [("key", 0.26, 0.32), ("diffusion", 0.28, 0.20),
                  ("fill", 0.74, 0.42)],
    "Hard Light": [("key", 0.24, 0.24), ("flag", 0.74, 0.44)],
    "Silhouette / Backlit": [("back", 0.50, 0.15), ("flag", 0.28, 0.42),
                             ("flag", 0.72, 0.42)],
    "Day Exterior (Negative Fill)": [("key", 0.30, 0.16), ("flag", 0.74, 0.44),
                                     ("fill", 0.72, 0.62)],
    "Night Exterior": [("key", 0.24, 0.20), ("back", 0.60, 0.15),
                       ("practical", 0.82, 0.30)],
    "Interview": [("key", 0.28, 0.32), ("fill", 0.72, 0.40), ("back", 0.58, 0.15),
                  ("ambient", 0.86, 0.68)],
}


def starter_fixtures(setup_name):
    """Return a list of fixtures seeding a common named setup (empty if the
    name is unknown, e.g. 'Available / Natural')."""
    specs = _STARTER_SETUPS.get((setup_name or "").strip())
    return [new_fixture(t, x, y) for (t, x, y) in specs] if specs else []


def _blank_row(columns):
    return {c: "" for c in columns}


@dataclass
class CallSheet:
    title: str = "Shoot Day 1"
    date: str = ""
    general_call: str = ""
    shoot_day: str = "1 of 1"
    location: str = ""
    address: str = ""
    nearest_hospital: str = ""
    weather: str = ""
    sunrise: str = ""
    sunset: str = ""
    notes: str = ""
    bulletins: str = ""
    # per-call-sheet schedule + crew rows
    schedule: List[Dict[str, Any]] = field(default_factory=list)
    crew: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        cs = cls()
        for k in CALL_SHEET_FIELDS:
            setattr(cs, k, d.get(k, getattr(cs, k)))
        cs.schedule = d.get("schedule", [])
        cs.crew = d.get("crew", [])
        return cs


@dataclass
class Project:
    title: str = "Untitled Production"
    author: str = ""
    screenplay: Screenplay = field(default_factory=Screenplay)
    shots: List[Dict[str, Any]] = field(default_factory=list)
    storyboard: List[Dict[str, Any]] = field(default_factory=list)
    lightplans: List[Dict[str, Any]] = field(default_factory=list)
    schedule: List[Dict[str, Any]] = field(default_factory=list)
    contacts: List[Dict[str, Any]] = field(default_factory=list)
    budget: List[Dict[str, Any]] = field(default_factory=list)
    call_sheets: List[CallSheet] = field(default_factory=list)

    # ---------- serialization ----------
    def to_dict(self):
        return {
            "format": "scrivenlight-project-2",
            "title": self.title,
            "author": self.author,
            "screenplay": self.screenplay.to_dict(),
            "shots": self.shots,
            "storyboard": self.storyboard,
            "lightplans": self.lightplans,
            "schedule": self.schedule,
            "contacts": self.contacts,
            "budget": self.budget,
            "call_sheets": [cs.to_dict() for cs in self.call_sheets],
        }

    @classmethod
    def from_dict(cls, d):
        p = cls(title=d.get("title", "Untitled Production"),
                author=d.get("author", ""))
        # screenplay may be nested (new) or be the whole doc (old format)
        if "screenplay" in d:
            p.screenplay = Screenplay.from_dict(d["screenplay"])
        elif "blocks" in d:  # legacy single-screenplay file
            p.screenplay = Screenplay.from_dict(d)
            p.title = d.get("title", p.title)
        p.shots = d.get("shots", [])
        p.storyboard = d.get("storyboard", [])
        p.lightplans = d.get("lightplans", [])
        p.schedule = d.get("schedule", [])
        p.contacts = d.get("contacts", [])
        p.budget = d.get("budget", [])
        p.call_sheets = [CallSheet.from_dict(c) for c in d.get("call_sheets", [])]
        return p

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    @classmethod
    def load(cls, path: str):
        with open(path, "r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    # ---------- helpers ----------
    def contact_names(self):
        return [c.get("Name", "") for c in self.contacts if c.get("Name", "").strip()]

    def cast_names(self):
        return [c.get("Name", "") for c in self.contacts
                if c.get("Name", "").strip() and c.get("Department", "") == "Cast"]

    def new_shot(self):
        return _blank_row(SHOT_COLUMNS)

    def new_schedule_strip(self):
        return _blank_row(SCHEDULE_COLUMNS)

    def new_contact(self):
        return _blank_row(CONTACT_COLUMNS)

    def new_budget_line(self):
        return _blank_row(BUDGET_COLUMNS)

    def new_lightplan(self, name="Lighting Setup"):
        return new_lightplan(name)

    def merge_lightplans_from_storyboard(self):
        """Create a lighting plan for each storyboard frame not already
        represented (keyed by scene/shot), seeding the camera package and a
        starter fixture layout from the frame's Lighting Setup. Returns the
        number of plans added."""
        existing = {(str(lp.get("scene", "")).strip(), str(lp.get("shot", "")).strip())
                    for lp in self.lightplans}
        added = 0
        for fr in self.storyboard:
            key = (str(fr.get("scene", "")).strip(), str(fr.get("shot", "")).strip())
            if key in existing:
                continue
            subj = fr.get("subject", "") or fr.get("location", "") or "Setup"
            lp = new_lightplan(
                f"Sc {fr.get('scene', '?')} / Sh {fr.get('shot', '?')} — {subj}")
            lp["scene"] = fr.get("scene", "")
            lp["shot"] = fr.get("shot", "")
            lp["reference_image"] = fr.get("frame_image", "")
            lp["camera_body"] = fr.get("camera_body", "")
            lp["lens"] = fr.get("lens", "")
            lp["focal_length"] = fr.get("focal_length", "")
            lp["aperture"] = fr.get("aperture", "")
            lp["camera_angle"] = fr.get("camera_angle", "")
            lp["fixtures"] = starter_fixtures(fr.get("lighting_setup", ""))
            self.lightplans.append(lp)
            existing.add(key)
            added += 1
        return added

    def generate_shots_from_script(self):
        """Create one placeholder shot row per scene heading, like
        StudioBinder's 'import script -> shot list per scene'."""
        from .elements import ElementType
        rows = []
        scene_no = 0
        for b in self.screenplay.blocks:
            if b.etype() == ElementType.SCENE_HEADING:
                scene_no += 1
                r = _blank_row(SHOT_COLUMNS)
                r["Scene"] = str(scene_no)
                r["Shot #"] = "1"
                r["Subject"] = b.text.strip()
                r["Location"] = b.text.strip()
                rows.append(r)
        return rows

    def merge_shots_from_script(self):
        """Add a shot row only for scenes not already represented in the shot
        list. Returns the number of rows added. Prevents the duplicate-on-
        re-click footgun."""
        existing = {str(r.get("Scene", "")).strip()
                    for r in self.shots if str(r.get("Scene", "")).strip()}
        added = 0
        for r in self.generate_shots_from_script():
            if r["Scene"] not in existing:
                self.shots.append(r)
                existing.add(r["Scene"])
                added += 1
        return added

    def merge_schedule_from_script(self):
        """Add a strip only for scenes not already scheduled. Returns count."""
        existing = {str(r.get("Scene", "")).strip()
                    for r in self.schedule if str(r.get("Scene", "")).strip()}
        added = 0
        for r in self.generate_schedule_from_script():
            if r["Scene"] not in existing:
                self.schedule.append(r)
                existing.add(r["Scene"])
                added += 1
        return added

    def generate_schedule_from_script(self):
        """One strip per scene, pulling INT/EXT and D/N from the heading."""
        from .elements import ElementType
        rows = []
        scene_no = 0
        for b in self.screenplay.blocks:
            if b.etype() == ElementType.SCENE_HEADING:
                scene_no += 1
                head = b.text.strip().upper()
                ie = "INT" if head.startswith("INT") else \
                     ("EXT" if head.startswith("EXT") else "")
                dn = ""
                for token, val in (("DAY", "D"), ("NIGHT", "N"),
                                   ("DAWN", "D"), ("DUSK", "N"),
                                   ("MORNING", "D"), ("EVENING", "N")):
                    if token in head:
                        dn = val
                        break
                # location = between prefix and last " - "
                loc = head
                for p in ("INT./EXT.", "INT.", "EXT.", "EST.", "I/E."):
                    if loc.startswith(p):
                        loc = loc[len(p):].strip()
                        break
                if " - " in loc:
                    loc = loc.rsplit(" - ", 1)[0].strip()
                r = _blank_row(SCHEDULE_COLUMNS)
                r.update({"Day": "1", "Scene": str(scene_no), "INT/EXT": ie,
                          "Set / Location": loc, "D/N": dn,
                          "Description": b.text.strip()})
                rows.append(r)
        return rows
