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
