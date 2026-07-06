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
