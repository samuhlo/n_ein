"""Witness for Prelo PR 2's missing upload: distinguish a fixed precondition.

Run inside a disposable Prelo checkout. No reader, server or private library.
"""
import io
import json
from pathlib import Path
import runpy
import tempfile
import zipfile
from margen import kobo, library


def result(outcome, reason):
    print("NEIN_PROBE_RESULT " + json.dumps({"check": "pending-upload-recoverability", "outcome": outcome, "reason": reason}))
    raise SystemExit(1 if outcome == "reproduced" else 2 if outcome == "error" else 0)


try:
    with tempfile.TemporaryDirectory() as scratch:
        root = Path(scratch) / "library"
        root.mkdir()
        library.save_inventory(root, {"device": "A", "books": []})
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("mimetype", "application/epub+zip")
            archive.writestr("META-INF/container.xml", "<container/>")
        command = kobo.upload(root, "synthetic.epub", data.getvalue(), "A")
        restored = Path(scratch) / "restored"
        runpy.run_path("scripts/restore_backup.py")["restore"](library.backup(root), restored)
        uploaded = restored / ".uploads" / (command["id"] + ".epub")
        if uploaded.exists():
            if uploaded.read_bytes() != data.getvalue():
                result("error", "El escenario cambió y el archivo restaurado tiene otros bytes.")
            result("not_applicable", "El backup ya conserva el EPUB: no existe la ausencia de archivo que activaba esta sonda.")
        kobo.claim(restored, command["id"], "A")
        try:
            kobo.cancel(restored, command["id"])
        except ValueError:
            state = next(row["state"] for row in kobo.listing(restored) if row["id"] == command["id"])
            if state == "executing":
                result("reproduced", "La subida restaurada no tiene archivo, sigue en ejecución y no se puede cancelar.")
            result("error", "La cancelación falló por una condición distinta de la comprobada.")
        result("passed", "La orden sin archivo se puede cancelar.")
except Exception as error:
    result("error", f"No se pudo preparar o ejecutar el escenario: {error}")
