import json
from unittest import mock

import pytest

from lightplot.rig import LightingRig


FAKE_PAYLOAD = {
    "lights": [{"role": "key", "azimuth_deg": 60.0, "elevation_deg": 20.0,
                "distance_m": 1.8, "softness": 0.4, "intensity": 1.0,
                "color_temp_k": 2700, "color_hex": "", "modifier": "LED panel",
                "confidence": 0.8, "notes": "motivated by practical"}],
    "key_fill_ratio": "8:1", "mood": "low-key",
    "summary": "Warm low-key single source."}


def test_describe_to_rig_parses_response(monkeypatch):
    anthropic = pytest.importorskip("anthropic")
    from lightplot import claude_backend

    block = mock.Mock(type="text", text=json.dumps(FAKE_PAYLOAD))
    client = mock.Mock()
    client.messages.create.return_value = mock.Mock(content=[block])
    monkeypatch.setattr(claude_backend, "claude_available", lambda: True)
    with mock.patch.object(claude_backend.anthropic_module(), "Anthropic",
                           return_value=client):
        rig = claude_backend.describe_to_rig("warm low-key night interior")
    assert isinstance(rig, LightingRig)
    assert rig.lights[0].color_temp_k == 2700
    assert rig.analyzer.startswith("claude")
    # the description must be in the request
    sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert any("night interior" in c.get("text", "") for c in sent)


def test_describe_raises_cleanly_when_unavailable(monkeypatch):
    from lightplot import claude_backend
    monkeypatch.setattr(claude_backend, "claude_available", lambda: False)
    with pytest.raises(RuntimeError, match="not available"):
        claude_backend.describe_to_rig("anything")
