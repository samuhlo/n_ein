"""Contrast independent witnesses on frozen trees; never modify the source repo.

Uses the dependency installations already present in Prelo only for imports.
All project files and temporary state live in this bank's ignored directory.
"""
import ast
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import io

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(os.environ.get("PRELO_SOURCE", Path.home() / "Documents/01_Proyectos/prelo"))
BANK = ROOT / ".n_ein/prelo-bench-20261027"
PRS = {p["number"]: p for p in json.loads((Path(__file__).parent / "manifest.json").read_text())["prs"]}


def snapshot(number, side):
    dest = BANK / "validation" / f"pr-{number}-{side}"
    dest.mkdir(parents=True, exist_ok=True)
    archive = subprocess.check_output(["git", "-C", str(SOURCE), "archive", PRS[number][side]])
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        bundle.extractall(dest, filter="data")
    modules = dest / "plugin/node_modules"
    if not modules.exists():
        modules.symlink_to(SOURCE / "plugin/node_modules", target_is_directory=True)
    return dest


def plugin_witness(number, finding_index, side):
    local = BANK / "baseline-live" / f"pr-{number}.json"
    origin = json.loads(local.read_text()) if local.exists() else next(
        row for row in map(json.loads, (Path(__file__).parent / "results/baseline-live.jsonl").read_text().splitlines()) if row["pr"] == number)
    probe = origin["findings"][finding_index]["probe"]
    dest = snapshot(number, side)
    script = dest / probe["file"]
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text(probe["source"])
    result = subprocess.run(["node", "--test", str(script)], cwd=dest, text=True, capture_output=True, timeout=30)
    return {"pr": number, "side": side, "exit": result.returncode, "output": result.stdout + result.stderr,
            "witness": probe["file"], "source": probe["source"]}


def numeric_witness(side):
    """Execute the actual literal-check functions, without loading any AI provider."""
    source = subprocess.check_output(["git", "-C", str(SOURCE), "show", f"{PRS[6][side]}:server/margen/editor.py"], text=True)
    tree = ast.parse(source)
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in {"required_tokens", "missing_tokens"}
             or isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "TOKEN" for t in n.targets)]
    namespace = {"re": re}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "editor.py", "exec"), namespace)
    examples = [("Temperatura: 5 grados.", "Temperatura: -5 grados."),
                ("El valor es -5.", "El valor es 5."),
                ("El puerto es 8080.", "El puerto es 18080.")]
    return {"pr": 6, "side": side, "numeric_cases": [
        {"source": a, "written": b, "missing": namespace["missing_tokens"](a, b)} for a, b in examples]}


def redelivery_witness(side):
    source = subprocess.check_output(["git", "-C", str(SOURCE), "show", f"{PRS[3][side]}:server/margen/library.py"], text=True)
    tree = ast.parse(source)
    namespace = {}
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "on_kobo"], type_ignores=[]), "library.py", "exec"), namespace)
    result = namespace["on_kobo"]({"id": "edition", "delivery": "sent", "delivered_at": "2026-10-27T10:01:00+00:00"},
                                   {"edition": {"present": False}}, {"at": "2026-10-27T10:00:00+00:00"})
    return {"pr": 3, "side": side, "redelivery_status": result, "expected": "copied"}


if __name__ == "__main__":
    results = []
    for side in ["base", "head"]:
        results.extend([plugin_witness(1, 0, side), plugin_witness(3, 0, side), numeric_witness(side), redelivery_witness(side)])
    target = BANK / "validation/results.json"
    target.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    for result in results:
        print({k: v for k, v in result.items() if k not in {"output", "source"}})
    print(target)
