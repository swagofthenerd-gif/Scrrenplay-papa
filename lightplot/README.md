# lightplot — lighting & blocking pre-production for Papa Pre Production

Design a shot's lighting and blocking before you're on set, and read it back
as a **god's-eye light plot** — an overhead diagram in the language a DOP
actually uses: key/fill/rim/background, azimuth and elevation, softness,
contrast ratio, color temperature, a suggested modifier per unit, plus
subjects, camera, set elements (walls, doors, windows, flags, furniture) and
blocking move arrows.

```
        analyze a still ┐
  start from a template ├─▶ LightPlot (editable, JSON) ─▶ god's-eye diagram
    describe the look   ┘        │                    ├─▶ text breakdown
                                 └── drag / edit ──────┴─▶ SVG · PNG · side-by-side · PDF
```

## Three ways to start

| Start | How | Needs |
|---|---|---|
| **Analyze** a reference still | `New ▸ Analyze image…` (or CLI) | offline CV, or Claude vision if available |
| **Template** | `New ▸ From template` — Three-Point, Rembrandt, Book Light, Butterfly, Split, Silhouette, Window Daylight | nothing |
| **Describe the look** | `New ▸ Describe the look… (Claude)` — type a DOP brief, Claude drafts a buildable rig | `pip install anthropic` + API credential |

## The editor

Everything is a **pure function of the model**: the canvas rebuilds from the
`LightPlot`, so undo/redo is total and reliable.

- **Draggable:** lights, subjects, camera, set elements, move arrows. Lights
  aim at the primary subject live as you drag; position labels stay correct.
- **Add tools:** lights (per role), subjects, and two-click set elements
  (wall / door / window / flag / furniture). Move arrows: select a subject or
  camera, click waypoints, double-click to commit. **Esc** cancels a tool.
- **Properties panel** edits the selected item; every change is undoable.
  Color-temp presets: Tungsten 3200K, Daylight 5600K, Warm practical 2400K,
  Cool window 6500K.
- **Snap** to a 25 cm grid, wheel-zoom, **Fit**, **Ctrl+D** duplicate.
- **Guards:** you can't delete the camera or the last subject; deleting a
  subject removes its move arrows and reassigns the primary reference.

## Blocking

Subjects carry a facing direction; the camera carries an aim. Set elements
are drawn from absolute points (walls/windows as lines, furniture as a box).
Move arrows are dashed paths with an arrowhead and an optional label — the
overhead blocking a 1st AD or gaffer can read at a glance.

## Exports

| Form | What |
|---|---|
| **SVG** | self-contained vector plot |
| **PNG** | 2× raster of the plot |
| **Side-by-side PNG** | reference still next to the rendered plot, equal heights |
| **PDF contact sheet** | one or many plots, two shots per A4 page — the "send to the gaffer/AD" artifact |

## Inside ScrivenLight

The editor is a plain `QWidget`, so ScrivenLight embeds it against a
storyboard frame. In the Storyboard tab's **Lighting** section:

- **Open Light Plot…** — edit (or analyze the frame still into) a plot
  attached to the current frame. On save the plot is stored on the frame as
  `light_plot` (format `lightplot-2`), and the lighting text fields
  (`lighting_setup`, `key_light`, `fill_light`, `background_light`) are
  **autofilled only where empty** — a value you already typed is never
  overwritten.
- **Export Lighting PDF…** — a contact sheet of every storyboard frame that
  carries a plot.

Malformed plot data never breaks project load: `frame_plot()` returns `None`
and logs. ScrivenLight also runs fine if lightplot isn't importable — every
lightplot import is lazy behind `lightplot_available()`.

## Run it

```bash
pip install Pillow numpy PyQt6          # optional: pip install anthropic

# CLI: writes <image>-lightplot.svg
python -m lightplot still.jpg
python -m lightplot still.jpg -o plot.svg --json rig.json --backend claude

# Desktop app
python -m lightplot --gui [still.jpg | setup.lightplot.json]
```

## Use it as a library

```python
from lightplot import analyze, LightPlot, render_plot_svg, TEMPLATES

# a template, or from an analyzed still
plot = TEMPLATES["Rembrandt"]()
plot = LightPlot.from_rig(analyze("still.jpg"), ref_image="still.jpg")

svg = render_plot_svg(plot)              # self-contained SVG string
open("setup.lightplot.json", "w").write(plot.to_json())   # round-trips
```

## What it honestly does (and doesn't)

Lighting reconstruction from a single image is ill-posed: a big soft source
far away and a small soft source close up can produce nearly identical
images. lightplot outputs **a setup that would reproduce the look**, not a
forensic measurement — direction, softness, key/fill ratio and color
temperature come back with useful confidence (each light carries a
`confidence`); distances are suggestions.

Verified against synthetic renders with known ground-truth lighting
(direction sign, softness ordering, CT class, rim presence/absence,
elevation). Heuristic limits: assumes a roughly centered subject, a single
dominant key, no cast-shadow reasoning — the Claude backend covers those.

**Versus Shot Designer:** lightplot covers 2D overhead plots, blocking
arrows, and per-shot boards attached to your storyboard. It deliberately does
**not** do 3D preview, fixture inventories, or DMX/console programming — it's
a pre-production drawing and communication tool, not a lighting console.

## Conventions

- `azimuth_deg`: seen from above; 0 = at the camera, **positive = camera
  left**, ±180 = directly behind the subject.
- `elevation_deg`: 0 = eye level, 90 = overhead.
- `softness`: 0 = hard point source → 1 = large wrapping source.
- `intensity`: relative to the key (key = 1.0).

## Module layout

```
lightplot/
  rig.py             LightingRig / LightSource dataclasses + JSON
  plot.py            LightPlot editable document (subjects, camera, set, moves)
  analyze.py         offline heuristic analyzer (Pillow + numpy)
  claude_backend.py  optional Claude vision + describe-to-setup
  templates.py       classic lighting-setup factories
  diagram.py         god's-eye SVG renderer
  canvas.py          interactive QGraphicsScene / items
  commands.py        undoable model operations
  props.py           properties panel
  editor.py          embeddable editor widget (canvas + toolbar + props + breakdown)
  gui.py             standalone app shell (file handling + exports)
  composite.py       side-by-side PNG export
  contact_sheet.py   PDF contact sheet export
  __main__.py        CLI
```
