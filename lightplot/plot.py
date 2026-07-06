"""Editable light-plot document.

LightingRig (rig.py) is the analyzer's *output* language: lights described
by azimuth/distance around an implied subject. LightPlot is the *editable*
document: absolute plan positions in meters for lights, subjects, camera,
set geometry, and blocking moves. The DOP-language breakdown (azimuth,
"45° camera left") is DERIVED from geometry relative to the primary
subject, so labels stay correct as items are dragged.

Plan coordinates: meters. +x = screen right, +y = screen down (toward the
camera in the default arrangement). Default subject (0,0), camera (0,2.2).
"""
from __future__ import annotations

import json
import math
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional

from .rig import LightSource, LightingRig, ROLE_KEY

PLOT_FORMAT = "lightplot-2"

KIND_WALL = "wall"
KIND_DOOR = "door"
KIND_WINDOW = "window"
KIND_FLAG = "flag"
KIND_FURNITURE = "furniture"
SET_KINDS = (KIND_WALL, KIND_DOOR, KIND_WINDOW, KIND_FLAG, KIND_FURNITURE)

CAMERA_ID = "camera"


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


# ------------------------------------------------------------ geometry
def derived_azimuth_distance(lx: float, ly: float, sx: float, sy: float,
                             cx: float, cy: float) -> tuple:
    """Azimuth (deg, v1 convention: 0 = toward camera, + = camera left)
    and distance (m) of a light at (lx,ly) relative to subject (sx,sy)
    with camera at (cx,cy)."""
    vx, vy = lx - sx, ly - sy
    dist = math.hypot(vx, vy)
    ux, uy = cx - sx, cy - sy
    n = math.hypot(ux, uy)
    if n < 1e-9:
        ux, uy = 0.0, 1.0
    else:
        ux, uy = ux / n, uy / n
    if dist < 1e-9:
        return 0.0, 0.0
    dot = (ux * vx + uy * vy) / dist
    cross = (ux * vy - uy * vx) / dist
    return math.degrees(math.atan2(cross, dot)), dist


def position_from_azimuth(sx: float, sy: float, cx: float, cy: float,
                          azimuth_deg: float, distance_m: float) -> tuple:
    """Inverse of derived_azimuth_distance."""
    ux, uy = cx - sx, cy - sy
    n = math.hypot(ux, uy)
    if n < 1e-9:
        ux, uy = 0.0, 1.0
    else:
        ux, uy = ux / n, uy / n
    a = math.radians(azimuth_deg)
    # rotate the subject->camera unit vector by +azimuth (counter-clockwise
    # in plan coords matches "+ = camera left" in the default arrangement)
    rx = ux * math.cos(a) - uy * math.sin(a)
    ry = ux * math.sin(a) + uy * math.cos(a)
    return sx + rx * distance_m, sy + ry * distance_m


# ------------------------------------------------------------ entities
@dataclass
class PlotLight:
    x: float = 0.0
    y: float = 1.5
    aim_deg: Optional[float] = None   # None = auto-aim at primary subject
    role: str = ROLE_KEY
    elevation_deg: float = 30.0
    softness: float = 0.5
    intensity: float = 1.0
    color_temp_k: int = 5600
    color_hex: str = ""
    modifier: str = ""
    confidence: float = 1.0
    notes: str = ""
    id: str = field(default_factory=_new_id)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Subject:
    name: str = "Subject"
    x: float = 0.0
    y: float = 0.0
    facing_deg: float = 0.0           # 0 = facing camera (default arrangement)
    primary: bool = False
    id: str = field(default_factory=_new_id)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Camera:
    x: float = 0.0
    y: float = 2.2
    aim_deg: float = 0.0              # 0 = aiming up-screen (-y)
    label: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SetElement:
    kind: str = KIND_WALL
    points: List[List[float]] = field(default_factory=list)  # [[x,y], ...]
    label: str = ""
    id: str = field(default_factory=_new_id)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Move:
    target_id: str = ""               # Subject.id or CAMERA_ID
    waypoints: List[List[float]] = field(default_factory=list)
    label: str = ""
    id: str = field(default_factory=_new_id)

    def to_dict(self) -> dict:
        return asdict(self)


def _filtered(cls, d: dict):
    """Construct dataclass from dict, ignoring unknown keys (forward compat)."""
    known = {f for f in cls.__dataclass_fields__}
    return cls(**{k: v for k, v in d.items() if k in known})


# ------------------------------------------------------------ document
@dataclass
class LightPlot:
    name: str = "Untitled Setup"
    notes: str = ""
    mood: str = ""
    summary: str = ""
    key_fill_ratio: str = ""
    ref_image: str = ""
    analyzer: str = "manual"
    lights: List[PlotLight] = field(default_factory=list)
    subjects: List[Subject] = field(default_factory=list)
    camera: Camera = field(default_factory=Camera)
    set_elements: List[SetElement] = field(default_factory=list)
    moves: List[Move] = field(default_factory=list)

    # -- structure ---------------------------------------------------
    def primary_subject(self) -> Subject:
        for s in self.subjects:
            if s.primary:
                return s
        if self.subjects:
            self.subjects[0].primary = True
            return self.subjects[0]
        s = Subject(primary=True)
        self.subjects.append(s)
        return s

    def light_source(self, light: PlotLight) -> LightSource:
        """DOP-language view of one light (azimuth/distance derived)."""
        s = self.primary_subject()
        az, dist = derived_azimuth_distance(light.x, light.y, s.x, s.y,
                                            self.camera.x, self.camera.y)
        return LightSource(
            role=light.role, azimuth_deg=round(az, 1),
            elevation_deg=light.elevation_deg, distance_m=round(dist, 2),
            softness=light.softness, intensity=light.intensity,
            color_temp_k=light.color_temp_k, color_hex=light.color_hex,
            modifier=light.modifier, confidence=light.confidence,
            notes=light.notes)

    def to_rig(self) -> LightingRig:
        return LightingRig(
            lights=[self.light_source(l) for l in self.lights],
            key_fill_ratio=self.key_fill_ratio, mood=self.mood,
            summary=self.summary, source_image=self.ref_image,
            analyzer=self.analyzer)

    @classmethod
    def from_rig(cls, rig: LightingRig, ref_image: str = "") -> "LightPlot":
        plot = cls(
            name=rig.source_image or "Analyzed Setup",
            mood=rig.mood, summary=rig.summary,
            key_fill_ratio=rig.key_fill_ratio,
            ref_image=ref_image or rig.source_image, analyzer=rig.analyzer,
            subjects=[Subject(primary=True)])
        s, c = plot.subjects[0], plot.camera
        for l in rig.lights:
            x, y = position_from_azimuth(s.x, s.y, c.x, c.y,
                                         l.azimuth_deg, l.distance_m)
            plot.lights.append(PlotLight(
                x=round(x, 3), y=round(y, 3), role=l.role,
                elevation_deg=l.elevation_deg, softness=l.softness,
                intensity=l.intensity, color_temp_k=l.color_temp_k,
                color_hex=l.color_hex, modifier=l.modifier,
                confidence=l.confidence, notes=l.notes))
        return plot

    # -- serialization ----------------------------------------------
    def to_dict(self) -> dict:
        return {
            "format": PLOT_FORMAT,
            "name": self.name, "notes": self.notes, "mood": self.mood,
            "summary": self.summary, "key_fill_ratio": self.key_fill_ratio,
            "ref_image": self.ref_image, "analyzer": self.analyzer,
            "lights": [l.to_dict() for l in self.lights],
            "subjects": [s.to_dict() for s in self.subjects],
            "camera": self.camera.to_dict(),
            "set_elements": [e.to_dict() for e in self.set_elements],
            "moves": [m.to_dict() for m in self.moves],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_dict(cls, d: dict) -> "LightPlot":
        plot = cls(
            name=d.get("name", "Untitled Setup"), notes=d.get("notes", ""),
            mood=d.get("mood", ""), summary=d.get("summary", ""),
            key_fill_ratio=d.get("key_fill_ratio", ""),
            ref_image=d.get("ref_image", ""),
            analyzer=d.get("analyzer", "manual"),
            lights=[_filtered(PlotLight, l) for l in d.get("lights", [])],
            subjects=[_filtered(Subject, s) for s in d.get("subjects", [])],
            camera=_filtered(Camera, d.get("camera", {})),
            set_elements=[_filtered(SetElement, e)
                          for e in d.get("set_elements", [])],
            moves=[_filtered(Move, m) for m in d.get("moves", [])])
        return plot

    @classmethod
    def from_json(cls, s: str) -> "LightPlot":
        return cls.from_dict(json.loads(s))
