import json

import pytest

from lightplot.analyze import analyze_image
from lightplot.rig import LightingRig, ROLE_KEY
from tests.conftest import synthetic_portrait


def key_of(rig):
    return next(l for l in rig.lights if l.role == ROLE_KEY)


def test_key_direction_left_lit_image():
    # bright IMAGE-LEFT => light from camera LEFT => positive azimuth (v1 convention)
    rig = analyze_image(synthetic_portrait(key_side="left", ratio=6.0))
    assert key_of(rig).azimuth_deg > 10


def test_key_direction_right_lit_image():
    rig = analyze_image(synthetic_portrait(key_side="right", ratio=6.0))
    assert key_of(rig).azimuth_deg < -10


def test_softness_ordering():
    soft = analyze_image(synthetic_portrait(softness=0.9, ratio=2.0))
    hard = analyze_image(synthetic_portrait(softness=0.1, ratio=8.0))
    assert key_of(soft).softness > key_of(hard).softness


def test_ratio_ordering():
    flat = analyze_image(synthetic_portrait(ratio=1.5))
    contrasty = analyze_image(synthetic_portrait(ratio=10.0))
    flat_r = float(flat.key_fill_ratio.split(":")[0])
    con_r = float(contrasty.key_fill_ratio.split(":")[0])
    assert con_r > flat_r


def test_rig_json_round_trip():
    rig = analyze_image(synthetic_portrait())
    rig2 = LightingRig.from_json(rig.to_json())
    assert rig2.to_dict() == rig.to_dict()
    assert json.loads(rig.to_json())["analyzer"] == "heuristic"


def test_every_light_has_confidence_and_valid_role():
    rig = analyze_image(synthetic_portrait())
    from lightplot.rig import ROLES
    for l in rig.lights:
        assert l.role in ROLES
        assert 0.0 <= l.confidence <= 1.0
