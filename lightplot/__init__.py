"""lightplot — visualize the lighting setup of an image as a god's-eye light plot.

Part of the Papa Pre Production suite. Analyze a reference image (offline
CV heuristics, or Claude vision when available), get back a parametric
LightingRig, and render it as an overhead set diagram a DOP can read.

Quick use:
    from lightplot import analyze, render_svg
    rig = analyze("still.jpg")
    open("plot.svg", "w").write(render_svg(rig))

GUI (standalone now, embeddable in ScrivenLight later):
    python -m lightplot --gui
"""
from .rig import LightSource, LightingRig
from .analyze import analyze, analyze_image
from .diagram import render_svg, save_svg

__version__ = "0.1.0"
__all__ = ["LightSource", "LightingRig", "analyze", "analyze_image",
           "render_svg", "save_svg"]
