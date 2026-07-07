# lightplot v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn lightplot from a view-only image analyzer into a full DOP tool: an interactive god's-eye editor (drag lights/subjects/camera, set geometry, movement arrows), three ways to start a plot (analyze image / template / describe in text), storyboard attachment inside ScrivenLight `.slt` projects, and SVG/PNG/side-by-side/PDF-contact-sheet exports.

**Architecture:** `LightingRig` (rig.py) stays untouched as the analyzer output language. A new editable document `LightPlot` (plot.py) holds absolute-plan-meter positions for lights, subjects, camera, set elements, and moves; DOP-language azimuth/distance is *derived* relative to the primary subject. The Qt editor (QGraphicsScene) and the SVG renderer both draw from `LightPlot`. Spec: `docs/superpowers/specs/2026-07-06-lightplot-v2-design.md`.

**Tech Stack:** Python 3.14, PyQt6 (QGraphicsScene, QUndoStack, QPdfWriter, QtSvg), Pillow + numpy (analysis), optional `anthropic` (Claude backends), pytest.

## Global Constraints

- No new runtime dependencies beyond what `requirements.txt` already lists (`PyQt6>=6.6`, `Pillow>=10.0`, `numpy>=1.26`, optional `anthropic`). `pytest` is dev-only.
- v1 public API must keep working verbatim: `analyze(path, backend=)`, `analyze_image()`, `render_svg(rig)`, `save_svg(rig, path)`, CLI `python -m lightplot image.jpg [-o] [--json] [--backend] [--gui]`.
- Coordinate convention (from spec): plan meters, `+x` = screen right, `+y` = screen down toward camera. Default primary subject at `(0, 0)`, camera at `(0, 2.2)`. Azimuth identity with v1: `x = -r·sin(az)`, `y = r·cos(az)` in the default arrangement; general derived azimuth is the signed angle from the subject→camera unit vector to the subject→light vector.
- `.slt` forward-compatibility: absent `light_plot` key on a storyboard frame = no plot; malformed plot data must never block project load.
- ScrivenLight autofill fills `lighting_setup`, `key_light`, `fill_light`, `background_light` **only where currently empty**.
- All GUI tests run headless: `QT_QPA_PLATFORM=offscreen`.
- Run tests from repo root: `python3 -m pytest tests/ -v`.
- Git commits in this repo use `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit …` (repo has no local identity configured; this matches all prior commits).
- Editor guards: cannot delete the last subject or the camera; deleting a subject deletes its moves and reassigns primary if needed.
- Version bump to `0.2.0` happens in the final task only.

---

### Task 1: Environment setup + analyzer verification with regression tests

The spec's phase 1: prove the existing pipeline works before building on it. numpy and pytest are currently **not installed** (verified 2026-07-06), so the heuristic analyzer crashes on import today — the app is broken out of the box.

**Files:**
- Create: `tests/__init__.py` (empty)
- Create: `tests/conftest.py`
- Create: `tests/test_analyze.py`
- Create: `tests/test_cli.py`

**Interfaces:**
- Consumes: `lightplot.analyze.analyze_image(path_or_image, source_name="") -> LightingRig`, `lightplot.rig.LightingRig.from_json/to_json`, CLI `python -m lightplot`.
- Produces: `tests/conftest.py::synthetic_portrait(key_side, softness)` fixture-helper used by later tasks.

- [ ] **Step 1: Install dev/runtime deps**

```bash
pip3 install --user numpy pytest
python3 -c "import numpy, pytest; print('ok')"
```
Expected: `ok`

- [ ] **Step 2: Write conftest with a synthetic-portrait generator**

`tests/conftest.py`:

```python
"""Shared test helpers: controlled synthetic images with known lighting."""
import math

import numpy as np
from PIL import Image


def synthetic_portrait(key_side: str = "left", softness: float = 0.5,
                       ratio: float = 4.0, size: int = 256) -> Image.Image:
    """Render a fake 'lit sphere on dark background' portrait.

    key_side: 'left' or 'right' — the bright side OF THE IMAGE.
    softness: 0..1 — controls shading falloff steepness.
    ratio:    bright/dark luminance ratio on the subject.
    """
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    cx = cy = (size - 1) / 2.0
    r = size * 0.32
    d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / r ** 2
    sphere = d2 < 1.0

    # Lambertian-ish shading from a light on one side, above eye line.
    lx = -1.0 if key_side == "left" else 1.0
    nx = (xx - cx) / r
    ny = (yy - cy) / r
    lam = np.clip(nx * lx * -1.0 + ny * -0.4 + 0.55, 0.0, 1.6)
    # softness flattens the curve (soft light wraps)
    gamma = 2.4 - 1.8 * softness
    shade = np.clip(lam, 0, 1) ** gamma
    lo = 1.0 / ratio
    shade = lo + (1.0 - lo) * shade

    img = np.full((size, size, 3), 0.06)          # dark background
    for c in range(3):
        img[..., c][sphere] = shade[sphere]
    img[..., 2] *= 0.92                            # slightly warm
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGB")
```

`tests/__init__.py`: empty file.

- [ ] **Step 3: Write analyzer regression tests**

`tests/test_analyze.py`:

```python
import json

import pytest

from lightplot.analyze import analyze_image
from lightplot.rig import LightingRig, ROLE_KEY
from tests.conftest import synthetic_portrait


def key_of(rig):
    return next(l for l in rig.lights if l.role == ROLE_KEY)


def test_key_direction_left_lit_image():
    # bright IMAGE-LEFT => light from camera LEFT => positive azimuth (v1 convention)
    rig = analyze_image(synthetic_portrait(key_side="left", ratio=6.0))
    assert key_of(rig).azimuth_deg > 10


def test_key_direction_right_lit_image():
    rig = analyze_image(synthetic_portrait(key_side="right", ratio=6.0))
    assert key_of(rig).azimuth_deg < -10


def test_softness_ordering():
    soft = analyze_image(synthetic_portrait(softness=0.9, ratio=2.0))
    hard = analyze_image(synthetic_portrait(softness=0.1, ratio=8.0))
    assert key_of(soft).softness > key_of(hard).softness


def test_ratio_ordering():
    flat = analyze_image(synthetic_portrait(ratio=1.5))
    contrasty = analyze_image(synthetic_portrait(ratio=10.0))
    flat_r = float(flat.key_fill_ratio.split(":")[0])
    con_r = float(contrasty.key_fill_ratio.split(":")[0])
    assert con_r > flat_r


def test_rig_json_round_trip():
    rig = analyze_image(synthetic_portrait())
    rig2 = LightingRig.from_json(rig.to_json())
    assert rig2.to_dict() == rig.to_dict()
    assert json.loads(rig.to_json())["analyzer"] == "heuristic"


def test_every_light_has_confidence_and_valid_role():
    rig = analyze_image(synthetic_portrait())
    from lightplot.rig import ROLES
    for l in rig.lights:
        assert l.role in ROLES
        assert 0.0 <= l.confidence <= 1.0
```

- [ ] **Step 4: Write CLI smoke test**

`tests/test_cli.py`:

```python
import subprocess
import sys

from tests.conftest import synthetic_portrait


def test_cli_writes_svg_and_json(tmp_path):
    img = tmp_path / "still.png"
    synthetic_portrait().save(img)
    svg = tmp_path / "plot.svg"
    rig_json = tmp_path / "rig.json"
    res = subprocess.run(
        [sys.executable, "-m", "lightplot", str(img), "-o", str(svg),
         "--json", str(rig_json), "--backend", "heuristic"],
        capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    assert svg.read_text().startswith("<svg")
    assert '"lights"' in rig_json.read_text()
```

- [ ] **Step 5: Run the tests**

```bash
cd /home/shaharyar/Scrrenplay-papa && python3 -m pytest tests/ -v
```
Expected: all PASS. If any analyzer assertion fails, that is a real v1 bug: use the superpowers:systematic-debugging skill — reproduce with the failing synthetic image, find root cause in `analyze.py`, fix minimally, re-run. Do not loosen a test tolerance without understanding *why* the analyzer misses it.

- [ ] **Step 6: Commit**

```bash
git add tests/ && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "test: analyzer regression suite on synthetic images + CLI smoke test"
```

---

### Task 2: `LightPlot` data model

**Files:**
- Create: `lightplot/plot.py`
- Test: `tests/test_plot.py`

**Interfaces:**
- Consumes: `lightplot.rig.LightSource`, `LightingRig`, role constants.
- Produces (used by every later task):
  - `PlotLight(x, y, aim_deg=None, role, elevation_deg, softness, intensity, color_temp_k, color_hex, modifier, confidence, notes, id)`
  - `Subject(id, name, x, y, facing_deg, primary)`
  - `Camera(x, y, aim_deg, label)`
  - `SetElement(id, kind, points, label)` with kind constants `KIND_WALL/KIND_DOOR/KIND_WINDOW/KIND_FLAG/KIND_FURNITURE`
  - `Move(id, target_id, waypoints, label)`
  - `LightPlot(name, notes, mood, summary, key_fill_ratio, ref_image, analyzer, lights, subjects, camera, set_elements, moves)`
  - `LightPlot.from_rig(rig, ref_image="") -> LightPlot`
  - `LightPlot.primary_subject() -> Subject`
  - `LightPlot.light_source(light: PlotLight) -> LightSource` (derived azimuth/distance)
  - `LightPlot.to_dict()/from_dict()/to_json()/from_json()`; `to_dict()["format"] == "lightplot-2"`
  - `derived_azimuth_distance(lx, ly, sx, sy, cx, cy) -> tuple[float, float]`
  - `position_from_azimuth(sx, sy, cx, cy, azimuth_deg, distance_m) -> tuple[float, float]`

- [ ] **Step 1: Write failing tests**

`tests/test_plot.py`:

```python
import math

import pytest

from lightplot.analyze import analyze_image
from lightplot.plot import (LightPlot, PlotLight, Subject, Camera, SetElement,
                            Move, KIND_WALL, KIND_WINDOW,
                            derived_azimuth_distance, position_from_azimuth)
from lightplot.rig import ROLE_KEY, ROLE_FILL
from tests.conftest import synthetic_portrait


def test_azimuth_position_round_trip():
    # default arrangement: subject (0,0), camera (0, 2.2)
    for az in (0.0, 45.0, -45.0, 90.0, -135.0, 179.0):
        for dist in (0.8, 1.5, 3.0):
            x, y = position_from_azimuth(0, 0, 0, 2.2, az, dist)
            az2, d2 = derived_azimuth_distance(x, y, 0, 0, 0, 2.2)
            assert az2 == pytest.approx(az, abs=0.01)
            assert d2 == pytest.approx(dist, abs=0.001)


def test_azimuth_identity_with_v1_convention():
    # azimuth 0 = at camera position (below subject on plan): +y
    x, y = position_from_azimuth(0, 0, 0, 2.2, 0.0, 1.5)
    assert (x, y) == (pytest.approx(0.0), pytest.approx(1.5))
    # positive azimuth = camera left = screen LEFT (negative x), as in diagram.py
    x, y = position_from_azimuth(0, 0, 0, 2.2, 90.0, 1.5)
    assert x == pytest.approx(-1.5)
    assert y == pytest.approx(0.0, abs=1e-9)


def test_azimuth_follows_moved_camera():
    # camera moved to the LEFT of the subject; light between them reads frontal
    az, _ = derived_azimuth_distance(-1.0, 0.0, 0.0, 0.0, -2.0, 0.0)
    assert az == pytest.approx(0.0, abs=0.01)


def test_from_rig_places_lights_and_defaults():
    rig = analyze_image(synthetic_portrait(key_side="left"))
    plot = LightPlot.from_rig(rig, ref_image="still.png")
    assert plot.ref_image == "still.png"
    assert len(plot.lights) == len(rig.lights)
    assert len(plot.subjects) == 1 and plot.subjects[0].primary
    assert plot.camera.y == pytest.approx(2.2)
    # derived azimuth of each placed light matches the rig's original
    for pl, rl in zip(plot.lights, rig.lights):
        src = plot.light_source(pl)
        assert src.azimuth_deg == pytest.approx(rl.azimuth_deg, abs=0.1)
        assert src.distance_m == pytest.approx(rl.distance_m, abs=0.01)
        assert src.softness == rl.softness


def test_json_round_trip_full_document():
    plot = LightPlot(name="Sc 12A — CU Sarah")
    plot.lights.append(PlotLight(x=-1.0, y=0.5, role=ROLE_KEY))
    plot.lights.append(PlotLight(x=1.2, y=0.8, role=ROLE_FILL, intensity=0.3))
    plot.subjects.append(Subject(name="Sarah", x=0, y=0, primary=True))
    plot.set_elements.append(SetElement(kind=KIND_WALL, points=[[-3, -2], [3, -2]]))
    plot.set_elements.append(SetElement(kind=KIND_WINDOW, points=[[-1, -2], [1, -2]]))
    plot.moves.append(Move(target_id=plot.subjects[0].id,
                           waypoints=[[0, 0], [-2, -1]], label="crosses to window"))
    d = plot.to_dict()
    assert d["format"] == "lightplot-2"
    plot2 = LightPlot.from_dict(d)
    assert plot2.to_dict() == d
    assert LightPlot.from_json(plot.to_json()).to_dict() == d


def test_primary_subject_fallbacks():
    plot = LightPlot()
    assert plot.primary_subject() is not None          # auto-created default
    plot2 = LightPlot(subjects=[Subject(name="A"), Subject(name="B", primary=True)])
    assert plot2.primary_subject().name == "B"


def test_from_dict_tolerates_unknown_keys():
    d = LightPlot().to_dict()
    d["future_field"] = 123
    d["lights"] = [{**PlotLight().to_dict(), "future": 1}]
    plot = LightPlot.from_dict(d)                       # must not raise
    assert len(plot.lights) == 1
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
python3 -m pytest tests/test_plot.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'lightplot.plot'`

- [ ] **Step 3: Implement `lightplot/plot.py`**

```python
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
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
python3 -m pytest tests/test_plot.py tests/ -v
```
Expected: all PASS (including Task 1's suite — no regressions).

- [ ] **Step 5: Commit**

```bash
git add lightplot/plot.py tests/test_plot.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: LightPlot editable document model with derived DOP-language geometry"
```

---

### Task 3: Templates

**Files:**
- Create: `lightplot/templates.py`
- Test: `tests/test_templates.py`

**Interfaces:**
- Consumes: `LightPlot`, `PlotLight`, `Subject`, `SetElement`, kind constants, `position_from_azimuth`.
- Produces: `TEMPLATES: dict[str, Callable[[], LightPlot]]` — ordered mapping of display name → zero-arg factory. Names (exact): `"Three-Point"`, `"Rembrandt"`, `"Butterfly / Paramount"`, `"Book Light"`, `"Two-Camera Interview"`, `"Day Exterior — Negative Fill"`, `"Night Interior — Motivated Practical"`.

- [ ] **Step 1: Write failing tests**

`tests/test_templates.py`:

```python
from lightplot.plot import LightPlot
from lightplot.rig import ROLE_KEY
from lightplot.templates import TEMPLATES


def test_expected_templates_present():
    assert list(TEMPLATES) == [
        "Three-Point", "Rembrandt", "Butterfly / Paramount", "Book Light",
        "Two-Camera Interview", "Day Exterior — Negative Fill",
        "Night Interior — Motivated Practical"]


def test_every_template_is_valid_plot():
    for name, factory in TEMPLATES.items():
        plot = factory()
        assert isinstance(plot, LightPlot)
        assert plot.name == name
        assert sum(1 for s in plot.subjects if s.primary) == 1
        assert plot.lights, name
        assert LightPlot.from_json(plot.to_json()).to_dict() == plot.to_dict()


def test_three_point_has_key_at_45_camera_left():
    plot = TEMPLATES["Three-Point"]()
    key = next(l for l in plot.lights if l.role == ROLE_KEY)
    src = plot.light_source(key)
    assert 30 <= src.azimuth_deg <= 60
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_templates.py -v
```
Expected: FAIL — `No module named 'lightplot.templates'`

- [ ] **Step 3: Implement `lightplot/templates.py`**

```python
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
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_templates.py tests/ -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lightplot/templates.py tests/test_templates.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: classic lighting-setup templates as LightPlot factories"
```

---

### Task 4: Renderer for `LightPlot` (blocking, set elements, moves)

**Files:**
- Modify: `lightplot/diagram.py` (extend; keep all existing helpers)
- Modify: `lightplot/__init__.py` (export `render_plot_svg`, `LightPlot`)
- Test: `tests/test_diagram.py`

**Interfaces:**
- Consumes: `LightPlot` and its entities; existing helpers `kelvin_to_hex`, `_beam`, `_light_icon`, `_label`, `_camera`-style drawing, `_grid`, `_panel`.
- Produces:
  - `render_plot_svg(plot: LightPlot) -> str` — full diagram with subjects/camera at real positions, walls/doors/windows/flags/furniture, move arrows.
  - `render_svg(rig: LightingRig) -> str` — **unchanged signature**, now implemented as `render_plot_svg(LightPlot.from_rig(rig))`.
  - `_to_px(x_m: float, y_m: float) -> tuple[float, float]` module helper: `(CX + x_m*PX_PER_M, CY + y_m*PX_PER_M)`.

- [ ] **Step 1: Write failing tests**

`tests/test_diagram.py`:

```python
from lightplot.analyze import analyze_image
from lightplot.diagram import render_svg, render_plot_svg
from lightplot.plot import (LightPlot, PlotLight, Subject, SetElement, Move,
                            KIND_WALL, KIND_WINDOW, KIND_FURNITURE)
from lightplot.templates import TEMPLATES
from tests.conftest import synthetic_portrait


def test_v1_render_svg_still_works():
    rig = analyze_image(synthetic_portrait())
    svg = render_svg(rig)
    assert svg.startswith("<svg") and svg.endswith("</svg>")
    assert "GOD'S-EYE LIGHT PLOT" in svg
    assert "KEY" in svg


def test_plot_renders_subjects_at_positions():
    plot = LightPlot(subjects=[Subject(name="Sarah", x=-1.0, y=0.0, primary=True),
                               Subject(name="Tom", x=1.0, y=0.0)])
    plot.lights.append(PlotLight(x=0, y=1.0))
    svg = render_plot_svg(plot)
    assert "SARAH" in svg.upper() and "TOM" in svg.upper()


def test_plot_renders_set_elements_and_moves():
    plot = TEMPLATES["Night Interior — Motivated Practical"]()
    plot.moves.append(Move(target_id=plot.subjects[0].id,
                           waypoints=[[0, 0], [-1.5, -1.0]],
                           label="crosses to window"))
    svg = render_plot_svg(plot)
    assert "window" in svg
    assert "crosses to window" in svg
    assert "marker" in svg or "arrow" in svg  # arrowhead present


def test_all_templates_render():
    for name, factory in TEMPLATES.items():
        svg = render_plot_svg(factory())
        assert svg.startswith("<svg"), name
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_diagram.py -v
```
Expected: FAIL — `cannot import name 'render_plot_svg'`

- [ ] **Step 3: Implement in `lightplot/diagram.py`**

Add after the existing imports (`from .plot import ...`) and keep every existing function. New/changed code:

```python
from .plot import LightPlot, Subject, Move, SetElement, CAMERA_ID, \
    KIND_WALL, KIND_DOOR, KIND_WINDOW, KIND_FLAG, KIND_FURNITURE


def _to_px(x_m: float, y_m: float):
    return CX + x_m * PX_PER_M, CY + y_m * PX_PER_M


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


_SET_STYLE = {
    KIND_WALL: (INK, 5, ""), KIND_DOOR: (DIM, 3, "6 4"),
    KIND_WINDOW: ("#7fb4ff", 5, "10 5"), KIND_FLAG: ("#000000", 7, ""),
}


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
```

Refactor the three position-dependent v1 helpers into `_at`-suffixed versions that take an explicit target instead of the module constants, then re-express the originals through them so v1 keeps working:

```python
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
```

The old `_beam`, `_light_icon`, `_label`, `_subject`, `_camera` module-level functions become unused once `render_svg` delegates — delete them (the `_at` versions fully replace them).

Finally replace `render_svg` with the wrapper (keep `save_svg` as is):

```python
def render_svg(rig: LightingRig) -> str:
    return render_plot_svg(LightPlot.from_rig(rig))
```

And in `lightplot/__init__.py` add:

```python
from .plot import LightPlot
from .diagram import render_plot_svg
```
plus `"LightPlot", "render_plot_svg"` in `__all__`.

- [ ] **Step 4: Run full suite**

```bash
python3 -m pytest tests/ -v
```
Expected: all PASS, including Task 1's CLI test (proves the v1 wrapper is faithful).

- [ ] **Step 5: Visual spot-check**

```bash
python3 - <<'EOF'
from lightplot.templates import TEMPLATES
from lightplot.diagram import render_plot_svg
for name, f in TEMPLATES.items():
    open(f"/tmp/{name.replace('/', '-').replace(' ', '_')}.svg", "w").write(render_plot_svg(f()))
print("wrote /tmp/*.svg — open a couple in a browser and eyeball them")
EOF
```
Look at two or three: lights placed sanely, labels legible, window/flag visible in the night-interior and book-light plots.

- [ ] **Step 6: Commit**

```bash
git add lightplot/diagram.py lightplot/__init__.py tests/test_diagram.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: render LightPlot diagrams — blocking, set elements, move arrows; keep v1 render_svg"
```

---

### Task 5: Claude describe-to-setup backend

**Files:**
- Modify: `lightplot/claude_backend.py`
- Test: `tests/test_describe.py`

**Interfaces:**
- Consumes: existing `_RIG_SCHEMA`, `MODEL`, `claude_available()`.
- Produces: `describe_to_rig(description: str) -> LightingRig` — raises `RuntimeError` with a clear message when the backend is unavailable.

- [ ] **Step 1: Write failing tests (mocked API)**

`tests/test_describe.py`:

```python
import json
from unittest import mock

import pytest

from lightplot.rig import LightingRig


FAKE_PAYLOAD = {
    "lights": [{"role": "key", "azimuth_deg": 60.0, "elevation_deg": 20.0,
                "distance_m": 1.8, "softness": 0.4, "intensity": 1.0,
                "color_temp_k": 2700, "color_hex": "", "modifier": "LED panel",
                "confidence": 0.8, "notes": "motivated by practical"}],
    "key_fill_ratio": "8:1", "mood": "low-key",
    "summary": "Warm low-key single source."}


def test_describe_to_rig_parses_response(monkeypatch):
    anthropic = pytest.importorskip("anthropic")
    from lightplot import claude_backend

    block = mock.Mock(type="text", text=json.dumps(FAKE_PAYLOAD))
    client = mock.Mock()
    client.messages.create.return_value = mock.Mock(content=[block])
    monkeypatch.setattr(claude_backend, "claude_available", lambda: True)
    with mock.patch.object(claude_backend.anthropic_module(), "Anthropic",
                           return_value=client):
        rig = claude_backend.describe_to_rig("warm low-key night interior")
    assert isinstance(rig, LightingRig)
    assert rig.lights[0].color_temp_k == 2700
    assert rig.analyzer.startswith("claude")
    # the description must be in the request
    sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert any("night interior" in c.get("text", "") for c in sent)


def test_describe_raises_cleanly_when_unavailable(monkeypatch):
    from lightplot import claude_backend
    monkeypatch.setattr(claude_backend, "claude_available", lambda: False)
    with pytest.raises(RuntimeError, match="not available"):
        claude_backend.describe_to_rig("anything")
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_describe.py -v
```
Expected: `test_describe_raises_cleanly_when_unavailable` FAILS with `AttributeError: ... no attribute 'describe_to_rig'`; the first test SKIPS if `anthropic` isn't installed (fine — the unavailable-path test still exercises the guard).

- [ ] **Step 3: Implement in `lightplot/claude_backend.py`**

Append:

```python
_DESCRIBE_PROMPT = """You are a director of photography designing a lighting \
setup from a verbal brief so it can be drawn as a god's-eye light plot and \
built on set.

Design a practical, buildable rig for the described look. Use the same \
conventions as lighting analysis:
- azimuth_deg: 0 = light at camera (frontal), positive = camera LEFT, \
negative = camera RIGHT, +/-180 = behind subject.
- elevation_deg: 0 = eye level, 90 = overhead, negative = below.
- distance_m: plausible distance in meters.
- softness: 0 = hard point source, 1 = very large soft source.
- intensity: relative output, key = 1.0.
- color_temp_k / color_hex: CCT, hex only for a strong gel.
- modifier: the actual unit and modifier you'd order.
- confidence: your confidence this source serves the brief.

List every source including practicals and negative fill notes. \
key_fill_ratio like "4:1". Summary: 2-3 sentences of DOP language.

The brief:
"""


def anthropic_module():
    """Indirection point so tests can patch the SDK without importing it
    at module load (the package is optional)."""
    import anthropic
    return anthropic


def describe_to_rig(description: str) -> LightingRig:
    """Draft a LightingRig from a verbal description of the look."""
    if not claude_available():
        raise RuntimeError(
            "Claude backend is not available: install the 'anthropic' package "
            "and provide an API credential to use describe-to-setup.")
    client = anthropic_module().Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        output_config={"format": {"type": "json_schema", "schema": _RIG_SCHEMA}},
        messages=[{"role": "user",
                   "content": [{"type": "text",
                                "text": _DESCRIBE_PROMPT + description}]}])
    text = next(b.text for b in response.content if b.type == "text")
    payload = json.loads(text)
    return LightingRig(
        lights=[LightSource(**l) for l in payload["lights"]],
        key_fill_ratio=payload["key_fill_ratio"], mood=payload["mood"],
        summary=payload["summary"], source_image="",
        analyzer=f"claude ({MODEL})")
```

Also refactor `analyze_with_claude` to use `anthropic_module().Anthropic()` instead of its local `import anthropic` + `anthropic.Anthropic()` so both paths share the indirection.

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_describe.py tests/ -v
```
Expected: PASS (or first test SKIPPED without `anthropic`, second PASS).

- [ ] **Step 5: Commit**

```bash
git add lightplot/claude_backend.py tests/test_describe.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: describe-to-setup — Claude drafts a LightingRig from a verbal brief"
```

---

### Task 6: Undo commands + interactive canvas (scene, items, drag)

**Files:**
- Create: `lightplot/commands.py`
- Create: `lightplot/canvas.py`
- Test: `tests/test_canvas.py`

**Interfaces:**
- Consumes: `LightPlot` and entities; `kelvin_to_hex` from diagram.
- Produces (used by Tasks 7–8):
  - `commands.MoveItemCommand(scene, kind, obj_id, old_xy, new_xy)`
  - `commands.AddObjectCommand(scene, kind, obj)` / `RemoveObjectCommand(scene, kind, obj_id)`
  - `commands.EditFieldCommand(scene, kind, obj_id, field, old, new)`
  - `canvas.PlotScene(QGraphicsScene)` with: `.plot: LightPlot`, `.undo_stack: QUndoStack`, `.set_plot(plot)`, `.sync()` (rebuild items from model), `.find_model(kind, obj_id)`, signal `plotChanged` (emitted after any command), signal `selectionTarget(kind: str, obj_id: str)` on selection change, `.METER_PX = 78.0`.
  - `canvas.PlotView(QGraphicsView)` with wheel zoom, `fit()`.
  - Item `kind` strings used everywhere: `"light"`, `"subject"`, `"camera"`, `"set"`, `"move"`, `"plot"` (the last for document-level fields).

- [ ] **Step 1: Write failing tests**

`tests/test_canvas.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.canvas import PlotScene
from lightplot.commands import (MoveItemCommand, AddObjectCommand,
                                RemoveObjectCommand, EditFieldCommand)
from lightplot.plot import LightPlot, PlotLight, Subject
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def make_scene(app):
    scene = PlotScene()
    scene.set_plot(TEMPLATES["Three-Point"]())
    return scene


def test_scene_populates_items(app):
    scene = make_scene(app)
    kinds = {it.kind for it in scene.items() if hasattr(it, "kind")}
    assert {"light", "subject", "camera"} <= kinds


def test_move_command_updates_model_and_undoes(app):
    scene = make_scene(app)
    light = scene.plot.lights[0]
    old = (light.x, light.y)
    scene.undo_stack.push(MoveItemCommand(scene, "light", light.id, old, (-2.0, 0.5)))
    assert (light.x, light.y) == (-2.0, 0.5)
    scene.undo_stack.undo()
    assert (light.x, light.y) == old


def test_add_and_remove_commands(app):
    scene = make_scene(app)
    n = len(scene.plot.lights)
    new = PlotLight(x=1.0, y=-1.0)
    scene.undo_stack.push(AddObjectCommand(scene, "light", new))
    assert len(scene.plot.lights) == n + 1
    scene.undo_stack.push(RemoveObjectCommand(scene, "light", new.id))
    assert len(scene.plot.lights) == n
    scene.undo_stack.undo()
    assert len(scene.plot.lights) == n + 1


def test_edit_field_command(app):
    scene = make_scene(app)
    light = scene.plot.lights[0]
    scene.undo_stack.push(EditFieldCommand(scene, "light", light.id,
                                           "color_temp_k", light.color_temp_k, 3200))
    assert light.color_temp_k == 3200
    scene.undo_stack.undo()
    assert light.color_temp_k == 5600


def test_guard_cannot_remove_last_subject(app):
    scene = make_scene(app)
    subj = scene.plot.subjects[0]
    cmd = RemoveObjectCommand(scene, "subject", subj.id)
    scene.undo_stack.push(cmd)
    assert len(scene.plot.subjects) == 1        # guard: command was a no-op


def test_removing_subject_removes_its_moves(app):
    from lightplot.plot import Move
    scene = make_scene(app)
    extra = Subject(name="Tom", x=1, y=0)
    scene.undo_stack.push(AddObjectCommand(scene, "subject", extra))
    scene.plot.moves.append(Move(target_id=extra.id, waypoints=[[1, 0], [2, 0]]))
    scene.sync()
    scene.undo_stack.push(RemoveObjectCommand(scene, "subject", extra.id))
    assert all(m.target_id != extra.id for m in scene.plot.moves)
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_canvas.py -v
```
Expected: FAIL — `No module named 'lightplot.commands'`

- [ ] **Step 3: Implement `lightplot/commands.py`**

```python
"""Undoable operations on a PlotScene's LightPlot model.

Every command mutates the MODEL only, then calls scene.sync() so the
QGraphicsScene rebuilds/repositions items. Simple and reliable: the scene
is always a pure function of the model.
"""
from __future__ import annotations

from PyQt6.QtGui import QUndoCommand

from .plot import CAMERA_ID

_LISTS = {"light": "lights", "subject": "subjects",
          "set": "set_elements", "move": "moves"}


def model_list(plot, kind):
    return getattr(plot, _LISTS[kind])


def find_obj(plot, kind, obj_id):
    if kind == "camera":
        return plot.camera
    for o in model_list(plot, kind):
        if o.id == obj_id:
            return o
    return None


class MoveItemCommand(QUndoCommand):
    def __init__(self, scene, kind, obj_id, old_xy, new_xy):
        super().__init__(f"move {kind}")
        self.scene, self.kind, self.obj_id = scene, kind, obj_id
        self.old_xy, self.new_xy = tuple(old_xy), tuple(new_xy)

    def _apply(self, xy):
        obj = find_obj(self.scene.plot, self.kind, self.obj_id)
        if obj is not None:
            dx, dy = xy[0] - obj.x, xy[1] - obj.y
            obj.x, obj.y = xy
            # set elements / moves carry their geometry in absolute points:
            # translate them together with the anchor
            if hasattr(obj, "points") and obj.points:
                obj.points = [[px + dx, py + dy] for px, py in obj.points]
            if hasattr(obj, "waypoints") and obj.waypoints:
                obj.waypoints = [[px + dx, py + dy] for px, py in obj.waypoints]
        self.scene.sync()

    def redo(self):
        self._apply(self.new_xy)

    def undo(self):
        self._apply(self.old_xy)


class AddObjectCommand(QUndoCommand):
    def __init__(self, scene, kind, obj):
        super().__init__(f"add {kind}")
        self.scene, self.kind, self.obj = scene, kind, obj

    def redo(self):
        model_list(self.scene.plot, self.kind).append(self.obj)
        self.scene.sync()

    def undo(self):
        model_list(self.scene.plot, self.kind).remove(self.obj)
        self.scene.sync()


class RemoveObjectCommand(QUndoCommand):
    """Remove an object. Guards: never removes the camera or the last
    subject; removing a subject removes its moves and reassigns primary."""

    def __init__(self, scene, kind, obj_id):
        super().__init__(f"remove {kind}")
        self.scene, self.kind, self.obj_id = scene, kind, obj_id
        self.obj = None
        self.removed_moves = []
        self.was_primary = False

    def redo(self):
        plot = self.scene.plot
        if self.kind == "camera":
            self.setObsolete(True)
            return
        if self.kind == "subject" and len(plot.subjects) <= 1:
            self.setObsolete(True)
            return
        self.obj = find_obj(plot, self.kind, self.obj_id)
        if self.obj is None:
            self.setObsolete(True)
            return
        model_list(plot, self.kind).remove(self.obj)
        if self.kind == "subject":
            self.removed_moves = [m for m in plot.moves
                                  if m.target_id == self.obj_id]
            for m in self.removed_moves:
                plot.moves.remove(m)
            self.was_primary = self.obj.primary
            if self.was_primary and plot.subjects:
                plot.subjects[0].primary = True
        self.scene.sync()

    def undo(self):
        plot = self.scene.plot
        if self.obj is None:
            return
        model_list(plot, self.kind).append(self.obj)
        plot.moves.extend(self.removed_moves)
        if self.was_primary:
            for s in plot.subjects:
                s.primary = s.id == self.obj_id
        self.scene.sync()


class EditFieldCommand(QUndoCommand):
    def __init__(self, scene, kind, obj_id, field, old, new):
        super().__init__(f"edit {field}")
        self.scene, self.kind, self.obj_id = scene, kind, obj_id
        self.field, self.old, self.new = field, old, new

    def _apply(self, value):
        target = (self.scene.plot if self.kind == "plot"
                  else find_obj(self.scene.plot, self.kind, self.obj_id))
        if target is not None:
            setattr(target, self.field, value)
        self.scene.sync()

    def redo(self):
        self._apply(self.new)

    def undo(self):
        self._apply(self.old)
```

- [ ] **Step 4: Implement `lightplot/canvas.py`**

```python
"""Interactive god's-eye canvas: QGraphicsScene items for every plot entity.

The scene is a pure function of the LightPlot model: sync() rebuilds all
items from the model. Dragging moves the item live; on release a single
MoveItemCommand is pushed so undo restores the pre-drag position.
"""
from __future__ import annotations

import math

from PyQt6.QtCore import Qt, QPointF, QRectF, pyqtSignal
from PyQt6.QtGui import (QBrush, QColor, QPainter, QPainterPath, QPen,
                         QPolygonF, QUndoStack)
from PyQt6.QtWidgets import (QGraphicsItem, QGraphicsScene, QGraphicsView)

from .commands import MoveItemCommand
from .diagram import kelvin_to_hex
from .plot import (LightPlot, CAMERA_ID, KIND_FURNITURE, KIND_FLAG,
                   KIND_WINDOW, KIND_WALL, KIND_DOOR)

METER_PX = 78.0
BG = QColor("#14161c")
GRID = QColor("#242833")
INK = QColor("#e8e6df")
DIM = QColor("#9aa0ad")
ACCENT = QColor("#e0a458")


def m2px(x_m, y_m) -> QPointF:
    return QPointF(x_m * METER_PX, y_m * METER_PX)


def px2m(pos: QPointF):
    return pos.x() / METER_PX, pos.y() / METER_PX


class _PlotItem(QGraphicsItem):
    """Base: draggable, reports kind + model id, pushes undo on drag end."""
    kind = ""

    def __init__(self, scene: "PlotScene", obj):
        super().__init__()
        self._scene = scene
        self.obj = obj
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges, True)
        self.setPos(m2px(obj.x, obj.y))
        self._drag_start = None

    @property
    def obj_id(self):
        return getattr(self.obj, "id", CAMERA_ID)

    def mousePressEvent(self, ev):
        self._drag_start = (self.obj.x, self.obj.y)
        super().mousePressEvent(ev)

    def mouseReleaseEvent(self, ev):
        super().mouseReleaseEvent(ev)
        new = px2m(self.pos())
        if self._scene.snap_to_grid:
            new = (round(new[0] * 4) / 4, round(new[1] * 4) / 4)  # 25 cm grid
        if self._drag_start and (abs(new[0] - self._drag_start[0]) > 1e-6
                                 or abs(new[1] - self._drag_start[1]) > 1e-6):
            self._scene.undo_stack.push(MoveItemCommand(
                self._scene, self.kind, self.obj_id, self._drag_start, new))
        self._drag_start = None

    def itemChange(self, change, value):
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            self._scene.live_moved(self)
        return super().itemChange(change, value)


class LightItem(_PlotItem):
    kind = "light"

    def boundingRect(self):
        return QRectF(-24, -24, 48, 60)

    def paint(self, p: QPainter, opt, widget=None):
        color = QColor(kelvin_to_hex(self.obj.color_temp_k))
        size = 11 + 13 * self.obj.softness
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        pen = QPen(ACCENT if self.isSelected() else BG, 1.5)
        p.setPen(pen)
        p.setBrush(QBrush(color))
        # aim toward the primary subject (live)
        s = self._scene.plot.primary_subject()
        tgt = m2px(s.x, s.y) - self.pos()
        ang = math.degrees(math.atan2(tgt.y(), tgt.x()))
        p.save()
        p.rotate(ang + 90)
        if self.obj.softness >= 0.4:
            p.drawRoundedRect(QRectF(-size / 2, -5, size, 10), 3, 3)
        else:
            p.drawEllipse(QRectF(-8, -8, 16, 16))
        p.restore()
        p.setPen(QPen(INK))
        p.drawText(QRectF(-24, 14, 48, 16), Qt.AlignmentFlag.AlignHCenter,
                   self.obj.role.upper())


class SubjectItem(_PlotItem):
    kind = "subject"

    def boundingRect(self):
        return QRectF(-34, -30, 68, 48)

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        ring = ACCENT if (self.obj.primary or self.isSelected()) else INK
        p.setPen(QPen(ring, 1.5))
        p.setBrush(QBrush(QColor("#3a4150")))
        p.save()
        p.rotate(self.obj.facing_deg)
        p.drawEllipse(QRectF(-30, -12, 60, 24))
        p.setBrush(QBrush(QColor("#535d70")))
        p.drawEllipse(QRectF(-10, -10, 20, 20))
        p.setBrush(QBrush(INK))
        p.drawEllipse(QRectF(-3, 5, 6, 6))   # nose dot = facing
        p.restore()
        p.setPen(QPen(DIM))
        p.drawText(QRectF(-34, -30, 68, 12), Qt.AlignmentFlag.AlignHCenter,
                   self.obj.name.upper())


class CameraItem(_PlotItem):
    kind = "camera"

    def boundingRect(self):
        return QRectF(-20, -22, 40, 56)

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(QPen(ACCENT if self.isSelected() else INK, 1.5))
        p.setBrush(QBrush(QColor("#2c313d")))
        p.save()
        p.rotate(self.obj.aim_deg)
        p.drawRoundedRect(QRectF(-16, -10, 32, 22), 4, 4)
        p.drawRoundedRect(QRectF(-6, -16, 12, 8), 2, 2)
        p.restore()
        p.setPen(QPen(DIM))
        p.drawText(QRectF(-20, 18, 40, 14), Qt.AlignmentFlag.AlignHCenter,
                   (self.obj.label or "CAM").upper())


class SetElementItem(_PlotItem):
    """Set elements store absolute points; the item sits at points[0] and
    drags translate ALL points (handled in the move command by the scene)."""
    kind = "set"

    _COLORS = {KIND_WALL: INK, KIND_DOOR: DIM, KIND_WINDOW: QColor("#7fb4ff"),
               KIND_FLAG: QColor("#000000"), KIND_FURNITURE: DIM}

    def __init__(self, scene, obj):
        # anchor at first point; expose obj.x/obj.y virtually for _PlotItem
        obj.x, obj.y = obj.points[0][0], obj.points[0][1]
        super().__init__(scene, obj)

    def boundingRect(self):
        xs = [p[0] for p in self.obj.points]
        ys = [p[1] for p in self.obj.points]
        w = (max(xs) - min(xs)) * METER_PX + 20
        h = (max(ys) - min(ys)) * METER_PX + 20
        return QRectF(-10, -10, max(w, 20), max(h, 20))

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        color = self._COLORS.get(self.obj.kind, DIM)
        pen = QPen(ACCENT if self.isSelected() else color,
                   5 if self.obj.kind in (KIND_WALL, KIND_WINDOW) else 3)
        if self.obj.kind == KIND_WINDOW:
            pen.setStyle(Qt.PenStyle.DashLine)
        p.setPen(pen)
        ox, oy = self.obj.points[0]
        pts = [QPointF((x - ox) * METER_PX, (y - oy) * METER_PX)
               for x, y in self.obj.points]
        if self.obj.kind == KIND_FURNITURE and len(pts) >= 2:
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawRect(QRectF(pts[0], pts[-1]).normalized())
        else:
            for a, b in zip(pts, pts[1:]):
                p.drawLine(a, b)
        if self.obj.label:
            p.setPen(QPen(DIM))
            p.drawText(QPointF(0, -8), self.obj.label)


class MoveArrowItem(_PlotItem):
    kind = "move"

    def __init__(self, scene, obj):
        obj.x, obj.y = obj.waypoints[0][0], obj.waypoints[0][1]
        super().__init__(scene, obj)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable, False)

    def boundingRect(self):
        xs = [p[0] for p in self.obj.waypoints]
        ys = [p[1] for p in self.obj.waypoints]
        return QRectF(-10, -10, (max(xs) - min(xs)) * METER_PX + 20,
                      (max(ys) - min(ys)) * METER_PX + 20)

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        pen = QPen(ACCENT, 2, Qt.PenStyle.DashLine)
        p.setPen(pen)
        ox, oy = self.obj.waypoints[0]
        pts = [QPointF((x - ox) * METER_PX, (y - oy) * METER_PX)
               for x, y in self.obj.waypoints]
        for a, b in zip(pts, pts[1:]):
            p.drawLine(a, b)
        if len(pts) >= 2:  # arrowhead
            a, b = pts[-2], pts[-1]
            ang = math.atan2(b.y() - a.y(), b.x() - a.x())
            for da in (math.radians(150), -math.radians(150)):
                p.drawLine(b, b + QPointF(10 * math.cos(ang + da),
                                          10 * math.sin(ang + da)))
        if self.obj.label:
            p.drawText(pts[-1] + QPointF(8, -6), self.obj.label)


class PlotScene(QGraphicsScene):
    plotChanged = pyqtSignal()
    selectionTarget = pyqtSignal(str, str)      # kind, obj_id

    def __init__(self, parent=None):
        super().__init__(parent)
        self.plot = LightPlot()
        self.undo_stack = QUndoStack(self)
        self.snap_to_grid = True
        self.setSceneRect(-5 * METER_PX, -5 * METER_PX,
                          10 * METER_PX, 10 * METER_PX)
        self.setBackgroundBrush(QBrush(BG))
        self.selectionChanged.connect(self._on_selection)
        self.undo_stack.indexChanged.connect(lambda _: self.plotChanged.emit())

    # ---- model <-> scene -------------------------------------------
    def set_plot(self, plot: LightPlot):
        self.plot = plot
        self.undo_stack.clear()
        self.sync()

    def sync(self):
        """Rebuild all items from the model."""
        self.blockSignals(True)
        self.clear()
        for e in self.plot.set_elements:
            if e.points:
                self.addItem(SetElementItem(self, e))
        for m in self.plot.moves:
            if len(m.waypoints) >= 2:
                self.addItem(MoveArrowItem(self, m))
        for s in self.plot.subjects:
            self.addItem(SubjectItem(self, s))
        self.addItem(CameraItem(self, self.plot.camera))
        for l in self.plot.lights:
            self.addItem(LightItem(self, l))
        self.blockSignals(False)
        self.update()
        self.plotChanged.emit()

    def find_model(self, kind, obj_id):
        from .commands import find_obj
        return find_obj(self.plot, kind, obj_id)

    def live_moved(self, item):
        """During drag: update model transiently so beams/labels track."""
        x, y = px2m(item.pos())
        item.obj.x, item.obj.y = x, y
        if item.kind == "set":
            ox, oy = item.obj.points[0]
            dx, dy = x - ox, y - oy
            item.obj.points = [[px + dx, py + dy] for px, py in item.obj.points]
        self.update()

    def drawBackground(self, p: QPainter, rect: QRectF):
        super().drawBackground(p, rect)
        p.setPen(QPen(GRID, 0))
        step = METER_PX / 2
        x = math.floor(rect.left() / step) * step
        while x < rect.right():
            p.drawLine(QPointF(x, rect.top()), QPointF(x, rect.bottom()))
            x += step
        y = math.floor(rect.top() / step) * step
        while y < rect.bottom():
            p.drawLine(QPointF(rect.left(), y), QPointF(rect.right(), y))
            y += step
        # meter rings around primary subject
        s = self.plot.primary_subject()
        c = m2px(s.x, s.y)
        pen = QPen(GRID, 1, Qt.PenStyle.DashLine)
        p.setPen(pen)
        for m in (1, 2, 3):
            r = m * METER_PX
            p.drawEllipse(c, r, r)

    def _on_selection(self):
        sel = self.selectedItems()
        if sel and hasattr(sel[0], "kind"):
            self.selectionTarget.emit(sel[0].kind, sel[0].obj_id)
        else:
            self.selectionTarget.emit("plot", "")


class PlotView(QGraphicsView):
    def __init__(self, scene, parent=None):
        super().__init__(scene, parent)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setDragMode(QGraphicsView.DragMode.RubberBandDrag)
        self.setTransformationAnchor(
            QGraphicsView.ViewportAnchor.AnchorUnderMouse)

    def wheelEvent(self, ev):
        factor = 1.15 if ev.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)

    def fit(self):
        rect = self.scene().itemsBoundingRect().adjusted(-60, -60, 60, 60)
        self.fitInView(rect, Qt.AspectRatioMode.KeepAspectRatio)
```

`Subject`, `Camera`, `PlotLight` have `x/y` natively; `SetElement`/`Move` get transient `x/y` attributes assigned by their items — since `to_dict()` uses explicit field lists via `asdict`, the transient attributes never leak into JSON. Verify: `asdict` on a dataclass only serializes declared fields — the round-trip test from Task 2 plus `test_json_round_trip_full_document` already cover this.

- [ ] **Step 5: Run tests**

```bash
python3 -m pytest tests/test_canvas.py tests/ -v
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lightplot/commands.py lightplot/canvas.py tests/test_canvas.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: interactive plot canvas — draggable items, undoable commands, live sync"
```

---

### Task 7: Properties panel

**Files:**
- Create: `lightplot/props.py`
- Test: `tests/test_props.py`

**Interfaces:**
- Consumes: `PlotScene.selectionTarget`, model classes, `EditFieldCommand`.
- Produces: `PropertiesPanel(QWidget)` with `.set_scene(scene: PlotScene)`; it listens to `selectionTarget`, shows the right form, and pushes `EditFieldCommand` on every edit. CT presets (exact labels): `Tungsten 3200K`, `Daylight 5600K`, `Warm practical 2400K`, `Cool window 6500K`.

- [ ] **Step 1: Write failing tests**

`tests/test_props.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.canvas import PlotScene
from lightplot.props import PropertiesPanel
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def make(app):
    scene = PlotScene()
    scene.set_plot(TEMPLATES["Three-Point"]())
    panel = PropertiesPanel()
    panel.set_scene(scene)
    return scene, panel


def test_panel_shows_light_form_on_selection(app):
    scene, panel = make(app)
    light = scene.plot.lights[0]
    scene.selectionTarget.emit("light", light.id)
    assert panel.current_kind == "light"
    assert panel.fields["intensity"].value() == pytest.approx(light.intensity)


def test_editing_field_pushes_undoable_command(app):
    scene, panel = make(app)
    light = scene.plot.lights[0]
    scene.selectionTarget.emit("light", light.id)
    panel.fields["color_temp_k"].setValue(3200)
    panel.commit_field("color_temp_k")
    assert light.color_temp_k == 3200
    scene.undo_stack.undo()
    assert light.color_temp_k == 5600


def test_plot_level_form_edits_name(app):
    scene, panel = make(app)
    scene.selectionTarget.emit("plot", "")
    panel.fields["name"].setText("Sc 4 — WS kitchen")
    panel.commit_field("name")
    assert scene.plot.name == "Sc 4 — WS kitchen"


def test_subject_primary_toggle(app):
    scene, panel = make(app)
    subj = scene.plot.subjects[0]
    scene.selectionTarget.emit("subject", subj.id)
    assert panel.fields["name"].text() == subj.name
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_props.py -v
```
Expected: FAIL — `No module named 'lightplot.props'`

- [ ] **Step 3: Implement `lightplot/props.py`**

```python
"""Properties panel: edits whatever is selected in the PlotScene.

Every commit goes through EditFieldCommand so it is undoable. Widgets are
rebuilt per selection kind; self.fields maps model field name -> widget.
"""
from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (QCheckBox, QComboBox, QDoubleSpinBox, QFormLayout,
                             QLabel, QLineEdit, QPushButton, QSpinBox,
                             QVBoxLayout, QWidget, QHBoxLayout, QPlainTextEdit)

from .commands import EditFieldCommand, find_obj
from .rig import ROLES

CT_PRESETS = [("Tungsten 3200K", 3200), ("Daylight 5600K", 5600),
              ("Warm practical 2400K", 2400), ("Cool window 6500K", 6500)]

MODIFIERS = ["", "softbox", "book light", "bounce board", "fresnel",
             "LED panel", "practical lamp in frame", "tube", "beauty dish",
             "8x8 diffusion", "lantern / china ball"]


class PropertiesPanel(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = None
        self.current_kind = "plot"
        self.current_id = ""
        self.fields = {}
        self._loading = False
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(8, 8, 8, 8)
        self._form_host = QWidget()
        self._layout.addWidget(self._form_host)
        self._layout.addStretch(1)

    def set_scene(self, scene):
        self.scene = scene
        scene.selectionTarget.connect(self.show_target)
        self.show_target("plot", "")

    # ------------------------------------------------------------ forms
    def show_target(self, kind: str, obj_id: str):
        self.current_kind, self.current_id = kind, obj_id
        self.fields = {}
        self._form_host.deleteLater()
        self._form_host = QWidget()
        form = QFormLayout(self._form_host)
        self._layout.insertWidget(0, self._form_host)
        obj = self._target()
        if obj is None:
            return
        self._loading = True
        builder = {"light": self._light_form, "subject": self._subject_form,
                   "camera": self._camera_form, "set": self._set_form,
                   "move": self._move_form, "plot": self._plot_form}[kind]
        builder(form, obj)
        self._loading = False

    def _target(self):
        if self.scene is None:
            return None
        if self.current_kind == "plot":
            return self.scene.plot
        return find_obj(self.scene.plot, self.current_kind, self.current_id)

    # each _*_form registers widgets in self.fields and wires commit
    def _light_form(self, form, light):
        role = QComboBox(); role.addItems(list(ROLES))
        role.setCurrentText(light.role)
        self._reg(form, "Role", "role", role,
                  role.currentTextChanged, role.currentText)
        inten = self._spin(0.0, 2.0, 0.05, light.intensity)
        self._reg(form, "Intensity", "intensity", inten,
                  inten.valueChanged, inten.value)
        soft = self._spin(0.0, 1.0, 0.05, light.softness)
        self._reg(form, "Softness", "softness", soft,
                  soft.valueChanged, soft.value)
        elev = self._spin(-90.0, 90.0, 1.0, light.elevation_deg)
        self._reg(form, "Elevation °", "elevation_deg", elev,
                  elev.valueChanged, elev.value)
        ct = QSpinBox(); ct.setRange(1500, 12000); ct.setSingleStep(100)
        ct.setValue(light.color_temp_k)
        self._reg(form, "Color temp K", "color_temp_k", ct,
                  ct.valueChanged, ct.value)
        presets = QHBoxLayout()
        for label, k in CT_PRESETS:
            b = QPushButton(label.split()[0]); b.setToolTip(label)
            b.clicked.connect(lambda _, kk=k: (ct.setValue(kk),
                                               self.commit_field("color_temp_k")))
            presets.addWidget(b)
        host = QWidget(); host.setLayout(presets)
        form.addRow("", host)
        gel = QLineEdit(light.color_hex)
        self._reg(form, "Gel hex", "color_hex", gel,
                  gel.editingFinished, gel.text)
        mod = QComboBox(); mod.setEditable(True); mod.addItems(MODIFIERS)
        mod.setCurrentText(light.modifier)
        self._reg(form, "Modifier", "modifier", mod,
                  mod.currentTextChanged, mod.currentText)
        notes = QLineEdit(light.notes)
        self._reg(form, "Notes", "notes", notes,
                  notes.editingFinished, notes.text)

    def _subject_form(self, form, s):
        name = QLineEdit(s.name)
        self._reg(form, "Name", "name", name, name.editingFinished, name.text)
        facing = self._spin(-180.0, 180.0, 5.0, s.facing_deg)
        self._reg(form, "Facing °", "facing_deg", facing,
                  facing.valueChanged, facing.value)
        primary = QCheckBox("Primary (breakdown reference)")
        primary.setChecked(s.primary)
        primary.toggled.connect(lambda v: self._set_primary(v))
        form.addRow("", primary)
        self.fields["primary"] = primary

    def _camera_form(self, form, c):
        label = QLineEdit(c.label)
        self._reg(form, "Label", "label", label,
                  label.editingFinished, label.text)
        aim = self._spin(-180.0, 180.0, 5.0, c.aim_deg)
        self._reg(form, "Aim °", "aim_deg", aim, aim.valueChanged, aim.value)

    def _set_form(self, form, e):
        form.addRow(QLabel(f"Set element: {e.kind}"))
        label = QLineEdit(e.label)
        self._reg(form, "Label", "label", label,
                  label.editingFinished, label.text)

    def _move_form(self, form, m):
        label = QLineEdit(m.label)
        self._reg(form, "Label", "label", label,
                  label.editingFinished, label.text)

    def _plot_form(self, form, plot):
        name = QLineEdit(plot.name)
        self._reg(form, "Setup name", "name", name,
                  name.editingFinished, name.text)
        mood = QLineEdit(plot.mood)
        self._reg(form, "Mood", "mood", mood, mood.editingFinished, mood.text)
        notes = QLineEdit(plot.notes)
        self._reg(form, "Notes", "notes", notes,
                  notes.editingFinished, notes.text)

    # ------------------------------------------------------------ plumbing
    def _spin(self, lo, hi, step, val):
        w = QDoubleSpinBox()
        w.setRange(lo, hi); w.setSingleStep(step); w.setValue(val)
        return w

    def _reg(self, form, label, field, widget, signal, getter):
        self.fields[field] = widget
        widget._getter = getter
        form.addRow(label, widget)
        signal.connect(lambda *_: self.commit_field(field))

    def commit_field(self, field: str):
        if self._loading:
            return
        obj = self._target()
        if obj is None:
            return
        new = self.fields[field]._getter()
        old = getattr(obj, field)
        if type(old) is int:
            new = int(new)
        if new == old:
            return
        self.scene.undo_stack.push(EditFieldCommand(
            self.scene, self.current_kind, self.current_id, field, old, new))

    def _set_primary(self, value: bool):
        if self._loading or not value:
            return
        # exactly one primary: clear others directly, set this one undoably
        for s in self.scene.plot.subjects:
            s.primary = False
        self.scene.undo_stack.push(EditFieldCommand(
            self.scene, "subject", self.current_id, "primary", False, True))
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_props.py tests/ -v
```
Expected: all PASS. (If `commit_field` fires during form construction, the `_loading` flag is the guard — check it first.)

- [ ] **Step 5: Commit**

```bash
git add lightplot/props.py tests/test_props.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: properties panel with undoable edits and CT presets"
```

---

### Task 8: Editor widget (toolbar, add tools, breakdown, wiring)

**Files:**
- Create: `lightplot/editor.py`
- Test: `tests/test_editor.py`

**Interfaces:**
- Consumes: `PlotScene`, `PlotView`, `PropertiesPanel`, commands, `TEMPLATES`, `LightPlot`, `render_plot_svg`.
- Produces: `PlotEditorWidget(QWidget)` — the embeddable editor:
  - `.set_plot(plot: LightPlot)`, `.plot() -> LightPlot`
  - signal `plotEdited` (re-emitted from scene.plotChanged)
  - `.scene: PlotScene`, `.view: PlotView`, `.props: PropertiesPanel`
  - actions: `add_light(role: str)`, `add_subject()`, `delete_selection()`, `duplicate_selection()`; pending-placement tools `start_tool(name)` for `"wall"|"door"|"window"|"flag"|"furniture"|"move"`; Esc cancels a pending tool.
  - `.breakdown: QPlainTextEdit` (read-only) refreshed on every `plotChanged`.
  - Tool behavior: wall/door/window/furniture = two clicks (start, end); flag = two clicks; move = select a subject/camera first, then clicks add waypoints, double-click commits.

- [ ] **Step 1: Write failing tests**

`tests/test_editor.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.editor import PlotEditorWidget
from lightplot.plot import LightPlot, KIND_WALL
from lightplot.rig import ROLE_FILL
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def test_editor_constructs_and_loads_template(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Rembrandt"]())
    assert ed.plot().name == "Rembrandt"
    assert "KEY" in ed.breakdown.toPlainText().upper()


def test_add_light_is_undoable(app):
    ed = PlotEditorWidget()
    ed.set_plot(LightPlot())
    n = len(ed.plot().lights)
    ed.add_light(ROLE_FILL)
    assert len(ed.plot().lights) == n + 1
    ed.scene.undo_stack.undo()
    assert len(ed.plot().lights) == n


def test_delete_selection_respects_guards(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Three-Point"]())
    # select the only subject via the scene item
    for it in ed.scene.items():
        if getattr(it, "kind", "") == "subject":
            it.setSelected(True)
    ed.delete_selection()
    assert len(ed.plot().subjects) == 1     # guard held


def test_duplicate_light(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Three-Point"]())
    n = len(ed.plot().lights)
    for it in ed.scene.items():
        if getattr(it, "kind", "") == "light":
            it.setSelected(True)
            break
    ed.duplicate_selection()
    assert len(ed.plot().lights) == n + 1


def test_wall_tool_two_clicks(app):
    ed = PlotEditorWidget()
    ed.set_plot(LightPlot())
    ed.start_tool("wall")
    ed.scene.tool_click(-2.0, -1.5)
    ed.scene.tool_click(2.0, -1.5)
    walls = [e for e in ed.plot().set_elements if e.kind == KIND_WALL]
    assert len(walls) == 1
    assert walls[0].points == [[-2.0, -1.5], [2.0, -1.5]]


def test_breakdown_updates_after_edit(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Three-Point"]())
    before = ed.breakdown.toPlainText()
    light = ed.plot().lights[0]
    from lightplot.commands import EditFieldCommand
    ed.scene.undo_stack.push(EditFieldCommand(
        ed.scene, "light", light.id, "color_temp_k", 5600, 3200))
    assert ed.breakdown.toPlainText() != before
    assert "3200" in ed.breakdown.toPlainText()
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_editor.py -v
```
Expected: FAIL — `No module named 'lightplot.editor'`

- [ ] **Step 3: Implement `lightplot/editor.py`**

```python
"""The embeddable light-plot editor: canvas + toolbar + properties + breakdown.

Standalone gui.py wraps this in a QMainWindow with file handling;
ScrivenLight embeds it in a dialog attached to a storyboard frame.
"""
from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction, QKeySequence
from PyQt6.QtWidgets import (QMenu, QPlainTextEdit, QSplitter, QToolBar,
                             QToolButton, QVBoxLayout, QWidget)

from .canvas import PlotScene, PlotView
from .commands import AddObjectCommand, RemoveObjectCommand
from .plot import (LightPlot, Move, PlotLight, SetElement, Subject, CAMERA_ID,
                   KIND_DOOR, KIND_FLAG, KIND_FURNITURE, KIND_WALL, KIND_WINDOW)
from .props import PropertiesPanel
from .rig import ROLES, ROLE_KEY

_TWO_CLICK_TOOLS = {"wall": KIND_WALL, "door": KIND_DOOR, "window": KIND_WINDOW,
                    "flag": KIND_FLAG, "furniture": KIND_FURNITURE}


class _ToolScene(PlotScene):
    """PlotScene + click-placement tools driven by the editor."""

    def __init__(self, editor, parent=None):
        super().__init__(parent)
        self.editor = editor
        self.pending_tool = None
        self.pending_points = []

    def tool_click(self, x_m: float, y_m: float):
        """Programmatic click for tools (also used by tests)."""
        tool = self.pending_tool
        if tool in _TWO_CLICK_TOOLS:
            self.pending_points.append([x_m, y_m])
            if len(self.pending_points) == 2:
                el = SetElement(kind=_TWO_CLICK_TOOLS[tool],
                                points=list(self.pending_points))
                self.undo_stack.push(AddObjectCommand(self, "set", el))
                self.editor.end_tool()
        elif tool == "move":
            self.pending_points.append([x_m, y_m])
        elif tool == "light":
            light = PlotLight(x=x_m, y=y_m, role=self.editor.pending_role)
            self.undo_stack.push(AddObjectCommand(self, "light", light))
            self.editor.end_tool()
        elif tool == "subject":
            s = Subject(x=x_m, y=y_m, name=f"Subject {len(self.plot.subjects) + 1}")
            self.undo_stack.push(AddObjectCommand(self, "subject", s))
            self.editor.end_tool()

    def commit_move_tool(self):
        if self.pending_tool == "move" and len(self.pending_points) >= 2:
            target = self.editor.move_target_id or self.plot.primary_subject().id
            mv = Move(target_id=target, waypoints=list(self.pending_points))
            self.undo_stack.push(AddObjectCommand(self, "move", mv))
        self.editor.end_tool()

    def mousePressEvent(self, ev):
        if self.pending_tool:
            p = ev.scenePos()
            from .canvas import px2m
            self.tool_click(*px2m(p))
            ev.accept()
            return
        super().mousePressEvent(ev)

    def mouseDoubleClickEvent(self, ev):
        if self.pending_tool == "move":
            self.commit_move_tool()
            ev.accept()
            return
        super().mouseDoubleClickEvent(ev)


class PlotEditorWidget(QWidget):
    plotEdited = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.pending_role = ROLE_KEY
        self.move_target_id = ""
        self._build_ui()
        self.set_plot(LightPlot())

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.scene = _ToolScene(self)
        self.scene.plotChanged.connect(self._refresh_breakdown)
        self.scene.plotChanged.connect(self.plotEdited.emit)
        self.scene.selectionTarget.connect(self._track_move_target)

        bar = QToolBar()
        # Add Light with role menu
        light_btn = QToolButton()
        light_btn.setText("＋ Light")
        menu = QMenu(light_btn)
        for role in ROLES:
            menu.addAction(role.capitalize(),
                           lambda r=role: self._arm_light(r))
        light_btn.setMenu(menu)
        light_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        bar.addWidget(light_btn)
        bar.addAction("＋ Subject", lambda: self.start_tool("subject"))
        for name in ("wall", "door", "window", "flag", "furniture"):
            bar.addAction(f"＋ {name.capitalize()}",
                          lambda n=name: self.start_tool(n))
        bar.addAction("＋ Move arrow", lambda: self.start_tool("move"))
        bar.addSeparator()
        dup = QAction("Duplicate", self)
        dup.setShortcut(QKeySequence("Ctrl+D"))
        dup.triggered.connect(self.duplicate_selection)
        bar.addAction(dup)
        delete = QAction("Delete", self)
        delete.setShortcut(QKeySequence.StandardKey.Delete)
        delete.triggered.connect(self.delete_selection)
        bar.addAction(delete)
        bar.addSeparator()
        undo = self.scene.undo_stack.createUndoAction(self, "Undo")
        undo.setShortcut(QKeySequence.StandardKey.Undo)
        redo = self.scene.undo_stack.createRedoAction(self, "Redo")
        redo.setShortcut(QKeySequence.StandardKey.Redo)
        bar.addAction(undo)
        bar.addAction(redo)
        bar.addSeparator()
        bar.addAction("Fit", lambda: self.view.fit())
        snap = QAction("Snap", self)
        snap.setCheckable(True)
        snap.setChecked(True)
        snap.toggled.connect(lambda v: setattr(self.scene, "snap_to_grid", v))
        bar.addAction(snap)
        layout.addWidget(bar)

        split = QSplitter(Qt.Orientation.Horizontal)
        self.view = PlotView(self.scene)
        split.addWidget(self.view)
        right = QSplitter(Qt.Orientation.Vertical)
        self.props = PropertiesPanel()
        self.props.set_scene(self.scene)
        right.addWidget(self.props)
        self.breakdown = QPlainTextEdit()
        self.breakdown.setReadOnly(True)
        right.addWidget(self.breakdown)
        split.addWidget(right)
        split.setStretchFactor(0, 3)
        split.setStretchFactor(1, 1)
        layout.addWidget(split, 1)

    # ---------------------------------------------------------- plot API
    def set_plot(self, plot: LightPlot):
        self.scene.set_plot(plot)
        self._refresh_breakdown()

    def plot(self) -> LightPlot:
        return self.scene.plot

    # ---------------------------------------------------------- actions
    def _arm_light(self, role: str):
        self.pending_role = role
        self.start_tool("light")

    def add_light(self, role: str = ROLE_KEY):
        """Immediate add near the subject (menu default / tests)."""
        s = self.plot().primary_subject()
        light = PlotLight(x=s.x - 1.2, y=s.y + 1.0, role=role)
        self.scene.undo_stack.push(AddObjectCommand(self.scene, "light", light))

    def add_subject(self):
        self.scene.tool_click(0.8, 0.0) if self.scene.pending_tool == "subject" \
            else self.scene.undo_stack.push(AddObjectCommand(
                self.scene, "subject",
                Subject(x=0.8, y=0.0,
                        name=f"Subject {len(self.plot().subjects) + 1}")))

    def start_tool(self, name: str):
        self.scene.pending_tool = name
        self.scene.pending_points = []

    def end_tool(self):
        self.scene.pending_tool = None
        self.scene.pending_points = []

    def keyPressEvent(self, ev):
        if ev.key() == Qt.Key.Key_Escape and self.scene.pending_tool:
            self.end_tool()
            return
        super().keyPressEvent(ev)

    def _selected(self):
        return [it for it in self.scene.selectedItems() if hasattr(it, "kind")]

    def delete_selection(self):
        for it in self._selected():
            self.scene.undo_stack.push(RemoveObjectCommand(
                self.scene, it.kind, it.obj_id))

    def duplicate_selection(self):
        import copy
        from .plot import _new_id
        for it in self._selected():
            if it.kind not in ("light", "subject", "set"):
                continue
            clone = copy.deepcopy(it.obj)
            clone.id = _new_id()
            clone.x += 0.5
            clone.y += 0.5
            if hasattr(clone, "points") and clone.points:
                clone.points = [[px + 0.5, py + 0.5] for px, py in clone.points]
            if hasattr(clone, "primary"):
                clone.primary = False
            self.scene.undo_stack.push(AddObjectCommand(
                self.scene, it.kind, clone))

    def _track_move_target(self, kind, obj_id):
        if kind in ("subject", "camera"):
            self.move_target_id = obj_id if kind == "subject" else CAMERA_ID

    # ---------------------------------------------------------- breakdown
    def _refresh_breakdown(self):
        plot = self.plot()
        rig = plot.to_rig()
        lines = [plot.name, ""]
        if plot.mood or plot.key_fill_ratio:
            lines.append(f"{plot.mood} · key/fill {plot.key_fill_ratio}".strip(" ·"))
        for src in rig.lights:
            lines.append(f"[{src.role.upper()}] {src.position_label()}")
            lines.append(f"   {src.softness_label()} · {src.modifier} · "
                         f"{src.ct_label()} · {src.intensity * 100:.0f}%")
        if plot.summary:
            lines += ["", plot.summary]
        self.breakdown.setPlainText("\n".join(lines))
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_editor.py tests/ -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lightplot/editor.py tests/test_editor.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: PlotEditorWidget — toolbar tools, guards, duplicate, live breakdown"
```

---

### Task 9: Standalone app (file handling, starting points, exports)

**Files:**
- Rewrite: `lightplot/gui.py` (keep `main()`, `APP_NAME`, `DARK_QSS`, `LightingVisualizerWidget` name)
- Modify: `lightplot/__main__.py` (no interface change; `--gui` path unchanged)
- Test: `tests/test_gui.py`

**Interfaces:**
- Consumes: `PlotEditorWidget`, `TEMPLATES`, `analyze`, `LightPlot`, `render_plot_svg`, `describe_to_rig`, `claude_available`.
- Produces:
  - `LightingVisualizerWidget(QWidget)` — now a thin wrapper: toolbar (New ▾ [Blank / template names / Describe… / Analyze Image…], Open, Save, Export ▾) + `PlotEditorWidget`. Keeps the embed contract (plain QWidget, no QMainWindow).
  - Methods used by tests and ScrivenLight: `.editor: PlotEditorWidget`, `.load_file(path)`, `.save_file(path)`, `.new_from_template(name)`, `.new_blank()`, `.analyze_file(path, backend="auto")`, `.export_svg(path)`.
  - File format: a single `LightPlot` JSON, suggested extension `.lightplot.json`.
  - `main(argv)` — unchanged behavior; `python -m lightplot --gui still.jpg` analyzes the image into the editor.

- [ ] **Step 1: Write failing tests**

`tests/test_gui.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.gui import LightingVisualizerWidget
from lightplot.plot import LightPlot
from tests.conftest import synthetic_portrait


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def test_new_from_template_and_save_load(app, tmp_path):
    w = LightingVisualizerWidget()
    w.new_from_template("Book Light")
    path = tmp_path / "setup.lightplot.json"
    w.save_file(str(path))
    w2 = LightingVisualizerWidget()
    w2.load_file(str(path))
    assert w2.editor.plot().name == "Book Light"


def test_analyze_file_lands_in_editor(app, tmp_path):
    img = tmp_path / "still.png"
    synthetic_portrait().save(img)
    w = LightingVisualizerWidget()
    w.analyze_file(str(img), backend="heuristic")
    assert w.editor.plot().analyzer == "heuristic"
    assert w.editor.plot().lights


def test_export_svg(app, tmp_path):
    w = LightingVisualizerWidget()
    w.new_from_template("Three-Point")
    out = tmp_path / "plot.svg"
    w.export_svg(str(out))
    assert out.read_text().startswith("<svg")


def test_load_malformed_file_does_not_crash(app, tmp_path):
    bad = tmp_path / "bad.lightplot.json"
    bad.write_text("{not json")
    w = LightingVisualizerWidget()
    w.load_file(str(bad))                    # shows error via status, no raise
    assert isinstance(w.editor.plot(), LightPlot)
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_gui.py -v
```
Expected: FAIL — `LightingVisualizerWidget` has no `new_from_template` (old class).

- [ ] **Step 3: Rewrite `lightplot/gui.py`**

```python
"""Standalone app shell around PlotEditorWidget.

`LightingVisualizerWidget` keeps its name and embed contract (plain
QWidget) so ScrivenLight can add it as a tab. It adds file handling,
starting points (blank / template / analyze / describe), and exports.
"""
from __future__ import annotations

import os
import sys

from PyQt6.QtCore import Qt, QByteArray, QThread, pyqtSignal
from PyQt6.QtGui import QAction, QImage, QPainter, QPixmap
from PyQt6.QtSvg import QSvgRenderer
from PyQt6.QtWidgets import (QApplication, QFileDialog, QInputDialog, QLabel,
                             QMainWindow, QMenu, QMessageBox, QToolBar,
                             QToolButton, QVBoxLayout, QWidget)

from .diagram import render_plot_svg
from .editor import PlotEditorWidget
from .plot import LightPlot
from .templates import TEMPLATES

APP_NAME = "Papa Light Plot"

DARK_QSS = """
QWidget { background: #14161c; color: #e8e6df; font-size: 13px; }
QToolBar { background: #1b1e27; border: 0; spacing: 8px; padding: 6px; }
QPushButton, QComboBox, QToolButton {
    background: #2c313d; border: 1px solid #3a4150; border-radius: 5px;
    padding: 6px 14px; }
QPushButton:hover, QComboBox:hover, QToolButton:hover { border-color: #e0a458; }
QLabel#hint { color: #9aa0ad; font-size: 15px; }
QScrollArea { border: 0; }
QPlainTextEdit { background: #1b1e27; border: 0; }
"""

FILE_FILTER = "Light plot (*.lightplot.json *.json)"


class _AnalyzeWorker(QThread):
    done = pyqtSignal(object)
    failed = pyqtSignal(str)

    def __init__(self, path, backend, parent=None):
        super().__init__(parent)
        self._path, self._backend = path, backend

    def run(self):
        try:
            from .analyze import analyze
            self.done.emit(analyze(self._path, backend=self._backend))
        except Exception as e:
            self.failed.emit(str(e))


class LightingVisualizerWidget(QWidget):
    """Editor + file/new/export toolbar. Embeddable (plain QWidget)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._path = ""
        self._worker = None
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        bar = QToolBar()
        new_btn = QToolButton()
        new_btn.setText("New ▾")
        new_menu = QMenu(new_btn)
        new_menu.addAction("Blank", self.new_blank)
        tmpl = new_menu.addMenu("From template")
        for name in TEMPLATES:
            tmpl.addAction(name, lambda n=name: self.new_from_template(n))
        new_menu.addAction("Describe the look… (Claude)", self._describe_dialog)
        new_menu.addAction("Analyze image…", self._analyze_dialog)
        new_btn.setMenu(new_menu)
        new_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        bar.addWidget(new_btn)
        bar.addAction("Open…", self._open_dialog)
        bar.addAction("Save", self._save)
        bar.addAction("Save As…", self._save_as_dialog)
        export_btn = QToolButton()
        export_btn.setText("Export ▾")
        exp_menu = QMenu(export_btn)
        exp_menu.addAction("SVG…", self._export_svg_dialog)
        exp_menu.addAction("PNG…", self._export_png_dialog)
        export_btn.setMenu(exp_menu)
        export_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        bar.addWidget(export_btn)
        self.status = QLabel("")
        bar.addWidget(self.status)
        layout.addWidget(bar)

        self.editor = PlotEditorWidget()
        layout.addWidget(self.editor, 1)

    # ------------------------------------------------------ starting points
    def new_blank(self):
        self.editor.set_plot(LightPlot())
        self._path = ""

    def new_from_template(self, name: str):
        self.editor.set_plot(TEMPLATES[name]())
        self._path = ""

    def analyze_file(self, path: str, backend: str = "auto"):
        self.status.setText("  analyzing…")
        self._worker = _AnalyzeWorker(path, backend, self)
        self._worker.done.connect(
            lambda rig: (self.editor.set_plot(
                LightPlot.from_rig(rig, ref_image=path)),
                self.status.setText(f"  {rig.analyzer} · {rig.mood}")))
        self._worker.failed.connect(self._error)
        self._worker.start()

    def _analyze_dialog(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Analyze reference image", "",
            "Images (*.png *.jpg *.jpeg *.webp *.bmp *.tif *.tiff)")
        if path:
            self.analyze_file(path)

    def _describe_dialog(self):
        from .claude_backend import claude_available
        if not claude_available():
            QMessageBox.information(
                self, APP_NAME,
                "Describe-to-setup needs the 'anthropic' package and an API "
                "credential.\nMeanwhile, start from a template instead.")
            return
        text, ok = QInputDialog.getMultiLineText(
            self, "Describe the look",
            "Describe the lighting you want, in DOP language:")
        if not ok or not text.strip():
            return
        self.status.setText("  drafting setup…")
        try:
            from .claude_backend import describe_to_rig
            rig = describe_to_rig(text.strip())
            plot = LightPlot.from_rig(rig)
            plot.name = text.strip().splitlines()[0][:60]
            self.editor.set_plot(plot)
            self.status.setText(f"  {rig.analyzer}")
        except Exception as e:
            self._error(str(e))

    # ------------------------------------------------------ file handling
    def load_file(self, path: str):
        try:
            with open(path, "r", encoding="utf-8") as f:
                self.editor.set_plot(LightPlot.from_json(f.read()))
            self._path = path
            self.status.setText(f"  {os.path.basename(path)}")
        except Exception as e:
            self._error(f"Could not open {os.path.basename(path)}: {e}")

    def save_file(self, path: str):
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self.editor.plot().to_json())
            self._path = path
            self.status.setText(f"  saved {os.path.basename(path)}")
        except Exception as e:
            self._error(str(e))

    def _open_dialog(self):
        path, _ = QFileDialog.getOpenFileName(self, "Open light plot", "",
                                              FILE_FILTER)
        if path:
            self.load_file(path)

    def _save(self):
        if self._path:
            self.save_file(self._path)
        else:
            self._save_as_dialog()

    def _save_as_dialog(self):
        base = self.editor.plot().name.replace("/", "-") or "setup"
        path, _ = QFileDialog.getSaveFileName(
            self, "Save light plot", f"{base}.lightplot.json", FILE_FILTER)
        if path:
            self.save_file(path)

    # ------------------------------------------------------ exports
    def export_svg(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(render_plot_svg(self.editor.plot()))
        self.status.setText(f"  exported {os.path.basename(path)}")

    def export_png(self, path: str, scale: int = 2):
        svg = render_plot_svg(self.editor.plot())
        renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
        size = renderer.defaultSize() * scale
        img = QImage(size, QImage.Format.Format_ARGB32)
        img.fill(0)
        p = QPainter(img)
        renderer.render(p)
        p.end()
        img.save(path)
        self.status.setText(f"  exported {os.path.basename(path)}")

    def _export_svg_dialog(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Export SVG", "lightplot.svg", "SVG (*.svg)")
        if path:
            self.export_svg(path)

    def _export_png_dialog(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Export PNG", "lightplot.png", "PNG (*.png)")
        if path:
            self.export_png(path)

    def _error(self, msg: str):
        # Always surface in the status bar; only raise a modal box when the
        # widget is actually on screen (a modal in headless tests would hang).
        self.status.setText(f"  ⚠ {msg}")
        if self.isVisible():
            QMessageBox.warning(self, APP_NAME, msg)


def main(argv=None):
    app = QApplication(argv or sys.argv)
    app.setApplicationName(APP_NAME)
    app.setStyleSheet(DARK_QSS)
    win = QMainWindow()
    win.setWindowTitle(APP_NAME)
    widget = LightingVisualizerWidget()
    win.setCentralWidget(widget)
    win.resize(1320, 800)
    win.show()
    args = [a for a in (argv or sys.argv)[1:] if not a.startswith("-")]
    if args and os.path.isfile(args[0]):
        if args[0].endswith(".json"):
            widget.load_file(args[0])
        else:
            widget.analyze_file(args[0])
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests + manual launch check**

```bash
python3 -m pytest tests/ -v
```
Expected: all PASS.

```bash
QT_QPA_PLATFORM=offscreen timeout 5 python3 -c "
from PyQt6.QtWidgets import QApplication
from lightplot.gui import LightingVisualizerWidget
app = QApplication([])
w = LightingVisualizerWidget(); w.show(); print('constructs ok')"
```
Expected: `constructs ok`

- [ ] **Step 5: Commit**

```bash
git add lightplot/gui.py tests/test_gui.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: standalone app — file handling, template/describe/analyze starting points, SVG/PNG export"
```

---

### Task 10: Side-by-side export

**Files:**
- Create: `lightplot/composite.py`
- Modify: `lightplot/gui.py` (add "Side-by-side PNG…" to the Export menu)
- Test: `tests/test_composite.py`

**Interfaces:**
- Consumes: `render_plot_svg`, `LightPlot`, Pillow.
- Produces: `composite.side_by_side_png(plot: LightPlot, out_path: str, ref_image_path: str = "") -> str` — reference still (from arg or `plot.ref_image`) left, rendered plot right, equal heights; if no reference exists, raises `ValueError("plot has no reference image")`.

- [ ] **Step 1: Write failing tests**

`tests/test_composite.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PIL import Image

from lightplot.composite import side_by_side_png
from lightplot.plot import LightPlot
from lightplot.templates import TEMPLATES
from tests.conftest import synthetic_portrait


def test_side_by_side_composites(tmp_path):
    from PyQt6.QtWidgets import QApplication
    QApplication.instance() or QApplication([])
    ref = tmp_path / "ref.png"
    synthetic_portrait().save(ref)
    plot = TEMPLATES["Rembrandt"]()
    plot.ref_image = str(ref)
    out = tmp_path / "board.png"
    side_by_side_png(plot, str(out))
    img = Image.open(out)
    assert img.width > img.height          # two panels side by side


def test_missing_reference_raises(tmp_path):
    with pytest.raises(ValueError, match="reference image"):
        side_by_side_png(LightPlot(), str(tmp_path / "x.png"))
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_composite.py -v
```
Expected: FAIL — `No module named 'lightplot.composite'`

- [ ] **Step 3: Implement `lightplot/composite.py`**

```python
"""Side-by-side export: reference still + light plot in one image."""
from __future__ import annotations

import os

from PIL import Image
from PyQt6.QtCore import QByteArray
from PyQt6.QtGui import QImage, QPainter
from PyQt6.QtSvg import QSvgRenderer

from .diagram import render_plot_svg
from .plot import LightPlot

PANEL_H = 660 * 2  # 2x plot render for crispness
GAP = 24
BG = (20, 22, 28)


def _plot_png_bytes(plot: LightPlot) -> Image.Image:
    svg = render_plot_svg(plot)
    renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
    size = renderer.defaultSize() * 2
    qimg = QImage(size, QImage.Format.Format_ARGB32)
    qimg.fill(0)
    p = QPainter(qimg)
    renderer.render(p)
    p.end()
    buf = qimg.constBits()
    buf.setsize(qimg.sizeInBytes())
    img = Image.frombuffer("RGBA", (qimg.width(), qimg.height()), bytes(buf),
                           "raw", "BGRA", qimg.bytesPerLine())
    return img.convert("RGB")


def side_by_side_png(plot: LightPlot, out_path: str,
                     ref_image_path: str = "") -> str:
    ref_path = ref_image_path or plot.ref_image
    if not ref_path or not os.path.isfile(ref_path):
        raise ValueError("plot has no reference image to composite")
    plot_img = _plot_png_bytes(plot)
    ref = Image.open(ref_path).convert("RGB")
    scale = plot_img.height / ref.height
    ref = ref.resize((max(1, int(ref.width * scale)), plot_img.height),
                     Image.LANCZOS)
    canvas = Image.new("RGB",
                       (ref.width + GAP + plot_img.width, plot_img.height), BG)
    canvas.paste(ref, (0, 0))
    canvas.paste(plot_img, (ref.width + GAP, 0))
    canvas.save(out_path)
    return out_path
```

In `gui.py`'s Export menu add:

```python
        exp_menu.addAction("Side-by-side PNG…", self._export_side_by_side_dialog)
```
and the handler on `LightingVisualizerWidget`:

```python
    def _export_side_by_side_dialog(self):
        from .composite import side_by_side_png
        path, _ = QFileDialog.getSaveFileName(
            self, "Export side-by-side", "lightplot-board.png", "PNG (*.png)")
        if not path:
            return
        try:
            side_by_side_png(self.editor.plot(), path)
            self.status.setText(f"  exported {os.path.basename(path)}")
        except ValueError as e:
            self._error(str(e))
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_composite.py tests/ -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lightplot/composite.py lightplot/gui.py tests/test_composite.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: side-by-side export — reference still next to the light plot"
```

---

### Task 11: PDF contact sheet

**Files:**
- Create: `lightplot/contact_sheet.py`
- Modify: `lightplot/gui.py` (Export menu: "PDF contact sheet…" exporting the current plot as a one-page sheet)
- Test: `tests/test_contact_sheet.py`

**Interfaces:**
- Consumes: `render_plot_svg`, `LightPlot`, QPdfWriter, QSvgRenderer.
- Produces: `contact_sheet.write_pdf(plots: list[LightPlot], out_path: str, title: str = "Light Plots") -> str` — two shots per A4 page: each entry = shot name header, diagram, summary line. Used by Task 12 for the ScrivenLight whole-board export.

- [ ] **Step 1: Write failing tests**

`tests/test_contact_sheet.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.contact_sheet import write_pdf
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def test_writes_valid_pdf_for_multiple_plots(app, tmp_path):
    plots = [f() for f in TEMPLATES.values()]      # 7 plots -> 4 pages
    out = tmp_path / "board.pdf"
    write_pdf(plots, str(out), title="Sc 12 lighting")
    data = out.read_bytes()
    assert data.startswith(b"%PDF")
    assert len(data) > 5000


def test_empty_list_raises(app, tmp_path):
    with pytest.raises(ValueError, match="no plots"):
        write_pdf([], str(tmp_path / "x.pdf"))
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_contact_sheet.py -v
```
Expected: FAIL — `No module named 'lightplot.contact_sheet'`

- [ ] **Step 3: Implement `lightplot/contact_sheet.py`**

```python
"""PDF contact sheet: all shots' light plots, two per A4 page.

The 'send to gaffer/AD' artifact: name + diagram + summary per shot.
"""
from __future__ import annotations

from typing import List

from PyQt6.QtCore import QByteArray, QMarginsF, QRectF, Qt
from PyQt6.QtGui import QFont, QPageLayout, QPageSize, QPainter, QPdfWriter
from PyQt6.QtSvg import QSvgRenderer

from .diagram import render_plot_svg
from .plot import LightPlot

PER_PAGE = 2


def write_pdf(plots: List[LightPlot], out_path: str,
              title: str = "Light Plots") -> str:
    if not plots:
        raise ValueError("no plots to export")
    writer = QPdfWriter(out_path)
    writer.setPageSize(QPageSize(QPageSize.PageSizeId.A4))
    writer.setPageMargins(QMarginsF(12, 12, 12, 12),
                          QPageLayout.Unit.Millimeter)
    writer.setResolution(150)
    writer.setTitle(title)

    p = QPainter(writer)
    page_w = writer.width()
    page_h = writer.height()
    slot_h = page_h // PER_PAGE

    header = QFont("Helvetica", 11, QFont.Weight.Bold)
    body = QFont("Helvetica", 8)

    for i, plot in enumerate(plots):
        if i and i % PER_PAGE == 0:
            writer.newPage()
        top = (i % PER_PAGE) * slot_h
        p.setFont(header)
        p.drawText(QRectF(0, top, page_w, 40), 0, plot.name)
        svg = render_plot_svg(plot)
        renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
        avail = QRectF(0, top + 46, page_w, slot_h - 110)
        size = renderer.defaultSize()
        scale = min(avail.width() / size.width(),
                    avail.height() / size.height())
        target = QRectF(avail.x(), avail.y(),
                        size.width() * scale, size.height() * scale)
        renderer.render(p, target)
        p.setFont(body)
        flags = int(Qt.TextFlag.TextWordWrap.value) | \
            int(Qt.AlignmentFlag.AlignLeft.value)
        p.drawText(QRectF(0, target.bottom() + 6, page_w, 52), flags,
                   plot.summary or plot.mood)
    p.end()
    return out_path
```

In `gui.py` Export menu add:

```python
        exp_menu.addAction("PDF contact sheet…", self._export_pdf_dialog)
```
and handler:

```python
    def _export_pdf_dialog(self):
        from .contact_sheet import write_pdf
        path, _ = QFileDialog.getSaveFileName(
            self, "Export PDF", "lightplots.pdf", "PDF (*.pdf)")
        if not path:
            return
        try:
            write_pdf([self.editor.plot()], path,
                      title=self.editor.plot().name)
            self.status.setText(f"  exported {os.path.basename(path)}")
        except Exception as e:
            self._error(str(e))
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_contact_sheet.py tests/ -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lightplot/contact_sheet.py lightplot/gui.py tests/test_contact_sheet.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: PDF contact sheet export via QPdfWriter"
```

---

### Task 12: ScrivenLight integration — attach plots to storyboard frames

**Files:**
- Create: `scrivenlight/lightplot_bridge.py`
- Modify: `scrivenlight/tab_storyboard.py` (add "Open Light Plot…" button in the Lighting section + "Export Lighting PDF…" button; read `head -120` of the file first to place them in its existing layout style)
- Test: `tests/test_sl_bridge.py`

**Interfaces:**
- Consumes: `LightPlot`, `PlotEditorWidget`, `write_pdf`, ScrivenLight frame dicts (`frame["light_plot"]`, `frame["frame_image"]`, lighting text fields).
- Produces (in `scrivenlight/lightplot_bridge.py`):
  - `lightplot_available() -> bool` — True when the lightplot package imports (keeps ScrivenLight functional without it).
  - `frame_plot(frame: dict) -> "LightPlot | None"` — parse `frame["light_plot"]`; returns None on absent/malformed data (malformed logs a warning, never raises).
  - `store_plot(frame: dict, plot) -> list[str]` — writes `frame["light_plot"] = plot.to_dict()`, then fills `lighting_setup`, `key_light`, `fill_light`, `background_light` **only where empty**; returns which fields were filled.
  - `light_description(plot, role: str) -> str` — e.g. `"softbox · 5600K · 45° camera left"` for the first light of that role, `""` if none.
  - `open_plot_dialog(parent, frame: dict) -> bool` — modal QDialog hosting `PlotEditorWidget` (+ an "Analyze frame still" button when `frame["frame_image"]` exists and no plot is stored yet); on OK, calls `store_plot`. Returns True if saved.
  - `export_storyboard_pdf(parent, project) -> None` — collects `frame_plot()` for every storyboard frame that has one and calls `write_pdf` (file dialog for destination; message box when no frames carry plots).

- [ ] **Step 1: Write failing tests**

`tests/test_sl_bridge.py`:

```python
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from scrivenlight.lightplot_bridge import (frame_plot, store_plot,
                                           light_description,
                                           lightplot_available)
from scrivenlight.project import new_storyboard_frame
from lightplot.templates import TEMPLATES
from lightplot.rig import ROLE_KEY


def test_lightplot_available():
    assert lightplot_available()


def test_store_and_reload_plot_on_frame():
    frame = new_storyboard_frame()
    plot = TEMPLATES["Three-Point"]()
    filled = store_plot(frame, plot)
    assert frame["light_plot"]["format"] == "lightplot-2"
    assert "key_light" in filled
    plot2 = frame_plot(frame)
    assert plot2.name == "Three-Point"


def test_autofill_respects_existing_values():
    frame = new_storyboard_frame()
    frame["key_light"] = "ARRI M18"                   # user already chose
    filled = store_plot(frame, TEMPLATES["Three-Point"]())
    assert frame["key_light"] == "ARRI M18"           # untouched
    assert "key_light" not in filled
    assert frame["fill_light"]                        # empty ones filled


def test_malformed_plot_returns_none():
    frame = new_storyboard_frame()
    frame["light_plot"] = {"format": "lightplot-2", "lights": "corrupt"}
    assert frame_plot(frame) is None
    frame["light_plot"] = "not even a dict"
    assert frame_plot(frame) is None
    assert frame_plot(new_storyboard_frame()) is None  # absent key


def test_light_description_language():
    plot = TEMPLATES["Three-Point"]()
    desc = light_description(plot, ROLE_KEY)
    assert "5600K" in desc and "camera left" in desc
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_sl_bridge.py -v
```
Expected: FAIL — `No module named 'scrivenlight.lightplot_bridge'`

- [ ] **Step 3: Implement `scrivenlight/lightplot_bridge.py`**

```python
"""Bridge between ScrivenLight storyboard frames and lightplot documents.

A storyboard frame dict may carry a 'light_plot' key holding a LightPlot
as a plain dict (format 'lightplot-2'). Absent key = no plot. Malformed
data must never break project load — frame_plot returns None and logs.

ScrivenLight must keep working when lightplot isn't importable, so every
lightplot import happens lazily behind lightplot_available().
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

AUTOFILL_FIELDS = ("lighting_setup", "key_light", "fill_light",
                   "background_light")


def lightplot_available() -> bool:
    try:
        import lightplot  # noqa: F401
        return True
    except ImportError:
        return False


def frame_plot(frame: dict):
    """LightPlot stored on the frame, or None (absent or malformed)."""
    data = frame.get("light_plot")
    if not isinstance(data, dict):
        return None
    try:
        from lightplot.plot import LightPlot
        plot = LightPlot.from_dict(data)
        _ = plot.to_rig()        # force-validate light entries
        return plot
    except Exception as e:
        logger.warning("Ignoring malformed light_plot on frame: %s", e)
        return None


def light_description(plot, role: str) -> str:
    """Short set-language description of the first light with `role`."""
    for light in plot.lights:
        if light.role == role:
            src = plot.light_source(light)
            bits = [b for b in (src.modifier, f"{src.color_temp_k}K",
                                src.position_label().split(",")[0]) if b]
            return " · ".join(bits)
    return ""


def store_plot(frame: dict, plot) -> list:
    """Store the plot on the frame; autofill empty lighting text fields.

    Mirrors project.autofill_frame's convention: never overwrite a value
    the user already set. Returns the list of fields that were filled.
    """
    from lightplot.rig import ROLE_KEY, ROLE_FILL, ROLE_BACKGROUND
    frame["light_plot"] = plot.to_dict()
    values = {
        "lighting_setup": plot.mood or plot.name,
        "key_light": light_description(plot, ROLE_KEY),
        "fill_light": light_description(plot, ROLE_FILL),
        "background_light": light_description(plot, ROLE_BACKGROUND),
    }
    filled = []
    for field in AUTOFILL_FIELDS:
        if not frame.get(field) and values[field]:
            frame[field] = values[field]
            filled.append(field)
    return filled


def open_plot_dialog(parent, frame: dict) -> bool:
    """Modal editor for the frame's light plot. True if saved."""
    from PyQt6.QtWidgets import (QDialog, QDialogButtonBox, QPushButton,
                                 QVBoxLayout)
    from lightplot.editor import PlotEditorWidget
    from lightplot.plot import LightPlot

    dlg = QDialog(parent)
    dlg.setWindowTitle("Light Plot")
    dlg.resize(1200, 760)
    layout = QVBoxLayout(dlg)
    editor = PlotEditorWidget()
    existing = frame_plot(frame)
    if existing is not None:
        editor.set_plot(existing)
    else:
        blank = LightPlot(name=f"Sc {frame.get('scene', '')} · "
                               f"Shot {frame.get('shot', '')}".strip(" ·"))
        editor.set_plot(blank)
    layout.addWidget(editor, 1)
    buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Save
                               | QDialogButtonBox.StandardButton.Cancel)
    if frame.get("frame_image") and existing is None:
        analyze_btn = QPushButton("Analyze frame still")

        def _analyze():
            from lightplot.analyze import analyze
            from lightplot.plot import LightPlot as LP
            try:
                rig = analyze(frame["frame_image"])
                editor.set_plot(LP.from_rig(rig,
                                            ref_image=frame["frame_image"]))
            except Exception as e:
                from PyQt6.QtWidgets import QMessageBox
                QMessageBox.warning(dlg, "Light Plot",
                                    f"Analysis failed:\n{e}")
        analyze_btn.clicked.connect(_analyze)
        buttons.addButton(analyze_btn,
                          QDialogButtonBox.ButtonRole.ActionRole)
    buttons.accepted.connect(dlg.accept)
    buttons.rejected.connect(dlg.reject)
    layout.addWidget(buttons)
    if dlg.exec() == QDialog.DialogCode.Accepted:
        store_plot(frame, editor.plot())
        return True
    return False


def export_storyboard_pdf(parent, project) -> None:
    """PDF contact sheet of every storyboard frame that carries a plot."""
    from PyQt6.QtWidgets import QFileDialog, QMessageBox
    from lightplot.contact_sheet import write_pdf

    plots = []
    for frame in project.storyboard:
        plot = frame_plot(frame)
        if plot is not None:
            label = f"Sc {frame.get('scene', '?')} · Shot " \
                    f"{frame.get('shot', '?')} — {plot.name}"
            plot.name = label
            plots.append(plot)
    if not plots:
        QMessageBox.information(parent, "Light Plots",
                                "No storyboard frames have light plots yet.")
        return
    path, _ = QFileDialog.getSaveFileName(parent, "Export lighting PDF",
                                          "lighting-board.pdf", "PDF (*.pdf)")
    if path:
        write_pdf(plots, path, title=project.title)
```

- [ ] **Step 4: Wire into the Storyboard tab**

Read `scrivenlight/tab_storyboard.py` fully first. In the section builder where the `Lighting` group's fields are created (the `SECTIONS` entry `("Lighting", [...])`), add two buttons after the lighting field rows, following the file's existing widget-creation style:

```python
        # inside the Lighting section construction, after its field rows:
        from .lightplot_bridge import (lightplot_available, open_plot_dialog,
                                       export_storyboard_pdf)
        if lightplot_available():
            plot_btn = QToolButton()
            plot_btn.setText("Open Light Plot…")
            plot_btn.clicked.connect(self._open_light_plot)
            pdf_btn = QToolButton()
            pdf_btn.setText("Export Lighting PDF…")
            pdf_btn.clicked.connect(
                lambda: export_storyboard_pdf(self, self.project))
            # add both to the Lighting section's layout
```
and the handler on `StoryboardTab`:

```python
    def _open_light_plot(self):
        if self._current is None:
            return
        from .lightplot_bridge import open_plot_dialog
        if open_plot_dialog(self, self._current):
            self._load_frame(self._current)   # refresh autofilled fields
            self.changed.emit()
```
Adapt the two integration points to the file's actual structure (`self._current` is the selected frame dict; find the method that reloads the form — it may be named differently, e.g. `_show_frame` — and call that one). The bridge module carries all logic, so this wiring stays minimal.

- [ ] **Step 5: Run tests + full suite**

```bash
python3 -m pytest tests/test_sl_bridge.py tests/ -v
```
Expected: all PASS.

Manual check that ScrivenLight still launches:

```bash
QT_QPA_PLATFORM=offscreen timeout 8 python3 -c "
from PyQt6.QtWidgets import QApplication
import scrivenlight.window as w
app = QApplication([])
print('scrivenlight imports ok')"
```
Expected: `scrivenlight imports ok`

- [ ] **Step 6: Commit**

```bash
git add scrivenlight/lightplot_bridge.py scrivenlight/tab_storyboard.py tests/test_sl_bridge.py && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "feat: attach light plots to ScrivenLight storyboard frames with empty-only autofill + lighting PDF"
```

---

### Task 13: README, exports, version bump, manual QA

**Files:**
- Modify: `lightplot/README.md`
- Modify: `lightplot/__init__.py` (version `0.2.0`; export `PlotEditorWidget` lazily is NOT needed — Qt imports stay out of `__init__`; export `LightPlot`, `render_plot_svg`, `TEMPLATES`)
- Modify: `requirements.txt` (no new deps — verify only)
- Create: `docs/superpowers/plans/2026-07-06-lightplot-v2-qa-checklist.md`

**Interfaces:** none new.

- [ ] **Step 1: Update `lightplot/__init__.py`**

```python
from .rig import LightSource, LightingRig
from .plot import LightPlot
from .analyze import analyze, analyze_image
from .diagram import render_svg, render_plot_svg, save_svg
from .templates import TEMPLATES

__version__ = "0.2.0"
__all__ = ["LightSource", "LightingRig", "LightPlot", "analyze",
           "analyze_image", "render_svg", "render_plot_svg", "save_svg",
           "TEMPLATES"]
```
(Keep the existing module docstring; GUI classes are imported from `lightplot.gui` / `lightplot.editor` directly so importing the package never requires PyQt6.)

- [ ] **Step 2: Update `lightplot/README.md`**

Rewrite to cover (keep the honest-limits section and expand it with the analyzer verification findings from Task 1):
- The three starting points (analyze / template / describe).
- The editor: what's draggable, tools, undo, snap, guards.
- Blocking: subjects, camera, set elements, move arrows.
- ScrivenLight: how plots attach to storyboard frames, autofill behavior, lighting PDF.
- Exports: SVG, PNG, side-by-side, PDF contact sheet.
- Library use: `LightPlot.from_rig`, `render_plot_svg`, `TEMPLATES`.
- Comparison paragraph: what lightplot now covers vs Shot Designer (2D plots, blocking arrows, per-shot boards) and what it deliberately doesn't (3D preview, fixture inventories, DMX).

- [ ] **Step 3: Write the manual QA checklist**

`docs/superpowers/plans/2026-07-06-lightplot-v2-qa-checklist.md` — items for a hands-on session (each is a checkbox): drag every item type and undo it; zoom/pan/fit; place each set-element tool with two clicks; Esc cancels a tool; draw a move arrow with a subject selected and double-click to commit; duplicate a light with Ctrl+D; delete guards (last subject, camera); CT presets update the diagram color; analyze a real still (heuristic + claude if available); describe-to-setup dialog (with and without credential); save/reopen a .lightplot.json; ScrivenLight: attach plot to frame, verify autofill, reopen and edit, export lighting PDF, open an old .slt without plots; all four export forms open correctly in a viewer.

- [ ] **Step 4: Run the full suite one final time**

```bash
python3 -m pytest tests/ -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lightplot/__init__.py lightplot/README.md docs/superpowers/plans/2026-07-06-lightplot-v2-qa-checklist.md && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "docs: lightplot v2 README, exports, 0.2.0, manual QA checklist"
```

- [ ] **Step 6: Manual QA session with the user**

Launch `python3 -m lightplot --gui` and walk the QA checklist together — the drag-feel, label legibility, and dialog flows can only be judged by hand (and by a DOP).
