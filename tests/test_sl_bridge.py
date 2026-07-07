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
