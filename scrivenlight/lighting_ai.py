"""
Phase-2 hook: draft a lighting plan from a reference frame.

This is optional and gated. When an Anthropic API key is available (env var
ANTHROPIC_API_KEY) and the `anthropic` package is installed, `draft_from_image`
sends the still to a vision model and asks it to estimate the lighting setup —
returning fixtures in the same normalized schema the diagram uses, plus a short
set-notes paragraph. Without a key/SDK it raises NotConfigured with a clear
message, so the UI degrades gracefully to the manual (Phase-1) workflow.

The output is an *estimate*, a starting point the DP refines — never treated as
measured truth.
"""

import base64
import json
import os

from .project import FIXTURE_TYPES, new_fixture

_VALID_TYPES = set(FIXTURE_TYPES.keys())
_MODEL = os.environ.get("SCRIVENLIGHT_VISION_MODEL", "claude-sonnet-5")

_PROMPT = """You are a cinematographer analysing a single film still to reverse-engineer its lighting.
Return ONLY JSON (no prose) of the form:
{"fixtures":[{"type","label","modifier","intensity","gel","notes","x","y"}],"set_notes":"..."}
Rules:
- "type" MUST be one of: key, fill, back, diffusion, practical, flag, ambient.
- x,y are the fixture's position in a TOP-DOWN plan, each 0..1. The subject sits
  near (0.5,0.5) and the camera at the bottom (0.5,0.86); the background/top of
  frame is y≈0.15. Place the key on the side the light clearly comes from.
- Infer hardness/softness (modifier), relative level (intensity, e.g. "Key",
  "-1 stop", "50%"), and colour (gel, e.g. "Warm (practical)", "1/4 CTO").
- Include negative-fill flags where the shadow side is deliberately deep.
- "set_notes": 1-2 sentences on the motivation and mood. Keep it tight."""


class NotConfigured(RuntimeError):
    pass


def available():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
        return True
    except ImportError:
        return False


def draft_from_image(path):
    """Return (fixtures, set_notes). Raises NotConfigured when the AI backend
    isn't set up, or RuntimeError on a request/parse failure."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise NotConfigured(
            "AI drafting needs an Anthropic API key.\n\n"
            "Set ANTHROPIC_API_KEY in your environment and install the SDK "
            "(pip install --user anthropic), then restart ScrivenLight.\n\n"
            "Meanwhile you can build the plan by hand — that's the primary "
            "workflow, and the AI only ever proposes a starting point.")
    try:
        import anthropic
    except ImportError:
        raise NotConfigured(
            "The 'anthropic' package isn't installed.\n"
            "Install it with:  pip install --user anthropic")

    media_type = _media_type(path)
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("ascii")

    client = anthropic.Anthropic()
    msg = client.messages.create(
        model=_MODEL,
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64", "media_type": media_type, "data": data}},
                {"type": "text", "text": _PROMPT},
            ],
        }],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    return _parse(text)


def _parse(text):
    text = text.strip()
    # tolerate a ```json fence
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise RuntimeError("The model didn't return usable JSON.")
    payload = json.loads(text[start:end + 1])

    fixtures = []
    for raw in payload.get("fixtures", []):
        ftype = str(raw.get("type", "")).strip().lower()
        if ftype not in _VALID_TYPES:
            ftype = "key"
        fx = new_fixture(ftype,
                         _clamp(raw.get("x", 0.5)), _clamp(raw.get("y", 0.35)))
        for k in ("modifier", "intensity", "gel", "notes"):
            v = raw.get(k)
            if v:
                fx[k] = str(v)
        if raw.get("label"):
            fx["label"] = str(raw["label"])
        fixtures.append(fx)
    return fixtures, str(payload.get("set_notes", "")).strip()


def _clamp(v):
    try:
        return max(0.0, min(1.0, float(v)))
    except (TypeError, ValueError):
        return 0.5


def _media_type(path):
    ext = os.path.splitext(path)[1].lower()
    return {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "image/jpeg")
