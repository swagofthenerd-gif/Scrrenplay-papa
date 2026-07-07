"""Parametric lighting-rig model.

A LightingRig is the common language between every part of lightplot:
analyzers (heuristic CV or Claude vision) produce one, the diagram
renderer draws one, and the GUI displays one. It is JSON-serializable so
rigs can be saved into project files (e.g. ScrivenLight's .slt).

Conventions
-----------
azimuth_deg   : horizontal angle of the light around the subject, seen from
                above. 0 = directly at the camera position (frontal light),
                positive = camera LEFT, negative = camera RIGHT,
                +/-180 = directly behind the subject (backlight).
elevation_deg : 0 = subject eye level, 90 = directly overhead, negative = below.
distance_m    : approximate distance from subject in meters (plausible value,
                not forensic — distance is ill-posed from a single image).
softness      : 0.0 = hard point source (bare bulb, fresnel spot, direct sun)
                1.0 = very soft wrapping source (big book light, overcast sky).
intensity     : relative output 0..1, key light normalized to 1.0.
color_temp_k  : correlated color temperature in Kelvin (3200 tungsten,
                5600 daylight, etc.).
confidence    : analyzer's confidence 0..1 that this light exists as described.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional

ROLE_KEY = "key"
ROLE_FILL = "fill"
ROLE_RIM = "rim"
ROLE_BACKGROUND = "background"
ROLE_PRACTICAL = "practical"

ROLES = (ROLE_KEY, ROLE_FILL, ROLE_RIM, ROLE_BACKGROUND, ROLE_PRACTICAL)


@dataclass
class LightSource:
    role: str = ROLE_KEY
    azimuth_deg: float = 45.0
    elevation_deg: float = 30.0
    distance_m: float = 1.5
    softness: float = 0.5
    intensity: float = 1.0
    color_temp_k: int = 5600
    color_hex: str = ""            # dominant gel/tint if not neutral, e.g. "#ff9944"
    modifier: str = ""             # suggested modifier: "softbox", "fresnel", "bounce"...
    confidence: float = 0.5
    notes: str = ""

    def position_label(self) -> str:
        """Human phrasing of the position, in set language."""
        a = self.azimuth_deg
        if abs(a) < 15:
            horiz = "frontal (on camera axis)"
        elif abs(a) > 150:
            horiz = "directly behind subject"
        else:
            side = "camera left" if a > 0 else "camera right"
            horiz = f"{abs(a):.0f}° {side}"
            if abs(a) > 100:
                horiz += " (behind subject)"
        e = self.elevation_deg
        if e >= 60:
            vert = "toplight"
        elif e >= 35:
            vert = "high"
        elif e >= 12:
            vert = "slightly above eye line"
        elif e > -12:
            vert = "eye level"
        else:
            vert = "below eye line (uplight)"
        return f"{horiz}, {vert} (~{e:.0f}°)"

    def softness_label(self) -> str:
        s = self.softness
        if s < 0.25:
            return "hard"
        if s < 0.5:
            return "medium-hard"
        if s < 0.75:
            return "soft"
        return "very soft"

    def ct_label(self) -> str:
        k = self.color_temp_k
        if k < 2400:
            return f"{k}K (candle/warm practical)"
        if k < 3800:
            return f"{k}K (tungsten)"
        if k < 5000:
            return f"{k}K (warm daylight / mixed)"
        if k < 6500:
            return f"{k}K (daylight)"
        return f"{k}K (cool / shade / moonlight look)"


@dataclass
class LightingRig:
    """A complete, reproducible lighting setup for one image."""
    lights: List[LightSource] = field(default_factory=list)
    key_fill_ratio: str = ""       # e.g. "4:1"
    mood: str = ""                 # e.g. "low-key dramatic"
    summary: str = ""              # a short DOP-readable paragraph
    source_image: str = ""
    analyzer: str = "heuristic"    # which backend produced this rig

    # -- convenience -------------------------------------------------
    def key(self) -> Optional[LightSource]:
        for l in self.lights:
            if l.role == ROLE_KEY:
                return l
        return None

    # -- serialization ----------------------------------------------
    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_dict(cls, d: dict) -> "LightingRig":
        lights = [LightSource(**l) for l in d.get("lights", [])]
        rest = {k: v for k, v in d.items() if k != "lights"}
        return cls(lights=lights, **rest)

    @classmethod
    def from_json(cls, s: str) -> "LightingRig":
        return cls.from_dict(json.loads(s))
