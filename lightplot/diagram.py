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
from .plot import LightPlot, Subject, Move, SetElement, CAMERA_ID, \
    KIND_WALL, KIND_DOOR, KIND_WINDOW, KIND_FLAG, KIND_FURNITURE

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

_SET_STYLE = {
    KIND_WALL: (INK, 5, ""), KIND_DOOR: (DIM, 3, "6 4"),
    KIND_WINDOW: ("#7fb4ff", 5, "10 5"), KIND_FLAG: ("#000000", 7, ""),
}


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


def _to_px(x_m: float, y_m: float) -> Tuple[float, float]:
    return CX + x_m * PX_PER_M, CY + y_m * PX_PER_M


def _beam_at(x, y, tx, ty, light, color):
    """Same wedge math as v1 _beam but aimed at (tx, ty); honors aim_deg."""
    if getattr(light, "aim_deg", None) is not None:
        ang = math.radians(light.aim_deg)
    else:
        ang = math.atan2(ty - y, tx - x)
    half = math.radians(9 + 26 * light.softness)
    reach = math.hypot(tx - x, ty - y) * 0.92 or PX_PER_M
    p1 = (x + reach * math.cos(ang - half), y + reach * math.sin(ang - half))
    p2 = (x + reach * math.cos(ang + half), y + reach * math.sin(ang + half))
    op = 0.10 + 0.16 * light.intensity
    return (f'<path d="M{x:.1f},{y:.1f} L{p1[0]:.1f},{p1[1]:.1f} '
            f'L{p2[0]:.1f},{p2[1]:.1f} Z" fill="{color}" opacity="{op:.2f}"/>')


def _light_icon_at(x, y, tx, ty, light, color):
    """v1 _light_icon aimed at (tx, ty) instead of the module CX,CY."""
    ang = math.degrees(math.atan2(ty - y, tx - x))
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


def _label_at(x, y, tx, ty, src, light, color):
    """v1 _label, pushed away from (tx, ty); numbers read from the derived
    LightSource `src` so the text matches the breakdown panel."""
    tag = ROLE_TAGS.get(src.role, src.role.upper())
    ang = math.atan2(y - ty, x - tx)
    lx, ly = x + 26 * math.cos(ang), y + 26 * math.sin(ang)
    anchor = "start" if lx >= x else "end"
    pct = f"{src.intensity * 100:.0f}%"
    return (
        f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}" fill="{INK}" '
        f'font-size="13" font-weight="700">{_esc(tag)}</text>'
        f'<text x="{lx:.1f}" y="{ly + 15:.1f}" text-anchor="{anchor}" fill="{DIM}" '
        f'font-size="11">{src.color_temp_k}K · {pct} · el {src.elevation_deg:.0f}°</text>')


def _subject_at(s: Subject) -> str:
    x, y = _to_px(s.x, s.y)
    ring = f'stroke="{ACCENT}"' if s.primary else f'stroke="{INK}"'
    return (
        f'<g transform="rotate({s.facing_deg:.1f} {x:.1f} {y:.1f})">'
        f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="30" ry="12" fill="#3a4150" '
        f'{ring} stroke-width="1.5"/>'
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="10" fill="#535d70" '
        f'{ring} stroke-width="1.5"/>'
        f'<circle cx="{x:.1f}" cy="{y + 8:.1f}" r="3" fill="{INK}"/></g>'
        f'<text x="{x:.1f}" y="{y - 24:.1f}" text-anchor="middle" fill="{DIM}" '
        f'font-size="11" letter-spacing="1">{_esc(s.name.upper())}</text>')


def _camera_at(plot: LightPlot) -> str:
    x, y = _to_px(plot.camera.x, plot.camera.y)
    fov = math.radians(24)
    reach = 2.0 * PX_PER_M
    label = plot.camera.label or "CAMERA"
    return (
        f'<g transform="rotate({plot.camera.aim_deg:.1f} {x:.1f} {y:.1f})">'
        f'<path d="M{x},{y} L{x - reach * math.sin(fov):.1f},'
        f'{y - reach * math.cos(fov):.1f} L{x + reach * math.sin(fov):.1f},'
        f'{y - reach * math.cos(fov):.1f} Z" fill="{INK}" opacity="0.06"/>'
        f'<rect x="{x - 16}" y="{y - 10}" width="32" height="22" rx="4" '
        f'fill="#2c313d" stroke="{INK}" stroke-width="1.5"/>'
        f'<rect x="{x - 6}" y="{y - 16}" width="12" height="8" rx="2" '
        f'fill="#2c313d" stroke="{INK}" stroke-width="1.5"/></g>'
        f'<text x="{x}" y="{y + 30}" text-anchor="middle" fill="{DIM}" '
        f'font-size="11" letter-spacing="2">{_esc(label.upper())}</text>')


def _set_element(e: SetElement) -> str:
    if len(e.points) < 2:
        return ""
    pts = [_to_px(px, py) for px, py in e.points]
    parts = []
    if e.kind == KIND_FURNITURE:
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        x, y = min(x1, x2), min(y1, y2)
        parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{abs(x2 - x1):.1f}" '
                     f'height="{abs(y2 - y1):.1f}" fill="none" stroke="{DIM}" '
                     f'stroke-width="2" rx="3"/>')
    else:
        color, wid, dash = _SET_STYLE.get(e.kind, (DIM, 3, ""))
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        parts.append(f'<path d="{d}" fill="none" stroke="{color}" '
                     f'stroke-width="{wid}" stroke-linecap="round"{dash_attr}/>')
        if e.kind == KIND_FLAG:  # white edge so it reads on dark bg
            parts.append(f'<path d="{d}" fill="none" stroke="{INK}" '
                         f'stroke-width="1" stroke-linecap="round"/>')
    if e.label:
        lx, ly = pts[0]
        parts.append(f'<text x="{lx:.1f}" y="{ly - 8:.1f}" fill="{DIM}" '
                     f'font-size="10">{_esc(e.label)}</text>')
    return "".join(parts)


def _move_arrow(m: Move) -> str:
    if len(m.waypoints) < 2:
        return ""
    pts = [_to_px(px, py) for px, py in m.waypoints]
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    parts = [f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="2" '
             f'stroke-dasharray="7 5" marker-end="url(#arrowhead)"/>']
    if m.label:
        mx, my = pts[-1]
        parts.append(f'<text x="{mx + 8:.1f}" y="{my - 6:.1f}" fill="{ACCENT}" '
                     f'font-size="11" font-style="italic">{_esc(m.label)}</text>')
    return "".join(parts)


_DEFS = (f'<defs><marker id="arrowhead" markerWidth="9" markerHeight="7" '
         f'refX="8" refY="3.5" orient="auto"><polygon points="0 0, 9 3.5, 0 7" '
         f'fill="{ACCENT}"/></marker></defs>')


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


def render_plot_svg(plot: LightPlot) -> str:
    s = plot.primary_subject()
    rig = plot.to_rig()                      # derived DOP language for panel
    body = [_DEFS, _grid()]
    for e in plot.set_elements:
        body.append(_set_element(e))
    # beams aim at the primary subject (or explicit light aim)
    sx_px, sy_px = _to_px(s.x, s.y)
    pairs = list(zip(plot.lights, rig.lights))
    pairs.sort(key=lambda p: 1 if p[1].role == ROLE_KEY else 0)
    for pl, src in pairs:
        x, y = _to_px(pl.x, pl.y)
        body.append(_beam_at(x, y, sx_px, sy_px, pl, kelvin_to_hex(pl.color_temp_k)))
    for m in plot.moves:
        body.append(_move_arrow(m))
    for subj in plot.subjects:
        body.append(_subject_at(subj))
    body.append(_camera_at(plot))
    for pl, src in pairs:
        x, y = _to_px(pl.x, pl.y)
        color = kelvin_to_hex(pl.color_temp_k)
        body.append(_light_icon_at(x, y, sx_px, sy_px, pl, color))
        body.append(_label_at(x, y, sx_px, sy_px, src, pl, color))
    body.append(f'<text x="20" y="34" fill="{INK}" font-size="17" '
                f'font-weight="700" letter-spacing="1">GOD\'S-EYE LIGHT PLOT</text>')
    if plot.name:
        body.append(f'<text x="20" y="54" fill="{ACCENT}" font-size="12">'
                    f'{_esc(plot.name)}</text>')
    body.append(_panel(rig))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
            f'viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">'
            + "".join(body) + "</svg>")


def render_svg(rig: LightingRig) -> str:
    return render_plot_svg(LightPlot.from_rig(rig))


def save_svg(rig: LightingRig, path: str) -> str:
    svg = render_svg(rig)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return path
