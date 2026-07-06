"""Optional Claude-vision analyzer.

When the `anthropic` package is installed and a credential is available
(ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile),
this backend sends the image to Claude with a cinematography-specific
prompt and a strict JSON schema, and returns a LightingRig. It is far
better than the heuristic at multi-light scenes, motivated/practical
sources, and unusual framings. Falls back cleanly when unavailable.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os

from .rig import LightSource, LightingRig

MODEL = "claude-opus-4-8"

_LIGHT_SCHEMA = {
    "type": "object",
    "properties": {
        "role": {"type": "string",
                 "enum": ["key", "fill", "rim", "background", "practical"]},
        "azimuth_deg": {"type": "number"},
        "elevation_deg": {"type": "number"},
        "distance_m": {"type": "number"},
        "softness": {"type": "number"},
        "intensity": {"type": "number"},
        "color_temp_k": {"type": "integer"},
        "color_hex": {"type": "string"},
        "modifier": {"type": "string"},
        "confidence": {"type": "number"},
        "notes": {"type": "string"},
    },
    "required": ["role", "azimuth_deg", "elevation_deg", "distance_m",
                 "softness", "intensity", "color_temp_k", "color_hex",
                 "modifier", "confidence", "notes"],
    "additionalProperties": False,
}

_RIG_SCHEMA = {
    "type": "object",
    "properties": {
        "lights": {"type": "array", "items": _LIGHT_SCHEMA},
        "key_fill_ratio": {"type": "string"},
        "mood": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["lights", "key_fill_ratio", "mood", "summary"],
    "additionalProperties": False,
}

_PROMPT = """You are a director of photography analyzing the lighting of this \
image so another DOP can reproduce the look on set.

Estimate a plausible lighting rig. Conventions:
- azimuth_deg: seen from above (god's-eye view). 0 = light at the camera \
position (frontal), positive = camera LEFT, negative = camera RIGHT, \
+/-180 = directly behind the subject.
- elevation_deg: 0 = subject eye level, 90 = directly overhead, negative = below.
- distance_m: plausible distance in meters (a suggestion, not a measurement).
- softness: 0 = hard point source, 1 = very large soft wrapping source.
- intensity: relative output, key light = 1.0.
- color_temp_k: correlated color temperature; use color_hex only for a strong \
gel/tint, otherwise "".
- modifier: the unit you'd use (e.g. "4x4 book light", "fresnel with barn \
doors", "practical lamp in frame", "bounce board").
- confidence: how sure you are this source exists as described.

List each distinct source (key, fill, rim/back, background, practicals). If \
the fill is just ambient bounce, still list it with a low intensity and say so \
in notes. key_fill_ratio like "4:1". Keep summary to 2-3 sentences of DOP \
language, and honest about ambiguity (a big source far away can read like a \
small one close up)."""


def claude_available() -> bool:
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    # `ant auth login` profile on disk also works with a zero-arg client
    cfg = os.environ.get("ANTHROPIC_CONFIG_DIR",
                         os.path.expanduser("~/.config/anthropic"))
    return os.path.isdir(os.path.join(cfg, "credentials"))


def analyze_with_claude(path: str) -> LightingRig:
    import anthropic

    media_type = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        output_config={"format": {"type": "json_schema", "schema": _RIG_SCHEMA}},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image",
                 "source": {"type": "base64", "media_type": media_type,
                            "data": data}},
                {"type": "text", "text": _PROMPT},
            ],
        }],
    )
    text = next(b.text for b in response.content if b.type == "text")
    payload = json.loads(text)

    rig = LightingRig(
        lights=[LightSource(**l) for l in payload["lights"]],
        key_fill_ratio=payload["key_fill_ratio"],
        mood=payload["mood"],
        summary=payload["summary"],
        source_image=os.path.basename(path),
        analyzer=f"claude ({MODEL})",
    )
    return rig
