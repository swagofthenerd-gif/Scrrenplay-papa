# ScrivenLight

A minimal, fast film-production app for Fedora 44 (and any Linux with Python 3 +
Qt6). It pairs an industry-standard screenplay editor with a full set of
StudioBinder-style production tabs — all in one clean, distraction-free window,
saved to a single project file.

## Tabs

- **Script** — screenplay editor with proper formatting (Scene Heading, Action,
  Character, Dialogue, Parenthetical, Transition, Shot), `Tab`/`Enter` element
  flow, auto-uppercasing, character/location autocomplete, and a scene navigator.
- **Shot List** — per-shot grid with Shot Size, Camera Angle, Movement, Equipment,
  Lens, Sound, Location, Lighting, Est. Takes, Time, Description, and a Done
  checkbox. **Generate from Script** creates one shot row per scene. CSV export.
- **Storyboard** — a detailed pre-production board. Each frame is a card with a
  reference image and the full camera package: shot size, angle, movement, camera
  body (ARRI/RED/Sony/Blackmagic…), lens series (Cooke/Zeiss/ARRI…), focal length,
  T-stop, filter, frame rate, shutter, ISO, white balance, codec, support/rig,
  full lighting setup (key/fill/background units), sound, VFX, props, wardrobe,
  takes, and notes. Generate one frame per scene; export to PDF.
- **Lighting** — a DP's **lighting breakdown**: a draggable top-down diagram
  where you drop numbered fixtures (key, fill/bounce, back/rim, diffusion,
  practical, negative-fill flags, ambient spill) around a subject and camera.
  Each fixture carries its unit, modifier, intensity and gel; the numbered
  **legend** and **set notes** read straight off the diagram. Attach a
  reference frame, seed a plan from any storyboard frame's Lighting Setup with
  **Generate from Storyboard**, and export a one-page breakdown to PDF.
  Optional **Draft from Frame** uses a vision model to propose a fixture layout
  from a reference still (needs `ANTHROPIC_API_KEY` + the `anthropic` package;
  it only ever suggests a starting point).
- **Schedule** — stripboard shooting schedule (Day, Scene, INT/EXT, Set, D/N,
  Pages, Cast, Time). **Generate from Script** auto-fills INT/EXT and Day/Night
  by parsing each scene heading.
- **Call Sheets** — one call sheet per shoot day with the real StudioBinder fields
  (date, general call, location, address, nearest hospital, weather, sunrise/
  sunset, notes, bulletins), an embedded day schedule and crew-call grid, and a
  clean printable text export.
- **Contacts** — cast & crew directory (Name, Role, Department, Phone, Email,
  Call Time, Notes) with department dropdown.
- **Budget** — line-item budget by category with auto-calculated subtotals
  (Qty × Rate) and a live running total.

Everything saves to one `.slt` JSON project file. The screenplay also imports/
exports **Fountain** so it works with any other screenwriting tool.

## How to run (Fedora 44)

```bash
tar -xzf scrivenlight.tar.gz
cd scrivenlight
./install.sh
```

The installer pulls in PyQt6 (`sudo dnf install python3-pyqt6`), copies the app
to `~/.local`, and adds **ScrivenLight** to your app menu. Launch it from
Activities or run `scrivenlight`.

If `scrivenlight` isn't found afterward, add `~/.local/bin` to your PATH:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

### Run without installing

```bash
sudo dnf install python3-pyqt6
python3 main.py
```

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| New / Open / Save / Save As | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| Script element 1–6 (Scene…Transition) | `Ctrl+1` … `Ctrl+6` |
| Cycle element fwd / back (in editor) | `Tab` / `Shift+Tab` |
| Go to tab (Shot List…Budget) | `Alt+2` … `Alt+6` |
| Toggle theme | `Ctrl+D` |
| Toggle scene list | `Ctrl+B` |

## Project layout

```
scrivenlight/
  elements.py        element types, margins, casing, flow rules
  model.py           Screenplay model + .slt / Fountain (de)serialization
  project.py         Project model: shots, schedule, call sheets, contacts, budget
  editor.py          formatting-aware screenplay editor widget
  datagrid.py        reusable spreadsheet grid (shots/schedule/contacts/budget)
  tab_script.py      Script tab (editor + scene navigator)
  tabs_grid.py       Shot List, Schedule, Contacts, Budget tabs
  tabs_callsheet.py  Call Sheets tab
  window.py          tabbed main window, menus, file ops
  theme.py           dark & light stylesheets
main.py              entry point
install.sh           Fedora installer
```

## Notes

Grid columns are editable inline; dropdown cells (shot size, angle, movement,
department, category, INT/EXT, D/N) are editable too — pick a preset or type your
own. Budget subtotals and the grand total recompute as you type. Page count in
the script is an estimate suited to drafting rather than true typeset pagination.

## What's new

- Storyboard tab with complete pre-production camera/lens/lighting spec per frame.
- Contacts now feed the Schedule cast list and Call Sheet crew (one source of truth);
  "Pull from Contacts" imports your whole crew into a call sheet at once.
- PDF export for call sheets, the shot list, and the storyboard (File ▸ Export PDF).
- Undo/redo in every grid (Ctrl+Z / Ctrl+Shift+Z) routed to the active tab.
- Autosave every 30s; recovers unsaved work to ~/.scrivenlight_recovery.slt.
- "Generate from Script" no longer duplicates rows when clicked again.

## Smart autofill (Storyboard)

When you add a new storyboard frame while working on a scene, ScrivenLight fills
in the setup that carries over on a real set, so you only enter what actually
changes shot to shot:

- **Project-wide (set once):** camera body and resolution/codec follow the whole
  project. Change the body and new frames pick it up; existing frames keep theirs.
- **Per-scene (one-time setup, held across coverage):** lens, focal length,
  aperture, filter, frame rate, shutter, ISO, white balance, support/rig, the full
  lighting setup, location, wardrobe/makeup and sound all carry from the previous
  shot *in the same scene*, and reset when you start a new scene.
- **Per-shot (never inherited):** shot size, camera angle, movement, subject,
  description, VFX, props, takes, time and notes are unique to each setup.

"Add Frame" assumes the new frame belongs to the scene you're on and auto-numbers
the next shot. Anything you've explicitly set is never overwritten.
