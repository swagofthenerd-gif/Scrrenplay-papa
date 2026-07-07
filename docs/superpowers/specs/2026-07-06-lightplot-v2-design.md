# lightplot v2 — analyze, create, block, board

**Date:** 2026-07-06
**Status:** Approved design, pending implementation plan
**Owner:** Shaharyar (DOP) — this tool is built for working DOPs

## Problem

lightplot v1 only analyzes: image in, static god's-eye SVG out. A DOP also
needs to *author* — build a lighting setup from scratch, block actors and
camera, revise the plot by hand, and save setups per shot so the whole
storyboard can go to the gaffer/AD. The competitive bar is Shot Designer
(draggable 2D overhead diagrams with actors, camera, lights, set geometry,
and blocking movement, organized by scene/shot); lightplot's differentiator
on top of that bar is AI: analyze a reference still into an editable plot,
or describe a look in words and get a draft rig.

## Goals

1. Interactive god's-eye editor: drag lights, subjects (multiple), and
   camera; edit all light parameters; simple set geometry (walls, doors,
   windows, furniture, flags/negative fill); movement arrows (subject or
   camera path A → B within a shot).
2. Three ways to start a plot: analyze an image (existing pipeline),
   pick a classic template, or describe the look in text (Claude drafts it).
3. Plots attach to ScrivenLight storyboard frames inside the `.slt`
   project; standalone app keeps working with its own files.
4. Exports: per-shot SVG/PNG, side-by-side (reference still + plot), and a
   PDF contact sheet of all shots.
5. Verify the existing analyzer actually works end-to-end and pin down its
   honest limits, with regression tests, *before* building on it.

## Non-goals

- 3D rendering or photometric simulation (set.a.light 3D territory).
- Fixture inventory / power distribution / DMX (Vectorworks territory).
- Forensic accuracy of analysis — v1's "plausible setup, not measurement"
  stance stands.
- Multi-position blocking *animation* (playback). Arrows show moves; they
  don't animate.

## Architecture

```
                    ┌── analyze(image) ──▶ LightingRig ──┐
starting points ────┼── templates.py  ────────────────────┼──▶ LightPlot ──▶ editor (QGraphicsScene)
                    └── describe(text) ─▶ LightingRig ───┘        │
                                                                  ├──▶ render_svg / PNG / side-by-side
                                                                  ├──▶ PDF contact sheet (QPdfWriter)
                                                                  └──▶ .lightplot.json / .slt storyboard frame
```

`LightingRig` (rig.py) is unchanged — it remains the analyzer output
language. `LightPlot` (new plot.py) is the editable document. The editor
scene and the SVG renderer both draw from `LightPlot`, so what you edit is
exactly what exports.

## Components

### 1. Data model — `lightplot/plot.py` (new)

All positions in absolute plan meters, +x = screen right, +y = toward
camera (matching the current renderer's orientation). Dataclasses, JSON
round-trip, `format: "lightplot-2"` version field.

- **`LightPlot`** — `name`, `notes`, `mood`, `ref_image` (path),
  `lights: [PlotLight]`, `subjects: [Subject]`, `camera: Camera`,
  `set_elements: [SetElement]`, `moves: [Move]`, `analyzer` provenance.
- **`PlotLight`** — `x, y, aim_deg` plus every existing `LightSource`
  parameter (`role`, `elevation_deg`, `softness`, `intensity`,
  `color_temp_k`, `color_hex`, `modifier`, `confidence`, `notes`).
  Azimuth/distance are **derived** from geometry relative to the primary
  subject (for the DOP-language breakdown), never stored.
- **`Subject`** — `id`, `name`, `x, y`, `facing_deg`, `primary: bool`
  (exactly one primary; breakdown language is relative to it).
- **`Camera`** — `x, y`, `aim_deg`, optional `label` (e.g. "A-cam 35mm").
- **`SetElement`** — `kind` in `{wall, door, window, flag, furniture}`,
  `points: [(x, y)]` (polyline for walls, rect for furniture), `label`.
  Windows matter: they are motivated sources.
- **`Move`** — `target_id` (subject id or `"camera"`),
  `waypoints: [(x, y)]`, `label` (e.g. "crosses to window").
- **Conversions:** `LightPlot.from_rig(rig, ref_image)` places rig lights
  around a default primary subject at origin, camera at (0, 2.2);
  `plot.breakdown()` regenerates the per-light DOP text (reusing
  `LightSource.position_label` etc. via derived azimuth/elevation).

### 2. Interactive editor — rewrite of `lightplot/gui.py` around `QGraphicsScene`

- **Canvas** (`QGraphicsView`): meter grid + rings, wheel zoom, pan,
  snap-to-grid toggle. Scene items: `LightItem` (icon + live beam wedge +
  rotation handle for aim), `SubjectItem`, `CameraItem` (with FOV wedge),
  `WallItem`/`WindowItem`/`FlagItem`/`FurnitureItem`, `MoveArrowItem`.
  Items drag; model updates on drag-end (single undo entry per drag).
- **Properties panel** (right side) edits the selection. For a light:
  role, intensity, color temperature (with tungsten/daylight/practical
  presets), softness, modifier, gel color, notes. For subjects: name,
  primary toggle. For the plot itself: name, mood, notes.
- **Toolbar:** add light / subject / wall / window / flag / furniture /
  move arrow; delete; duplicate (Ctrl+D); undo/redo (`QUndoStack`).
- **Live breakdown panel:** the DOP text updates as items move.
- The old analyze-and-view flow becomes: analysis produces a plot that
  opens in this editor (fully editable) instead of a static image.
- `LightingVisualizerWidget` name and embed contract (plain QWidget)
  are preserved so ScrivenLight can embed it as before.

### 3. Starting points

- **Analyze image** — existing `analyze()`; result converted with
  `LightPlot.from_rig`.
- **Templates — `lightplot/templates.py` (new):** factories returning
  `LightPlot`s: three-point, Rembrandt, butterfly/paramount, book light,
  two-camera interview, day-exterior negative fill, night-interior
  motivated practical. Menu: New from Template.
- **Describe it** — dialog with a text box; sends the description to the
  existing Claude backend (`claude_backend.py` gains
  `describe_to_rig(text) -> LightingRig`, reusing the same strict JSON
  schema, no image block). Requires the anthropic package + credential,
  same as image analysis; when unavailable the dialog says so and points
  at templates.

### 4. ScrivenLight integration + standalone

- Storyboard frame dicts gain a `light_plot` key (plot JSON dict).
  Absent key = no plot; old `.slt` files load unchanged.
- Storyboard tab, Lighting section: **"Open Light Plot…"** button opens
  the editor as a dialog seeded from the frame (`frame_image` offered for
  analysis if set). On save: plot stored in the frame, and the frame's
  `lighting_setup`, `key_light`, `fill_light`, `background_light` text
  fields are auto-filled from the plot **only where currently empty**
  (same non-overwrite convention as `autofill_frame`).
- Standalone `python -m lightplot --gui`: File New/Open/Save for
  `.lightplot.json` (a single `LightPlot`), recent-files, and the CLI
  keeps `python -m lightplot image.jpg` producing an SVG as today.

### 5. Exports

- **SVG/PNG per shot** — `diagram.py` extended to render a `LightPlot`:
  subjects at their real positions, camera wherever placed, walls /
  windows / furniture / flags, move arrows with labels. A thin
  `render_svg(rig)` wrapper (via `from_rig`) keeps the v1 API working.
- **Side-by-side** — export option: reference still left, plot right,
  one composite image (PNG) or SVG with embedded image.
- **PDF contact sheet** — `lightplot/contact_sheet.py` (new) using Qt's
  `QPdfWriter`: one shot per half-page (name, diagram, breakdown), in
  scene/shot order. Reachable from ScrivenLight (all frames with plots)
  and from the standalone app (all open plots).

### 6. Analyzer verification (first implementation phase, not last)

- Generate controlled synthetic test images (gradient spheres / lit
  portraits with known key direction, softness, ratio) and assert the
  heuristic backend recovers direction within tolerance and orders
  softness/ratio correctly.
- Smoke-test CLI (`python -m lightplot img.jpg`), JSON round-trip, and
  SVG output end-to-end; fix any bugs found.
- Document honest limits (single-key bias, distance ambiguity) in the
  README — the competitive claim is "editable AI-seeded plots," not
  "perfect reconstruction."

## Error handling

- Claude backend unavailable (no package/credential/network): analysis
  falls back to heuristic (existing `auto` behavior); describe-it dialog
  disables with an explanatory message. Never crash the editor.
- Malformed `light_plot` data in an `.slt`: log, treat frame as having no
  plot, do not block project load.
- Editor guards: cannot delete the last subject or the camera; deleting a
  subject deletes its moves; primary-subject reassignment on delete.
- File writes (JSON/SVG/PNG/PDF) report failures in the status bar /
  message box, never silently.

## Testing

- **Unit:** plot JSON round-trip (plot ↔ dict, inside a frame dict inside
  an `.slt`), `from_rig` geometry (azimuth/distance → x,y → derived
  azimuth matches), derived breakdown labels, template validity (every
  template round-trips and has exactly one primary subject), renderer
  output (SVG string contains expected elements/coordinates), analyzer
  tolerance tests on synthetic images, ScrivenLight attach + autofill
  (empty-only fill respected).
- **GUI smoke:** widget constructs, scene populates from a plot, undo
  stack works for a programmatic move (offscreen Qt platform).
- **Manual:** drag interactions, dialogs, exports checked by hand;
  a manual QA checklist ships with the implementation plan.

## Implementation order

1. Analyzer verification + regression tests (protects the foundation).
2. `plot.py` model + `from_rig` + tests.
3. Renderer extension to `LightPlot` + tests.
4. Editor: canvas + drag + properties panel + undo (largest phase).
5. Set elements + move arrows.
6. Templates + describe-it.
7. Standalone file handling; ScrivenLight frame attachment + autofill.
8. Exports: side-by-side, PDF contact sheet.
9. README + manual QA pass.
