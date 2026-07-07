"""Shared test helpers: controlled synthetic images with known lighting."""
import math

import numpy as np
from PIL import Image


def synthetic_portrait(key_side: str = "left", softness: float = 0.5,
                       ratio: float = 4.0, size: int = 256) -> Image.Image:
    """Render a fake 'lit sphere on dark background' portrait.

    key_side: 'left' or 'right' — the bright side OF THE IMAGE.
    softness: 0..1 — controls shading falloff steepness.
    ratio:    bright/dark luminance ratio on the subject.
    """
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    cx = cy = (size - 1) / 2.0
    r = size * 0.32
    d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / r ** 2
    sphere = d2 < 1.0

    # Lambertian-ish shading from a light on one side, above eye line.
    lx = -1.0 if key_side == "left" else 1.0
    nx = (xx - cx) / r
    ny = (yy - cy) / r
    lam = np.clip(nx * lx + ny * -0.4 + 0.55, 0.0, 1.6)
    # softness flattens the curve (soft light wraps)
    gamma = 2.4 - 1.8 * softness
    shade = np.clip(lam, 0, 1) ** gamma
    lo = 1.0 / ratio
    shade = lo + (1.0 - lo) * shade

    img = np.full((size, size, 3), 0.06)          # dark background
    for c in range(3):
        img[..., c][sphere] = shade[sphere]
    img[..., 2] *= 0.92                            # slightly warm
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGB")
