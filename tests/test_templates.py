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
