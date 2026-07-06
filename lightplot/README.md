# lightplot — AI lighting visualization for Papa Pre Production

Give it a reference image; get back a **god's-eye light plot** — an overhead
set diagram showing where and how each light was (plausibly) placed to get
that look, in the language a DOP actually uses: key/fill/rim/background,
azimuth and elevation, softness, contrast ratio, color temperature, and a
suggested modifier for each unit.

```
image ──▶ analyzer ──▶ LightingRig (parametric, JSON) ──▶ SVG god's-eye diagram
                                                     └──▶ text breakdown
```

## What it honestly does

Lighting reconstruction from a single image is ill-posed: a big soft source
far away and a small soft source close up can produce nearly identical
images. lightplot therefore outputs **a setup that would reproduce the
look**, not a forensic measurement. Direction, softness, key/fill ratio and
color temperature are recovered with useful confidence (each light carries a
`confidence` value); distances are labeled as suggestions.

## Two analysis backends

| Backend | Needs | Good at |
|---|---|---|
| `heuristic` (default) | nothing — offline CV (Pillow + numpy) | single-key portrait/interview looks: key direction, softness, ratio, CT, rim & background detection |
| `claude` | `pip install anthropic` + an API credential | multi-light scenes, practicals, motivated sources, unusual framings — full DOP-quality readings |

`--backend auto` uses Claude when available and falls back to the heuristic.
The Claude backend sends the image to `claude-opus-4-8` with a strict JSON
schema, so both backends produce the identical `LightingRig` structure.

## Run it

```bash
pip install Pillow numpy PyQt6          # PyQt6 only needed for the GUI
                                        # optional: pip install anthropic

# CLI: writes <image>-lightplot.svg
python -m lightplot still.jpg
python -m lightplot still.jpg -o plot.svg --json rig.json --backend claude

# Desktop app
python -m lightplot --gui [still.jpg]
```

## Use it as a library

```python
from lightplot import analyze, render_svg

rig = analyze("still.jpg")              # LightingRig
print(rig.summary)                      # DOP-readable paragraph
for light in rig.lights:
    print(light.role, light.position_label(), light.softness_label())
svg = render_svg(rig)                   # self-contained SVG string
```

`LightingRig.to_json()` / `from_json()` round-trip cleanly, so rigs can be
stored inside a project file.

## Adding it to ScrivenLight later

The GUI is a plain `QWidget` with no dependency on the main window, so the
integration is one tab:

```python
# in scrivenlight/window.py, next to the other tabs
from lightplot.gui import LightingVisualizerWidget
self.tabs.addTab(LightingVisualizerWidget(), "Light Plot")
```

Natural deeper integration (future): attach a `LightingRig` to each
Storyboard frame — the frame already has a "full lighting setup" field —
and store the rig JSON in the `.slt` project file.

## Module layout

```
lightplot/
  rig.py             LightingRig / LightSource dataclasses + JSON (de)serialization
  analyze.py         offline heuristic analyzer (Pillow + numpy)
  claude_backend.py  optional Claude-vision analyzer (strict JSON schema)
  diagram.py         god's-eye SVG renderer (no dependencies)
  gui.py             PyQt6 widget + standalone window
  __main__.py        CLI
```

## Conventions

- `azimuth_deg`: seen from above; 0 = at the camera, **positive = camera
  left**, ±180 = directly behind the subject.
- `elevation_deg`: 0 = eye level, 90 = overhead.
- `softness`: 0 = hard point source → 1 = large wrapping source.
- `intensity`: relative to the key (key = 1.0).

## How the heuristic works (v1)

Luminance-weighted centroid of a center-weighted subject region gives the
image-plane light vector (direction); the 80th/20th-percentile contrast
ratio sets how far off-axis the key sits and the key/fill ratio; softness
combines shadow *wrap* (how little of the subject sits at the shadow floor)
with shadow-edge sharpness; color temperature comes from the highlight
chromaticity via McCamy's CCT approximation; a rim light is detected as a
bright shell on the side of the subject facing away from the key; the
background border region is reported as its own source. Verified against
synthetic renders with known ground-truth lighting (direction sign, softness
ordering, CT class, rim presence/absence, elevation).

Known v1 limits: assumes the subject is roughly centered; single dominant
key; no cast-shadow reasoning. The Claude backend covers those cases today;
a trained model (synthetic Blender data → light-parameter regression) is the
planned v2 of the offline path.
