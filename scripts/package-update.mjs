// Usage: bun run build && node scripts/package-update.mjs 1.1.0
// Zips the built app, computes SHA-256 and writes public/app-updates/latest.json.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import JSZip from "jszip";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) { console.error("أعط رقم إصدار مثل 1.1.0"); process.exit(1); }
const src = existsSync("dist/client") ? "dist/client" : "dist";
const out = "public/app-updates";
mkdirSync(out, { recursive: true });

const zip = new JSZip();
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) { if (relative(src, p) !== "app-updates") walk(p); }
  else zip.file(relative(src, p).replaceAll("\\", "/"), readFileSync(p));
});
walk(src);
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(join(out, `${version}.zip`), buf);
const checksum = createHash("sha256").update(buf).digest("hex");
const manifest = { version, path: `/app-updates/${version}.zip`, checksum };
writeFileSync(join(out, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("latest.json:", manifest);
