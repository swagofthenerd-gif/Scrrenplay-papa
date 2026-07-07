# lightplot v2 — manual QA checklist

Hands-on session items. These judge things automated tests can't: drag-feel,
label legibility, and dialog flow. Launch with `python -m lightplot --gui`.

## Editor — direct manipulation
- [ ] Drag a **light** and confirm it re-aims at the primary subject live; undo restores the exact pre-drag position.
- [ ] Drag a **subject**, a **camera**, and a **set element** (walls translate whole); undo each.
- [ ] Zoom with the wheel, pan, and **Fit** re-frames everything.
- [ ] Toggle **Snap** off and confirm free placement; on, confirm 25 cm grid snapping.

## Tools
- [ ] Place each set element with two clicks: **wall, door, window, flag, furniture** — each looks right (window dashed, furniture as a box).
- [ ] **Esc** cancels a pending tool (no stray element created).
- [ ] Draw a **move arrow**: select a subject, click waypoints, double-click to commit; arrowhead points the right way.
- [ ] **Ctrl+D** duplicates a selected light, offset by ~0.5 m.

## Guards
- [ ] Delete is refused for the **camera** and for the **last remaining subject**.
- [ ] Deleting a non-primary subject also removes its move arrows; deleting the primary reassigns primary to another subject.

## Properties panel
- [ ] Selecting each kind (light/subject/camera/set/move/plot) shows the right form.
- [ ] Editing any field updates the diagram and is undoable.
- [ ] Each **CT preset** (Tungsten/Daylight/Warm practical/Cool window) changes the light's rendered color.
- [ ] Setting a subject **Primary** clears primary from the others (exactly one).

## Starting points
- [ ] Each **template** loads and reads correctly in the breakdown.
- [ ] **Analyze a real still** — heuristic backend; then Claude backend if credentials are present.
- [ ] **Describe the look** dialog: with a credential drafts a rig; without one, shows the friendly "start from a template" message (no crash).

## Files & exports
- [ ] **Save** a `.lightplot.json`, start Blank, then **Open** it back — identical.
- [ ] Open a **malformed** `.lightplot.json` — status shows a warning, editor keeps a valid blank plot, no crash.
- [ ] Export and open in a viewer: **SVG**, **PNG**, **Side-by-side PNG** (needs a reference image), **PDF contact sheet**.

## ScrivenLight integration
- [ ] In the Storyboard tab **Lighting** section, **Open Light Plot…** on a frame; save and confirm the lighting text fields autofill **only where empty** (a value you pre-typed stays).
- [ ] Reopen the same frame's plot and confirm your edits persisted.
- [ ] With a frame that has a still and no plot yet, **Analyze frame still** inside the dialog.
- [ ] **Export Lighting PDF…** produces a contact sheet of all frames carrying plots; with none, shows the info message.
- [ ] Open an **old `.slt`** project with no light plots — loads fine, no errors.
