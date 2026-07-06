import subprocess
import sys

from tests.conftest import synthetic_portrait


def test_cli_writes_svg_and_json(tmp_path):
    img = tmp_path / "still.png"
    synthetic_portrait().save(img)
    svg = tmp_path / "plot.svg"
    rig_json = tmp_path / "rig.json"
    res = subprocess.run(
        [sys.executable, "-m", "lightplot", str(img), "-o", str(svg),
         "--json", str(rig_json), "--backend", "heuristic"],
        capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    assert svg.read_text().startswith("<svg")
    assert '"lights"' in rig_json.read_text()
