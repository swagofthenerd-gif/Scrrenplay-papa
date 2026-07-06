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
