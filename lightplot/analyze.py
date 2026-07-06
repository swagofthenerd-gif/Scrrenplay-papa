"""Heuristic single-image lighting analysis.

Estimates a plausible lighting rig from one photograph using classic
image statistics — no network, no API key, runs anywhere Pillow and
numpy run. It is intentionally framed as "a setup that would reproduce
this look", not a forensic reconstruction: distance and wattage are
ill-posed from a single image, but direction, softness, contrast ratio
and color temperature are recoverable with useful confidence.

Pipeline
--------
1. Downscale, build a luminance map.
2. Weight a subject region (center-weighted ellipse — portraits and
   interview frames put the subject near center; documented limitation).
3. Key direction  : luminance-weighted centroid of the subject region
                    gives the image-plane light vector; the key/fill
                    contrast ratio sets how far off-axis the key sits.
4. Elevation      : vertical component of the same centroid.
5. Softness       : gradient statistics — hard light produces steep
                    shading gradients and crushed shadow edges.
6. Ratio          : bright-half vs dark-half mean luminance.
7. Color temp     : mean chromaticity of the highlight percentile,
                    mapped to CCT with McCamy's approximation.
8. Rim light      : bright band along the subject's edges vs its interior.
9. Background     : border-region luminance and tint, as its own source.
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image

from .rig import (LightSource, LightingRig, ROLE_KEY, ROLE_FILL, ROLE_RIM,
                  ROLE_BACKGROUND)

ANALYSIS_SIZE = 256  # longest edge used for analysis


# ---------------------------------------------------------------- helpers
def _load(path_or_image) -> np.ndarray:
    """Return float RGB array in [0,1], downscaled for analysis."""
    img = path_or_image if isinstance(path_or_image, Image.Image) \
        else Image.open(path_or_image)
    img = img.convert("RGB")
    img.thumbnail((ANALYSIS_SIZE, ANALYSIS_SIZE), Image.LANCZOS)
    return np.asarray(img, dtype=np.float64) / 255.0


def _luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def _subject_mask(h: int, w: int) -> np.ndarray:
    """Center-weighted ellipse — a soft prior on where the subject is."""
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx = (h - 1) / 2.0, (w - 1) / 2.0
    ry, rx = h * 0.38, w * 0.32
    d = ((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2
    return np.clip(1.0 - d, 0.0, 1.0)


def _cct_from_rgb(rgb_mean: np.ndarray) -> int:
    """Correlated color temperature via CIE xy + McCamy's formula."""
    r, g, b = np.clip(rgb_mean, 1e-6, 1.0)
    # linearize (approx sRGB gamma)
    r, g, b = (v ** 2.2 for v in (r, g, b))
    X = 0.4124 * r + 0.3576 * g + 0.1805 * b
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Z = 0.0193 * r + 0.1192 * g + 0.9505 * b
    s = X + Y + Z
    if s < 1e-9:
        return 5600
    x, y = X / s, Y / s
    if abs(y - 0.1858) < 1e-6:
        return 5600
    n = (x - 0.3320) / (0.1858 - y)
    cct = 449.0 * n ** 3 + 3525.0 * n ** 2 + 6823.3 * n + 5520.33
    return int(np.clip(cct, 1800, 12000))


# ---------------------------------------------------------------- analyzer
def analyze_image(path_or_image, source_name: str = "") -> LightingRig:
    rgb = _load(path_or_image)
    h, w = rgb.shape[:2]
    L = _luminance(rgb)
    mask = _subject_mask(h, w)
    mw = mask / mask.sum()

    # --- key direction from luminance-weighted centroid --------------
    yy, xx = np.mgrid[0:h, 0:w]
    xn = (xx - (w - 1) / 2.0) / (w / 2.0)   # -1 left edge .. +1 right edge
    yn = (yy - (h - 1) / 2.0) / (h / 2.0)   # -1 top .. +1 bottom
    Lm = L * mask
    tot = Lm.sum() + 1e-9
    dx = float((Lm * xn).sum() / tot)       # + means bright side is image-right
    dy = float((Lm * yn).sum() / tot)       # - means bright side is image-top

    # --- contrast ratio on the subject -------------------------------
    subj = L[mask > 0.3]
    bright = np.percentile(subj, 80)
    dark = np.percentile(subj, 20)
    ratio = float(bright / max(dark, 1e-3))
    ratio = min(ratio, 32.0)

    # Horizontal off-axis angle: flat ratio => frontal, high ratio => side.
    # Convention (rig.py): positive azimuth = camera left, negative = camera right.
    # dx > 0 means the luminance centroid is image-right → key is camera-right
    # (negative azimuth). dx < 0 → centroid image-left → key is camera-left (positive).
    side_amount = np.clip((ratio - 1.2) / 6.0, 0.0, 1.0)     # 0 flat .. 1 side
    azimuth = -math.copysign(15.0 + 75.0 * side_amount, dx)
    if abs(dx) < 0.005:                                       # symmetric = frontal
        azimuth = 0.0

    # Elevation from the vertical centroid: bright top => high light.
    elevation = float(np.clip(-dy * 180.0 + 20.0, -20.0, 75.0))

    # --- softness: shadow wrap + shadow-edge sharpness -----------------
    # Wrap: soft sources wrap around the subject, shrinking the fraction
    # of the subject that sits near the shadow floor.
    lo, hi = np.percentile(subj, 5), np.percentile(subj, 95)
    Ln = np.clip((subj - lo) / max(hi - lo, 1e-3), 0.0, 1.0)
    dark_frac = float((Ln < 0.25).mean())
    wrap_soft = np.clip(1.0 - (dark_frac - 0.08) / 0.22, 0.0, 1.0)
    # Edge sharpness: hard light also casts crisp shadow edges (strong
    # luminance gradients relative to the subject's tonal range).
    gy, gx_ = np.gradient(L)
    grad = np.sqrt(gx_ ** 2 + gy ** 2)
    sharp = float(np.percentile(grad[mask > 0.3], 99) / max(hi - lo, 1e-3))
    grad_soft = np.clip(1.0 - (sharp - 0.03) / 0.25, 0.0, 1.0)
    softness = float(np.clip(0.7 * wrap_soft + 0.3 * grad_soft, 0.05, 0.95))

    # --- key color temperature from the highlights -------------------
    hi_mask = (L >= np.percentile(L[mask > 0.1], 92)) & (mask > 0.1)
    hi_rgb = rgb[hi_mask].mean(axis=0) if hi_mask.any() else rgb.mean(axis=(0, 1))
    key_ct = _cct_from_rgb(hi_rgb)

    # --- rim / back light --------------------------------------------
    # A rim reads as a bright shell on the side FACING AWAY from the key
    # (checking only the far hemisphere avoids mistaking the key's own
    # bright limb, or a toplight's bright crown, for a rim).
    nrm = max(math.hypot(dx, dy), 1e-6)
    ux, uy = dx / nrm, dy / nrm
    opp = (xn * ux + yn * uy) < 0
    shell = (mask > 0.05) & (mask < 0.35) & opp
    core = (mask > 0.6) & opp
    rim_score = float(np.percentile(L[shell], 90) - np.percentile(L[core], 75)) \
        if shell.any() and core.any() else 0.0
    has_rim = rim_score > 0.02

    # --- background as its own source ---------------------------------
    border = np.ones_like(L, dtype=bool)
    bh, bw = int(h * 0.12), int(w * 0.12)
    border[bh:h - bh, bw:w - bw] = False
    bg_L = float(L[border].mean())
    bg_rgb = rgb[border].mean(axis=0)
    bg_ct = _cct_from_rgb(bg_rgb)

    subj_mean = float((L * mw).sum())
    key_intensity = 1.0

    # ------------------------------------------------------------ rig
    lights = []
    mod = ("book light / large diffusion frame" if softness > 0.75 else
           "softbox / bounced source" if softness > 0.5 else
           "small softbox or diffused fresnel" if softness > 0.25 else
           "fresnel / hard open-face / direct sun")
    lights.append(LightSource(
        role=ROLE_KEY, azimuth_deg=round(azimuth, 1),
        elevation_deg=round(elevation, 1), distance_m=1.5,
        softness=round(softness, 2), intensity=key_intensity,
        color_temp_k=key_ct, modifier=mod,
        confidence=round(float(np.clip(0.45 + abs(dx) * 4 + side_amount * 0.2, 0.3, 0.9)), 2),
        notes="Direction from shading asymmetry; softness from shadow-edge gradients.",
    ))

    # Fill: implied by the ratio. Placed mirror-side, soft and weak.
    fill_intensity = float(np.clip(1.0 / ratio, 0.03, 0.8))
    ratio_label = f"{max(ratio, 1.0):.0f}:1"
    if ratio < 6.0:  # visible fill — include it in the recipe
        lights.append(LightSource(
            role=ROLE_FILL, azimuth_deg=round(-math.copysign(45.0, azimuth or 1.0), 1),
            elevation_deg=10.0, distance_m=2.0,
            softness=0.85, intensity=round(fill_intensity, 2),
            color_temp_k=key_ct, modifier="bounce board / big soft source",
            confidence=0.5,
            notes=f"Implied by {ratio_label} contrast ratio; could equally be ambient bounce.",
        ))

    if has_rim:
        # rim reads opposite the key, behind the subject
        rim_az = math.copysign(150.0, -azimuth if azimuth else 1.0)
        lights.append(LightSource(
            role=ROLE_RIM, azimuth_deg=round(rim_az, 1), elevation_deg=40.0,
            distance_m=2.0, softness=0.25,
            intensity=round(float(np.clip(0.4 + rim_score, 0.3, 1.0)), 2),
            color_temp_k=key_ct, modifier="hard back light / kicker",
            confidence=round(float(np.clip(rim_score * 2.5, 0.3, 0.85)), 2),
            notes="Bright edge separation detected around the subject.",
        ))

    lights.append(LightSource(
        role=ROLE_BACKGROUND, azimuth_deg=180.0, elevation_deg=30.0,
        distance_m=3.0, softness=0.6,
        intensity=round(float(np.clip(bg_L / max(subj_mean, 1e-3), 0.05, 1.2)), 2),
        color_temp_k=bg_ct, modifier="background wash / ambient",
        confidence=0.55,
        notes="Background level relative to subject; may be ambient rather than a dedicated unit.",
    ))

    # ------------------------------------------------------------ prose
    key = lights[0]
    mood = ("low-key / dramatic" if ratio >= 8 and subj_mean < 0.45 else
            "moody" if ratio >= 4 else
            "high-key / bright" if subj_mean > 0.6 and ratio < 3 else
            "naturalistic")
    summary = (
        f"{key.softness_label().capitalize()} key from {key.position_label()}, "
        f"roughly {ratio_label} key-to-fill — a {mood} look. "
        f"Key reads about {key.ct_label()}."
        + (" A back light gives edge separation." if has_rim else "")
        + " Distances are plausible suggestions, not measurements."
    )

    return LightingRig(
        lights=lights, key_fill_ratio=ratio_label, mood=mood,
        summary=summary,
        source_image=source_name or (path_or_image if isinstance(path_or_image, str)
                                     else getattr(path_or_image, "filename", "") or ""),
        analyzer="heuristic",
    )


def analyze(path: str, backend: str = "auto") -> LightingRig:
    """Entry point used by the CLI/GUI. backend: auto | heuristic | claude."""
    if backend in ("auto", "claude"):
        try:
            from .claude_backend import analyze_with_claude, claude_available
            if claude_available():
                return analyze_with_claude(path)
            if backend == "claude":
                raise RuntimeError(
                    "Claude backend requested but the 'anthropic' package or an "
                    "API credential is not available.")
        except ImportError:
            if backend == "claude":
                raise
    name = os.path.basename(path) if isinstance(path, str) else ""
    return analyze_image(path, source_name=name)
