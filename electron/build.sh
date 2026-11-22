#!/usr/bin/env bash
# Package electron/ as a Windows x64 app: bash electron/build.sh [outdir]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${1:-/tmp/electron-build}"
rm -rf "$OUT"; mkdir -p "$OUT/work"; cp "$ROOT"/electron/{main.cjs,package.json,icon.png} "$OUT/work/"
cd "$OUT"; npm init -y >/dev/null; npm i --silent @electron/packager resedit pe-library
npx @electron/packager work "ACTES-CRM" --platform=win32 --arch=x64 --electron-version=33.2.1 --out=dist --overwrite
python3 -c "from PIL import Image; Image.open('work/icon.png').convert('RGBA').save('actes.ico',sizes=[(256,256),(64,64),(48,48),(32,32),(16,16)])"
node -e '
const fs=require("fs"),ResEdit=require("resedit"),PE=require("pe-library");
const f="dist/ACTES-CRM-win32-x64/ACTES-CRM.exe";
const exe=PE.NtExecutable.from(fs.readFileSync(f)),res=PE.NtExecutableResource.from(exe);
const ico=ResEdit.Data.IconFile.from(fs.readFileSync("actes.ico"));
const g=ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries,g.id,g.lang,ico.icons.map(i=>i.data));
const v=ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
v.setStringValues({lang:1033,codepage:1200},{ProductName:"ACTES CRM",FileDescription:"ACTES CRM",CompanyName:"ACTES"});
v.outputToResourceEntries(res.entries);res.outputResource(exe);fs.writeFileSync(f,Buffer.from(exe.generate()));'
(cd dist && nix run nixpkgs#zip -- -qr ../ACTES-CRM-Electron-Windows.zip ACTES-CRM-win32-x64)
echo "$OUT/ACTES-CRM-Electron-Windows.zip"
