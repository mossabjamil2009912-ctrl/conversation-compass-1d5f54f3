// Manual Capacitor update: reads {serviceUrl}/app-updates/latest.json and applies a newer zip bundle.
export const SERVICE_URL_KEY = "service-url";
export const DEFAULT_SERVICE_URL = "https://actes-crm.lovable.app";
export const LOCAL_VERSION_KEY = "bundle-version";

export type Manifest = { version: string; path: string; checksum: string };

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function normalizeServiceUrl(u: string): string {
  const url = new URL(u.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("الرابط يجب أن يبدأ بـ https://");
  return url.origin + url.pathname.replace(/\/+$/, "");
}

export function getServiceUrl(): string {
  return localStorage.getItem(SERVICE_URL_KEY) || DEFAULT_SERVICE_URL;
}
export function setServiceUrl(u: string): string {
  const n = normalizeServiceUrl(u);
  localStorage.setItem(SERVICE_URL_KEY, n);
  return n;
}

async function native() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  return CapacitorUpdater;
}

// Call once on app start so the plugin keeps the applied bundle instead of rolling back.
export async function markAppReady() {
  try { await (await native())?.notifyAppReady(); } catch { /* web */ }
}

export type Status = "checking" | "downloading" | "latest" | "applying" | "error";

export async function runManualUpdate(onStatus: (s: Status, info?: string) => void) {
  onStatus("checking");
  const base = getServiceUrl();
  const res = await fetch(`${base}/app-updates/latest.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`تعذر جلب ملف التحديث (${res.status})`);
  const m = (await res.json()) as Manifest;
  if (!m.version || !m.path) throw new Error("ملف latest.json غير صالح");
  const updater = await native();
  const current = updater ? (await updater.current()).bundle.version : localStorage.getItem(LOCAL_VERSION_KEY) || "0.0.0";
  const local = current === "builtin" ? "0.0.0" : current;
  if (compareVersions(m.version, local) <= 0) { onStatus("latest", local); return; }
  if (!updater) { onStatus("error", "التحديث اليدوي يعمل داخل تطبيق أندرويد فقط"); return; }
  onStatus("downloading", m.version);
  const url = new URL(m.path, base + "/").toString();
  const bundle = await updater.download({ url, version: m.version, checksum: m.checksum });
  onStatus("applying", m.version);
  await updater.set({ id: bundle.id });
}
