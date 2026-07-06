"""Classic lighting-setup templates. Each factory returns a fresh LightPlot."""
from __future__ import annotations

from .plot import (LightPlot, PlotLight, Subject, SetElement, Move,
                   KIND_WINDOW, KIND_FLAG, position_from_azimuth)
from .rig import ROLE_KEY, ROLE_FILL, ROLE_RIM, ROLE_BACKGROUND, ROLE_PRACTICAL


def _base(name: str, mood: str) -> LightPlot:
    return LightPlot(name=name, mood=mood, analyzer="template",
                     subjects=[Subject(primary=True)])


def _at(plot: LightPlot, az: float, dist: float, **kw) -> PlotLight:
    s, c = plot.subjects[0], plot.camera
    x, y = position_from_azimuth(s.x, s.y, c.x, c.y, az, dist)
    light = PlotLight(x=round(x, 3), y=round(y, 3), **kw)
    plot.lights.append(light)
    return light


def three_point() -> LightPlot:
    p = _base("Three-Point", "naturalistic")
    _at(p, 45, 1.8, role=ROLE_KEY, softness=0.6, intensity=1.0,
        color_temp_k=5600, modifier="softbox", elevation_deg=35)
    _at(p, -50, 2.2, role=ROLE_FILL, softness=0.85, intensity=0.4,
        color_temp_k=5600, modifier="bounce board", elevation_deg=15)
    _at(p, -150, 2.0, role=ROLE_RIM, softness=0.2, intensity=0.7,
        color_temp_k=5600, modifier="fresnel with barn doors", elevation_deg=45)
    p.key_fill_ratio = "2.5:1"
    p.summary = "Standard three-point: soft key 45° camera left, bounce fill, hard rim."
    return p


def rembrandt() -> LightPlot:
    p = _base("Rembrandt", "moody")
    _at(p, 50, 1.5, role=ROLE_KEY, softness=0.45, intensity=1.0,
        color_temp_k=5600, modifier="medium softbox, high", elevation_deg=45)
    _at(p, -45, 2.4, role=ROLE_FILL, softness=0.9, intensity=0.15,
        color_temp_k=5600, modifier="neg-side ambient only", elevation_deg=10)
    p.key_fill_ratio = "6:1"
    p.summary = "Single high key ~50° off axis for the triangle cheek patch; minimal fill."
    return p


def butterfly() -> LightPlot:
    p = _base("Butterfly / Paramount", "glamour")
    _at(p, 0, 1.6, role=ROLE_KEY, softness=0.55, intensity=1.0,
        color_temp_k=5600, modifier="beauty dish above lens", elevation_deg=55)
    _at(p, 0, 1.2, role=ROLE_FILL, softness=0.9, intensity=0.3,
        color_temp_k=5600, modifier="bounce under lens", elevation_deg=-20)
    p.key_fill_ratio = "3:1"
    p.summary = "Frontal high key over the lens, bounce from below — butterfly shadow."
    return p


def book_light() -> LightPlot:
    p = _base("Book Light", "soft naturalistic")
    _at(p, 55, 2.4, role=ROLE_KEY, softness=0.95, intensity=1.0,
        color_temp_k=5600, modifier="book light (bounce through diffusion)",
        elevation_deg=30)
    _at(p, -40, 2.2, role=ROLE_FILL, softness=0.9, intensity=0.35,
        color_temp_k=5600, modifier="bounce board", elevation_deg=10)
    p.set_elements.append(SetElement(kind=KIND_FLAG,
                                     points=[[-2.6, 1.2], [-2.6, 2.0]],
                                     label="flag / neg fill"))
    p.key_fill_ratio = "3:1"
    p.summary = "Very soft wrapped key via book light; flag controls spill camera right."
    return p


def interview_two_cam() -> LightPlot:
    p = _base("Two-Camera Interview", "interview")
    p.camera.label = "A-cam"
    _at(p, 40, 1.9, role=ROLE_KEY, softness=0.75, intensity=1.0,
        color_temp_k=5600, modifier="4x4 book light", elevation_deg=30)
    _at(p, -55, 2.3, role=ROLE_FILL, softness=0.9, intensity=0.35,
        color_temp_k=5600, modifier="bounce / low soft", elevation_deg=12)
    _at(p, -155, 2.1, role=ROLE_RIM, softness=0.25, intensity=0.6,
        color_temp_k=5600, modifier="tube / hard back", elevation_deg=40)
    _at(p, 178, 3.0, role=ROLE_BACKGROUND, softness=0.6, intensity=0.3,
        color_temp_k=4300, modifier="background slash", elevation_deg=25)
    p.key_fill_ratio = "3:1"
    p.summary = "Interview package: book-light key, soft fill, rim, warm bg slash."
    return p


def day_ext_neg_fill() -> LightPlot:
    p = _base("Day Exterior — Negative Fill", "naturalistic daylight")
    _at(p, 70, 3.2, role=ROLE_KEY, softness=0.8, intensity=1.0,
        color_temp_k=6200, modifier="sun through 8x8 diffusion", elevation_deg=55)
    p.set_elements.append(SetElement(kind=KIND_FLAG,
                                     points=[[1.6, -0.6], [1.6, 0.9]],
                                     label="8x8 neg fill"))
    p.key_fill_ratio = "4:1"
    p.summary = "Diffused sun as key; ratio shaped with negative fill, no added fill."
    return p


def night_int_practical() -> LightPlot:
    p = _base("Night Interior — Motivated Practical", "low-key / dramatic")
    _at(p, 60, 1.1, role=ROLE_PRACTICAL, softness=0.5, intensity=0.6,
        color_temp_k=2400, modifier="practical lamp in frame", elevation_deg=-5)
    _at(p, 75, 2.0, role=ROLE_KEY, softness=0.6, intensity=1.0,
        color_temp_k=2700, modifier="LED through lampshade side (motivated)",
        elevation_deg=25)
    _at(p, -160, 2.6, role=ROLE_RIM, softness=0.3, intensity=0.5,
        color_temp_k=4500, modifier="cool window kicker", elevation_deg=35)
    p.set_elements.append(SetElement(kind=KIND_WINDOW,
                                     points=[[-2.4, -1.8], [-0.8, -1.8]],
                                     label="window"))
    p.key_fill_ratio = "8:1"
    p.summary = "Warm practical motivates the key; cool window rim for separation."
    return p


TEMPLATES = {
    "Three-Point": three_point,
    "Rembrandt": rembrandt,
    "Butterfly / Paramount": butterfly,
    "Book Light": book_light,
    "Two-Camera Interview": interview_two_cam,
    "Day Exterior — Negative Fill": day_ext_neg_fill,
    "Night Interior — Motivated Practical": night_int_practical,
}
