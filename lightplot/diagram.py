"""God's-eye (overhead) set-diagram renderer.

Takes a LightingRig and produces a self-contained SVG: subject at
center, camera at the bottom, each light placed on the floor plan at its
azimuth/distance with a beam wedge aimed at the subject, colored by its
color temperature and sized by softness, plus a breakdown panel in DOP
language. Pure-Python string assembly — no dependencies — so the same
renderer works in the desktop app, a CLI, or a future web export.
"""
from __future__ import annotations

import html
import math
from typing import List, Tuple

from .rig import LightingRig, LightSource, ROLE_KEY, ROLE_FILL, ROLE_RIM

W, H = 980, 660
PLAN_W = 640
CX, CY = PLAN_W / 2, 308.0          # subject position on the plan
PX_PER_M = 78.0
CAM_DIST = 2.2                       # camera drawn 2.2 "meters" from subject

BG = "#14161c"
PANEL_BG = "#1b1e27"
GRID = "#242833"
INK = "#e8e6df"
DIM = "#9aa0ad"
ACCENT = "#e0a458"

ROLE_TAGS = {ROLE_KEY: "KEY", ROLE_FILL: "FILL", ROLE_RIM: "RIM/BACK",
             "background": "BG", "practical": "PRAC"}


def kelvin_to_hex(k: int) -> str:
    """Rough blackbody tint for diagram color-coding."""
    if k <= 2400:
        return "#ff9d4d"
    if k <= 3400:
        return "#ffb46b"
    if k <= 4600:
        return "#ffd6a0"
    if k <= 6000:
        return "#fff3dd"
    if k <= 7500:
        return "#dbe7ff"
    return "#aac4ff"


def _light_xy(light: LightSource) -> Tuple[float, float]:
    """Plan position. Azimuth 0 = at camera (bottom), + = camera left (screen left)."""
    a = math.radians(light.azimuth_deg)
    r = max(0.7, min(light.distance_m, 3.4)) * PX_PER_M
    return CX - r * math.sin(a), CY + r * math.cos(a)


def _esc(s: str) -> str:
    return html.escape(s, quote=True)


def _beam(x: float, y: float, light: LightSource, color: str) -> str:
    """Wedge from the light toward the subject; wider = softer."""
    ang = math.atan2(CY - y, CX - x)
    half = math.radians(9 + 26 * light.softness)
    reach = math.hypot(CX - x, CY - y) * 0.92
    p1 = (x + reach * math.cos(ang - half), y + reach * math.sin(ang - half))
    p2 = (x + reach * math.cos(ang + half), y + reach * math.sin(ang + half))
    op = 0.10 + 0.16 * light.intensity
    return (f'<path d="M{x:.1f},{y:.1f} L{p1[0]:.1f},{p1[1]:.1f} '
            f'L{p2[0]:.1f},{p2[1]:.1f} Z" fill="{color}" opacity="{op:.2f}"/>')


def _light_icon(x: float, y: float, light: LightSource, color: str) -> str:
    """Softbox = rounded rect, hard source = circle with rays, oriented at subject."""
    ang = math.degrees(math.atan2(CY - y, CX - x))
    size = 11 + 13 * light.softness
    parts = []
    if light.softness >= 0.4:
        parts.append(
            f'<g transform="rotate({ang + 90:.1f} {x:.1f} {y:.1f})">'
            f'<rect x="{x - size / 2:.1f}" y="{y - 5:.1f}" width="{size:.1f}" '
            f'height="10" rx="3" fill="{color}" stroke="{BG}" stroke-width="1.5"/></g>')
    else:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="{color}" '
                     f'stroke="{BG}" stroke-width="1.5"/>')
        for i in range(8):
            ra = math.radians(i * 45)
            parts.append(
                f'<line x1="{x + 10 * math.cos(ra):.1f}" y1="{y + 10 * math.sin(ra):.1f}" '
                f'x2="{x + 15 * math.cos(ra):.1f}" y2="{y + 15 * math.sin(ra):.1f}" '
                f'stroke="{color}" stroke-width="2" stroke-linecap="round"/>')
    return "".join(parts)


def _label(x: float, y: float, light: LightSource, color: str) -> str:
    tag = ROLE_TAGS.get(light.role, light.role.upper())
    # push label away from the subject so it doesn't sit on the beam
    ang = math.atan2(y - CY, x - CX)
    lx, ly = x + 26 * math.cos(ang), y + 26 * math.sin(ang)
    anchor = "start" if lx >= x else "end"
    pct = f"{light.intensity * 100:.0f}%"
    return (
        f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}" fill="{INK}" '
        f'font-size="13" font-weight="700">{_esc(tag)}</text>'
        f'<text x="{lx:.1f}" y="{ly + 15:.1f}" text-anchor="{anchor}" fill="{DIM}" '
        f'font-size="11">{light.color_temp_k}K · {pct} · el {light.elevation_deg:.0f}°</text>')


def _subject() -> str:
    """Top-down person: head circle + shoulder bar facing camera (down)."""
    return (
        f'<ellipse cx="{CX}" cy="{CY}" rx="30" ry="12" fill="#3a4150" '
        f'stroke="{INK}" stroke-width="1.5"/>'
        f'<circle cx="{CX}" cy="{CY}" r="10" fill="#535d70" stroke="{INK}" '
        f'stroke-width="1.5"/>'
        f'<circle cx="{CX}" cy="{CY + 8}" r="3" fill="{INK}"/>'
        f'<text x="{CX}" y="{CY - 24}" text-anchor="middle" fill="{DIM}" '
        f'font-size="11" letter-spacing="1">SUBJECT</text>')


def _camera() -> str:
    x, y = CX, CY + CAM_DIST * PX_PER_M
    fov = math.radians(24)
    reach = CAM_DIST * PX_PER_M * 0.9
    p1 = (x - reach * math.sin(fov), y - reach * math.cos(fov))
    p2 = (x + reach * math.sin(fov), y - reach * math.cos(fov))
    return (
        f'<path d="M{x},{y} L{p1[0]:.1f},{p1[1]:.1f} L{p2[0]:.1f},{p2[1]:.1f} Z" '
        f'fill="{INK}" opacity="0.06"/>'
        f'<rect x="{x - 16}" y="{y - 10}" width="32" height="22" rx="4" '
        f'fill="#2c313d" stroke="{INK}" stroke-width="1.5"/>'
        f'<rect x="{x - 6}" y="{y - 16}" width="12" height="8" rx="2" '
        f'fill="#2c313d" stroke="{INK}" stroke-width="1.5"/>'
        f'<text x="{x}" y="{y + 30}" text-anchor="middle" fill="{DIM}" '
        f'font-size="11" letter-spacing="2">CAMERA</text>')


def _grid() -> str:
    parts = [f'<rect x="0" y="0" width="{PLAN_W}" height="{H}" fill="{BG}"/>']
    step = PX_PER_M / 2  # half-meter grid
    x = CX
    while x > 0:
        for gx in (x, 2 * CX - x):
            parts.append(f'<line x1="{gx:.1f}" y1="0" x2="{gx:.1f}" y2="{H}" '
                         f'stroke="{GRID}" stroke-width="1"/>')
        x -= step
    y = CY
    while y > -H:
        for gy in (y, 2 * CY - y):
            if 0 <= gy <= H:
                parts.append(f'<line x1="0" y1="{gy:.1f}" x2="{PLAN_W}" y2="{gy:.1f}" '
                             f'stroke="{GRID}" stroke-width="1"/>')
        y -= step
    # meter rings around subject
    for m in (1, 2, 3):
        parts.append(f'<circle cx="{CX}" cy="{CY}" r="{m * PX_PER_M:.1f}" fill="none" '
                     f'stroke="{GRID}" stroke-width="1" stroke-dasharray="3 5"/>')
        parts.append(f'<text x="{CX + m * PX_PER_M + 4:.1f}" y="{CY - 4}" fill="{GRID}" '
                     f'font-size="10">{m}m</text>')
    return "".join(parts)


def _wrap(text: str, width: int) -> List[str]:
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        if len(cur) + len(w_) + 1 > width and cur:
            lines.append(cur)
            cur = w_
        else:
            cur = f"{cur} {w_}".strip()
    if cur:
        lines.append(cur)
    return lines


def _panel(rig: LightingRig) -> str:
    x0 = PLAN_W
    parts = [
        f'<rect x="{x0}" y="0" width="{W - x0}" height="{H}" fill="{PANEL_BG}"/>',
        f'<text x="{x0 + 20}" y="38" fill="{INK}" font-size="18" font-weight="700">'
        f'Lighting Breakdown</text>',
        f'<text x="{x0 + 20}" y="58" fill="{ACCENT}" font-size="12">'
        f'{_esc(rig.mood)} · key/fill {_esc(rig.key_fill_ratio)}</text>',
    ]
    y = 84
    for light in rig.lights:
        color = kelvin_to_hex(light.color_temp_k)
        tag = ROLE_TAGS.get(light.role, light.role.upper())
        parts.append(f'<circle cx="{x0 + 26}" cy="{y - 4}" r="5" fill="{color}"/>')
        parts.append(f'<text x="{x0 + 38}" y="{y}" fill="{INK}" font-size="13" '
                     f'font-weight="700">{_esc(tag)}'
                     f'<tspan fill="{DIM}" font-weight="400"> · conf {light.confidence:.0%}</tspan></text>')
        y += 16
        for line in (
            light.position_label(),
            f"{light.softness_label()} · {_esc(light.modifier)}",
            f"{light.ct_label()} · {light.intensity * 100:.0f}% · ~{light.distance_m:.1f}m",
        ):
            parts.append(f'<text x="{x0 + 38}" y="{y}" fill="{DIM}" font-size="11">'
                         f'{_esc(line)}</text>')
            y += 14
        y += 10
    y = max(y + 6, H - 130)
    parts.append(f'<line x1="{x0 + 20}" y1="{y - 16}" x2="{W - 20}" y2="{y - 16}" '
                 f'stroke="{GRID}" stroke-width="1"/>')
    for line in _wrap(rig.summary, 52)[:7]:
        parts.append(f'<text x="{x0 + 20}" y="{y}" fill="{DIM}" font-size="11" '
                     f'font-style="italic">{_esc(line)}</text>')
        y += 14
    parts.append(f'<text x="{x0 + 20}" y="{H - 14}" fill="#5b6270" font-size="10">'
                 f'lightplot · analyzer: {_esc(rig.analyzer)}'
                 + (f' · {_esc(rig.source_image)}' if rig.source_image else '')
                 + '</text>')
    return "".join(parts)


def render_svg(rig: LightingRig) -> str:
    body = [_grid()]
    # beams under icons, key drawn last so it reads on top
    ordered = sorted(rig.lights, key=lambda l: 1 if l.role == ROLE_KEY else 0)
    for light in ordered:
        x, y = _light_xy(light)
        color = kelvin_to_hex(light.color_temp_k)
        body.append(_beam(x, y, light, color))
    body.append(_subject())
    body.append(_camera())
    for light in ordered:
        x, y = _light_xy(light)
        color = kelvin_to_hex(light.color_temp_k)
        body.append(_light_icon(x, y, light, color))
        body.append(_label(x, y, light, color))
    body.append(f'<text x="20" y="34" fill="{INK}" font-size="17" font-weight="700" '
                f'letter-spacing="1">GOD\'S-EYE LIGHT PLOT</text>')
    body.append(_panel(rig))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">'
        + "".join(body) + "</svg>")


def save_svg(rig: LightingRig, path: str) -> str:
    svg = render_svg(rig)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return path
