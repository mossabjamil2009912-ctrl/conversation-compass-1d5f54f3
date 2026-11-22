#!/usr/bin/env bash
# Build the Windows launcher: desktop/launcher.c -> ACTES-CRM.exe (64-bit).
# Needs zig (run through `nix run nixpkgs#zig`) and Pillow for the icon.
#
#   bash desktop/build.sh [output-dir]     # default output dir: /tmp/launch
#
# The launcher opens the published app in its own browser window (no address
# bar) using the Edge/Chrome already installed on the machine, so the installed
# copy always shows the newest published version.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-/tmp/launch}"
mkdir -p "$OUT"

# 1. multi-size .ico from the PWA icon
ICO_ROOT="$ROOT" ICO_OUT="$OUT/actes.ico" python3 - <<'PY'
import os
from PIL import Image
src = os.path.join(os.environ["ICO_ROOT"], "public", "icon-512.png")
Image.open(src).convert("RGBA").save(
    os.environ["ICO_OUT"], sizes=[(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)]
)
PY

# 2. embed the icon as a Windows resource
printf '#include <windows.h>\nIDI_ICON1 ICON "actes.ico"\n' > "$OUT/actres.rc"
(cd "$OUT" && nix run nixpkgs#zig -- rc actres.rc actes.res)

# 3. compile: GUI subsystem (no console window), wWinMain entry point
(cd "$OUT" && nix run nixpkgs#zig -- cc -target x86_64-windows-gnu -O2 -municode -Wl,--subsystem,windows \
  "$ROOT/desktop/launcher.c" -o ACTES-CRM.exe actes.res -lshell32 -luuid -lole32)

echo "built: $OUT/ACTES-CRM.exe"
