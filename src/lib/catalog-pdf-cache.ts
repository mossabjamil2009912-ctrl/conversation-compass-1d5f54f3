// Keeps every opened catalog PDF on the device (Cache Storage), keyed by catalog id,
// so it reopens instantly and works with no internet.
const CACHE = "catalog-pdfs";
const keyOf = (id: string) => `/__catalog-pdf/${id}`;

export async function loadCatalogPdf(id: string, remoteUrl: string | null): Promise<Blob | null> {
  if (typeof caches === "undefined") return remoteUrl ? fetchBlob(remoteUrl) : null;
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(keyOf(id));
    if (hit) return await hit.blob();
    if (!remoteUrl) return null;
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    await cache.put(keyOf(id), new Response(blob, { headers: { "Content-Type": "application/pdf" } }));
    return blob;
  } catch {
    return remoteUrl ? fetchBlob(remoteUrl) : null;
  }
}

async function fetchBlob(url: string) {
  try { const r = await fetch(url); return r.ok ? await r.blob() : null; } catch { return null; }
}
