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
