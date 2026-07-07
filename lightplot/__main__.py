"""CLI entry point.

    python -m lightplot image.jpg                 # writes image-lightplot.svg
    python -m lightplot image.jpg -o plot.svg --json rig.json
    python -m lightplot image.jpg --backend claude
    python -m lightplot --gui [image.jpg]         # launch the desktop app
"""
from __future__ import annotations

import argparse
import os
import sys


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="lightplot",
        description="Visualize an image's lighting setup as a god's-eye light plot.")
    parser.add_argument("image", nargs="?", help="reference image to analyze")
    parser.add_argument("-o", "--output", help="output SVG path "
                        "(default: <image>-lightplot.svg)")
    parser.add_argument("--json", help="also write the parametric rig as JSON")
    parser.add_argument("--backend", choices=["auto", "heuristic", "claude"],
                        default="auto", help="analysis backend (default: auto)")
    parser.add_argument("--gui", action="store_true", help="launch the GUI")
    args = parser.parse_args(argv)

    if args.gui:
        from .gui import main as gui_main
        gui_main([sys.argv[0]] + ([args.image] if args.image else []))
        return 0

    if not args.image:
        parser.error("an image path is required (or use --gui)")
    if not os.path.isfile(args.image):
        parser.error(f"no such file: {args.image}")

    from .analyze import analyze
    from .diagram import save_svg

    rig = analyze(args.image, backend=args.backend)
    out = args.output or f"{os.path.splitext(args.image)[0]}-lightplot.svg"
    save_svg(rig, out)
    print(f"[{rig.analyzer}] {rig.summary}")
    print(f"wrote {out}")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            f.write(rig.to_json())
        print(f"wrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
