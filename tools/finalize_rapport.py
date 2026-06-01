# -*- coding: utf-8 -*-
"""Copie Rapport_generated.docx vers Rapport.docx lorsque le fichier n'est plus verrouillé."""
import os
import shutil
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "Rapport_generated.docx")
DST = os.path.join(ROOT, "docs", "Rapport.docx")


def main():
    if not os.path.isfile(SRC):
        print(f"Source introuvable : {SRC}")
        print("Exécutez d'abord : py -3 tools/generate_rapport.py")
        return 1
    for attempt in range(1, 11):
        try:
            shutil.copy2(SRC, DST)
            print(f"OK — {DST} ({os.path.getsize(DST)} octets)")
            return 0
        except PermissionError:
            print(f"Tentative {attempt}/10 : {DST} verrouillé — fermez Word/Cursor puis réessayez…")
            time.sleep(2)
    print("Échec : fermez le fichier Rapport.docx puis relancez ce script.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
